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
        "BNcN5DcLo7iYHm3NPxiM4EpopRXHtOXzhyU-8AUu3DoDimJ3PEY-F3FslbMzZ21uUUtbc6xtIVeyC7PpfGdbIp4"
    )
    VAPID_PRIVATE_KEY: str = os.getenv(
        "VAPID_PRIVATE_KEY",
        "N3syxR8LFfoPb3yHe3t5dAUl7wtviMTSzEC64KFVD6Q"
    )
    VAPID_CLAIM_EMAIL: str = os.getenv("VAPID_CLAIM_EMAIL", "mailto:admin@anbutraders.com")
    
    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"

settings = Settings()
