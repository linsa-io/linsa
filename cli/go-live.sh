#!/bin/bash
# Go live on linsa.io
# Usage: ./go-live.sh [start|stop]

ACTION=${1:-start}
HLS_URL="http://65.108.248.119:8080/hls/stream.m3u8"

if [ "$ACTION" = "start" ]; then
    echo "Going live on linsa.io..."

    # Start the stream capture in background
    cd /Users/nikiv/org/linsa/linsa/cli/stream
    .build/release/stream-capture start 65.108.248.119 6000 &
    STREAM_PID=$!
    echo $STREAM_PID > /tmp/stream.pid

    echo "Stream started (PID: $STREAM_PID)"
    echo "HLS URL: $HLS_URL"
    echo ""
    echo "To stop: ./go-live.sh stop"

elif [ "$ACTION" = "stop" ]; then
    echo "Stopping stream..."

    if [ -f /tmp/stream.pid ]; then
        kill $(cat /tmp/stream.pid) 2>/dev/null
        rm /tmp/stream.pid
    fi

    # Also kill any lingering stream-capture processes
    pkill -f stream-capture 2>/dev/null

    echo "Stream stopped"
fi
