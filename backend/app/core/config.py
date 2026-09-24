import os
from pydantic import BaseModel


class Settings(BaseModel):
    APP_NAME: str = "UniLotary Lao Lottery Platform"
    API_V1_PREFIX: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "SOKXAY_ENTERPRISE_SECRET_KEY_99283741829374")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./sokxay_lottery.db"
    )

    CORS_ORIGINS: list[str] = ["*"]
    S3_BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "")
    AWS_REGION: str = os.getenv("AWS_REGION", "auto")
    
    # Cloudflare R2 Support
    CLOUDFLARE_ACCOUNT_ID: str = os.getenv("CLOUDFLARE_ACCOUNT_ID", "")
    S3_ENDPOINT_URL: str = os.getenv(
        "S3_ENDPOINT_URL", 
        f"https://{os.getenv('CLOUDFLARE_ACCOUNT_ID')}.r2.cloudflarestorage.com" if os.getenv('CLOUDFLARE_ACCOUNT_ID') else None
    )


settings = Settings()
