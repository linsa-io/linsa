import { useEffect, useRef, useState } from "react"

const BLIT_SHADER = `
@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, 1.0),
  );
  var uv = array<vec2f, 6>(
    vec2f(0.0, 1.0),
    vec2f(1.0, 1.0),
    vec2f(0.0, 0.0),
    vec2f(0.0, 0.0),
    vec2f(1.0, 1.0),
    vec2f(1.0, 0.0),
  );
  var output: VertexOutput;
  output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
  output.uv = uv[vertexIndex];
  return output;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  return textureSample(inputTex, inputSampler, input.uv);
}
`

const SHADER_CODE = `
struct Time {
  elapsed: f32,
  delta: f32,
  frame: u32,
  _pad: u32,
}

struct Custom {
  twist: f32,
  viz: f32,
}

@group(0) @binding(0) var<uniform> time: Time;
@group(0) @binding(1) var<uniform> custom: Custom;
@group(0) @binding(2) var screen: texture_storage_2d<rgba8unorm, write>;

fn w(T: f32) -> vec3f {
  let Q = vec3f(0.5, 0.5, 0.5);
  let P = vec3f(0.5, 0.5, 0.5);
  let J = vec3f(1.0, 1.0, 1.0);
  let H = vec3f(0.263, 0.416, 0.557);
  return Q + P * cos(6.28318 * (J * T + H));
}

fn v(z: vec3f) -> vec3f {
  var x = z + vec3f(12.34, 56.78, 90.12);
  var a = fract(x * vec3f(0.1031, 0.1030, 0.0973));
  a = a + dot(a, a.yzx + 19.19);
  return fract(vec3f(a.x + a.y, a.y + a.z, a.z + a.x) * a.zxy);
}

fn m(s: f32) -> mat2x2<f32> {
  let n: f32 = sin(s);
  let r: f32 = cos(s);
  return mat2x2(r, -n, n, r);
}

fn t(U: vec3<f32>, S: f32) -> f32 {
  return length(U) - S;
}

fn u(R: vec3<f32>) -> f32 {
  var d = R;
  let G = custom.twist * 0.1;
  d = vec3f(d.xy * m(d.z * 0.05 * sin(G * 0.5)), d.z);
  let l = 8.0;
  let k = vec3<i32>(floor(d / l));
  let i = v(vec3f(f32(k.x), f32(k.y), f32(k.z)) + 1337.0);
  let K = 1.0;
  if (i.x >= K) {
    return 0.9;
  }
  var h = (d / l);
  h = fract(h) - 0.5;
  let A = (pow(sin(4.0 * time.elapsed), 4.0) + 1.0) / 2.0;
  let B = custom.viz * 0.4;
  let C = (i.yzx - vec3f(0.5)) * mix(0.1, 0.3 + B, A);
  let D = (vec3f(h) + C);
  let E = mix(0.05, 0.12, i.z) + (custom.viz * 0.15);
  let F = t(D, E);
  return F * l;
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) e: vec3u) {
  let c = textureDimensions(screen);
  if (e.x >= c.x || e.y >= c.y) {
    return;
  }
  let I = vec2f(f32(e.x) + .5, f32(c.y - e.y) - .5);
  var f = (I * 2.0 - vec2f(f32(c.x), f32(c.y))) / f32(c.y);
  let y = custom.twist;
  f = f * m(y * 0.1);
  let L = 8.0;
  let M = 0.6 - (custom.viz * 0.2);
  let N = vec3f(0, 0, -3 + time.elapsed * L);
  let O = normalize(vec3f(f * M, 1.0));
  var g = 0.0;
  var b = vec3<f32>(0);
  for (var q: i32 = 0; q < 80; q++) {
    var p = N + O * g;
    var j = u(p);
    let o = w(p.z * 0.04 + time.elapsed * 0.2);
    let V = 0.008 + (custom.viz * 0.01);
    let W = 8.0;
    b += o * V * exp(-j * W);
    if (j < 0.001) {
      b += o * 2.0;
      break;
    }
    g += j * 0.7 * (1.0 - custom.viz);
    if (g > 150.0) {
      break;
    }
  }
  b = b / (b + 1.0);
  b = pow(b, vec3f(1.0 / 2.2));
  let X = length(f);
  b *= 1.0 - X * 0.5;
  textureStore(screen, e.xy, vec4f(b, 1.));
}
`

type WebGPUState = {
  device: GPUDevice
  context: GPUCanvasContext
  format: GPUTextureFormat
  computePipeline: GPUComputePipeline
  computeBindGroup: GPUBindGroup
  blitPipeline: GPURenderPipeline
  blitBindGroup: GPUBindGroup
  timeBuffer: GPUBuffer
  customBuffer: GPUBuffer
  screenTexture: GPUTexture
  width: number
  height: number
}

export function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<WebGPUState | null>(null)
  const frameRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let animationId: number
    let disposed = false

    const init = async () => {
      // Check WebGPU support
      if (!navigator.gpu) {
        setSupported(false)
        return
      }

      const adapter = await navigator.gpu.requestAdapter()
      if (!adapter) {
        setSupported(false)
        return
      }

      const device = await adapter.requestDevice()
      if (disposed) return

      const context = canvas.getContext("webgpu")
      if (!context) {
        setSupported(false)
        return
      }

      const format = navigator.gpu.getPreferredCanvasFormat()
      const dpr = Math.min(window.devicePixelRatio, 2)
      const width = Math.floor(canvas.clientWidth * dpr)
      const height = Math.floor(canvas.clientHeight * dpr)

      canvas.width = width
      canvas.height = height

      context.configure({
        device,
        format,
        alphaMode: "premultiplied",
      })

      // Create shader modules
      const computeModule = device.createShaderModule({
        code: SHADER_CODE,
      })
      const blitModule = device.createShaderModule({
        code: BLIT_SHADER,
      })

      // Create buffers
      const timeBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      })

      const customBuffer = device.createBuffer({
        size: 8,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      })

      // Create screen texture (for compute output)
      const screenTexture = device.createTexture({
        size: [width, height],
        format: "rgba8unorm",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
      })

      // Create compute bind group layout and pipeline
      const computeBindGroupLayout = device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" },
          },
          {
            binding: 1,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" },
          },
          {
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            storageTexture: { access: "write-only", format: "rgba8unorm" },
          },
        ],
      })

      const computePipeline = device.createComputePipeline({
        layout: device.createPipelineLayout({
          bindGroupLayouts: [computeBindGroupLayout],
        }),
        compute: {
          module: computeModule,
          entryPoint: "main",
        },
      })

      const computeBindGroup = device.createBindGroup({
        layout: computeBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: timeBuffer } },
          { binding: 1, resource: { buffer: customBuffer } },
          { binding: 2, resource: screenTexture.createView() },
        ],
      })

      // Create blit pipeline for rendering to canvas
      const sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
      })

      const blitBindGroupLayout = device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { sampleType: "float" },
          },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: { type: "filtering" },
          },
        ],
      })

      const blitPipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({
          bindGroupLayouts: [blitBindGroupLayout],
        }),
        vertex: {
          module: blitModule,
          entryPoint: "vs",
        },
        fragment: {
          module: blitModule,
          entryPoint: "fs",
          targets: [{ format }],
        },
        primitive: {
          topology: "triangle-list",
        },
      })

      const blitBindGroup = device.createBindGroup({
        layout: blitBindGroupLayout,
        entries: [
          { binding: 0, resource: screenTexture.createView() },
          { binding: 1, resource: sampler },
        ],
      })

      stateRef.current = {
        device,
        context,
        format,
        computePipeline,
        computeBindGroup,
        blitPipeline,
        blitBindGroup,
        timeBuffer,
        customBuffer,
        screenTexture,
        width,
        height,
      }

      startTimeRef.current = performance.now()

      // Start render loop
      const render = () => {
        if (disposed || !stateRef.current) return

        const state = stateRef.current
        const elapsed = (performance.now() - startTimeRef.current) / 1000
        frameRef.current++

        // Update time uniform
        const timeData = new ArrayBuffer(16)
        const timeView = new DataView(timeData)
        timeView.setFloat32(0, elapsed, true)
        timeView.setFloat32(4, 0.016, true)
        timeView.setUint32(8, frameRef.current, true)
        timeView.setUint32(12, 0, true)
        state.device.queue.writeBuffer(state.timeBuffer, 0, timeData)

        // Update custom uniform (animated values)
        const twist = Math.sin(elapsed * 0.3) * 2
        const viz = 0.3 + Math.sin(elapsed * 0.5) * 0.2
        const customData = new Float32Array([twist, viz])
        state.device.queue.writeBuffer(state.customBuffer, 0, customData)

        // Create command encoder
        const encoder = state.device.createCommandEncoder()

        // Run compute shader
        const computePass = encoder.beginComputePass()
        computePass.setPipeline(state.computePipeline)
        computePass.setBindGroup(0, state.computeBindGroup)
        computePass.dispatchWorkgroups(
          Math.ceil(state.width / 16),
          Math.ceil(state.height / 16)
        )
        computePass.end()

        // Blit to canvas using render pass
        const canvasTexture = state.context.getCurrentTexture()
        const renderPass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: canvasTexture.createView(),
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              loadOp: "clear",
              storeOp: "store",
            },
          ],
        })
        renderPass.setPipeline(state.blitPipeline)
        renderPass.setBindGroup(0, state.blitBindGroup)
        renderPass.draw(6)
        renderPass.end()

        state.device.queue.submit([encoder.finish()])

        animationId = requestAnimationFrame(render)
      }

      render()
    }

    init().catch((err) => {
      console.error("WebGPU init error:", err)
      setSupported(false)
    })

    // Handle resize
    const handleResize = () => {
      if (!stateRef.current || !canvas) return

      const state = stateRef.current
      const dpr = Math.min(window.devicePixelRatio, 2)
      const width = Math.floor(canvas.clientWidth * dpr)
      const height = Math.floor(canvas.clientHeight * dpr)

      if (width === state.width && height === state.height) return
      if (width === 0 || height === 0) return

      canvas.width = width
      canvas.height = height

      // Recreate screen texture
      state.screenTexture.destroy()
      const screenTexture = state.device.createTexture({
        size: [width, height],
        format: "rgba8unorm",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
      })

      // Recreate compute bind group
      const computeBindGroupLayout = state.computePipeline.getBindGroupLayout(0)
      const computeBindGroup = state.device.createBindGroup({
        layout: computeBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: state.timeBuffer } },
          { binding: 1, resource: { buffer: state.customBuffer } },
          { binding: 2, resource: screenTexture.createView() },
        ],
      })

      // Recreate blit bind group
      const sampler = state.device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
      })
      const blitBindGroupLayout = state.blitPipeline.getBindGroupLayout(0)
      const blitBindGroup = state.device.createBindGroup({
        layout: blitBindGroupLayout,
        entries: [
          { binding: 0, resource: screenTexture.createView() },
          { binding: 1, resource: sampler },
        ],
      })

      stateRef.current = {
        ...state,
        screenTexture,
        computeBindGroup,
        blitBindGroup,
        width,
        height,
      }
    }

    window.addEventListener("resize", handleResize)

    return () => {
      disposed = true
      if (animationId) cancelAnimationFrame(animationId)
      window.removeEventListener("resize", handleResize)
      if (stateRef.current) {
        stateRef.current.screenTexture.destroy()
        stateRef.current.timeBuffer.destroy()
        stateRef.current.customBuffer.destroy()
      }
    }
  }, [])

  if (!supported) {
    // Fallback gradient background
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-black to-purple-950" />
    )
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      style={{ background: "black" }}
    />
  )
}
