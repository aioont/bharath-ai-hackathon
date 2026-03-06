# Quick Start: Chat History Setup

## 🚀 Run This to Enable Chat History (5 minutes)

### Step 1: Database Migration

```powershell
# Navigate to backend
cd c:\Users\abhin\Desktop\project_to_win_hackathon\backend

# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Run migration script
python scripts\create_chat_history_tables.py
```

**Expected Output:**
```
✅ Chat history tables created successfully!
Verified tables: ['chat_conversations', 'chat_messages']
Created indexes: 8
```

---

### Step 2: Verify Database Tables

```powershell
# Connect to PostgreSQL (use your actual credentials)
$env:PGPASSWORD="YOUR_PASSWORD"
psql -h agrisaarthi-db.cjeoiqeekboz.ap-south-1.rds.amazonaws.com -U postgres -d agrisaarthi -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'chat%';
"
```

**Expected Output:**
```
   table_name        
---------------------
 chat_conversations
 chat_messages
(2 rows)
```

---

### Step 3: Test Chat API

```powershell
# Restart backend
cd c:\Users\abhin\Desktop\project_to_win_hackathon\backend
uvicorn app.main:app --reload --port 8000
```

**Test without authentication (anonymous chat):**
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/chat" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"message":"Hello","language":"en","category":"general","tts_enabled":false}'
```

**Test with authentication (saves to database):**
```powershell
# Get auth token first
$loginResponse = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"email":"test@example.com","password":"password123"}'

$token = $loginResponse.access_token

# Send chat message (will be saved to database)
Invoke-RestMethod -Uri "http://localhost:8000/api/chat" `
  -Method Post `
  -Headers @{"Authorization"="Bearer $token"} `
  -ContentType "application/json" `
  -Body '{"message":"Rice cultivation tips","language":"en","category":"general","tts_enabled":false}'
```

---

### Step 4: Verify Data Saved

```powershell
# Check conversations created
psql -h agrisaarthi-db.cjeoiqeekboz.ap-south-1.rds.amazonaws.com -U postgres -d agrisaarthi -c "
SELECT id, title, language, category, message_count, created_at 
FROM chat_conversations 
ORDER BY created_at DESC 
LIMIT 5;
"

# Check messages saved
psql -h agrisaarthi-db.cjeoiqeekboz.ap-south-1.rds.amazonaws.com -U postgres -d agrisaarthi -c "
SELECT role, LEFT(content, 50) as content, language, model_used, cached_response 
FROM chat_messages 
ORDER BY created_at DESC 
LIMIT 10;
"
```

---

### Step 5: Test Cache Hit

```powershell
# Send SAME message twice
$message = "What is the best rice variety?"

# First request (cache miss)
$response1 = Invoke-RestMethod -Uri "http://localhost:8000/api/chat" `
  -Method Post `
  -Headers @{"Authorization"="Bearer $token"} `
  -ContentType "application/json" `
  -Body "{`"message`":`"$message`",`"language`":`"en`",`"category`":`"general`",`"tts_enabled`":false}"

# Wait 2 seconds
Start-Sleep -Seconds 2

# Second request (should be cached)
$response2 = Invoke-RestMethod -Uri "http://localhost:8000/api/chat" `
  -Method Post `
  -Headers @{"Authorization"="Bearer $token"} `
  -ContentType "application/json" `
  -Body "{`"message`":`"$message`",`"language`":`"en`",`"category`":`"general`",`"tts_enabled`":false}"
```

**Check backend logs:**
```
INFO  ai_response_generated response_time_ms=1234 tokens=156        # First request
INFO  serving_cached_response response_time_ms=45 saved_cost=~$0.005-0.01  # Second request ✅
```

---

### Step 6: Get Chat History

```powershell
# List conversations
Invoke-RestMethod -Uri "http://localhost:8000/api/chat/conversations?limit=10" `
  -Headers @{"Authorization"="Bearer $token"}

# Get specific conversation
$conversationUuid = "UUID_FROM_ABOVE"
Invoke-RestMethod -Uri "http://localhost:8000/api/chat/conversations/$conversationUuid?include_audio=false" `
  -Headers @{"Authorization"="Bearer $token"}
```

---

### Step 7: Get Analytics

```powershell
# Get 7-day analytics
Invoke-RestMethod -Uri "http://localhost:8000/api/chat/analytics?days=7" `
  -Headers @{"Authorization"="Bearer $token"}
```

**Expected Response:**
```json
{
  "user_id": 1,
  "period_days": 7,
  "total_messages": 24,
  "conversations": 3,
  "cache_hit_rate": 71.5,
  "total_tokens": 5678,
  "avg_response_time_ms": 875
}
```

---

## 🎯 Verification Checklist

- [ ] Database migration completed successfully
- [ ] Tables `chat_conversations` and `chat_messages` exist
- [ ] Backend starts without errors
- [ ] Anonymous chat works (no database save)
- [ ] Authenticated chat saves to database
- [ ] Same query cached on second request (fast response)
- [ ] Conversation list endpoint returns data
- [ ] Analytics endpoint shows cache hit rate

---

## 🐛 Common Issues

### Issue 1: "psycopg2.OperationalError: connection to server failed"

**Solution:**
1. Fix RDS password in `.env` (replace "PASSWORD" placeholder)
2. Add your IP to RDS security group (122.165.158.209/32)
3. Add `?sslmode=require` to `DATABASE_POOL_URL`

### Issue 2: "Table 'chat_conversations' doesn't exist"

**Solution:**
```powershell
python backend\scripts\create_chat_history_tables.py
```

### Issue 3: "Cache not working (every request goes to AI)"

**Solution:**
1. Check ElastiCache URL in `.env`
2. Verify Redis connection:
```python
python -c "
import redis
r = redis.from_url('redis://agri-translate-cache-rwskkv.serverless.aps1.cache.amazonaws.com:6379')
print(r.ping())  # Should print True
"
```

### Issue 4: "401 Unauthorized" when calling /api/chat/conversations

**Solution:**
Get a valid JWT token:
```powershell
# Login
$response = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"email":"test@example.com","password":"password123"}'

$token = $response.access_token
echo "Token: $token"
```

---

## 📊 Monitor Costs

### Check Cache Hit Rate (Target: >70%)

```sql
SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN cached_response THEN 1 ELSE 0 END) as cached,
    ROUND(100.0 * SUM(CASE WHEN cached_response THEN 1 ELSE 0 END) / COUNT(*), 2) as hit_rate_pct
FROM chat_messages
WHERE created_at >= NOW() - INTERVAL '24 hours';
```

### Estimate Cost Savings

```sql
SELECT 
    COUNT(*) as requests,
    SUM(CASE WHEN cached_response THEN 0.0005 ELSE 0.015 END) as cost_with_cache,
    COUNT(*) * 0.015 as cost_without_cache,
    (COUNT(*) * 0.015) - SUM(CASE WHEN cached_response THEN 0.0005 ELSE 0.015 END) as savings
FROM chat_messages
WHERE role = 'assistant';
```

---

## 🎉 Success!

You now have:
- ✅ Persistent chat history
- ✅ Semantic caching (60-80% cost reduction)
- ✅ Multilingual audio storage
- ✅ Analytics dashboard
- ✅ Full conversation management

**Next Steps:**
1. Update frontend to load chat history (see [CHAT_HISTORY_INTEGRATION.md](../frontend/docs/CHAT_HISTORY_INTEGRATION.md))
2. Monitor cache hit rate daily
3. Review AWS bill in 1 week to see cost savings

---

**Questions?**
- Backend API: http://localhost:8000/docs
- Full Documentation: [CHAT_HISTORY_AND_AWS_OPTIMIZATION.md](./CHAT_HISTORY_AND_AWS_OPTIMIZATION.md)
- Frontend Integration: [../frontend/docs/CHAT_HISTORY_INTEGRATION.md](../frontend/docs/CHAT_HISTORY_INTEGRATION.md)
