
import os
import time

from dotenv import load_dotenv
from google import genai
from google.genai.errors import ServerError, ClientError

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
model_name = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

if not api_key:
    raise RuntimeError("GEMINI_API_KEY missing in .env")

client = genai.Client(api_key=api_key)

max_attempts = 3

for attempt in range(1, max_attempts + 1):
    try:
        print(f"Connecting to Gemini... Attempt {attempt}")

        response = client.models.generate_content(
            model=model_name,
            contents=(
                "Suggest one healthy Sri Lankan "
                "vegetarian breakfast in 2 sentences."
            ),
        )

        print("\nGemini AI Connection Successful!")
        print(response.text)
        break

    except ServerError as error:
        if error.code != 503:
            raise

        if attempt == max_attempts:
            print("Gemini server is still busy. Try later.")
            break

        wait_seconds = 5 * (2 ** (attempt - 1))
        print(f"Server busy. Retrying in {wait_seconds}s...")
        time.sleep(wait_seconds)

    except ClientError as error:
        print(f"Gemini API Error: {error}")
        break

