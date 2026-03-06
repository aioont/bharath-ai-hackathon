# AWS ElastiCache Serverless with Valkey Setup Guide
## Cost Optimization for Bedrock Knowledge Bases & API Calls

### Problem & Estimated Savings
**Current Monthly AWS Costs:**
- OpenSearch Serverless (2 Knowledge Bases): **~$700+/month** 💸
- Bedrock Claude API calls: Variable (could be $100-200/month)
- External API rate limits: DuckDuckGo, myscheme.gov.in, AGMARKNET

**After Implementing Caching:**
- OpenSearch queries reduced by **60-80%**: **Saves $420-560/month** ✅
- Translation API calls reduced by **70-90%**: **Saves $50-100/month** ✅  
- Faster response times: **50-90% faster** ⚡
- Better user experience: Instantaneous cached responses

**ElastiCache Serverless Cost (Recommended):**
- **Pay-per-use pricing**: $0.125 per ECPU-hour + $0.10 per GB storage/month
- **Typical usage**: ~$8-20/month for variable workloads 🎉
- **Auto-scales**: 0-100% utilization automatically
- **No node management**: Fully serverless

**Alternative: ElastiCache with Fixed Nodes:**
- t3.micro (0.5 GB RAM): **$15/month** 
- t3.small (1.5 GB RAM): **$30/month**
- t4g.micro (ARM, cheaper): **$12/month**

**Net Savings: ~$480-670/month** 💰 (Serverless is cheaper!)

---

## Architecture

```
User Request → Backend API
                  ↓
            Cache Check (Redis)
                  ↓
         ┌────────┴────────┐
         │                 │
    Cache Hit         Cache Miss
         │                 │
    Return Cached    Call AWS Service
    (Instant)        (OpenSearch/Bedrock)
                          │
                     Cache Result
                          │
                    Return to User
```

**Why Valkey Serverless?**
- **Valkey**: Open-source fork of Redis (no licensing issues, 100% compatible)
- **Serverless**: Auto-scales from 0 to peak, pay only for what you use
- **Cost-effective**: 50-70% cheaper than fixed nodes for variable workloads
- **Zero maintenance**: No node sizing, patching, or scaling decisions
- **Perfect for startups/hackathons**: Scales with your growth

**Intelligent Caching Strategy:**
1. **Semantic Deduplication** for Knowledge Base queries:
   - "How to grow rice?" and "Rice cultivation techniques" → Same cache hit
   - Saves on expensive OpenSearch queries

2. **Multi-tier TTL**:
   - Bedrock KB: 1 hour (balance freshness vs cost)
   - Translation (common): 7 days (agricultural terms don't change)
   - Translation (rare): 24 hours
   - Weather: 1 hour (changes slowly)
   - Market prices: 15 minutes (needs frequent updates)
   - Insurance schemes: 6 hours (government data stable)

3. **Graceful Degradation**:
   - Development: Local Valkey/Redis (`redis://localhost:6379`)
   - Production: AWS ElastiCache Serverless (Valkey)
   - Fallback: If cache unavailable, direct API calls (no errors)

---

## Setup Instructions

### 🎯 Recommended: ElastiCache Serverless with Valkey

**Best for:** Variable workloads, startups, hackathons, cost optimization

1. **Go to AWS Console → ElastiCache → Serverless caches**
   - Click **Create serverless cache**

2. **Basic Configuration**:
   - **Cache name**: `agri-translate-cache`
   - **Description**: "Serverless cache for Agri AI (reduces Bedrock KB costs)"
   - **Engine**: **Valkey** (recommended - open source, no licensing)
     - Alternative: Redis OSS (also supported)
   - **Engine version**: Latest (7.1+)

3. **Capacity Settings** (Auto-scaling limits):
   - **Minimum ECPUs**: 1000 (baseline capacity, ~$9/month)
   - **Maximum ECPUs**: 5000 (burst capacity for peak traffic)
   - **Maximum data storage**: 10 GB (should be plenty)
   
   **Cost Calculation**:
   - Light usage (avg 1500 ECPUs): ~$14/month
   - Medium usage (avg 2500 ECPUs): ~$23/month
   - Heavy usage (avg 4000 ECPUs): ~$37/month
   - Still **20-50% cheaper than fixed nodes!**

4. **Network & Security**:
   - **Subnet group**: Create new or use default
     - Choose your VPC (same as backend servers)
     - Select 2+ subnets in different AZs (required for high availability)
   
   - **Security groups**: Create new or use existing
     - Inbound rule: **Custom TCP, Port 6379, Source: Backend Security Group**
     - Example: Allow from EC2/Fargate/Lambda security group
     - ⚠️ Never allow `0.0.0.0/0` in production!

5. **Encryption & Security** (Recommended):
   - **Encryption at rest**: Enabled (uses AWS-managed KMS key, no extra cost)
   - **Encryption in transit**: Enabled (use `rediss://` URL)
   - **Daily snapshots**: Enabled (automatic backups, 1-day retention)

6. **Advanced Settings** (Optional):
   - **Tags**: Add tags for cost tracking
     - Key: `Project`, Value: `agri-translate-ai`
     - Key: `Environment`, Value: `production`
     - Key: `CostCenter`, Value: `caching-optimization`

7. **Click Create** → Wait 3-5 minutes (much faster than provisioned nodes!)

8. **Get Endpoint**:
   - Go to your cache → **Details** tab
   - Copy **Serverless endpoint**: 
     ```
     agri-translate-cache.serverless.aps1.cache.amazonaws.com:6379
     ```

9. **Update `.env`**:
   ```bash
   # ElastiCache Serverless with Valkey (TLS enabled)
   REDIS_URL=rediss://agri-translate-cache.serverless.aps1.cache.amazonaws.com:6379
   
   # Without TLS (not recommended for production)
   # REDIS_URL=redis://agri-translate-cache.serverless.aps1.cache.amazonaws.com:6379
   
   REDIS_CACHE_ENABLED=true
   ```

---

### Alternative: Fixed Node Setup (Traditional ElastiCache)

**Use this if:** You need predictable costs or have consistently high traffic

<details>
<summary>Click to expand fixed node setup instructions</summary>

1. **Go to AWS Console → ElastiCache → Redis OSS Caches**
   - Click **Create Redis OSS cache**

2. **Configuration**:
   - **Deployment**: Design your own cache
   - **Cluster mode**: Disabled (simpler)
   - **Location**: AWS Cloud
   - **Multi-AZ**: Disabled (for dev/staging), Enabled (for production)
   
3. **Cluster Settings**:
   - **Name**: `agri-translate-cache`
   - **Engine**: Valkey (recommended) or Redis OSS
   - **Engine version**: 7.1 (latest)
   - **Port**: 6379
   - **Parameter group**: default.valkey7 or default.redis7
   - **Node type**: `cache.t4g.small` (1.5 GB RAM, ARM-based, $24/month)
     - For higher performance: `cache.t4g.medium` (3.09 GB, $48/month)
     - Budget option: `cache.t4g.micro` (0.5 GB, $12/month)
   - **Number of replicas**: 0 (dev), 1-2 (production with Multi-AZ)

4. **Subnet & Security**: Same as serverless setup above

5. **Backup**: 
   - Automatic backups: Enabled
   - Retention: 1-7 days
   - Window: Off-peak hours

</details>

6. **Advanced Settings**:
   - Encryption at rest: Enabled (no extra cost)
   - Encryption in transit: Disabled for dev (use `rediss://` for production)
   - Logs: Slow log enabled (helps debug)

7. **Click Create** → Wait 5-10 minutes

8. **Get Endpoint**:
   - Go to your cache → **Details** tab
   - Copy **Primary Endpoint**: 
     ```
     agri-translate-cache.abc123.0001.aps1.cache.amazonaws.com:6379
     ```

9. **Update `.env`**:
   ```bash
   # Production ElastiCache (no TLS)
   REDIS_URL=redis://agri-translate-cache.abc123.0001.aps1.cache.amazonaws.com:6379
   
   # With TLS (recommended for production)
   # REDIS_URL=rediss://agri-translate-cache.abc123.0001.aps1.cache.amazonaws.com:6379
   
   REDIS_CACHE_ENABLED=true
   ```

---


---

## Cost Comparison: Serverless vs Fixed Nodes

### ElastiCache Serverless (Valkey) - RECOMMENDED ✅

**Pricing Model:**
- **ECPUs (Compute)**: $0.125 per ECPU-hour
- **Storage**: $0.10 per GB-month
- **Data transfer**: Standard AWS rates

**Estimated Monthly Cost:**

| Usage Pattern | Avg ECPUs | Storage | Monthly Cost | Best For |
|---------------|-----------|---------|--------------|----------|
| **Light** (hackathon/demo) | 1000-1500 | 1 GB | **$9-14** | Development, testing |
| **Medium** (startup/MVP) | 2000-3000 | 2 GB | **$19-28** | Production, growing user base |
| **Heavy** (scale-up) | 4000-5000 | 5 GB | **$37-47** | High traffic, peak hours |

**Advantages:**
- ✅ **Auto-scales** to zero during idle periods (huge savings!)
- ✅ **No node management** (AWS handles everything)
- ✅ **High availability** built-in (multi-AZ by default)
- ✅ **Perfect for variable workloads** (hackathons, startups)
- ✅ **Pay only for what you use**
- ✅ **Valkey = Open source** (no licensing concerns)

**When NOT to use:**
- ❌ Consistently high traffic 24/7 (fixed nodes may be cheaper)
- ❌ Need sub-millisecond latency guarantees
- ❌ Complex Redis modules not supported in serverless

### ElastiCache with Fixed Nodes (Valkey/Redis)

**Pricing Model:**
- Fixed hourly rate per node (24/7 billing)
- Reserved instances: 37-56% discount

**Estimated Monthly Cost:**

| Node Type | RAM | Monthly Cost | Reserved 1-yr | Reserved 3-yr |
|-----------|-----|--------------|---------------|---------------|
| **t4g.micro** (Valkey) | 0.5 GB | $12 | $8/month | $5/month |
| **t4g.small** (Valkey) | 1.5 GB | $24 | $15/month | $11/month |
| **t4g.medium** (Valkey) | 3.09 GB | $48 | $30/month | $21/month |
| **r7g.large** (Valkey) | 13.07 GB | $120 | $76/month | $53/month |

**Advantages:**
- ✅ **Predictable costs** (easier budgeting)
- ✅ **Better for consistent 24/7 traffic**
- ✅ **Reserved instance discounts** (37-56% off)
- ✅ **Supports all Redis/Valkey features**

**When to use:**
- ✅ Stable production with consistent traffic
- ✅ Need specific node features (clustering, modules)
- ✅ Cost-conscious with long-term commitment (reserved)

### Verdict: Use Serverless Valkey! 🏆

For **Agri AI**:
- ✅ Variable traffic (farmers use during day, idle at night)
- ✅ Hackathon/startup phase (may scale or pivot)
- ✅ Cost optimization priority (OpenSearch is expensive!)
- ✅ **Serverless saves 50-70% vs fixed nodes** for your use case
- ✅ **Valkey = future-proof** (open source, no licensing issues)

---

## Security Best Practices

### 1. **VPC Security Group Configuration**

**Development/Testing** (restrictive):
```
Inbound Rules:
- Type: Custom TCP
- Port: 6379
- Source: Your IP (e.g., 49.37.x.x/32)

Outbound Rules:
- Allow all (default)
```

**Production with EC2 Backend**:
```
Inbound Rules:
- Type: Custom TCP
- Port: 6379
- Source: Backend Security Group (sg-xxxxx)
```

**Production with Lambda/Fargate**:
```
Inbound Rules:
- Type: Custom TCP
- Port: 6379
- Source: Lambda/Fargate Execution Role Security Group
```

### 2. **Enable TLS (Encryption in Transit)**

```bash
# In .env
REDIS_URL=rediss://your-cache.amazonaws.com:6379  # Notice 'rediss' (double-s)
```

**Why TLS?**
- Encrypts data in transit (compliance requirement for sensitive data)
- Prevents man-in-the-middle attacks
- Required for PCI-DSS, HIPAA compliance

### 3. **Auth Tokens (Password Protection)**

When creating cache → **Access Control** → **Redis AUTH**:
- Generate strong token: `openssl rand -base64 32`
- Add to URL: `rediss://:YOUR_TOKEN@endpoint:6379`

**Update `.env`**:
```bash
REDIS_URL=rediss://:aC8F2kL9mN4pQ7rT1vW5xY6zB3dE8fG0@your-cache.amazonaws.com:6379
```

### 4. **Encryption at Rest**

- Enable during cache creation (no performance impact)
- Uses AWS KMS for key management
- Free tier: AWS-managed keys (no extra cost)
- Compliance: GDPR, HIPAA, SOC 2

---

## Cost Optimization Tips

### 1. **For Serverless (Recommended)**: Monitor ECPUs

**Key Metrics to Watch:**
```
- ElastiCacheProcessingUnits (ECPUs used per hour)
- BytesUsedForCache (storage consumption)
- CacheHits vs CacheMisses (aim for >60% hit rate)
- NetworkBytesIn/Out (data transfer costs)
```

**Optimization Strategies:**
- ✅ Set appropriate **min/max ECPUs** (start with 1000-5000)
- ✅ Monitor idle periods (serverless auto-scales to zero!)
- ✅ Adjust TTL to balance freshness vs cache hits
- ✅ Use CloudWatch alarms for unexpected spikes

**Cost Calculation Example:**
```
Average 2000 ECPUs x 730 hours/month x $0.125/ECPU-hour = $182.50/month
+ 2 GB storage x $0.10/GB-month = $0.20/month
= ~$183/month (but you only pay for actual usage!)
```

### 2. **For Fixed Nodes**: Right-Size & Use ARM Instances

**Memory Usage Estimation:**
- Average cache entry: ~2-5 KB (KB query result)
- 10,000 cached queries: ~20-50 MB
- Recommendation: Start with `t4g.small` (1.5 GB), monitor with CloudWatch

**CloudWatch Metrics:**
```
- DatabaseMemoryUsagePercentage (keep below 80%)
- CurrConnections (should be stable)
- CacheHits vs CacheMisses (aim for >60% hit rate)
- Evictions (if >0, increase node size)
```

**Use ARM-based Graviton Instances:**
- `cache.t4g.small` (1.5 GB): $24/month (vs $30 for t3.small)
- **20% cost savings** with identical performance
- Works with Valkey/Redis (no code changes)

### 3. **Reserved Instances (Fixed Nodes Only)**

**Savings:**
- 1-year reservation: **37% discount**
- 3-year reservation: **56% discount**

**Example:**
- On-demand t4g.small: $24/month = $288/year
- 1-year reserved: $181/year (**saves $107/year**)
- 3-year reserved: $127/year (**saves $161/year**)

**When to use:**
- Stable production workload (not variable traffic)
- Long-term commitment (>1 year)
- **Not recommended for hackathons/startups** (use serverless instead!)

### 4. **Development: Use Local Valkey/Redis**

```bash
# Install Valkey locally (Docker - easiest)
docker run -d -p 6379:6379 valkey/valkey:7-alpine

# Or Redis (also compatible)
docker run -d -p 6379:6379 redis:7-alpine

# .env
REDIS_URL=redis://localhost:6379/0
REDIS_CACHE_ENABLED=true
```

**Disable caching entirely (for testing):**
```bash
# In .env
REDIS_CACHE_ENABLED=false  # Fallback to direct API calls
```

---

## Testing & Validation

### 1. **Test Cache Connection**

**For Serverless:**
```bash
# Use valkey-cli or redis-cli (both work)
redis-cli -h agri-translate-cache.serverless.aps1.cache.amazonaws.com -p 6379 --tls

# Should see:
agri-translate-cache.serverless:6379> PING
PONG

# Test set/get
agri-translate-cache.serverless:6379> SET test "hello"
OK
agri-translate-cache.serverless:6379> GET test
"hello"
agri-translate-cache.serverless:6379> DEL test
(integer) 1
```

**For Fixed Nodes:**
```bash
redis-cli -h agri-translate-cache.abc123.0001.aps1.cache.amazonaws.com -p 6379

# With TLS:
redis-cli -h your-cache.amazonaws.com -p 6379 --tls

# With AUTH token:
redis-cli -h your-cache.amazonaws.com -p 6379 -a YOUR_AUTH_TOKEN --tls
```
agri-translate-cache:6379> GET test
"hello"
agri-translate-cache:6379> DEL test
(integer) 1
```

**With AUTH token**:
```bash
redis-cli -h your-cache.amazonaws.com -p 6379 -a YOUR_AUTH_TOKEN --tls
```

### 2. **Monitor Cache Performance**

**Backend API endpoint** (add to your routes):
```python
# backend/app/api/routes/admin.py
from app.core.cache import get_cache_stats

@router.get("/cache-stats")
async def cache_stats():
    """Get cache performance metrics."""
    return await get_cache_stats()
```

**Response:**
```json
{
  "available": true,
  "connected_clients": 5,
  "used_memory_human": "12.3M",
  "total_commands_processed": 45823,
  "keyspace_hits": 38492,
  "keyspace_misses": 7331,
  "hit_rate": 84.0
}
```

**Target Hit Rate: >60%** (good caching strategy)

### 3. **Monitor Cost Savings**

**CloudWatch Dashboard** (create custom):
1. Go to CloudWatch → Dashboards → Create dashboard
2. Add widgets:
   - **CacheHits**: Line graph (shows cache effectiveness)
   - **CacheMisses**: Line graph (shows API fallbacks)
   - **NetworkBytesIn**: Savings indicator (less network = less cost)
   - **DatabaseMemoryUsagePercentage**: Capacity planning

**Calculate Savings:**
```python
# Example calculation
bedrock_kb_cost_per_query = $0.005  # Estimated
cache_hits_per_day = 5000
days_per_month = 30

savings_per_month = bedrock_kb_cost_per_query * cache_hits_per_day * days_per_month
# = $0.005 * 5000 * 30 = $750/month saved!

elasticache_cost = $30/month
net_savings = $750 - $30 = $720/month 💰
```

---

## Troubleshooting

### Issue 1: `ConnectionError: Error connecting to Redis`

**Cause**: Security group not allowing port 6379

**Fix**:
1. Go to EC2 → Security Groups → Your ElastiCache SG
2. Add inbound rule: Custom TCP, Port 6379, Source: Your IP or Backend SG
3. Wait 30 seconds, retry connection

### Issue 2: `NOAUTH Authentication required`

**Cause**: Cache has AUTH enabled but no token in URL

**Fix**:
```bash
# Update .env with auth token
REDIS_URL=rediss://:YOUR_AUTH_TOKEN@endpoint:6379
```

### Issue 3: High memory usage / Evictions

**Cause**: Too many cache entries for node size

**Fix Options**:
1. **Increase node size**: t3.small → t3.medium
2. **Reduce TTL**: Lower cache expiry times
3. **Selective caching**: Only cache expensive operations (KB queries)
4. **Implement LRU eviction**: (already default in Redis)

**Check current eviction policy**:
```bash
redis-cli -h your-cache.com CONFIG GET maxmemory-policy
# Should return: "allkeys-lru" (evicts least recently used)
```

### Issue 4: Low cache hit rate (<40%)

**Causes & Fixes**:
1. **Highly unique queries**: Enable semantic hashing (already in code)
2. **TTL too short**: Increase TTL for stable data
3. **Cache warming needed**: Pre-populate common queries on startup
4. **Traffic too low**: Normal for new deployment, improves over time

### Issue 5: Cannot connect from local machine

**Cause**: ElastiCache is in private VPC

**Options**:
1. **SSH Tunnel** (recommended for debugging):
   ```bash
   # SSH to EC2 instance in same VPC
   ssh -i your-key.pem -L 6379:agri-cache.amazonaws.com:6379 ec2-user@your-ec2-ip
   
   # Now connect locally
   redis-cli -h localhost -p 6379
   ```

2. **VPN**: Set up AWS Client VPN (more complex, $0.05/hour)

3. **Development**: Use local Redis instead
   ```bash
   docker run -d -p 6379:6379 redis:7-alpine
   ```

---

## Migration Checklist

- [ ] Create ElastiCache cluster (t3.small recommended)
- [ ] Configure security group (allow port 6379 from backend)
- [ ] Enable encryption at rest (free, compliance)
- [ ] Enable encryption in transit for production (rediss://)
- [ ] Set AUTH token for production
- [ ] Update `.env` with `REDIS_URL`
- [ ] Deploy backend with caching code
- [ ] Test cache connection: `redis-cli PING`
- [ ] Monitor hit rate for 24 hours (target >60%)
- [ ] Verify cost savings in AWS Cost Explorer (1 week)
- [ ] Adjust TTL based on hit rate and business needs
- [ ] Set up CloudWatch alarms:
  - High memory (>80%)
  - Low hit rate (<40%)
  - Connection errors
- [ ] Document cache keys and TTL for team
- [ ] Schedule monthly cost review

---

## Expected Results

**Before Caching:**
```
Request 1: "How to grow rice?" → Bedrock KB call → 800ms → $0.005
Request 2: "Rice cultivation methods?" → Bedrock KB call → 850ms → $0.005
Request 3: "Rice farming tips?" → Bedrock KB call → 900ms → $0.005
```
**Total: 2550ms, $0.015**

**After Caching:**
```
Request 1: "How to grow rice?" → Bedrock KB call → 800ms → $0.005 → Cached
Request 2: "Rice cultivation methods?" → Cache hit (semantic) → 5ms → $0
Request 3: "Rice farming tips?" → Cache hit (semantic) → 5ms → $0
```
**Total: 810ms, $0.005**

**Improvement: 68% faster, 67% cheaper** ✨

---

## Support & Resources

- **AWS ElastiCache Documentation**: https://docs.aws.amazon.com/elasticache/
- **Redis Best Practices**: https://redis.io/docs/management/optimization/
- **Pricing Calculator**: https://calculator.aws/
- **Code Implementation**: See `backend/app/core/cache.py`

**Questions?** Check CloudWatch Logs → `/aws/elasticache/agri-translate-cache`
