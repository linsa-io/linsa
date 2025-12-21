use std::path::Path;
use std::process::Stdio;

use anyhow::{Context, Result};
use tokio::process::{Child, Command};
use tracing::info;

pub struct ReceiverHandle {
    child: Child,
}

impl ReceiverHandle {
    pub async fn stop(mut self) {
        // Send SIGTERM
        if let Err(e) = self.child.kill().await {
            tracing::warn!("Failed to kill ffmpeg: {e}");
        }
    }
}

/// Start ffmpeg to receive SRT stream and segment into files.
///
/// Output files: segment_dir/stream-YYYYMMDD-HHMMSS-NNN.ts
pub async fn start(
    ffmpeg_path: &Path,
    srt_port: u16,
    segment_dir: &Path,
    segment_duration: u32,
) -> Result<ReceiverHandle> {
    let srt_url = format!("srt://0.0.0.0:{srt_port}?mode=listener");
    let output_pattern = segment_dir.join("stream-%Y%m%d-%H%M%S-%%03d.ts");

    // ffmpeg command:
    // - Listen for SRT input
    // - Copy video and audio (no re-encoding)
    // - Segment into files with timestamps
    let mut cmd = Command::new(ffmpeg_path);
    cmd.args([
        "-hide_banner",
        "-loglevel",
        "warning",
        // Input
        "-i",
        &srt_url,
        // Copy codecs (no re-encoding)
        "-c",
        "copy",
        // Segment muxer
        "-f",
        "segment",
        "-segment_time",
        &segment_duration.to_string(),
        "-segment_format",
        "mpegts",
        // Use strftime for timestamp in filename
        "-strftime",
        "1",
        // Reset timestamps for each segment
        "-reset_timestamps",
        "1",
        // Output pattern
        output_pattern.to_str().unwrap(),
    ]);

    cmd.stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    info!("Starting ffmpeg receiver: {:?}", cmd);

    let child = cmd
        .spawn()
        .with_context(|| format!("spawn ffmpeg at {}", ffmpeg_path.display()))?;

    Ok(ReceiverHandle { child })
}

/// Start ffmpeg to receive SRT stream and output HLS for web playback.
///
/// Generates a live HLS playlist (.m3u8) and segment files (.ts)
/// that can be served via HTTP for web players.
pub async fn start_hls(
    ffmpeg_path: &Path,
    srt_port: u16,
    hls_dir: &Path,
    segment_duration: u32,
) -> Result<ReceiverHandle> {
    let srt_url = format!("srt://0.0.0.0:{srt_port}?mode=listener");
    let playlist_path = hls_dir.join("stream.m3u8");
    let segment_pattern = hls_dir.join("stream%03d.ts");

    // Ensure HLS directory exists
    std::fs::create_dir_all(hls_dir)?;

    // ffmpeg command for HLS output:
    // - Receive SRT input (already H.264 from Mac hardware encoder)
    // - Copy video codec (no re-encoding)
    // - Ensure audio is AAC (required for HLS)
    // - Output HLS playlist and segments
    let mut cmd = Command::new(ffmpeg_path);
    cmd.args([
        "-hide_banner",
        "-loglevel",
        "warning",
        // Input from SRT
        "-i",
        &srt_url,
        // Video: copy (no re-encoding)
        "-c:v",
        "copy",
        // Audio: AAC for HLS compatibility
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ar",
        "44100",
        // HLS output settings
        "-f",
        "hls",
        "-hls_time",
        &segment_duration.to_string(),
        "-hls_list_size",
        "10", // Keep 10 segments in playlist
        "-hls_flags",
        "delete_segments+append_list",
        "-hls_segment_filename",
        segment_pattern.to_str().unwrap(),
        // Output playlist
        playlist_path.to_str().unwrap(),
    ]);

    cmd.stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    info!("Starting HLS output to {}", hls_dir.display());

    let child = cmd
        .spawn()
        .with_context(|| format!("spawn ffmpeg at {}", ffmpeg_path.display()))?;

    Ok(ReceiverHandle { child })
}

/// Start ffmpeg to receive SRT stream and forward to YouTube RTMP.
///
/// Receives hardware-encoded H.264 from Mac, applies optional filters,
/// and streams directly to YouTube with minimal re-encoding.
pub async fn start_youtube(
    ffmpeg_path: &Path,
    srt_port: u16,
    rtmp_url: &str,
    stream_key: &str,
) -> Result<ReceiverHandle> {
    let srt_url = format!("srt://0.0.0.0:{srt_port}?mode=listener");
    let youtube_url = format!("{}/{}", rtmp_url, stream_key);

    // ffmpeg command for YouTube streaming:
    // - Receive SRT input (already H.264 from Mac hardware encoder)
    // - Copy video if already H.264, or re-encode if filtering needed
    // - Ensure audio is AAC (YouTube requirement)
    // - Output to RTMP
    let mut cmd = Command::new(ffmpeg_path);
    cmd.args([
        "-hide_banner",
        "-loglevel",
        "warning",
        // Reconnect on errors
        "-reconnect",
        "1",
        "-reconnect_streamed",
        "1",
        "-reconnect_delay_max",
        "5",
        // Input from SRT
        "-i",
        &srt_url,
        // Video: copy if already H.264 (from Mac VideoToolbox)
        "-c:v",
        "copy",
        // Audio: ensure AAC for YouTube
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ar",
        "44100",
        // FLV container for RTMP
        "-f",
        "flv",
        // Buffer settings for stable streaming
        "-flvflags",
        "no_duration_filesize",
        "-max_muxing_queue_size",
        "1024",
        // Output to YouTube
        &youtube_url,
    ]);

    cmd.stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    info!("Starting YouTube stream to {}", rtmp_url);

    let child = cmd
        .spawn()
        .with_context(|| format!("spawn ffmpeg at {}", ffmpeg_path.display()))?;

    Ok(ReceiverHandle { child })
}

/// Start ffmpeg to receive SRT, apply filters, and stream to YouTube.
///
/// This variant decodes, applies filters, and re-encodes.
/// Use when you need video processing on the Linux side.
pub async fn start_youtube_with_filter(
    ffmpeg_path: &Path,
    srt_port: u16,
    rtmp_url: &str,
    stream_key: &str,
    video_filter: Option<&str>,
) -> Result<ReceiverHandle> {
    let srt_url = format!("srt://0.0.0.0:{srt_port}?mode=listener");
    let youtube_url = format!("{}/{}", rtmp_url, stream_key);

    let mut cmd = Command::new(ffmpeg_path);
    let mut args = vec![
        "-hide_banner".to_string(),
        "-loglevel".to_string(),
        "warning".to_string(),
        "-reconnect".to_string(),
        "1".to_string(),
        "-reconnect_streamed".to_string(),
        "1".to_string(),
        "-reconnect_delay_max".to_string(),
        "5".to_string(),
        "-i".to_string(),
        srt_url,
    ];

    // Add video filter if specified
    if let Some(filter) = video_filter {
        args.extend(["-vf".to_string(), filter.to_string()]);
    }

    // Video encoding (x264 with fast preset for low latency)
    args.extend([
        "-c:v".to_string(),
        "libx264".to_string(),
        "-preset".to_string(),
        "veryfast".to_string(),
        "-tune".to_string(),
        "zerolatency".to_string(),
        "-b:v".to_string(),
        "4500k".to_string(),
        "-maxrate".to_string(),
        "4500k".to_string(),
        "-bufsize".to_string(),
        "9000k".to_string(),
        "-g".to_string(),
        "60".to_string(), // Keyframe every 2s at 30fps
    ]);

    // Audio
    args.extend([
        "-c:a".to_string(),
        "aac".to_string(),
        "-b:a".to_string(),
        "128k".to_string(),
        "-ar".to_string(),
        "44100".to_string(),
    ]);

    // Output
    args.extend([
        "-f".to_string(),
        "flv".to_string(),
        "-flvflags".to_string(),
        "no_duration_filesize".to_string(),
        youtube_url,
    ]);

    cmd.args(&args);
    cmd.stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    info!("Starting YouTube stream with filter");

    let child = cmd
        .spawn()
        .with_context(|| format!("spawn ffmpeg at {}", ffmpeg_path.display()))?;

    Ok(ReceiverHandle { child })
}
