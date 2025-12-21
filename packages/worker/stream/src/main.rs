mod receiver;
mod s3;
mod watcher;

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{Context, Result};
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::Json;
use axum::routing::get;
use axum::Router;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;
use tower_http::trace::TraceLayer;
use tracing::info;

use receiver::ReceiverHandle;
use s3::S3Uploader;
use watcher::SegmentWatcher;

#[derive(Clone)]
struct AppState {
    receiver: Arc<RwLock<Option<ReceiverHandle>>>,
    uploader: Option<Arc<S3Uploader>>,
    config: Arc<Config>,
    stats: Arc<RwLock<Stats>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Config {
    /// Port to listen for SRT stream
    srt_port: u16,
    /// Directory to store segments
    segment_dir: PathBuf,
    /// Segment duration in seconds
    segment_duration: u32,
    /// S3 bucket name
    s3_bucket: String,
    /// S3 prefix for uploads
    s3_prefix: String,
    /// HTTP API port
    api_port: u16,
    /// Delete local files after S3 upload
    delete_after_upload: bool,
    /// ffmpeg path
    ffmpeg_path: PathBuf,
    /// YouTube RTMP URL (rtmp://a.rtmp.youtube.com/live2)
    youtube_rtmp_url: String,
    /// YouTube stream key
    youtube_stream_key: String,
    /// Enable YouTube streaming
    youtube_enabled: bool,
    /// HLS output directory (for web playback)
    hls_dir: PathBuf,
    /// Enable HLS output for web playback
    hls_enabled: bool,
    /// HLS segment duration in seconds
    hls_segment_duration: u32,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            srt_port: 6000,
            segment_dir: PathBuf::from("/root/stream/segments"),
            segment_duration: 60,
            s3_bucket: String::new(),
            s3_prefix: "stream".into(),
            api_port: 8080,
            delete_after_upload: true,
            ffmpeg_path: PathBuf::from("ffmpeg"),
            youtube_rtmp_url: "rtmp://a.rtmp.youtube.com/live2".into(),
            youtube_stream_key: String::new(),
            youtube_enabled: false,
            hls_dir: PathBuf::from("/root/stream/hls"),
            hls_enabled: true, // Enable HLS by default for web playback
            hls_segment_duration: 4,
        }
    }
}

#[derive(Debug, Default, Serialize)]
struct Stats {
    receiving: bool,
    segments_uploaded: u64,
    bytes_uploaded: u64,
    last_segment: Option<String>,
    errors: Vec<String>,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("stream_server=info".parse().unwrap()),
        )
        .init();

    let config = load_config()?;
    info!("Starting stream server with config: {:?}", config);

    // Ensure segment directory exists
    tokio::fs::create_dir_all(&config.segment_dir)
        .await
        .with_context(|| format!("create segment dir {}", config.segment_dir.display()))?;

    // Initialize S3 uploader only when configured
    let uploader = if config.s3_bucket.trim().is_empty() {
        info!("S3 upload disabled (S3_BUCKET not set)");
        None
    } else {
        let uploader = S3Uploader::new(&config.s3_bucket, &config.s3_prefix).await?;
        Some(Arc::new(uploader))
    };

    let state = AppState {
        receiver: Arc::new(RwLock::new(None)),
        uploader: uploader.clone(),
        config: Arc::new(config.clone()),
        stats: Arc::new(RwLock::new(Stats::default())),
    };

    // Start segment watcher only when S3 upload is enabled
    if state.uploader.is_some() {
        let watcher_state = state.clone();
        tokio::spawn(async move {
            if let Err(e) = run_watcher(watcher_state).await {
                tracing::error!("Watcher error: {e}");
            }
        });
    }

    // Auto-start receiver
    let receiver_state = state.clone();
    tokio::spawn(async move {
        if let Err(e) = start_receiver_internal(&receiver_state).await {
            tracing::error!("Failed to start receiver: {e}");
        }
    });

    // Ensure HLS directory exists
    if config.hls_enabled {
        tokio::fs::create_dir_all(&config.hls_dir)
            .await
            .with_context(|| format!("create HLS dir {}", config.hls_dir.display()))?;
    }

    // Build HTTP API
    let mut app = Router::new()
        .route("/", get(index))
        .route("/status", get(status))
        .route("/start", get(start_receiver))
        .route("/stop", get(stop_receiver))
        .route("/health", get(health));

    // Serve HLS files if enabled
    if config.hls_enabled {
        info!("Serving HLS files from {} at /hls/", config.hls_dir.display());
        app = app.nest_service("/hls", ServeDir::new(&config.hls_dir));
    }

    let app = app
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.api_port));
    info!("HTTP API listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

fn load_config() -> Result<Config> {
    let mut config = Config::default();

    // Load from environment
    if let Ok(port) = std::env::var("SRT_PORT") {
        config.srt_port = port.parse().context("parse SRT_PORT")?;
    }
    if let Ok(dir) = std::env::var("SEGMENT_DIR") {
        config.segment_dir = PathBuf::from(dir);
    }
    if let Ok(duration) = std::env::var("SEGMENT_DURATION") {
        config.segment_duration = duration.parse().context("parse SEGMENT_DURATION")?;
    }
    if let Ok(bucket) = std::env::var("S3_BUCKET") {
        config.s3_bucket = bucket;
    }
    if let Ok(prefix) = std::env::var("S3_PREFIX") {
        config.s3_prefix = prefix;
    }
    if let Ok(port) = std::env::var("API_PORT") {
        config.api_port = port.parse().context("parse API_PORT")?;
    }
    if let Ok(delete) = std::env::var("DELETE_AFTER_UPLOAD") {
        config.delete_after_upload = delete == "true" || delete == "1";
    }
    if let Ok(path) = std::env::var("FFMPEG_PATH") {
        config.ffmpeg_path = PathBuf::from(path);
    }
    if let Ok(url) = std::env::var("YOUTUBE_RTMP_URL") {
        config.youtube_rtmp_url = url;
    }
    if let Ok(key) = std::env::var("YOUTUBE_STREAM_KEY") {
        config.youtube_stream_key = key;
        config.youtube_enabled = true;
    }
    if let Ok(enabled) = std::env::var("YOUTUBE_ENABLED") {
        config.youtube_enabled = enabled == "true" || enabled == "1";
    }
    if let Ok(dir) = std::env::var("HLS_DIR") {
        config.hls_dir = PathBuf::from(dir);
    }
    if let Ok(enabled) = std::env::var("HLS_ENABLED") {
        config.hls_enabled = enabled == "true" || enabled == "1";
    }
    if let Ok(duration) = std::env::var("HLS_SEGMENT_DURATION") {
        config.hls_segment_duration = duration.parse().context("parse HLS_SEGMENT_DURATION")?;
    }

    Ok(config)
}

async fn run_watcher(state: AppState) -> Result<()> {
    let uploader = match state.uploader.clone() {
        Some(uploader) => uploader,
        None => {
            info!("S3 upload disabled; segment watcher not started");
            return Ok(());
        }
    };
    let mut watcher = SegmentWatcher::new(&state.config.segment_dir)?;

    loop {
        if let Some(segment_path) = watcher.next_segment().await {
            let filename = segment_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();

            info!("Uploading segment: {}", filename);

            match uploader.upload_file(&segment_path).await {
                Ok(bytes) => {
                    let mut stats = state.stats.write().await;
                    stats.segments_uploaded += 1;
                    stats.bytes_uploaded += bytes;
                    stats.last_segment = Some(filename.clone());

                    if state.config.delete_after_upload {
                        if let Err(e) = tokio::fs::remove_file(&segment_path).await {
                            tracing::warn!("Failed to delete {}: {e}", segment_path.display());
                        } else {
                            info!("Deleted local segment: {}", filename);
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("Upload failed for {}: {e}", filename);
                    let mut stats = state.stats.write().await;
                    stats.errors.push(format!("Upload {}: {e}", filename));
                    if stats.errors.len() > 100 {
                        stats.errors.remove(0);
                    }
                }
            }
        }
    }
}

async fn start_receiver_internal(state: &AppState) -> Result<()> {
    let mut receiver_guard = state.receiver.write().await;
    if receiver_guard.is_some() {
        return Ok(());
    }

    let handle = if state.config.youtube_enabled && !state.config.youtube_stream_key.is_empty() {
        info!("Starting YouTube streaming mode");
        receiver::start_youtube(
            &state.config.ffmpeg_path,
            state.config.srt_port,
            &state.config.youtube_rtmp_url,
            &state.config.youtube_stream_key,
        )
        .await?
    } else if state.config.hls_enabled {
        info!("Starting HLS streaming mode");
        receiver::start_hls(
            &state.config.ffmpeg_path,
            state.config.srt_port,
            &state.config.hls_dir,
            state.config.hls_segment_duration,
        )
        .await?
    } else {
        receiver::start(
            &state.config.ffmpeg_path,
            state.config.srt_port,
            &state.config.segment_dir,
            state.config.segment_duration,
        )
        .await?
    };

    *receiver_guard = Some(handle);
    state.stats.write().await.receiving = true;

    info!(
        "SRT receiver started on port {}",
        state.config.srt_port
    );
    Ok(())
}

async fn index() -> &'static str {
    "Stream Server - POST /start, /stop, GET /status, /health"
}

async fn health() -> StatusCode {
    StatusCode::OK
}

async fn status(State(state): State<AppState>) -> Json<StatusResponse> {
    let stats = state.stats.read().await;
    let receiver = state.receiver.read().await;

    Json(StatusResponse {
        receiving: receiver.is_some(),
        srt_port: state.config.srt_port,
        s3_bucket: state.config.s3_bucket.clone(),
        youtube_enabled: state.config.youtube_enabled,
        youtube_rtmp_url: if state.config.youtube_enabled {
            Some(state.config.youtube_rtmp_url.clone())
        } else {
            None
        },
        hls_enabled: state.config.hls_enabled,
        hls_url: if state.config.hls_enabled {
            Some(format!("/hls/stream.m3u8"))
        } else {
            None
        },
        segments_uploaded: stats.segments_uploaded,
        bytes_uploaded: stats.bytes_uploaded,
        bytes_uploaded_human: human_bytes(stats.bytes_uploaded),
        last_segment: stats.last_segment.clone(),
        recent_errors: stats.errors.iter().rev().take(5).cloned().collect(),
    })
}

#[derive(Serialize)]
struct StatusResponse {
    receiving: bool,
    srt_port: u16,
    s3_bucket: String,
    youtube_enabled: bool,
    youtube_rtmp_url: Option<String>,
    hls_enabled: bool,
    hls_url: Option<String>,
    segments_uploaded: u64,
    bytes_uploaded: u64,
    bytes_uploaded_human: String,
    last_segment: Option<String>,
    recent_errors: Vec<String>,
}

async fn start_receiver(State(state): State<AppState>) -> Result<Json<serde_json::Value>, StatusCode> {
    match start_receiver_internal(&state).await {
        Ok(()) => Ok(Json(serde_json::json!({"status": "started"}))),
        Err(e) => {
            tracing::error!("Failed to start receiver: {e}");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn stop_receiver(State(state): State<AppState>) -> Json<serde_json::Value> {
    let mut receiver_guard = state.receiver.write().await;
    if let Some(handle) = receiver_guard.take() {
        handle.stop().await;
        state.stats.write().await.receiving = false;
        info!("SRT receiver stopped");
    }
    Json(serde_json::json!({"status": "stopped"}))
}

fn human_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}
