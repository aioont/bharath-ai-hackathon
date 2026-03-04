# Migrate from Supabase to Amazon RDS PostgreSQL
## Zero-Code Migration Guide for AgriSaarthi AI

### Why Migrate to AWS RDS?

| Feature | Supabase PostgreSQL | AWS RDS PostgreSQL |
|---------|---------------------|---------------------|
| **AWS Integration** | Hosted outside AWS | Native AWS service |
| **VPC Security** | Public internet | Private VPC network |
| **Networking** | Fixed location | Multi-AZ deployment |
| **Backup** | Limited control | Automated + point-in-time recovery |
| **Monitoring** | Basic | CloudWatch + Performance Insights |
| **Cost (Hackathon)** | Free tier exists | **Free tier: db.t3.micro (750 hrs/month)** |
| **Cost (Production)** | $25/month | $15-60/month (reserved instances) |
| **Scalability** | Manual scaling | Auto-scaling storage |
| **Compliance** | GDPR | GDPR + HIPAA + SOC 2 |

**For Hackathon Judges:** AWS RDS demonstrates full AWS ecosystem integration and production-ready architecture.

---

## Migration Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    MIGRATION PROCESS                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Step 1: Create AWS RDS PostgreSQL Instance                      │
│           ↓                                                       │
│  Step 2: Export Data from Supabase (pg_dump)                     │
│           ↓                                                       │
│  Step 3: Import Data to RDS (psql restore)                       │
│           ↓                                                       │
│  Step 4: Update .env with RDS Connection String                  │
│           ↓                                                       │
│  Step 5: Test Connection & Verify Data                           │
│           ↓                                                       │
│  Step 6: (Optional) Setup RDS Proxy for Connection Pooling       │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Time Required:** 20-30 minutes  
**Code Changes:** 0 lines (only `.env` update!)  
**Downtime:** None (if parallel deployment)

---

## Step 1: Create AWS RDS PostgreSQL Instance

### Option A: Free Tier (Recommended for Hackathon Demo)

**1.1 Login to AWS Console**
- Navigate to: https://console.aws.amazon.com/rds/
- Region: **ap-south-1** (Mumbai) — matches your current setup

**1.2 Create Database**
```
Click: "Create database"

Configuration:
┌─────────────────────────────────────────────────────┐
│ Database creation method:                           │
│   ○ Standard create                                 │
│                                                      │
│ Engine options:                                     │
│   Engine type: PostgreSQL                           │
│   Version: PostgreSQL 15.5-R2 (latest compatible)   │
│                                                      │
│ Templates:                                          │
│   ● Free tier ✓                                     │
│                                                      │
│ Settings:                                           │
│   DB instance identifier: agrisaarthi-db            │
│   Master username: postgres                         │
│   Master password: [Generate or enter secure pwd]  │
│   Confirm password: ••••••••                        │
│                                                      │
│ Instance configuration:                             │
│   DB instance class: db.t3.micro (Free tier)        │
│   vCPU: 2, RAM: 1 GB                                │
│                                                      │
│ Storage:                                            │
│   Storage type: General Purpose SSD (gp3)           │
│   Allocated storage: 20 GB (Free tier limit)        │
│   ☐ Enable storage autoscaling (optional)          │
│                                                      │
│ Connectivity:                                       │
│   Compute resource: Don't connect to EC2            │
│   VPC: Default VPC                                  │
│   Public access: ● Yes (for hackathon demo)         │
│                  ○ No (for production - use VPC)    │
│   VPC security group:                               │
│     ● Create new                                    │
│     Name: agrisaarthi-db-sg                         │
│                                                      │
│ Database authentication:                            │
│   ● Password authentication                         │
│   ☐ IAM database authentication (optional)          │
│                                                      │
│ Additional configuration:                           │
│   Initial database name: agrisaarthi                │
│   DB parameter group: default.postgres15            │
│   Backup retention: 7 days                          │
│   ☑ Enable automated backups                        │
│   ☑ Enable encryption (KMS)                         │
│   Performance Insights: ☑ Enable (7 days free)     │
│                                                      │
│ Estimated monthly costs: $0 (Free tier eligible)    │
└─────────────────────────────────────────────────────┘

Click: "Create database"
```

**Creation time:** 5-10 minutes

---


## Step 2: Configure Security Group

**2.1 Allow Your IP (Development)**

After DB creation:
1. Click on your DB instance: `agrisaarthi-db`
2. Go to: **Connectivity & security** tab
3. Click the security group (e.g., `agrisaarthi-db-sg`)
4. Click **Edit inbound rules**
5. Add rule:
   ```
   Type: PostgreSQL
   Protocol: TCP
   Port: 5432
   Source: My IP (auto-detects your IP) OR 0.0.0.0/0 (less secure, hackathon only)
   Description: Dev access
   ```

---

## Step 3: Get RDS Connection Details

**3.1 Find Endpoint**

In RDS Console → `agrisaarthi-db` → **Connectivity & security**:

```
Endpoint & port:
  Endpoint: agrisaarthi-db.abc123xyz.ap-south-1.rds.amazonaws.com
  Port: 5432

Connection string format:
postgresql://postgres:PASSWORD@agrisaarthi-db.cjeoiqeekboz.ap-south-1.rds.amazonaws.com:5432/agrisaarthi
```

**Example:**
```bash
# Without SSL (not recommended)
postgresql://postgres:YourPassword123@agrisaarthi-db.abc123xyz.ap-south-1.rds.amazonaws.com:5432/agrisaarthi

# With SSL (recommended)
postgresql://postgres:YourPassword123@agrisaarthi-db.abc123xyz.ap-south-1.rds.amazonaws.com:5432/agrisaarthi?sslmode=require
```

---

## Step 4: Export Data from Supabase

### Method 1: Using pg_dump (Recommended)

**4.1 Install PostgreSQL Client**

Windows:
```powershell
# Download from: https://www.postgresql.org/download/windows/
# Or use Chocolatey:
choco install postgresql15
```

macOS:
```bash
brew install postgresql@15
```

Linux:
```bash
sudo apt-get install postgresql-client-15
```

**4.2 Export Database**

```bash
# Your current Supabase credentials (from .env)
pg_dump \
  "postgresql://postgres:7MGCdVgJjwRruuXT@db.omsukgvwlzmyprszgkuj.supabase.co:5432/postgres" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file=supabase_backup.dump

# If you only want specific tables (e.g., forum_posts, forum_answers):
pg_dump \
  "postgresql://postgres:7MGCdVgJjwRruuXT@db.omsukgvwlzmyprszgkuj.supabase.co:5432/postgres" \
  --format=custom \
  --no-owner \
  --no-acl \
  --table=public.forum_posts \
  --table=public.forum_answers \
  --table=public.users \
  --file=agrisaarthi_partial.dump
```

**Output:** `supabase_backup.dump` (~100KB-10MB depending on data)

---

### Method 2: Using Supabase Dashboard (SQL Export)

1. Login to Supabase: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Run:
   ```sql
   -- Export forum_posts
   COPY (SELECT * FROM public.forum_posts) TO STDOUT WITH CSV HEADER;
   
   -- Export forum_answers
   COPY (SELECT * FROM public.forum_answers) TO STDOUT WITH CSV HEADER;
   ```
5. Save outputs as `forum_posts.csv`, `forum_answers.csv`

---

## Step 5: Import Data to AWS RDS

### Method 1: Using pg_restore (for .dump files)

```bash
# Replace with your actual RDS endpoint and password
export RDS_ENDPOINT="agrisaarthi-db.abc123xyz.ap-south-1.rds.amazonaws.com"
export RDS_PASSWORD="YourRDSPassword123"

pg_restore \
  --host=$RDS_ENDPOINT \
  --port=5432 \
  --username=postgres \
  --dbname=agrisaarthi \
  --no-owner \
  --no-acl \
  --verbose \
  supabase_backup.dump

# Enter password when prompted
```

**Expected output:**
```
pg_restore: connecting to database for restore
pg_restore: creating TABLE "public.forum_posts"
pg_restore: creating TABLE "public.forum_answers"
pg_restore: processing data for table "public.forum_posts"
pg_restore: processing data for table "public.forum_answers"
```

---

### Method 2: Using psql (for SQL files)

If you exported as SQL text:

```bash
psql \
  --host=agrisaarthi-db.abc123xyz.ap-south-1.rds.amazonaws.com \
  --port=5432 \
  --username=postgres \
  --dbname=agrisaarthi \
  --file=supabase_backup.sql
```

---

### Method 3: CSV Import (for CSV exports)

```sql
-- Connect to RDS first
psql "postgresql://postgres:YourPassword@agrisaarthi-db.abc123xyz.ap-south-1.rds.amazonaws.com:5432/agrisaarthi?sslmode=require"

-- Create tables (your app does this automatically, but for reference)
CREATE TABLE IF NOT EXISTS public.forum_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT 'Anonymous Farmer',
    category TEXT NOT NULL DEFAULT 'general',
    language TEXT NOT NULL DEFAULT 'en',
    upvotes INT NOT NULL DEFAULT 0,
    downvotes INT NOT NULL DEFAULT 0,
    answers_count INT NOT NULL DEFAULT 0,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    tags TEXT[] NOT NULL DEFAULT '{}',
    user_id UUID,
    user_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Import CSV data
\COPY public.forum_posts FROM 'forum_posts.csv' WITH CSV HEADER;
\COPY public.forum_answers FROM 'forum_answers.csv' WITH CSV HEADER;
```

---

## Step 6: Update Backend Configuration

### 6.1 Update `.env` File

**Old (Supabase):**
```dotenv
# Supabase PostgreSQL
DATABASE_URL=postgresql://postgres:7MGCdVgJjwRruuXT@db.omsukgvwlzmyprszgkuj.supabase.co:5432/postgres
DATABASE_POOL_URL=postgresql://postgres.omsukgvwlzmyprszgkuj:7MGCdVgJjwRruuXT@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres
```

**New (AWS RDS):**
```dotenv
# AWS RDS PostgreSQL
DATABASE_URL=postgresql://postgres:YourRDSPassword123@agrisaarthi-db.abc123xyz.ap-south-1.rds.amazonaws.com:5432/agrisaarthi?sslmode=require
DATABASE_POOL_URL=postgresql://postgres:YourRDSPassword123@agrisaarthi-db.abc123xyz.ap-south-1.rds.amazonaws.com:5432/agrisaarthi?sslmode=require
```

**That's it!** No code changes needed. Your app uses `settings.DATABASE_POOL_URL` which now points to RDS.

### 6.2 Update `.env.example` (for documentation)

Update the template file for other developers.

---

## Step 7: Test Connection

**7.1 Test with psql**

```bash
# Test direct connection
psql "postgresql://postgres:YourPassword@agrisaarthi-db.abc123xyz.ap-south-1.rds.amazonaws.com:5432/agrisaarthi?sslmode=require"

# Run test query
SELECT COUNT(*) FROM public.forum_posts;
```

**7.2 Test with Your Backend**

```bash
cd backend
# Activate venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # macOS/Linux

# Start backend
uvicorn app.main:app --reload --port 8000
```

**7.3 Test API Endpoint**

```bash
# Get forum posts
curl http://localhost:8000/api/forum/posts

# Should return your migrated data!
```

**7.4 Test from Frontend**

```bash
cd frontend
npm run dev

# Navigate to: http://localhost:5173/forum
# You should see all your forum posts!
```

---

## Step 8: (Optional) Setup RDS Proxy for Connection Pooling

**Why RDS Proxy?**
- Manages 1000s of connections efficiently
- Reduces database load (like Supabase's pooler)
- Auto-failover during maintenance
- IAM authentication support

**8.1 Create RDS Proxy**

AWS Console → RDS → Proxies → Create proxy

```
Proxy configuration:
  Engine: PostgreSQL
  Target group: agrisaarthi-db
  
Connectivity:
  Subnets: Select at least 2 AZs
  Security groups: Same as RDS instance
  
Authentication:
  Use Secrets Manager secret (auto-creates)
```

**8.2 Get Proxy Endpoint**

```
Proxy endpoint: agrisaarthi-proxy.proxy-abc123.ap-south-1.rds.amazonaws.com
Port: 5432
```

**8.3 Update .env**

```dotenv
# Use proxy for connection pooling
DATABASE_POOL_URL=postgresql://postgres:YourPassword@agrisaarthi-proxy.proxy-abc123.ap-south-1.rds.amazonaws.com:5432/agrisaarthi?sslmode=require
```

**Cost:** ~$10-15/month (scales with connections)

---

## Step 9: (Optional) Enable IAM Database Authentication

**More Secure:** No passwords in .env!

**9.1 Enable IAM Auth on RDS**

RDS Console → Modify DB → Enable IAM database authentication

**9.2 Create IAM Policy**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "rds-db:connect",
      "Resource": "arn:aws:rds-db:ap-south-1:YOUR_ACCOUNT_ID:dbuser:db-ABCDEFGHIJK/postgres"
    }
  ]
}
```

**9.3 Update Connection Code**

Install AWS SDK:
```bash
pip install boto3
```

Update `backend/app/core/config.py`:
```python
import boto3

def get_rds_auth_token():
    """Generate IAM auth token for RDS."""
    client = boto3.client('rds', region_name='ap-south-1')
    return client.generate_db_auth_token(
        DBHostname='agrisaarthi-db.abc123xyz.ap-south-1.rds.amazonaws.com',
        Port=5432,
        DBUsername='postgres'
    )

# Use in connection string
DATABASE_URL = f"postgresql://postgres:{get_rds_auth_token()}@..."
```

---

## Cost Comparison

### Current: Supabase

| Tier | Cost | Limits |
|------|------|--------|
| Free | $0/month | 500 MB database, 2 GB bandwidth, 1 GB file storage |
| Pro | $25/month | 8 GB database, 50 GB bandwidth, 100 GB storage |

### After Migration: AWS RDS

| Option | Cost | Limits |
|--------|------|--------|
| **Free Tier (db.t3.micro)** | **$0/month** (first 12 months) | 750 hours/month, 20 GB storage |
| **db.t4g.micro** (ARM) | ~$12/month (on-demand) | 1 GB RAM, 2 vCPUs |
| **db.t4g.small** | ~$24/month (on-demand) | 2 GB RAM, 2 vCPUs |
| **Aurora Serverless v2** | ~$45-90/month | Auto-scales 0.5-2 ACUs |

**Reserved Instances (1-year):** ~30-40% discount

---

## Hackathon Benefits Checklist

After migration, update your README with:

✅ **Full AWS Stack:**
- ✅ AWS Bedrock (Knowledge Bases, Claude 3 Haiku)
- ✅ AWS ElastiCache Serverless (Valkey)
- ✅ **AWS RDS PostgreSQL** (newly migrated!)
- ✅ AWS S3 (image storage)
- ✅ AWS CloudFront (CDN)
- ✅ AWS ECS Fargate (backend hosting)

✅ **Production Architecture:**
- ✅ VPC-based private networking
- ✅ Multi-AZ database deployment
- ✅ Automated backups (7-day retention)
- ✅ Performance Insights monitoring
- ✅ Encrypted at rest (KMS)
- ✅ SSL/TLS in transit

✅ **Cost Optimization:**
- ✅ Free tier eligible (first year)
- ✅ Auto-scaling storage (only pay for what you use)
- ✅ Reserved instances for 30%+ savings

✅ **Enterprise Features:**
- ✅ Point-in-time recovery (PITR)
- ✅ Read replicas (up to 5)
- ✅ CloudWatch monitoring
- ✅ Secrets Manager integration

---

## Troubleshooting

### Error: "Connection refused"

**Cause:** Security group not allowing your IP

**Fix:**
```bash
# Check your public IP
curl ifconfig.me

# Add to RDS security group inbound rules
# Source: YOUR_IP/32
```

### Error: "SSL connection required"

**Cause:** RDS requires SSL by default

**Fix:**
```bash
# Add ?sslmode=require to connection string
postgresql://user:pass@host:5432/db?sslmode=require
```

### Error: "Authentication failed"

**Cause:** Wrong password or username

**Fix:**
```bash
# Reset master password in RDS Console
RDS → agrisaarthi-db → Modify → Master password
```

### Error: "Database does not exist"

**Cause:** Initial database name not set during creation

**Fix:**
```bash
# Create database manually
psql -h agrisaarthi-db.abc123xyz.ap-south-1.rds.amazonaws.com -U postgres
CREATE DATABASE agrisaarthi;
\q
```

---

## Rollback Plan (If Migration Fails)

**Instant Rollback:** Just change `.env` back to Supabase:

```dotenv
# Revert to Supabase
DATABASE_URL=postgresql://postgres:7MGCdVgJjwRruuXT@db.omsukgvwlzmyprszgkuj.supabase.co:5432/postgres
DATABASE_POOL_URL=postgresql://postgres.omsukgvwlzmyprszgkuj:7MGCdVgJjwRruuXT@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres
```

Restart backend → Back to Supabase (zero downtime!)

---

## Next Steps

After successful migration:

1. ✅ **Update README.md** with AWS RDS in architecture diagram
2. ✅ **Enable automated backups** (RDS Console → Modify)
3. ✅ **Setup CloudWatch alarms** (CPU > 80%, storage < 10%)
4. ✅ **Create read replica** (for scaling reads)
5. ✅ **Enable Performance Insights** (built-in query analysis)
6. ✅ **Document RDS endpoint** in project submission

---

## Summary: What Changed?

| Component | Before | After |
|-----------|--------|-------|
| **Code** | psycopg2 + PostgreSQL | ✅ **psycopg2 + PostgreSQL (same!)** |
| **Tables** | forum_posts, forum_answers | ✅ **forum_posts, forum_answers (same!)** |
| **SQL Syntax** | PostgreSQL-compatible | ✅ **PostgreSQL-compatible (same!)** |
| **Connection String** | Supabase endpoint | ✅ **RDS endpoint (only change!)** |
| **SSL** | `?sslmode=require` | ✅ **`?sslmode=require` (same!)** |

**Total Code Changes:** **0 lines!** (only `.env` file updated)

---

## Support

**AWS Documentation:**
- RDS User Guide: https://docs.aws.amazon.com/rds/
- Aurora Guide: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/

**For Hackathon Submission:**
Include this migration guide in your GitHub repo to demonstrate:
- ✅ Production-ready infrastructure planning
- ✅ Database migration expertise
- ✅ AWS ecosystem depth
- ✅ Cost optimization awareness

**Questions?** Check AWS RDS documentation or submit to AWS forums.
