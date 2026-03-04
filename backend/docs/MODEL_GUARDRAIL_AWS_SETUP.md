# AWS Bedrock Setup Guide for AgriAI

This project uses AWS Bedrock for advanced AI capabilities including:
- **Guardrails**: Content filtering for safe chat
- **Insurance Knowledge Base**: RAG for insurance scheme suggestions
- **Agriculture Knowledge Base**: RAG for farming knowledge/recommendations (agent tool)
- **Claude 3 Haiku**: Intelligent response formatting and evaluation

## Prerequisites

1.  **AWS Account**: Ensure you have an active AWS account.
2.  **Region**: Use `ap-south-1` (Mumbai) or `us-east-1` (N. Virginia) where Bedrock Models and Guardrails are available.
3.  **AWS CLI**: Install and configure AWS CLI with your credentials.

---

## Step 1: Request Model Access

1.  Go to the **Amazon Bedrock Console**.
2.  Click **Model access** in the bottom left sidebar.
3.  Click **Manage model access**.
4.  Select the following models:
    *   **Anthropic**: `Claude 3 Haiku`
    *   **Amazon**: `Titan Text Embeddings V2` (for Knowledge Base) & `Titan Text G1 - Express` (generic fallback)
5.  Click **Request model access**. Access is usually granted instantly.

---

## Step 2: Create Insurance Knowledge Base

1.  Go to **Bedrock Console** → **Knowledge bases**.
2.  Click **Create knowledge base**.
3.  **KB Name**: `agri-insurance-kb`.
4.  **IAM Role**: Create a new service role (auto-generated).
5.  **Data Source**:
    *   Upload the `backend/insurance_schemes.json` file to your S3 bucket (e.g., `agri-translate-images`).
    *   Create a folder: `insurance-schemes/`
    *   Point the data source to this S3 URI: `s3://agri-translate-images/insurance-schemes/`
6.  **Embeddings Model**: Select `Titan Text Embeddings v2`.
7.  **Vector Store**: Choose **Quick create a new vector store** (creates an OpenSearch Serverless collection named `bedrock-knowledge-base-default-<random>`).
8.  Review and **Create**.
9.  **Important**: Note down the **Knowledge Base ID** (e.g., `ABC123XYZ`).
10. **Sync**: Once created, select your Data Source and click **Sync** to index the data (takes ~2-5 minutes).

---

## Step 3: Create Agriculture Knowledge Base (with Agent Tool)

This Knowledge Base will be used by the AI agent as a tool for answering farming questions.

### 3.1: Upload Agricultural Documents to S3

You can use the provided ingestion script to upload PDFs, research papers, and farming guides:

```bash
# Navigate to backend directory
cd backend

# Install dependencies
pip install boto3 requests

# Option 1: Ingest from a directory of PDFs
python scripts/ingest_agriculture_knowledge.py \
  --source /path/to/your/agriculture/pdfs \
  --bucket agri-translate-images \
  --prefix agriculture-knowledge/

# Option 2: Ingest from URLs
python scripts/ingest_agriculture_knowledge.py \
  --url https://agricoop.nic.in/crop-guide.pdf \
  --bucket agri-translate-images

# Option 3: Ingest from a list file
python scripts/ingest_agriculture_knowledge.py \
  --source-list scripts/agriculture_sources.txt \
  --bucket agri-translate-images
```

**Sample Documents to Include:**
- Crop cultivation guides (wheat, rice, cotton, etc.)
- Pest and disease management manuals
- Soil health and fertilizer recommendations
- Government farming schemes and subsidies
- Organic farming best practices
- Post-harvest and marketing guides
- Regional farming calendars (Kharif, Rabi, Zaid)

### 3.2: Create Knowledge Base in AWS Console

1.  Go to **Bedrock Console** → **Knowledge bases**.
2.  Click **Create knowledge base**.
3.  **KB Name**: `agri-farming-kb`.
4.  **Description**: "Agricultural knowledge base for crop cultivation, pest management, and farming best practices."
5.  **IAM Role**: Use the same service role created for insurance KB.
6.  **Data Source**:
    *   **S3 URI**: `s3://agri-translate-images/agriculture-knowledge/`
    *   **Chunking Strategy**: Fixed-size chunking (default 300 tokens with 20% overlap)
7.  **Embeddings Model**: Select `Titan Text Embeddings V2`.
8.  **Vector Store**: 
    *   **✅ RECOMMENDED: Option A** - Reuse the existing OpenSearch Serverless collection (`bedrock-knowledge-base-28lv9v`)
        - **Why?** AWS Bedrock automatically creates separate indexes within the same collection for each KB
        - Your existing collection shows 9.42 MiB usage (plenty of capacity for both KBs)
        - **Cost Savings**: ~$90/month vs $180/month for two collections
        - Each KB gets its own isolated index (e.g., `insurance-index`, `agriculture-index`)
        - Shared data access policies simplify management
    *   **Option B** - Create a new collection (only if you need strict data isolation or have compliance requirements)
9.  Review and **Create**.
10. **Note**: Copy the **Knowledge Base ID** (e.g., `XYZ789ABC`).
11. **Sync**: Select your Data Source and click **Sync** to index all documents (~5-15 minutes depending on document count).

### 3.3: Test the Knowledge Base

Before integrating, test it in the AWS Console:

1. In the Bedrock Console, select your `agri-farming-kb`.
2. Click **"Test knowledge base"** button.
3. Try sample queries:
   - "What are the best practices for wheat cultivation in Rabi season?"
   - "How to manage aphids in cotton crops?"
   - "What is the recommended NPK ratio for rice farming?"
   - "When should I plant maize in Maharashtra?"

If responses are relevant, your KB is ready!

---

## Step 4: Create Guardrails (for Safe Chat)

1.  Go to **Bedrock Console** → **Guardrails**.
2.  Click **Create guardrail**.
3.  **Name**: `agri-chat-guardrail`.
4.  **Content Filters**:
    *   Enable filters for **Hate**, **Insults**, **Sexual**, **Violence**.
    *   Set strength to **High** or **Medium** as desired.
5.  **Denied Topics** (Optional): Add topics like:
    - Politics
    - Non-agricultural financial advice
    - Medical prescriptions (only agricultural advice)
6.  **Word Filters** (Optional): Add custom words to block.
7.  **Create** the guardrail.
8.  **Create Version**: Navigate to the guardrail and click **Create version** (e.g., Version `1`).
9.  **Note**: Copy the **Guardrail ID** and **Version**.

---

## Step 5: Create OpenSearch Serverless Collection (if not auto-created)

If you chose "Provide your own vector store" during KB creation:

1.  Go to **Amazon OpenSearch Service Console**.
2.  Click **Collections** → **Create collection**.
3.  **Collection name**: `agri-knowledge-vectors`.
4.  **Collection type**: **Vector search**.
5.  **Deployment**: Serverless.
6.  **Network**: Public access (for demo) or VPC (for production).
7.  **Encryption**: Use AWS-managed keys.
8.  **Data access policy**: Grant access to your Bedrock service role:
    ```json
    [
      {
        "Rules": [
          {
            "Resource": ["index/agri-knowledge-vectors/*"],
            "Permission": ["aoss:*"],
            "ResourceType": "index"
          }
        ],
        "Principal": ["arn:aws:iam::<account-id>:role/service-role/AmazonBedrockExecutionRoleForKnowledgeBase_*"]
      }
]
    ```
9.  **Create** and note the **Collection endpoint**.

---

## Step 6: Configure the Application

Update your `backend/.env` file with these values:

```bash
# AWS Configuration
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ap-south-1

# S3 (already configured)
S3_BUCKET_NAME=agri-translate-images
S3_REGION=ap-south-1

# Bedrock Models
BEDROCK_CLAUDE_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0

# Bedrock Guardrail (from Step 4)
BEDROCK_GUARDRAIL_ID=your_guardrail_id
BEDROCK_GUARDRAIL_VERSION=1

# Knowledge Base IDs
BEDROCK_INSURANCE_KB_ID=ABC123XYZ       # From Step 2
BEDROCK_AGRI_KB_ID=XYZ789ABC           # From Step 3 (NEW!)
```

Also update `backend/app/core/config.py` to include the new field:

```python
# Add to Settings class
BEDROCK_INSURANCE_KB_ID: str = ""  # Existing
BEDROCK_AGRI_KB_ID: str = ""       # NEW for agriculture KB
```

---

## Step 7: Verify Setup

1.  **Restart Backend**: 
    ```bash
    cd backend
    uvicorn app.main:app --reload
    ```

2.  **Test Guardrail**: 
    - Send an offensive message in the Expert Chat. 
    - It should be blocked by the Guardrail.

3.  **Test Insurance KB**: 
    - Go to Insurance Suggestion page. 
    - It should use the insurance KB and format with Claude 3 Haiku.

4.  **Test Agriculture KB (Agent Tool)**:
    - In Expert Chat, ask: *"What are the best farming practices for growing tomatoes?"*
    - The agent should automatically invoke the `KNOWLEDGE` tool.
    - Response should include information from your uploaded documents.

---

## Integration Details

### Chat Endpoint
- Uses `BedrockClient.apply_guardrail()` for input/output filtering.
- Agent has access to `KNOWLEDGE` tool for RAG queries.

### Insurance Endpoint
- Uses `BedrockClient.retrieve_and_generate()` with `BEDROCK_INSURANCE_KB_ID`.
- Uses `invoke_haiku()` for final formatting.

### Agriculture Knowledge (Agent Tool)
- **Tool Name**: `KNOWLEDGE`
- **When Used**: Agent autonomously decides when farming knowledge is needed.
- **How**: Queries `BEDROCK_AGRI_KB_ID` via `retrieve_and_generate()`.
- **Example Triggers**:
  - "How to grow wheat in Punjab?"
  - "Best pesticide for cotton bollworm?"
  - "Soil preparation for mango orchard?"

### Evaluation
- Uses `Claude 3 Haiku` as a judge to evaluate AI response quality.

---

## Cost Optimization Tips

1.  **✅ Reuse OpenSearch Collection**: Use the same collection for both KBs to save ~$90/month.
    - AWS Bedrock creates separate indexes automatically (e.g., `bedrock-kb-insurance`, `bedrock-kb-agriculture`)
    - Your collection `bedrock-knowledge-base-28lv9v` can easily handle both KBs
    - Current usage: 9.42 MiB (can scale to GBs)
2.  **Limit Sync Frequency**: Only sync when you add new documents.
3.  **Use Haiku**: Claude 3 Haiku is 25x cheaper than Opus.
4.  **Chunk Size**: Default 300 tokens is good; don't make too small (more embeddings = higher cost).
5.  **OpenSearch Serverless Pricing**: ~$90/month for vector search workload (no free tier).
    - Formula: OCU (OpenSearch Compute Units) × Hours × $0.24/hour
    - Typical small KB: 2 OCUs = ~$90/month

---

## Troubleshooting
- **Check**: In OpenSearch Dashboards, verify index was created (e.g., `bedrock-kb-default-index`)

### "No Index" in OpenSearch Collection
- **Normal Behavior**: AWS Bedrock creates indexes automatically during first sync
- **To Verify**: Go to your KB → Data source → Click "Sync" → Wait 5-10 minutes
- **Check Index**: OpenSearch Dashboards → Index Management → Should see `bedrock-kb-<random>` index
- **Note**: The collection overview may show "-" for indexes, but indexes exist internally

### Knowledge Base Returns Empty Results
- **Check**: Did you sync the data source after uploading to S3?
- **Check**: Are the documents in a supported format (PDF, TXT, MD, HTML)?
- **Check**: Is the S3 URI correct in the KB data source configuration?

### Guardrail Not Blocking Content
- **Check**: Did you create a **version** of the guardrail?
- **Check**: Is `BEDROCK_GUARDRAIL_VERSION` set to the version number (not "DRAFT")?

### Access Denied Errors
- **Solution**: Go to Model Access and ensure Claude 3 Haiku is enabled.
- **Solution**: Check IAM permissions for Bedrock service role.

### Agent Not Using KNOWLEDGE Tool
- **Check**: Is `BEDROCK_AGRI_KB_ID` configured in `.env`?
- **Check**: Agent needs `tools_enabled=True` in the chat endpoint.
- **Test**: Ask a very specific farming question to trigger tool use.

---

## Sample Agriculture Knowledge Sources

### Free Government Resources
- **ICAR**: https://icar.gov.in (Crop Production Guides)
- **Agricoop**: https://agricoop.nic.in (Policy Documents)
- **Krishi Vigyan Kendra**: Regional farming calendars
- **State Agriculture Departments**: Localized guides

### Recommended Document Types
- ✅ Crop-specific cultivation manuals
- ✅ Integrated Pest Management (IPM) guides
- ✅ Soil testing and fertilizer recommendations
- ✅ Government scheme documents
- ✅ Research papers on sustainable farming
- ✅ Post-harvest handling guides
- ✅ Market price analysis reports

### Document Preparation Tips
- **OCR**: Ensure scanned PDFs are OCR'd (text-searchable).
- **Format**: Clean PDFs work best; avoid image-heavy documents.
- **Size**: Keep individual documents under 50MB.
- **Language**: English and Hindi work best with Titan Embeddings.
- **Structure**: Well-structured documents (headings, sections) improve retrieval.

---

## Next Steps After Setup

1. **Monitor Usage**: Check AWS Bedrock Console → Usage metrics.
2. **Add More Documents**: Keep expanding your agriculture KB with new research.
3. **Fine-tune Chunking**: Experiment with chunk sizes for better retrieval.
4. **Evaluation**: Use the `/api/evaluate` endpoint to measure response quality.
5. **User Feedback**: Collect farmer feedback to identify knowledge gaps.

---

**Need Help?**
- AWS Bedrock Documentation: https://docs.aws.amazon.com/bedrock/
- OpenSearch Serverless Guide: https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless.html
