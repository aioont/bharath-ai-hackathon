# AWS Bedrock Setup Guide for AgriAI

This project uses AWS Bedrock for advanced AI capabilities including content filtering (Guardrails) and intelligent suggestions (Claude 3 Haiku).

## Prerequisites

1.  **AWS Account**: Ensure you have an active AWS account.
2.  **Region**: Use `us-east-1` (N. Virginia) or another region where Bedrock Models and Guardrails are available.

## Step 1: Request Model Access

1.  Go to the **Amazon Bedrock Console**.
2.  Click **Model access** in the bottom left sidebar.
3.  Click **Manage model access**.
4.  Select the following models:
    *   **Anthropic**: `Claude 3 Haiku`
    *   **Amazon**: `Titan Text Embeddings V2` (for Knowledge Base) & `Titan Text G1 - Express` (generic fallback)
5.  Click **Request model access**. Access is usually granted instantly.

## Step 2: Create a Knowledge Base (for Insurance Suggestions)

1.  Go to **Bedrock Console** -> **Knowledge bases**.
2.  Click **Create knowledge base**.
3.  **KB Name**: `agri-insurance-kb`.
4.  **IAM Role**: Create a new service role.
5.  **Data Source**:
    *   Upload the `backend/insurance_schemes.json` file to an S3 bucket (e.g., `agri-hackathon-data`).
    *   Point the data source to this S3 URI (e.g., `s3://agri-hackathon-data/`).
6.  **Embeddings Model**: Select `Titan Text Embeddings v2`.
7.  **Vector Store**: Choose **Quick create a new vector store** (creates an OpenSearch Serverless collection).
8.  Review and **Create**.
9.  **Important**: Note down the **Knowledge Base ID** (e.g., `ABC123XYZ`).
10. **Sync**: Once created, select your Data Source and clicked **Sync** to index the data.

## Step 3: Create Guardrails (for Safe Chat)

1.  Go to **Bedrock Console** -> **Guardrails**.
2.  Click **Create guardrail**.
3.  **Name**: `agri-chat-guardrail`.
4.  **Content Filters**:
    *   Enable filters for **Hate**, **Insults**, **Sexual**, **Violence**.
    *   Set strength to **High** or **Medium** as desired.
5.  **Denied Topics** (Optional): add distinct topics like "Politics", "Finance advice", etc.
6.  **Word Filters** (Optional): Add custom words to block.
7.  **Create** the guardrail.
8.  **Create Version**: Navigate to the guardrail and click **Create version** (e.g., Version `1`).
9.  **Note**: Copy the **Guardrail ID** and **Version**.

## Step 4: Configure the Application

Update your `backend/app/core/config.py` or `.env` file with these values:

```python
# AWS Bedrock Configuration
BEDROCK_KB_ID = "YOUR_KB_ID_HERE"           # From Step 2
BEDROCK_GUARDRAIL_ID = "YOUR_GUARDRAIL_ID"  # From Step 3
BEDROCK_GUARDRAIL_VERSION = "1"             # From Step 3
BEDROCK_CLAUDE_MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0"
```

## Step 5: Verify Setup

1.  **Restart Backend**: Restart your FastAPI server.
2.  **Test Chat**: Try sending a harmful message in the Expert Chat. It should be blocked by the Guardrail.
3.  **Test Insurance**: Go to Insurance Suggestion page. It should now use the Knowledge Base and format the answer using Claude 3 Haiku.

## Integration Details

*   **Chat**: Uses `BedrockClient.apply_guardrail()` for input/output filtering.
*   **Insurance**: Uses `BedrockClient.retrieve_and_generate()` for RAG and `invoke_haiku()` for final formatting.
*   **Evaluation**: Uses `Claude 3 Haiku` as a judge to evaluate AI responses.
