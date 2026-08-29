import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Anbu Traders API"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-key-for-jwt-tokens-change-in-production")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    
    # PostgreSQL connection string
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/anbu_traders")
    
    # Supabase Configuration
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    SUPABASE_BUCKET_NAME: str = os.getenv("SUPABASE_BUCKET_NAME", "uploads")

    # Web Push / VAPID Configuration
    VAPID_PUBLIC_KEY: str = os.getenv(
        "VAPID_PUBLIC_KEY",
        "BFvykvvSXa-TvUnrnUNI7CEJT_7J2579TU7xyDc-WC1zgSUAaIXPpFPv761EwBMWqpMdisN6V1MmRwLUpoY5sAY"
    )
    VAPID_PRIVATE_KEY: str = os.getenv(
        "VAPID_PRIVATE_KEY",
        "-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgnDZSgRhQCZ7PdXNz\nuWEtLEgPdB+BqDHgu1T8LXh2HF6hRANCAARb8pL70l2vk71J651DSOwhCU/+ydue\n/U1O8cg3Plgtc4ElAGiFz6RT7++tRMATFqqTHYrDeldTJkcC1KaGObAG\n-----END PRIVATE KEY-----\n"
    )
    VAPID_CLAIM_EMAIL: str = os.getenv("VAPID_CLAIM_EMAIL", "mailto:admin@anbutraders.com")
    
    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"

settings = Settings()
