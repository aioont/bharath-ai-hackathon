# Agriculture Knowledge Base Ingestion Guide

## 🎯 Overview

This script ingests agricultural documents into AWS S3 for use with AWS Bedrock Knowledge Bases. It includes:

- ✅ **Text Extraction** from PDFs using PyPDF2
- ✅ **Intelligent Chunking** for better retrieval (default: 1000 chars/chunk)
- ✅ **Preprocessing** to remove junk data (headers, footers, page numbers)
- ✅ **Metadata Enrichment** for each chunk
- ✅ **50+ Curated Government Sources** (ICAR, Ministry of Agriculture, etc.)

---

## 📦 Installation

```bash
# Navigate to scripts directory
cd backend/scripts

# Install dependencies
pip install -r requirements.txt
```

**Dependencies:**
- `boto3` - AWS SDK for S3
- `requests` - For downloading URLs
- `PyPDF2` - PDF text extraction

---

## 🚀 Quick Start

### 1. Run the Ingestion Script

**Option A: Process all 50+ government sources (Recommended)**
```bash
python ingest_agriculture_knowledge.py \
  --source-list agriculture_sources.txt \
  --bucket agri-translate-images
```

**Option B: Process a single URL**
```bash
python ingest_agriculture_knowledge.py \
  --url https://farmer.gov.in/imagedefault/pestanddiseasescrops/rice.pdf \
  --bucket agri-translate-images
```

**Option C: Process a local directory**
```bash
python ingest_agriculture_knowledge.py \
  --source /path/to/pdf/folder \
  --bucket agri-translate-images
```

### 2. Advanced Options

```bash
# Custom chunk size (smaller = more precise, larger = more context)
python ingest_agriculture_knowledge.py \
  --source-list agriculture_sources.txt \
  --bucket agri-translate-images \
  --chunk-size 800

# Disable chunking (upload original files only)
python ingest_agriculture_knowledge.py \
  --source-list agriculture_sources.txt \
  --bucket agri-translate-images \
  --no-chunking

# Custom S3 prefix
python ingest_agriculture_knowledge.py \
  --source-list agriculture_sources.txt \
  --bucket my-bucket \
  --prefix "knowledge/agriculture/"
```

---

## 📚 Included Government Sources

The `agriculture_sources.txt` file includes 50+ verified links from:

### Official Organizations
- **Ministry of Agriculture & Farmers Welfare**
- **ICAR (Indian Council of Agricultural Research)**
- **PM-KISAN, PMFBY, PMKSY schemes**

### Topics Covered
- ✅ Crop cultivation (Rice, Wheat, Cotton, Pulses, Vegetables, Fruits)
- ✅ Integrated Pest Management (IPM)
- ✅ Soil Health Management
- ✅ Water Management & Irrigation
- ✅ Organic Farming
- ✅ Weather-based Agro Advisories
- ✅ Government Schemes & Subsidies
- ✅ Market Intelligence
- ✅ Livestock & Dairy
- ✅ Climate Resilient Agriculture

---

## 🧹 Preprocessing Features

### Text Cleaning (Automatic)
1. **Remove junk data:**
   - Page numbers (e.g., "Page 1 of 20")
   - Headers/footers (e.g., "Ministry of Agriculture")
   - URLs and email addresses
   - Special characters and excessive whitespace

2. **Normalize text:**
   - Preserve Devanagari and Bengali scripts
   - Remove lines with only numbers
   - Keep sentences > 20 characters

### Chunking Strategy
- **Default:** 1000 characters per chunk
- **Why?** Optimal for Titan Embeddings V2 (512 tokens ≈ 1000 chars)
- **Overlap:** None (clean splits on word boundaries)
- **Metadata:** Each chunk includes source file, chunk ID, total chunks

---

## 📊 Output Structure

```
s3://agri-translate-images/
└── agriculture-knowledge/
    ├── chunks/
    │   ├── rice_cultivation_chunk_0.txt (metadata: source, chunk_id, char_count)
    │   ├── rice_cultivation_chunk_1.txt
    │   └── ...
    └── _metadata.json (ingestion summary)
```

---

## 🔧 Troubleshooting

### Error: "PyPDF2 not installed"
```bash
pip install PyPDF2
```

### Error: "Access Denied" (S3)
- Ensure AWS credentials are configured: `aws configure`
- Verify IAM permissions for S3 PutObject

### Warning: "No text extracted from PDF"
- Some PDFs are image-based (scanned). Consider using OCR (Textract) for these.
- The script will upload the original PDF in this case.

### Downloads failing with 403/404
- Some government URLs may be temporarily down or moved
- Comment out failing URLs in `agriculture_sources.txt` and retry

---

## 📈 Performance Tips

1. **Chunk Size Tuning:**
   - Smaller chunks (500-800) = More precise answers, more storage
   - Larger chunks (1200-1500) = More context, fewer chunks

2. **Parallel Processing:**
   - Process multiple source files in batches
   - Use `--source` for directories instead of individual files

3. **Cost Optimization:**
   - Use S3 Intelligent-Tiering for infrequently accessed docs
   - Enable S3 lifecycle policies to archive old versions

---

## 🎯 Next Steps After Ingestion

1. **Create Bedrock Knowledge Base:**
   - Go to AWS Bedrock Console → Knowledge Bases
   - Click "Create Knowledge Base"
   - Select S3 as data source: `s3://agri-translate-images/agriculture-knowledge/`
   - Choose "Titan Text Embeddings V2" model
   - Use existing OpenSearch Serverless collection or create new

2. **Sync Data:**
   - Click "Sync" to start indexing
   - Wait 10-15 minutes for ~50 documents
   - Monitor sync status in console

3. **Test Queries:**
   - Test in Bedrock Console with queries like:
     - "What are the best practices for rice cultivation?"
     - "How to manage pest in cotton crops?"
     - "Soil health card benefits"

4. **Configure Backend:**
   ```bash
   # Add to backend/.env
   BEDROCK_AGRI_KB_ID=ABCD1234XYZ  # Your KB ID from AWS Console
   ```

5. **Restart Backend:**
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

6. **Test Chatbot:**
   - Ask farming questions in the chat interface
   - Agent should auto-invoke KNOWLEDGE tool
   - Check for grounded responses from KB

---

## 📝 Adding Your Own Documents

### Method 1: Edit `agriculture_sources.txt`
```plaintext
# Add local PDFs
/home/user/documents/my-farming-guide.pdf

# Add URLs
https://example.com/my-research-paper.pdf
```

### Method 2: Direct Upload
```bash
python ingest_agriculture_knowledge.py \
  --source /path/to/my/pdfs \
  --bucket agri-translate-images
```

---

## 🔍 Metadata Schema

Each uploaded chunk includes:
```json
{
  "source-file": "rice_cultivation.pdf",
  "chunk-id": "0",
  "total-chunks": "15",
  "char-count": "1024",
  "upload-date": "2026-03-04T10:30:00Z",
  "content-type": "text/plain"
}
```

---

## 📞 Support

- Check `AWS_SETUP.md` for detailed Bedrock KB configuration
- Review backend logs for agent tool invocation
- Monitor CloudWatch for Knowledge Base query performance

---

**Happy Farming! 🌾**
