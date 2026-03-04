# Quick Migration Guide: Supabase → AWS RDS PostgreSQL

## TL;DR - 3 Steps, 15 Minutes, Zero Code Changes

### Step 1: Create AWS RDS Instance (5 min)
```
AWS Console → RDS → Create database
- Engine: PostgreSQL 15.5
- Template: Free tier
- Instance: db.t3.micro
- Storage: 20 GB
- Public access: Yes (for demo)
- Database name: agrisaarthi
```

**Endpoint Example:**
```
agrisaarthi-db.abc123xyz.ap-south-1.rds.amazonaws.com
```

---

### Step 2: Export from Supabase (2 min)
```bash
pg_dump "postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres" \
  --format=custom \
  --no-owner \
  --table=public.forum_posts \
  --table=public.forum_answers \
  --file=backup.dump
```

---

### Step 3: Import to RDS (3 min)
```bash
pg_restore \
  --host=agrisaarthi-db.abc123xyz.ap-south-1.rds.amazonaws.com \
  --username=postgres \
  --dbname=agrisaarthi \
  --no-owner \
  backup.dump
```

---

### Step 4: Update .env (30 seconds)
```dotenv
# Old (Supabase)
# DATABASE_URL=postgresql://postgres:OLD_PWD@db.xxx.supabase.co:5432/postgres

# New (AWS RDS)
DATABASE_URL=postgresql://postgres:NEW_PWD@agrisaarthi-db.abc123xyz.ap-south-1.rds.amazonaws.com:5432/agrisaarthi?sslmode=require
DATABASE_POOL_URL=postgresql://postgres:NEW_PWD@agrisaarthi-db.abc123xyz.ap-south-1.rds.amazonaws.com:5432/agrisaarthi?sslmode=require
```

---

### Step 5: Test (1 min)
```bash
# Restart backend
uvicorn app.main:app --reload

# Test API
curl http://localhost:8000/api/forum/posts
```

**Done!** ✅

---

## Automated Migration (Windows)

We've created a script to automate this:

```bash
cd backend\scripts
migrate_to_rds.bat --full
```

The script will:
1. ✅ Check if pg_dump/psql are installed
2. ✅ Export data from Supabase
3. ✅ Import data to RDS
4. ✅ Verify migration
5. ✅ Show you the new connection string

---

## Why Migrate to RDS?

For **AI for Bharat Hackathon judges**:

| Benefit | Impact |
|---------|--------|
| **Full AWS Stack** | Shows complete cloud architecture mastery |
| **VPC Security** | Production-grade security (vs public Supabase) |
| **AWS Integration** | Native CloudWatch monitoring, IAM auth |
| **Free Tier** | $0/month for first 12 months (same as Supabase) |
| **Scalability** | Auto-scaling storage, read replicas |
| **Enterprise Features** | Point-in-time recovery, multi-AZ deployment |

**Pitch Point:**
> "Our application runs entirely on AWS: Bedrock for AI, ElastiCache for caching, RDS for data persistence, S3 for storage, and ECS for compute. This demonstrates production-ready architecture and AWS ecosystem expertise."

---

## What Doesn't Change?

✅ **Your Code:** Uses standard PostgreSQL → works with both  
✅ **Tables:** forum_posts, forum_answers → same schema  
✅ **Queries:** All SQL → PostgreSQL-compatible  
✅ **Driver:** psycopg2 → same library  
✅ **API:** All endpoints → same behavior  

**Total Code Changes:** 0 lines (only `.env` update!)

---

## Need Help?

See full documentation: [`backend/docs/AWS_RDS_MIGRATION.md`](./AWS_RDS_MIGRATION.md)

---

## Cost Comparison

| Service | Free Tier | After Free Tier |
|---------|-----------|-----------------|
| **Supabase** | 500 MB DB, unlimited | $25/month (Pro) |
| **AWS RDS** | 750 hours/month, 20 GB | $12-24/month (t4g.micro) |
| **AWS Aurora Serverless** | No free tier | $45-90/month (auto-scales) |

**Recommendation:** Start with RDS free tier, migrate to Aurora Serverless when scaling.
