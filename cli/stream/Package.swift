// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "stream-capture",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "stream-capture", targets: ["stream-capture"])
    ],
    dependencies: [],
    targets: [
        .executableTarget(
            name: "stream-capture",
            dependencies: [],
            linkerSettings: [
                .linkedFramework("ScreenCaptureKit"),
                .linkedFramework("VideoToolbox"),
                .linkedFramework("CoreMedia"),
                .linkedFramework("CoreVideo"),
                .linkedFramework("AVFoundation"),
                .linkedFramework("Network"),
            ]
        )
    ]
)
