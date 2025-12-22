import Foundation
import ScreenCaptureKit
import VideoToolbox
import CoreMedia
import Network
import AVFoundation

// MARK: - Zero-CPU Screen Capture
// Uses ScreenCaptureKit (GPU) → VideoToolbox (GPU) → Network
// No pixel data ever touches the CPU

@main
struct StreamCapture {
    static func main() async {
        let args = CommandLine.arguments

        if args.count < 2 {
            printUsage()
            return
        }

        switch args[1] {
        case "start":
            let host = args.count > 2 ? args[2] : "65.108.248.119"
            let port = args.count > 3 ? UInt16(args[3]) ?? 6000 : 6000
            await startStreaming(host: host, port: port)

        case "displays":
            await listDisplays()

        case "test":
            await testCapture()

        default:
            printUsage()
        }
    }

    static func printUsage() {
        print("""
        stream-capture - Zero-CPU screen streaming

        Usage:
          stream-capture start [host] [port]  - Stream Zed window to host (default: 65.108.248.119:6000)
          stream-capture displays             - List available displays
          stream-capture test                 - Test capture without streaming

        Architecture:
          ScreenCaptureKit (GPU) → VideoToolbox H.264 (GPU) → UDP → Linux

        The entire pipeline runs on GPU. CPU usage should be <1%.
        """)
    }

    static func listDisplays() async {
        do {
            let content = try await SCShareableContent.current
            print("Available displays:")
            for (i, display) in content.displays.enumerated() {
                print("  [\(i)] \(display.width)x\(display.height) - Display \(display.displayID)")
            }
        } catch {
            print("Error: \(error)")
        }
    }

    static func testCapture() async {
        print("Testing capture (5 seconds)...")

        do {
            let capturer = try await ZeroCPUCapturer.create()
            try await capturer.startCapture()

            try await Task.sleep(for: .seconds(5))

            await capturer.stopCapture()
            let count = await capturer.frameCount
            print("Test complete. Frames captured: \(count)")
            print("Average FPS: \(Double(count) / 5.0)")
        } catch {
            print("Error: \(error)")
        }
    }

    static func startStreaming(host: String, port: UInt16) async {
        print("Starting zero-CPU stream to \(host):\(port)")
        print("Press Ctrl+C to stop\n")

        do {
            let streamer = ZeroCPUStreamer(host: host, port: port)
            try await streamer.start()

            // Keep running until interrupted
            await withCheckedContinuation { (_: CheckedContinuation<Void, Never>) in
                signal(SIGINT) { _ in
                    print("\nStopping...")
                    exit(0)
                }
                dispatchMain()
            }
        } catch {
            if let error = error as? LocalizedError, let description = error.errorDescription {
                print("Error: \(description)")
            } else {
                print("Error: \(error)")
            }
        }
    }
}

// MARK: - Zero-CPU Capturer

actor ZeroCPUCapturer: NSObject, SCStreamDelegate, SCStreamOutput {
    private var stream: SCStream?
    private var display: SCDisplay?
    private var window: SCWindow?
    private var captureSize: CGSize?
    var frameCount = 0
    var onFrame: ((CMSampleBuffer) -> Void)?

    override init() {
        super.init()
    }

    static func create(onlyAppName: String? = nil) async throws -> ZeroCPUCapturer {
        let capturer = ZeroCPUCapturer()

        let content = try await SCShareableContent.current
        if let onlyAppName {
            let normalizedName = onlyAppName.lowercased()
            let candidateWindows = content.windows.filter { window in
                guard let app = window.owningApplication else { return false }
                let appName = app.applicationName.lowercased()
                let bundleId = app.bundleIdentifier?.lowercased()
                return appName == normalizedName || bundleId == normalizedName
            }
            guard let window = candidateWindows.max(by: { $0.frame.width * $0.frame.height < $1.frame.width * $1.frame.height }) else {
                throw CaptureError.noWindowForApp(onlyAppName)
            }
            await capturer.setWindow(window)
        } else {
            // Get primary display
            guard let display = content.displays.first else {
                throw CaptureError.noDisplay
            }
            await capturer.setDisplay(display)
        }
        return capturer
    }

    func setDisplay(_ display: SCDisplay) {
        self.display = display
        self.window = nil
        self.captureSize = CGSize(width: display.width, height: display.height)
    }

    func setWindow(_ window: SCWindow) {
        self.window = window
        self.display = nil
        self.captureSize = window.frame.size
    }

    func startCapture() async throws {
        guard let captureSize = captureSize else {
            throw CaptureError.noCaptureTarget
        }

        // Configure for zero-CPU capture
        let config = SCStreamConfiguration()

        // Match capture target resolution
        let normalizedSize = normalizedCaptureSize(for: captureSize)
        config.width = normalizedSize.width
        config.height = normalizedSize.height

        let targetFrameRate: Int32 = 60
        // 60 FPS for streaming
        config.minimumFrameInterval = CMTime(value: 1, timescale: targetFrameRate)

        // Queue depth for smooth delivery (like OBS)
        config.queueDepth = 8

        // Show cursor
        config.showsCursor = true

        // Use GPU-native pixel format (BGRA for VideoToolbox compatibility)
        config.pixelFormat = kCVPixelFormatType_32BGRA

        // Color space for wide gamut
        config.colorSpaceName = CGColorSpace.displayP3

        // Create content filter for display or window capture
        let filter: SCContentFilter
        if let window = window {
            filter = SCContentFilter(desktopIndependentWindow: window)
        } else if let display = display {
            filter = SCContentFilter(display: display, excludingWindows: [])
        } else {
            throw CaptureError.noCaptureTarget
        }

        // Create stream
        stream = SCStream(filter: filter, configuration: config, delegate: self)

        // Add output handler on high-priority queue
        try stream?.addStreamOutput(
            self,
            type: .screen,
            sampleHandlerQueue: DispatchQueue(label: "capture", qos: .userInteractive)
        )

        // Start capture
        try await stream?.startCapture()
        print("Capture started: \(config.width)x\(config.height) @ \(targetFrameRate)fps")
    }

    func stopCapture() async {
        try? await stream?.stopCapture()
        stream = nil
    }

    // SCStreamOutput - receives frames on GPU
    nonisolated func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen else { return }

        Task {
            await self.handleFrame(sampleBuffer)
        }
    }

    private func handleFrame(_ sampleBuffer: CMSampleBuffer) {
        frameCount += 1
        onFrame?(sampleBuffer)
    }

    // SCStreamDelegate
    nonisolated func stream(_ stream: SCStream, didStopWithError error: Error) {
        print("Stream stopped with error: \(error)")
    }
}

// MARK: - Zero-CPU Streamer (with VideoToolbox encoding)

class ZeroCPUStreamer {
    private var capturer: ZeroCPUCapturer?
    private var encoder: HardwareEncoder?
    private var connection: NWConnection?
    private let host: String
    private let port: UInt16

    init(host: String, port: UInt16) {
        self.host = host
        self.port = port
    }

    func start() async throws {
        // Setup network connection (UDP for low latency)
        let endpoint = NWEndpoint.hostPort(host: NWEndpoint.Host(host), port: NWEndpoint.Port(rawValue: port)!)
        connection = NWConnection(to: endpoint, using: .udp)

        connection?.stateUpdateHandler = { state in
            switch state {
            case .ready:
                print("Network ready")
            case .failed(let error):
                print("Network failed: \(error)")
            default:
                break
            }
        }
        connection?.start(queue: .global(qos: .userInteractive))

        // Setup capturer
        capturer = try await ZeroCPUCapturer.create(onlyAppName: "Zed")

        // Setup hardware encoder with network send callback
        let conn = connection
        let size = await capturer?.getCaptureSize() ?? CGSize(width: 1920, height: 1080)
        let normalizedSize = normalizedCaptureSize(for: size)
        encoder = try HardwareEncoder(width: normalizedSize.width, height: normalizedSize.height) { data in
            conn?.send(content: data, completion: .idempotent)
        }

        // Connect capturer to encoder
        let enc = encoder
        await capturer?.setOnFrame { sampleBuffer in
            enc?.encode(sampleBuffer: sampleBuffer)
        }

        // Start capture
        try await capturer?.startCapture()

        print("Streaming to \(host):\(port)")
    }

    func stop() async {
        await capturer?.stopCapture()
        connection?.cancel()
    }
}

// MARK: - Hardware H.264 Encoder (VideoToolbox - runs on GPU)

class HardwareEncoder {
    private var session: VTCompressionSession?
    private var onEncodedData: (Data) -> Void

    init(width: Int, height: Int, onEncodedData: @escaping (Data) -> Void) throws {
        self.onEncodedData = onEncodedData

        // Create hardware compression session
        let status = VTCompressionSessionCreate(
            allocator: nil,
            width: Int32(width),
            height: Int32(height),
            codecType: kCMVideoCodecType_H264,
            encoderSpecification: [
                kVTVideoEncoderSpecification_EnableHardwareAcceleratedVideoEncoder: true,
                kVTVideoEncoderSpecification_RequireHardwareAcceleratedVideoEncoder: true
            ] as CFDictionary,
            imageBufferAttributes: nil,
            compressedDataAllocator: nil,
            outputCallback: nil,
            refcon: nil,
            compressionSessionOut: &session
        )

        guard status == noErr, let session = session else {
            throw CaptureError.encoderCreationFailed
        }

        // Configure for streaming
        let targetFrameRate: Int32 = 60
        let keyframeInterval = Int(targetFrameRate) * 2
        let bitrate = HardwareEncoder.recommendedBitrate(
            width: width,
            height: height,
            frameRate: Int(targetFrameRate)
        )
        VTSessionSetProperty(session, key: kVTCompressionPropertyKey_RealTime, value: kCFBooleanTrue)
        VTSessionSetProperty(session, key: kVTCompressionPropertyKey_ProfileLevel, value: kVTProfileLevel_H264_High_AutoLevel)
        VTSessionSetProperty(session, key: kVTCompressionPropertyKey_ExpectedFrameRate, value: targetFrameRate as CFNumber)
        VTSessionSetProperty(session, key: kVTCompressionPropertyKey_AverageBitRate, value: bitrate as CFNumber)
        VTSessionSetProperty(session, key: kVTCompressionPropertyKey_MaxKeyFrameInterval, value: keyframeInterval as CFNumber)
        VTSessionSetProperty(session, key: kVTCompressionPropertyKey_MaxKeyFrameIntervalDuration, value: 2 as CFNumber)
        VTSessionSetProperty(session, key: kVTCompressionPropertyKey_AllowFrameReordering, value: kCFBooleanFalse) // No B-frames for low latency

        VTCompressionSessionPrepareToEncodeFrames(session)

        print("Hardware encoder initialized (VideoToolbox)")
    }

    func encode(sampleBuffer: CMSampleBuffer) {
        guard let session = session,
              let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            return
        }

        let presentationTime = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)

        VTCompressionSessionEncodeFrame(
            session,
            imageBuffer: imageBuffer,
            presentationTimeStamp: presentationTime,
            duration: .invalid,
            frameProperties: nil,
            infoFlagsOut: nil
        ) { [weak self] status, flags, sampleBuffer in
            guard status == noErr, let sampleBuffer = sampleBuffer else { return }
            self?.handleEncodedFrame(sampleBuffer)
        }
    }

    private func handleEncodedFrame(_ sampleBuffer: CMSampleBuffer) {
        guard let dataBuffer = CMSampleBufferGetDataBuffer(sampleBuffer) else { return }

        var length = 0
        var dataPointer: UnsafeMutablePointer<Int8>?
        CMBlockBufferGetDataPointer(dataBuffer, atOffset: 0, lengthAtOffsetOut: nil, totalLengthOut: &length, dataPointerOut: &dataPointer)

        if let dataPointer = dataPointer {
            let data = Data(bytes: dataPointer, count: length)
            onEncodedData(data)
        }
    }

    private static func recommendedBitrate(width: Int, height: Int, frameRate: Int) -> Int {
        let baseWidth = 2560
        let baseHeight = 1440
        let baseFrameRate = 60
        let baseBitrate = 30_000_000

        let pixels = max(1, width) * max(1, height)
        let basePixels = baseWidth * baseHeight
        let fpsScale = Double(max(frameRate, 1)) / Double(baseFrameRate)
        let raw = Double(baseBitrate) * (Double(pixels) / Double(basePixels)) * fpsScale
        return min(max(Int(raw.rounded()), 12_000_000), 80_000_000)
    }

    deinit {
        if let session = session {
            VTCompressionSessionInvalidate(session)
        }
    }
}

// MARK: - Errors

enum CaptureError: Error {
    case noDisplay
    case noCaptureTarget
    case noWindowForApp(String)
    case encoderCreationFailed
    case networkError
}

extension CaptureError: LocalizedError {
    var errorDescription: String? {
        switch self {
        case .noDisplay:
            return "No display available for capture."
        case .noCaptureTarget:
            return "No capture target configured."
        case .noWindowForApp(let appName):
            return "No window found for app: \(appName). Make sure Zed is running and a window is visible."
        case .encoderCreationFailed:
            return "Failed to create the hardware encoder."
        case .networkError:
            return "Network error while streaming."
        }
    }
}

// MARK: - Extensions

extension ZeroCPUCapturer {
    func setOnFrame(_ handler: @escaping (CMSampleBuffer) -> Void) {
        onFrame = handler
    }

    func getCaptureSize() -> CGSize? {
        captureSize
    }
}

private func normalizedCaptureSize(for size: CGSize) -> (width: Int, height: Int) {
    let width = max(1, Int(size.width.rounded(.down)))
    let height = max(1, Int(size.height.rounded(.down)))
    // H.264 encoders typically require even dimensions.
    return (width: width - (width % 2), height: height - (height % 2))
}
