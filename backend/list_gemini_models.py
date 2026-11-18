
import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise RuntimeError("GEMINI_API_KEY missing")

client = genai.Client(api_key=api_key)

for model in client.models.list():
    methods = model.supported_actions or []

    if "generateContent" in methods:
        print(model.name)
