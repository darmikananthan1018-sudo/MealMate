
from pathlib import Path
import os

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


class Settings:
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = int(os.getenv("DB_PORT", "3306"))
    DB_USER = os.getenv("DB_USER", "mealmate_user")
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    DB_NAME = os.getenv("DB_NAME", "mealmate_db")

    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
    JWT_ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
    )


settings = Settings()

if not settings.DB_PASSWORD:
    raise RuntimeError("DB_PASSWORD is missing in .env")

if not settings.JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY is missing in .env")

if len(settings.JWT_SECRET_KEY) < 32:
    raise RuntimeError(
        "JWT_SECRET_KEY must be at least 32 characters"
    )
