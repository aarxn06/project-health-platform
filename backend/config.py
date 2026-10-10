import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Base configuration for the AI-Driven Software Engineering Metrics Platform."""

    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    REPO_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))

    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-academic-platform-secret")

    DEFAULT_DB_PATH = os.path.join(BASE_DIR, "instance", "project_health.db")
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    MAX_UPLOAD_SIZE_MB = float(os.environ.get("MAX_UPLOAD_SIZE_MB", "25"))
    MAX_CONTENT_LENGTH = int(MAX_UPLOAD_SIZE_MB * 1024 * 1024)

    UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
    TEMP_EXTRACT_DIR = os.path.join(BASE_DIR, "temp_extract")
    DATA_DIR = os.path.join(REPO_ROOT, "data")
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")

