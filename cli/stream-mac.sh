#!/bin/bash
# Stream Mac screen + audio to Cloudflare Stream via RTMPS
# Uses VideoToolbox for zero-CPU hardware encoding

# Device 2 = Capture screen 0
# Device 1 = MacBook Pro Microphone (audio)

# Cloudflare Stream credentials (set STREAM_KEY env var or in ~/.config/linsa/stream.env)
RTMPS_URL="rtmps://live.cloudflare.com:443/live/"

if [ -z "$STREAM_KEY" ]; then
  if [ -f ~/.config/linsa/stream.env ]; then
    source ~/.config/linsa/stream.env
  fi
fi

if [ -z "$STREAM_KEY" ]; then
  echo "Error: STREAM_KEY not set"
  echo "Set it via: export STREAM_KEY=your_key"
  echo "Or create ~/.config/linsa/stream.env with: STREAM_KEY=your_key"
  exit 1
fi

exec ffmpeg -f avfoundation -capture_cursor 1 -framerate 60 -i "2:1" \
  -c:v h264_videotoolbox -b:v 30000k -maxrate 45000k -bufsize 90000k \
  -profile:v high -pix_fmt yuv420p \
  -g 120 -keyint_min 120 \
  -c:a aac -b:a 256k -ar 48000 -ac 2 \
  -f flv "${RTMPS_URL}${STREAM_KEY}"
