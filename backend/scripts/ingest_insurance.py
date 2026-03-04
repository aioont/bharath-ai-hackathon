#!/usr/bin/env python3
"""
Insurance Scheme Ingestion Script
Fetches insurance schemes from myscheme.gov.in and ingests into:
  1. A local JSON file (for reference)
  2. AWS S3 (as source for Bedrock Knowledge Base)

Run this once, then sync the Bedrock KB in the AWS Console.

Usage:
  python ingest_insurance.py [--dry-run]
"""
from __future__ import annotations
import io
import json
import sys
import time
import httpx
from pathlib import Path

# Force UTF-8 output on Windows so emoji prints don't crash with cp1252
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
else:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# ── Config ───────────────────────────────────────────────────────────────────
MYSCHEME_API_KEY = "tYTy5eEhlu9rFjyxuCr7ra7ACp4dv1RH8gWuHTDc"
MYSCHEME_BASE    = "https://api.myscheme.gov.in/search/v6/schemes"
HEADERS = {
    "x-api-key": MYSCHEME_API_KEY,
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://www.myscheme.gov.in",
    "Referer": "https://www.myscheme.gov.in/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
}

# Keywords to search for insurance-related schemes
KEYWORDS = [
    "insurance", "bima", "fasal bima", "crop insurance",
    "life insurance", "health insurance", "cattle insurance",
    "accidental insurance", "pradhan mantri bima",
]
PAGE_SIZE = 25
OUTPUT_JSON = Path(__file__).parent / "data" / "insurance_schemes.json"

# S3 target (same bucket as the project)
S3_PREFIX = "knowledge-base/insurance-schemes/"


# ── Fetch from myscheme.gov.in ────────────────────────────────────────────────

def fetch_schemes(keyword: str, size: int = PAGE_SIZE) -> list[dict]:
    """Fetch schemes for a keyword from the myScheme API."""
    import urllib.parse
    schemes = []
    from_idx = 0
    first_call = True
    while True:
        kw_enc = urllib.parse.quote(keyword, safe='')
        url = f"{MYSCHEME_BASE}?lang=en&q=%5B%5D&keyword={kw_enc}&sort=&from={from_idx}&size={size}"
        try:
            r = httpx.get(url, headers=HEADERS, timeout=15, follow_redirects=True)
            r.raise_for_status()
            data = r.json()
        except Exception as exc:
            print(f"  [warn] {keyword=} from={from_idx}: {exc}")
            break

        # Debug: print structure on first call ever
        if first_call and from_idx == 0 and keyword == 'insurance':
            _preview = json.dumps(data, ensure_ascii=False)[:400]
            print(f"  [debug] Raw response: {_preview}")
        first_call = False

        batch = _extract_hits(data)
        if not batch:
            break
        schemes.extend(batch)
        if len(batch) < size:
            break
        from_idx += size
        time.sleep(0.5)
    return schemes


def _extract_hits(data: dict) -> list[dict]:
    """Extract scheme records. API response: data.hits.items is the list."""
    try:
        items = data["data"]["hits"]["items"]
        if isinstance(items, list):
            return items
    except (KeyError, TypeError):
        pass
    # Fallback: walk any list of dicts
    for v in (data.get("data") or {}).values():
        if isinstance(v, list) and v and isinstance(v[0], dict):
            return v
        if isinstance(v, dict):
            for vv in v.values():
                if isinstance(vv, list) and vv and isinstance(vv[0], dict):
                    return vv
    return []


def deduplicate(schemes: list[dict]) -> list[dict]:
    """Dedup by _id/id/slug — skips any non-dict items safely."""
    seen, unique = set(), []
    for s in schemes:
        if not isinstance(s, dict):
            continue  # skip strings or other non-dict items
        sid = s.get("_id") or s.get("id") or s.get("slug") or json.dumps(s.get("_source", {}), sort_keys=True)[:60]
        if sid not in seen:
            seen.add(sid)
            unique.append(s)
    return unique


def normalise(raw: dict) -> dict:
    """Flatten a myScheme API item into a clean dict.
    API structure: {id, fields: {schemeName, briefDescription, ...}, highlight}
    """
    if not isinstance(raw, dict):
        return {}
    # v6 API: data is in raw['fields']
    src = raw.get("fields") or raw.get("_source") or raw
    if not isinstance(src, dict):
        src = raw

    name = src.get("schemeName") or src.get("name", {})
    desc = src.get("briefDescription") or src.get("description", "")
    state = src.get("state") or src.get("openForStates", {})
    ministry = src.get("nodalMinistryName") or src.get("ministry", "")

    return {
        "id":          raw.get("id") or src.get("slug") or src.get("schemeId", ""),
        "name":        name.get("en", "") if isinstance(name, dict) else str(name or ""),
        "ministry":    ministry.get("en", "") if isinstance(ministry, dict) else str(ministry or ""),
        "state":       state.get("en", "Central") if isinstance(state, dict) else str(state or "Central"),
        "category":    src.get("tag") or src.get("schemeCategory", ""),
        "description": desc.get("en", "") if isinstance(desc, dict) else str(desc or ""),
        "eligibility": src.get("eligibility") or src.get("beneficiaryCategory") or [],
        "benefits":    src.get("benefits") or src.get("schemeBenefits") or [],
        "documents":   src.get("documents") or src.get("requiredDocuments") or [],
        "application_process": src.get("applicationProcess") or [],
        "official_url": src.get("schemeUrl") or src.get("url", ""),
        "tags":        src.get("tags") or src.get("keywords") or [],
        "target_beneficiaries": src.get("targetBeneficiaries") or [],
    }


def scheme_to_text(s: dict) -> str:
    """Convert normalised scheme to a text document for Bedrock KB embedding."""
    lines = [
        f"SCHEME: {s['name']}",
        f"MINISTRY: {s['ministry']}",
        f"STATE: {s['state']}",
        f"CATEGORY: {s['category']}",
        f"DESCRIPTION: {s['description']}",
    ]
    if s["eligibility"]:
        elig = s["eligibility"]
        if isinstance(elig, list):
            lines += ["ELIGIBILITY:"] + [f"  - {e}" if isinstance(e, str) else f"  - {json.dumps(e)}" for e in elig[:10]]
        else:
            lines.append(f"ELIGIBILITY: {elig}")
    if s["benefits"]:
        ben = s["benefits"]
        if isinstance(ben, list):
            lines += ["BENEFITS:"] + [f"  - {b}" if isinstance(b, str) else f"  - {json.dumps(b)}" for b in ben[:5]]
    if s["official_url"]:
        lines.append(f"URL: {s['official_url']}")
    return "\n".join(lines)


# ── Upload to S3 ─────────────────────────────────────────────────────────────

def upload_to_s3(schemes: list[dict], bucket: str, dry_run: bool = False) -> int:
    if dry_run:
        print(f"[dry-run] Would upload {len(schemes)} scheme text files to s3://{bucket}/{S3_PREFIX}")
        return len(schemes)
    try:
        import boto3
        from app.core.config import settings
        
        # Helper to treat empty strings as None so boto3 uses default credential chain
        ak = settings.AWS_ACCESS_KEY_ID or None
        sk = settings.AWS_SECRET_ACCESS_KEY or None
        
        s3 = boto3.client(
            "s3",
            region_name=settings.AWS_REGION,
            aws_access_key_id=ak,
            aws_secret_access_key=sk,
        )

        try:
            s3.head_bucket(Bucket=bucket)
        except Exception:
            print(f"  [info] Bucket '{bucket}' not found. Creating...")
            if settings.AWS_REGION == "us-east-1":
                s3.create_bucket(Bucket=bucket)
            else:
                s3.create_bucket(
                    Bucket=bucket,
                    CreateBucketConfiguration={"LocationConstraint": settings.AWS_REGION},
                )
            print(f"  [info] Bucket '{bucket}' created.")
            
        count = 0
        for s in schemes:
            key = f"{S3_PREFIX}{s['id'] or f'scheme_{count}'}.txt"
            body = scheme_to_text(s)
            s3.put_object(Bucket=bucket, Key=key, Body=body.encode("utf-8"),
                          ContentType="text/plain")
            count += 1
            if count % 10 == 0:
                print(f"  Uploaded {count}/{len(schemes)}…")
        print(f"✅ Uploaded {count} scheme files to s3://{bucket}/{S3_PREFIX}")
        return count
    except ImportError:
        print("[warn] boto3 not available — skipping S3 upload")
        return 0
    except Exception as exc:
        print(f"[error] S3 upload failed: {exc}")
        return 0


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    dry_run = "--dry-run" in sys.argv
    print("📥 Fetching insurance schemes from myscheme.gov.in…")

    all_raw: list[dict] = []
    for kw in KEYWORDS:
        print(f"  Searching: '{kw}'…")
        batch = fetch_schemes(kw)
        print(f"    → {len(batch)} results")
        all_raw.extend(batch)

    all_raw = deduplicate(all_raw)
    print(f"✅ {len(all_raw)} unique schemes found")

    schemes = [normalise(r) for r in all_raw]
    schemes = [s for s in schemes if s.get("name")]  # drop empty/failed normalisations
    print(f"💾 Saving {len(schemes)} schemes…")

    # Save JSON locally
    OUTPUT_JSON.write_text(json.dumps(schemes, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"✅ Saved → {OUTPUT_JSON}")

    # Upload to S3
    import os
    bucket = os.environ.get("S3_BUCKET_NAME", "agri-translate-images")
    upload_to_s3(schemes, bucket, dry_run=dry_run)

    print("\n🎯 NEXT STEPS IN AWS CONSOLE:")
    print("1. Go to AWS Bedrock → Knowledge bases → Create knowledge base")
    print(f"2. Data source: S3 bucket '{bucket}', prefix '{S3_PREFIX}'")
    print("3. Embedding model: Amazon Titan Embeddings G1 - Text  (free tier)")
    print("4. Vector store: Amazon OpenSearch Serverless (auto-create)")
    print("5. After creation, click 'Sync data source'")
    print("6. Copy the KNOWLEDGE_BASE_ID and add to .env as BEDROCK_INSURANCE_KB_ID=<id>")


if __name__ == "__main__":
    main()
