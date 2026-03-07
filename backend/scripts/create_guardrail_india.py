"""
One-time script: create an AWS Bedrock guardrail in ap-south-1 (Mumbai)
so it is co-located with all other AgriSaarthi services.
Run with:  .venv\Scripts\python.exe scripts/create_guardrail_india.py
"""
import boto3
import os
import sys

# Load .env manually (no external deps beyond python-dotenv which is already installed)
env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
env_vars: dict = {}
if os.path.exists(env_path):
    with open(env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env_vars[k.strip()] = v.strip().strip('"').strip("'").split("#")[0].strip()

AWS_ACCESS_KEY_ID = env_vars.get("AWS_ACCESS_KEY_ID") or os.environ.get("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = env_vars.get("AWS_SECRET_ACCESS_KEY") or os.environ.get("AWS_SECRET_ACCESS_KEY")
REGION = "ap-south-1"

client = boto3.client(
    "bedrock",
    region_name=REGION,
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
)

print(f"Creating guardrail in {REGION} ...")

response = client.create_guardrail(
    name="agrisaarthi-guardrail",
    description="Content safety guardrail for AgriSaarthi agricultural assistant",
    # --- Topic policy: block off-topic harmful requests ---
    topicPolicyConfig={
        "topicsConfig": [
            {
                "name": "Violence",
                "definition": "Requests that promote, encourage, or describe violence or harm to people or animals.",
                "examples": ["How do I hurt someone", "How to make a weapon"],
                "type": "DENY",
            },
            {
                "name": "Illegal_Activities",
                "definition": "Requests related to illegal activities such as drug manufacturing, smuggling, or fraud.",
                "examples": ["How to evade tax", "How to smuggle goods"],
                "type": "DENY",
            },
        ]
    },
    # --- Content filter ---
    contentPolicyConfig={
        "filtersConfig": [
            {"type": "HATE", "inputStrength": "HIGH", "outputStrength": "HIGH"},
            {"type": "INSULTS", "inputStrength": "MEDIUM", "outputStrength": "MEDIUM"},
            {"type": "SEXUAL", "inputStrength": "HIGH", "outputStrength": "HIGH"},
            {"type": "VIOLENCE", "inputStrength": "HIGH", "outputStrength": "HIGH"},
            {"type": "MISCONDUCT", "inputStrength": "MEDIUM", "outputStrength": "MEDIUM"},
            {"type": "PROMPT_ATTACK", "inputStrength": "HIGH", "outputStrength": "NONE"},
        ]
    },
    # --- Word filter: block obvious abuse terms ---
    wordPolicyConfig={
        "managedWordListsConfig": [
            {"type": "PROFANITY"},
        ]
    },
    blockedInputMessaging="I'm here to help with farming and agriculture. I can't assist with that request.",
    blockedOutputsMessaging="I'm here to help with farming and agriculture. I can't assist with that request.",
)

guardrail_id = response["guardrailId"]
guardrail_arn = response["guardrailArn"]
print(f"\n✅  Guardrail created!")
print(f"   ID      : {guardrail_id}")
print(f"   ARN     : {guardrail_arn}")
print(f"   Region  : {REGION}")

# Create version 1
ver_response = client.create_guardrail_version(guardrailIdentifier=guardrail_id, description="v1")
version = ver_response["version"]
print(f"   Version : {version}")

# --- Patch .env in place ---
env_file = os.path.abspath(env_path)
with open(env_file, encoding="utf-8") as f:
    content = f.read()

import re

# Update BEDROCK_GUARDRAIL_ID
content = re.sub(
    r'^(BEDROCK_GUARDRAIL_ID\s*=\s*).*$',
    f'BEDROCK_GUARDRAIL_ID = "{guardrail_id}"',
    content, flags=re.MULTILINE
)
# Update BEDROCK_GUARDRAIL_VERSION
content = re.sub(
    r'^(BEDROCK_GUARDRAIL_VERSION\s*=\s*).*$',
    f'BEDROCK_GUARDRAIL_VERSION = "{version}"',
    content, flags=re.MULTILINE
)
# Remove BEDROCK_GUARDRAIL_REGION (not needed — now same region as everything else)
content = re.sub(
    r'^BEDROCK_GUARDRAIL_REGION\s*=.*\n?',
    '',
    content, flags=re.MULTILINE
)

with open(env_file, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\n✅  .env updated automatically.")
print(f"   BEDROCK_GUARDRAIL_ID = {guardrail_id}")
print(f"   BEDROCK_GUARDRAIL_VERSION = {version}")
print(f"   BEDROCK_GUARDRAIL_REGION removed (defaults to ap-south-1)\n")
print("Now restart uvicorn to pick up the changes.")
