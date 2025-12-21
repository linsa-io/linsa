export type StylePreset = {
  id: string
  label: string
  description: string
  prompt: string
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "default",
    label: "Natural",
    description: "Balanced, unstyled rendering",
    prompt: "Render the scene with natural lighting and realistic tones.",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    description: "High-contrast, filmic look",
    prompt: "Cinematic lighting, dramatic contrast, 35mm film aesthetic, rich color grading.",
  },
  {
    id: "watercolor",
    label: "Watercolor",
    description: "Soft painterly textures",
    prompt: "Watercolor illustration, soft brush strokes, flowing pigment, textured paper background.",
  },
  {
    id: "anime",
    label: "Anime",
    description: "Vibrant anime style",
    prompt: "Anime illustration, clean line art, vibrant cel shading, dynamic background, Studio Ghibli inspired.",
  },
  {
    id: "noir",
    label: "Noir",
    description: "Moody black-and-white",
    prompt: "Film noir photography, high contrast black and white, dramatic shadows, moody atmosphere.",
  },
]
