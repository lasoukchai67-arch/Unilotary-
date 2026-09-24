"""
Cloud Storage Abstraction Service
Enforces RULE 5: Implements dedicated Service Class for secure Cloud Storage uploads,
downloads, and Presigned URL generation (S3, GCS, or Local Filesystem provider).
"""

import os
import hashlib
import mimetypes
from typing import Optional, Dict, Any
from abc import ABC, abstractmethod


class StorageProvider(ABC):
    @abstractmethod
    def upload_file(self, file_bytes: bytes, storage_key: str, content_type: str) -> Dict[str, Any]:
        pass

    @abstractmethod
    def download_file(self, storage_key: str) -> bytes:
        pass

    @abstractmethod
    def generate_presigned_url(self, storage_key: str, expires_in_seconds: int = 3600) -> str:
        pass


class S3StorageProvider(StorageProvider):
    def __init__(self, bucket_name: str, region: str = "ap-southeast-1", endpoint_url: Optional[str] = None):
        import boto3
        from botocore.config import Config
        self.bucket = bucket_name
        self.client = boto3.client(
            "s3", 
            region_name=region, 
            endpoint_url=endpoint_url,
            config=Config(signature_version="s3v4")
        )

    def upload_file(self, file_bytes: bytes, storage_key: str, content_type: str) -> Dict[str, Any]:
        self.client.put_object(
            Bucket=self.bucket,
            Key=storage_key,
            Body=file_bytes,
            ContentType=content_type
        )
        return {"storage_key": storage_key, "bucket": self.bucket}

    def download_file(self, storage_key: str) -> bytes:
        resp = self.client.get_object(Bucket=self.bucket, Key=storage_key)
        return resp["Body"].read()

    def generate_presigned_url(self, storage_key: str, expires_in_seconds: int = 3600) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": storage_key},
            ExpiresIn=expires_in_seconds
        )


class LocalStorageProvider(StorageProvider):
    def __init__(self, base_directory: str = "storage_bucket"):
        self.base_dir = os.path.abspath(base_directory)
        os.makedirs(self.base_dir, exist_ok=True)

    def upload_file(self, file_bytes: bytes, storage_key: str, content_type: str) -> Dict[str, Any]:
        target_path = os.path.join(self.base_dir, storage_key)
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        with open(target_path, "wb") as f:
            f.write(file_bytes)
        return {"storage_key": storage_key, "local_path": target_path}

    def download_file(self, storage_key: str) -> bytes:
        target_path = os.path.join(self.base_dir, storage_key)
        if not os.path.exists(target_path):
            raise FileNotFoundError(f"Object {storage_key} not found in storage.")
        with open(target_path, "rb") as f:
            return f.read()

    def generate_presigned_url(self, storage_key: str, expires_in_seconds: int = 3600) -> str:
        # Returns secure application download endpoint path
        return f"/api/v1/docs/download?storage_key={storage_key}"


class CloudStorageService:
    """
    Dedicated Service Class exposing high-level document and ticket receipt
    storage operations with SHA-256 integrity validation and presigned links.
    """
    def __init__(self, provider: Optional[StorageProvider] = None):
        if provider:
            self.provider = provider
        else:
            from app.core.config import settings
            bucket_name = settings.S3_BUCKET_NAME
            if bucket_name:
                self.provider = S3StorageProvider(
                    bucket_name=bucket_name,
                    region=settings.AWS_REGION,
                    endpoint_url=settings.S3_ENDPOINT_URL
                )
            else:
                self.provider = LocalStorageProvider()

    def store_document(
        self,
        reference_id: str,
        reference_type: str,
        file_bytes: bytes,
        file_name: str,
        mime_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Upload file to storage and calculate cryptographic hash."""
        if not mime_type:
            mime_type, _ = mimetypes.guess_type(file_name)
            mime_type = mime_type or "application/octet-stream"

        file_size = len(file_bytes)
        sha256_hash = hashlib.sha256(file_bytes).hexdigest()
        ext = os.path.splitext(file_name)[1]
        storage_key = f"{reference_type.lower()}/{reference_id}/{sha256_hash[:16]}{ext}"

        upload_meta = self.provider.upload_file(file_bytes, storage_key, mime_type)

        return {
            "reference_id": reference_id,
            "reference_type": reference_type,
            "storage_key": storage_key,
            "file_name": file_name,
            "mime_type": mime_type,
            "file_size_bytes": file_size,
            "sha256_hash": sha256_hash,
            "presigned_url": self.provider.generate_presigned_url(storage_key, expires_in_seconds=3600),
            **upload_meta
        }

    def retrieve_document(self, storage_key: str) -> bytes:
        return self.provider.download_file(storage_key)

    def get_presigned_download_url(self, storage_key: str, expires_in_seconds: int = 3600) -> str:
        return self.provider.generate_presigned_url(storage_key, expires_in_seconds)


# Global singleton instance
storage_service = CloudStorageService()
