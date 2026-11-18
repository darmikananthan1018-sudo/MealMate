
import os

from dotenv import load_dotenv
from groq import Groq

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")
model_name = os.getenv(
    "GROQ_MODEL",
    "llama-3.3-70b-versatile"
)

if not api_key:
    raise RuntimeError(
        "GROQ_API_KEY missing in .env"
    )

client = Groq(api_key=api_key)

print("Connecting to Groq AI...")

response = client.chat.completions.create(
    model=model_name,
    messages=[
        {
            "role": "user",
            "content": (
                "Suggest one affordable Sri Lankan "
                "vegetarian breakfast in one sentence."
            )
        }
    ],
    temperature=0.3,
    max_completion_tokens=150,
)

print("\nGroq AI Connection Successful!")

print(response.choices[0].message.content)
