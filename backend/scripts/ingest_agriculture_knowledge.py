#!/usr/bin/env python3
"""
Agriculture Knowledge Base Ingestion Script
============================================
Ingests agricultural documents (PDFs, text files, web links) into S3 for AWS Bedrock Knowledge Base.
Features:
- Text extraction from PDFs
- Intelligent chunking for better retrieval
- Preprocessing to remove junk data
- Metadata enrichment

Usage:
    python ingest_agriculture_knowledge.py --source /path/to/pdfs --bucket your-bucket-name
    python ingest_agriculture_knowledge.py --url https://agricoop.nic.in/documents/crop-management.pdf
    python ingest_agriculture_knowledge.py --source-list sources.txt

Dependencies:
    pip install boto3 requests PyPDF2
"""

import argparse
import boto3
import os
import sys
import requests
from pathlib import Path
from typing import List, Optional, Dict
import hashlib
import json
import re
from datetime import datetime, timezone

from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


# Default S3 path for agriculture knowledge (separate from insurance)
DEFAULT_S3_PREFIX = "agriculture-knowledge/"


class AgriKnowledgeIngester:
    def __init__(self, bucket_name: str, s3_prefix: str = DEFAULT_S3_PREFIX, region: str = "ap-south-1", 
                 chunk_size: int = 1000, enable_chunking: bool = True,
                 aws_access_key: Optional[str] = None, aws_secret_key: Optional[str] = None):
        self.bucket_name = bucket_name
        self.s3_prefix = s3_prefix
        self.region = region
        self.chunk_size = chunk_size  # Characters per chunk
        self.enable_chunking = enable_chunking
        
        # Use explicit credentials if provided, otherwise boto3 uses default credential chain
        s3_kwargs = {'region_name': region}
        if aws_access_key and aws_secret_key:
            s3_kwargs['aws_access_key_id'] = aws_access_key
            s3_kwargs['aws_secret_access_key'] = aws_secret_key
            print(f"  🔑 Using provided AWS credentials")
        else:
            print(f"  🔑 Using AWS credential chain (aws configure)")
        
        self.s3_client = boto3.client('s3', **s3_kwargs)
        self.uploaded_files = []
        self.errors = []

    def preprocess_text(self, text: str) -> str:
        """Clean and preprocess extracted text to remove junk data."""
        if not text:
            return ""
        
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove page numbers (common patterns)
        text = re.sub(r'\bPage\s+\d+\s+of\s+\d+\b', '', text, flags=re.IGNORECASE)
        text = re.sub(r'\b\d+\s*/\s*\d+\b', '', text)
        
        # Remove common headers/footers
        text = re.sub(r'Ministry of Agriculture.*?(?=\n|$)', '', text, flags=re.IGNORECASE)
        text = re.sub(r'Government of India.*?(?=\n|$)', '', text, flags=re.IGNORECASE)
        text = re.sub(r'ICAR.*?(?=\n|$)', '', text, flags=re.IGNORECASE)
        
        # Remove URLs and email addresses (often footer junk)
        text = re.sub(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', '', text)
        text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '', text)
        
        # Remove special characters and normalize
        text = re.sub(r'[^\w\s.,;:()\-–—\'\"\u0900-\u097F\u0980-\u09FF]', '', text)  # Keep Devanagari and Bengali scripts
        
        # Remove lines with only numbers or special chars
        lines = text.split('\n')
        cleaned_lines = [line.strip() for line in lines if len(line.strip()) > 20 and not line.strip().isdigit()]
        
        text = ' '.join(cleaned_lines)
        
        # Final cleanup
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text

    def chunk_text(self, text: str, source_name: str) -> List[Dict[str, str]]:
        """Split text into chunks for better retrieval."""
        if not self.enable_chunking or len(text) < self.chunk_size:
            return [{"text": text, "chunk_id": 0, "source": source_name, "char_count": len(text)}]
        
        chunks = []
        words = text.split()
        current_chunk = []
        current_length = 0
        chunk_id = 0
        
        for word in words:
            current_chunk.append(word)
            current_length += len(word) + 1  # +1 for space
            
            if current_length >= self.chunk_size:
                chunk_text = ' '.join(current_chunk)
                chunks.append({
                    "text": chunk_text,
                    "chunk_id": chunk_id,
                    "source": source_name,
                    "char_count": len(chunk_text)
                })
                chunk_id += 1
                current_chunk = []
                current_length = 0
        
        # Add remaining words
        if current_chunk:
            chunk_text = ' '.join(current_chunk)
            chunks.append({
                "text": chunk_text,
                "chunk_id": chunk_id,
                "source": source_name,
                "char_count": len(chunk_text)
            })
        
        return chunks

    def extract_text_from_pdf(self, pdf_path: Path) -> str:
        """Extract text from PDF file."""
        try:
            import PyPDF2
            
            text = ""
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page_num, page in enumerate(pdf_reader.pages):
                    try:
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\n"
                    except Exception as e:
                        print(f"  ⚠ Warning: Could not extract page {page_num + 1}: {str(e)}")
                        continue
            
            return text
        except ImportError:
            print("  ⚠ Warning: PyPDF2 not installed. Install with: pip install PyPDF2")
            return ""
        except Exception as e:
            print(f"  ⚠ Warning: PDF extraction failed: {str(e)}")
            return ""

    def process_and_upload_document(self, file_path: Path, s3_key: Optional[str] = None) -> bool:
        """Process document with text extraction, chunking, and upload."""
        if not s3_key:
            s3_key = f"{self.s3_prefix}{file_path.name}"

        try:
            # Extract text if PDF
            if file_path.suffix.lower() == '.pdf':
                print(f"  📄 Extracting text from PDF...")
                raw_text = self.extract_text_from_pdf(file_path)
                
                if raw_text:
                    # Preprocess text
                    print(f"  🧹 Preprocessing text (removing junk)...")
                    cleaned_text = self.preprocess_text(raw_text)
                    
                    if not cleaned_text:
                        print(f"  ⚠ Warning: No usable text after preprocessing")
                        return self.upload_file(file_path, s3_key)  # Upload original
                    
                    # Chunk text
                    print(f"  ✂️ Chunking text (target: {self.chunk_size} chars/chunk)...")
                    chunks = self.chunk_text(cleaned_text, file_path.name)
                    print(f"  ℹ️ Created {len(chunks)} chunks")
                    
                    # Upload chunks as separate text files
                    base_name = file_path.stem
                    for chunk in chunks:
                        chunk_filename = f"{base_name}_chunk_{chunk['chunk_id']}.txt"
                        chunk_key = f"{self.s3_prefix}chunks/{chunk_filename}"
                        
                        # Upload chunk
                        self.s3_client.put_object(
                            Bucket=self.bucket_name,
                            Key=chunk_key,
                            Body=chunk['text'].encode('utf-8'),
                            ContentType='text/plain',
                            Metadata={
                                'source-file': file_path.name,
                                'chunk-id': str(chunk['chunk_id']),
                                'total-chunks': str(len(chunks)),
                                'char-count': str(chunk['char_count']),
                                'upload-date': datetime.now(timezone.utc).isoformat(),
                            }
                        )
                    
                    print(f"✓ Processed & uploaded: {file_path.name} → {len(chunks)} chunks")
                    self.uploaded_files.append(s3_key)
                    return True
                else:
                    print(f"  ⚠ No text extracted, uploading original file...")
                    return self.upload_file(file_path, s3_key)
            else:
                # For non-PDF files, upload as-is
                return self.upload_file(file_path, s3_key)

        except Exception as e:
            error_msg = f"✗ Failed to process {file_path.name}: {str(e)}"
            print(error_msg)
            self.errors.append(error_msg)
            return False

    def upload_file(self, file_path: Path, s3_key: Optional[str] = None) -> bool:
        """Upload a single file to S3."""
        if not s3_key:
            s3_key = f"{self.s3_prefix}{file_path.name}"

        try:
            # Add metadata for tracking
            metadata = {
                'original-filename': file_path.name,
                'upload-date': datetime.now(datetime.UTC).isoformat(),
                'content-type': self._get_content_type(file_path),
            }

            self.s3_client.upload_file(
                str(file_path),
                self.bucket_name,
                s3_key,
                ExtraArgs={
                    'Metadata': metadata,
                    'ContentType': metadata['content-type']
                }
            )
            
            print(f"✓ Uploaded: {file_path.name} → s3://{self.bucket_name}/{s3_key}")
            self.uploaded_files.append(s3_key)
            return True

        except Exception as e:
            error_msg = f"✗ Failed to upload {file_path.name}: {str(e)}"
            print(error_msg)
            self.errors.append(error_msg)
            return False

    def download_and_upload_url(self, url: str, max_retries: int = 3) -> bool:
        """Download content from URL and upload to S3."""
        for attempt in range(max_retries):
            try:
                if attempt > 0:
                    print(f"  🔄 Retry {attempt}/{max_retries-1}...")
                
                print(f"⬇ Downloading from: {url}")
                response = requests.get(
                    url, 
                    timeout=60, 
                    stream=True, 
                    headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    }
                )
                response.raise_for_status() 
                temp_filename = self._generate_filename_from_url(url)
                temp_path = Path(temp_filename) 
                # Download to temp file
                with open(temp_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)

                # Process and upload
                success = self.process_and_upload_document(temp_path)
                
                # Cleanup
                try:
                    temp_path.unlink()
                except:
                    pass
                
                return success

            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                if attempt < max_retries - 1:
                    print(f"  ⚠ Connection error, retrying...")
                    continue
                else:
                    error_msg = f"✗ Failed to download {url} after {max_retries} attempts: {str(e)}"
                    print(error_msg)
                    self.errors.append(error_msg)
                    return False
            except Exception as e:
                error_msg = f"✗ Failed to download {url}: {str(e)}"
                print(error_msg)
                self.errors.append(error_msg)
                return False
   
    def ingest_directory(self, directory: Path, recursive: bool = True) -> int:
        """Ingest all supported files from a directory."""
        supported_extensions = {'.pdf', '.txt', '.md', '.json', '.csv'}
        count = 0

        pattern = "**/*" if recursive else "*"
        for file_path in directory.glob(pattern):
            if file_path.is_file() and file_path.suffix.lower() in supported_extensions:
                if self.process_and_upload_document(file_path):
                    count += 1

        return count

    def ingest_from_list(self, list_file: Path) -> int:
        """Ingest from a text file containing URLs or file paths (one per line)."""
        count = 0
        
        with open(list_file, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                source = line.strip()
                if not source or source.startswith('#'):
                    continue

                print(f"\n[{line_num}] Processing: {source[:80]}...")
                
                if source.startswith('http://') or source.startswith('https://'):
                    # URL
                    if self.download_and_upload_url(source):
                        count += 1
                else:
                    # File path
                    file_path = Path(source)
                    if file_path.exists() and file_path.is_file():
                        if self.process_and_upload_document(file_path):
                            count += 1
                    else:
                        print(f"✗ File not found: {source}")

        return count

    def create_metadata_json(self) -> str:
        """Create a metadata JSON file with ingestion summary."""
        metadata = {
            "ingestion_date": datetime.now(timezone.utc).isoformat(),
            "bucket": self.bucket_name,
            "s3_prefix": self.s3_prefix,
            "total_files": len(self.uploaded_files),
            "files": self.uploaded_files,
            "errors": self.errors,
        }

        metadata_key = f"{self.s3_prefix}_metadata.json"
        
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=metadata_key,
                Body=json.dumps(metadata, indent=2),
                ContentType='application/json'
            )
            return metadata_key
        except Exception as e:
            print(f"✗ Failed to upload metadata: {e}")
            return ""

    def _get_content_type(self, file_path: Path) -> str:
        """Determine content type from file extension."""
        content_types = {
            '.pdf': 'application/pdf',
            '.txt': 'text/plain',
            '.md': 'text/markdown',
            '.json': 'application/json',
            '.csv': 'text/csv',
            '.html': 'text/html',
        }
        return content_types.get(file_path.suffix.lower(), 'application/octet-stream')

    def _generate_filename_from_url(self, url: str) -> str:
        """Generate a unique filename from URL."""
        # Try to extract filename from URL
        from urllib.parse import urlparse, unquote
        parsed = urlparse(url)
        path = unquote(parsed.path)
        
        if path and '/' in path:
            filename = path.split('/')[-1]
            if filename and '.' in filename:
                return filename
        
        # Fallback: hash-based name
        url_hash = hashlib.md5(url.encode()).hexdigest()[:12]
        extension = '.pdf' if 'pdf' in url.lower() else '.txt'
        return f"download_{url_hash}{extension}"


def main():
    parser = argparse.ArgumentParser(
        description="Ingest agricultural knowledge documents into S3 for AWS Bedrock KB with text extraction and chunking",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Ingest from directory with chunking
  python ingest_agriculture_knowledge.py --source /data/agri-docs --bucket agri-translate-images

  # Ingest from URL
  python ingest_agriculture_knowledge.py --url https://agricoop.nic.in/crop-guide.pdf --bucket agri-translate-images

  # Ingest from list file (recommended - processes 50+ government sources)
  python ingest_agriculture_knowledge.py --source-list agriculture_sources.txt --bucket agri-translate-images

  # Custom chunk size for better retrieval
  python ingest_agriculture_knowledge.py --source-list sources.txt --bucket my-bucket --chunk-size 800

  # Disable chunking (upload original files only)
  python ingest_agriculture_knowledge.py --source /data --bucket my-bucket --no-chunking
        """
    )

    # Define all arguments BEFORE parsing
    parser.add_argument('--source', type=str, help='Directory containing documents to ingest')
    parser.add_argument('--url', type=str, help='Single URL to download and ingest')
    parser.add_argument('--source-list', type=str, help='Text file with URLs/paths (one per line)')
    parser.add_argument('--bucket', type=str, required=True, help='S3 bucket name')
    parser.add_argument('--prefix', type=str, default=DEFAULT_S3_PREFIX, help='S3 key prefix')
    parser.add_argument('--region', type=str, default='ap-south-1', help='AWS region')
    parser.add_argument('--chunk-size', type=int, default=1000, help='Characters per chunk (default: 1000)')
    parser.add_argument('--no-chunking', action='store_true', help='Disable text chunking (upload original files)')
    parser.add_argument('--recursive', action='store_true', default=True, help='Recursively scan directories')
    parser.add_argument('--aws-access-key', type=str, help='AWS Access Key ID (or set AWS_ACCESS_KEY_ID env var)')
    parser.add_argument('--aws-secret-key', type=str, help='AWS Secret Access Key (or set AWS_SECRET_ACCESS_KEY env var)')

    # Parse arguments once
    args = parser.parse_args()

    # Load AWS credentials from environment if not provided as args
    aws_access_key = args.aws_access_key or os.environ.get('AWS_ACCESS_KEY_ID')
    aws_secret_key = args.aws_secret_key or os.environ.get('AWS_SECRET_ACCESS_KEY')

    # Validate input
    if not any([args.source, args.url, args.source_list]):
        parser.error("Must specify one of: --source, --url, or --source-list")

    # Initialize ingester
    print(f"🌾 Agriculture Knowledge Ingester v2.0")
    print(f"{'='*60}")
    print(f"📦 S3 Bucket: {args.bucket}")
    print(f"📂 S3 Prefix: {args.prefix}")
    print(f"🌍 Region: {args.region}")
    print(f"✂️  Chunking: {'Enabled' if not args.no_chunking else 'Disabled'}")
    if not args.no_chunking:
        print(f"📏 Chunk Size: {args.chunk_size} characters")
    print(f"{'='*60}\n")

    ingester = AgriKnowledgeIngester(
        bucket_name=args.bucket,
        s3_prefix=args.prefix,
        region=args.region,
        chunk_size=args.chunk_size,
        enable_chunking=not args.no_chunking,
        aws_access_key=aws_access_key,
        aws_secret_key=aws_secret_key
    )

    # Perform ingestion
    total_count = 0

    if args.source:
        source_path = Path(args.source)
        if not source_path.exists():
            print(f"✗ Source directory not found: {args.source}")
            sys.exit(1)
        
        print(f"📁 Ingesting from directory: {source_path}")
        count = ingester.ingest_directory(source_path, recursive=args.recursive)
        total_count += count

    if args.url:
        print(f"🔗 Ingesting from URL: {args.url}")
        if ingester.download_and_upload_url(args.url):
            total_count += 1

    if args.source_list:
        list_path = Path(args.source_list)
        if not list_path.exists():
            print(f"✗ Source list file not found: {args.source_list}")
            sys.exit(1)
        
        print(f"📋 Ingesting from list: {list_path}")
        count = ingester.ingest_from_list(list_path)
        total_count += count

    # Create metadata
    print(f"\n📊 Creating metadata file...")
    metadata_key = ingester.create_metadata_json()

    # Summary
    print(f"\n{'='*60}")
    print(f"✅ INGESTION COMPLETE")
    print(f"{'='*60}")
    print(f"📊 Total sources processed: {total_count}")
    print(f"📁 Total files/chunks uploaded: {len(ingester.uploaded_files)}")
    print(f"❌ Errors encountered: {len(ingester.errors)}")
    
    if metadata_key:
        print(f"\n📄 Metadata: s3://{args.bucket}/{metadata_key}")
    
    print(f"\n🎯 Next Steps:")
    print(f"   1. Go to AWS Bedrock Console → Knowledge Bases")
    print(f"   2. Create or sync your Knowledge Base with S3 source:")
    print(f"      s3://{args.bucket}/{args.prefix}")
    print(f"   3. Configure sync to include 'chunks/' subdirectory")
    print(f"   4. Wait for indexing to complete (~10-15 minutes for 50+ docs)")
    print(f"   5. Test queries in AWS Console (e.g., 'rice cultivation best practices')")
    print(f"   6. Update .env with BEDROCK_AGRI_KB_ID=<your-kb-id>")
    print(f"   7. Restart backend and test chatbot with farming questions")
    
    print(f"\n💡 Tips:")
    print(f"   - Chunked documents provide better retrieval accuracy")
    print(f"   - Each chunk is ~{args.chunk_size} characters for optimal embedding")
    print(f"   - Preprocessing removed headers, footers, and page numbers")
    print(f"   - Agent will auto-invoke KNOWLEDGE tool for agriculture queries")

    if ingester.errors:
        print(f"\n⚠️  Errors encountered:")
        for error in ingester.errors:
            print(f"   {error}")
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
