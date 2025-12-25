# Jazz Live Stream Recording Test

Tests the end-to-end flow of live stream recording with Jazz FileStream.

## Prerequisites

1. **Start Linsa dev server** (in one terminal):
   ```bash
   cd /Users/nikiv/org/linsa/linsa
   f dev
   ```

2. **Wait for server to be ready** at `http://localhost:3000`

## Running the Test

In a separate terminal:

```bash
cd /Users/nikiv/org/linsa/linsa
f test-jazz-stream
```

Or with shortcuts:
```bash
f test
f tjs
```

## What the Test Does

1. **Simulates stream-guard** uploading video chunks
2. **POSTs to API** `/api/stream-recording`
3. **Creates 5 chunks** of fake video data (256KB each)
4. **Stores chunks** in `/Users/nikiv/fork-i/garden-co/jazz/glide-storage/stream-recordings/`
5. **Verifies** chunk files exist on disk

## Viewing the Results

After the test completes:

1. **Open Linsa streams page**:
   ```
   http://localhost:3000/streams
   ```

2. **Wait for auto-sync** (happens every 5 seconds)
   - The page will fetch chunks from the API
   - Convert them to Jazz FileStream
   - Display the timeline

3. **Open Glide browser**:
   - Build and run Glide
   - Timeline will appear on canvas
   - Horizontal scrollable timeline showing the 5 chunks

## Test Output

The test will show:
- Stream ID and key
- Chunk upload progress
- Storage location
- Links to view the timeline

## Manual Testing

You can also manually POST chunks:

```bash
curl -X POST http://localhost:3000/api/stream-recording?action=start \
  -H "Content-Type: application/json" \
  -d '{
    "streamId": "manual-test",
    "title": "Manual Test Stream",
    "startedAt": '$(date +%s000)',
    "streamKey": "test-key"
  }'

# Upload a chunk
echo "fake video data" | base64 | \
  curl -X POST http://localhost:3000/api/stream-recording?action=chunk \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "streamId": "manual-test",
  "chunkIndex": 0,
  "data": "$(cat -)",
  "timestamp": $(date +%s000)
}
EOF
```

## Cleanup

Test recordings are stored in:
```
/Users/nikiv/fork-i/garden-co/jazz/glide-storage/stream-recordings/
```

You can delete test streams manually if needed.
