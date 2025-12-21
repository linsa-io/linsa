use std::path::Path;

use anyhow::{Context, Result};
use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::Client;
use chrono::{Datelike, Utc};
use tracing::info;

pub struct S3Uploader {
    client: Client,
    bucket: String,
    prefix: String,
}

impl S3Uploader {
    pub async fn new(bucket: &str, prefix: &str) -> Result<Self> {
        let config = aws_config::load_from_env().await;
        let client = Client::new(&config);

        // Verify bucket access if bucket is configured
        if !bucket.is_empty() {
            client
                .head_bucket()
                .bucket(bucket)
                .send()
                .await
                .with_context(|| format!("verify access to S3 bucket: {bucket}"))?;
            info!("S3 bucket verified: {bucket}");
        }

        Ok(Self {
            client,
            bucket: bucket.to_string(),
            prefix: prefix.trim_matches('/').to_string(),
        })
    }

    /// Upload a file to S3. Returns the number of bytes uploaded.
    pub async fn upload_file(&self, path: &Path) -> Result<u64> {
        if self.bucket.is_empty() {
            // No bucket configured, skip upload
            info!("S3 bucket not configured, skipping upload");
            return Ok(0);
        }

        let filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .context("get filename")?;

        // Organize by date: prefix/YYYY/MM/DD/filename
        let now = Utc::now();
        let key = format!(
            "{}/{}/{:02}/{:02}/{}",
            self.prefix,
            now.format("%Y"),
            now.month(),
            now.day(),
            filename
        );

        let metadata = tokio::fs::metadata(path)
            .await
            .with_context(|| format!("stat {}", path.display()))?;
        let size = metadata.len();

        let body = ByteStream::from_path(path)
            .await
            .with_context(|| format!("read {}", path.display()))?;

        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(&key)
            .body(body)
            .content_type("video/mp2t")
            .send()
            .await
            .with_context(|| format!("upload to s3://{}/{}", self.bucket, key))?;

        info!(
            "Uploaded {} ({} bytes) to s3://{}/{}",
            filename, size, self.bucket, key
        );

        Ok(size)
    }
}
