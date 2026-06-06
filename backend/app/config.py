from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    SECRET_KEY: str
    DATABASE_URL: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    ALLOWED_ORIGINS: str
    ZEROBOUNCE_API_KEY: str

    @property
    def origins(self) -> List[str]:
        try:
            return json.loads(self.ALLOWED_ORIGINS)
        except Exception:
            return ["http://localhost:8000"]

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
