# AgriAI Insurance Advisor Feature

## Overview
The Insurance Advisor is an AI-powered system designed to recommend the most suitable government insurance schemes to farmers based on their specific profile and farming data. It leverages **AWS Bedrock Knowledge Base** for accurate scheme data and **Amazon Nova Pro** for intelligent reasoning and personalized advice.

## How It Works

1.  **Data Collection**:
    The system collects detailed farmer profile data:
    *   **Personal**: Name, Age, Gender, Social Category.
    *   **Location**: State, District.
    *   **Farming**: Primary Crop, Land Area (Acres), Farming Type (Irrigated/Rain-fed), Income Level.

2.  **Orchestration (Endpoint: `/api/insurance/suggest`)**:
    *   **Step 1: Query Construction**: A natural language query is built representing the farmer (e.g., *"insurance cover for small farmer growing wheat in Punjab..."*).
    *   **Step 2: Knowledge Retrieval (RAG)**: This query is sent to **AWS Bedrock Knowledge Base**, which searches through indexed official government scheme documents to find relevant rules and guidelines.
    *   **Step 3: Live Data**: Simultaneously, the system checks `myscheme.gov.in` for the latest active schemes.
    *   **Step 4: AI Reasoning**: All retrieved information (User Profile + KB Documents + Live Schemes) is assembled into a prompt.

3.  **AI Models Used**:
    *   **Retrieval**: AWS Bedrock Knowledge Base (Titan Embeddings v2).
    *   **Reasoning & Formatting**: **Amazon Nova Pro** (via AWS Bedrock `converse` API) or **Sarvam-M** (Fallback).
    *   **Guardrails**: AWS Bedrock Guardrails ensures safety and relevance.

4.  **Prompt Strategy**:
    The prompt instructs the AI to act as an expert advisor. It provides the raw scheme data and the farmer's profile and asks for:
    *   Top 3 recommendations with specific justifications.
    *   Required documents list.
    *   Urgent next steps.
    *   Estimated costs/benefits.

## Benefits
*   **Hyper-Personalization**: Unlike standard search, it explains *why* a scheme is good for *this specific farmer* (e.g., "Because you are a woman farmer with <2 acres...").
*   **Accuracy**: Grounded in official documents via RAG (Retrieval-Augmented Generation), reducing hallucinations.
*   **Accessibility**: returns detailed, actionable steps in the user's local language (supported via Sarvam).

## Technical Flow
`User Frontend` -> `FastAPI Backend` -> `AWS Bedrock Agent (KB)` -> `Amazon Nova Pro` -> `Formatted Response`
