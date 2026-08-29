export type ToolStatus = "planned" | "live";
export type NavigationCategory =
  | "output"
  | "signal-frequency"
  | "input-analysis"
  | "timing-specialist";
export type ToolAccent =
  | "lavender"
  | "blue"
  | "mint"
  | "peach"
  | "yellow"
  | "cyan"
  | "neutral"
  | "spectral";

export interface ToolDefinition {
  readonly id: string;
  readonly route: `/${string}`;
  readonly title: string;
  readonly navigationCategory: NavigationCategory;
  readonly implementationPhase: string;
  readonly accent: ToolAccent;
  readonly status: ToolStatus;
  readonly relatedToolIds: readonly string[];
}

export const toolRegistry: readonly ToolDefinition[] = [
  {
    id: "sound-test",
    route: "/sound-test",
    title: "Sound Test",
    navigationCategory: "output",
    implementationPhase: "P3.1",
    accent: "peach",
    status: "live",
    relatedToolIds: [
      "speaker-test",
      "headphone-test",
      "stereo-test",
      "surround-sound-test",
    ],
  },
  {
    id: "speaker-test",
    route: "/speaker-test",
    title: "Speaker Test",
    navigationCategory: "output",
    implementationPhase: "P3.3",
    accent: "peach",
    status: "live",
    relatedToolIds: [
      "sound-test",
      "stereo-test",
      "phase-test",
      "headphone-test",
      "surround-sound-test",
      "bass-test",
    ],
  },
  {
    id: "headphone-test",
    route: "/headphone-test",
    title: "Headphone Test",
    navigationCategory: "output",
    implementationPhase: "P3.4",
    accent: "blue",
    status: "live",
    relatedToolIds: [
      "speaker-test",
      "sound-test",
      "stereo-test",
      "phase-test",
      "surround-sound-test",
      "bass-test",
    ],
  },
  {
    id: "stereo-test",
    route: "/stereo-test",
    title: "Stereo Test",
    navigationCategory: "output",
    implementationPhase: "P3.2",
    accent: "lavender",
    status: "live",
    relatedToolIds: [
      "sound-test",
      "phase-test",
      "speaker-test",
      "headphone-test",
      "surround-sound-test",
    ],
  },
  {
    id: "phase-test",
    route: "/phase-test",
    title: "Phase Test",
    navigationCategory: "output",
    implementationPhase: "P3.2",
    accent: "lavender",
    status: "live",
    relatedToolIds: ["stereo-test", "sound-test", "speaker-test", "headphone-test"],
  },
  {
    id: "surround-sound-test",
    route: "/surround-sound-test",
    title: "Surround Sound Test",
    navigationCategory: "output",
    implementationPhase: "P3.5",
    accent: "blue",
    status: "live",
    relatedToolIds: [
      "speaker-test",
      "stereo-test",
      "sound-test",
      "headphone-test",
    ],
  },
  {
    id: "bass-test",
    route: "/bass-test",
    title: "Bass Test",
    navigationCategory: "signal-frequency",
    implementationPhase: "P4.1",
    accent: "mint",
    status: "live",
    relatedToolIds: [
      "speaker-test",
      "headphone-test",
      "tone-generator",
      "frequency-sweep",
    ],
  },
  {
    id: "tone-generator",
    route: "/tone-generator",
    title: "Tone Generator",
    navigationCategory: "signal-frequency",
    implementationPhase: "P2.1",
    accent: "lavender",
    status: "live",
    relatedToolIds: [
      "frequency-sweep",
      "bass-test",
      "noise-generator",
      "hearing-frequency-test",
    ],
  },
  {
    id: "frequency-sweep",
    route: "/frequency-sweep",
    title: "Frequency Sweep",
    navigationCategory: "signal-frequency",
    implementationPhase: "P4.2",
    accent: "lavender",
    status: "live",
    relatedToolIds: [
      "tone-generator",
      "bass-test",
      "speaker-test",
      "headphone-test",
    ],
  },
  {
    id: "noise-generator",
    route: "/noise-generator",
    title: "Noise Generator",
    navigationCategory: "signal-frequency",
    implementationPhase: "P4.3",
    accent: "neutral",
    status: "live",
    relatedToolIds: ["tone-generator", "frequency-sweep"],
  },
  {
    id: "microphone-test",
    route: "/microphone-test",
    title: "Microphone Test",
    navigationCategory: "input-analysis",
    implementationPhase: "P5.2",
    accent: "cyan",
    status: "live",
    relatedToolIds: ["spectrum-analyzer", "pitch-detector", "decibel-meter"],
  },
  {
    id: "spectrum-analyzer",
    route: "/spectrum-analyzer",
    title: "Spectrum Analyzer",
    navigationCategory: "input-analysis",
    implementationPhase: "P5.3",
    accent: "spectral",
    status: "live",
    relatedToolIds: ["microphone-test", "pitch-detector", "decibel-meter"],
  },
  {
    id: "pitch-detector",
    route: "/pitch-detector",
    title: "Pitch Detector",
    navigationCategory: "input-analysis",
    implementationPhase: "P5.4",
    accent: "mint",
    status: "live",
    relatedToolIds: ["microphone-test", "spectrum-analyzer", "decibel-meter"],
  },
  {
    id: "decibel-meter",
    route: "/decibel-meter",
    title: "Decibel Meter",
    navigationCategory: "input-analysis",
    implementationPhase: "P5.5",
    accent: "cyan",
    status: "live",
    relatedToolIds: ["microphone-test", "spectrum-analyzer", "pitch-detector"],
  },
  {
    id: "audio-latency-test",
    route: "/audio-latency-test",
    title: "Audio Latency / AV Sync Test",
    navigationCategory: "timing-specialist",
    implementationPhase: "P6.1",
    accent: "yellow",
    status: "live",
    relatedToolIds: ["sound-test", "speaker-test", "headphone-test"],
  },
  {
    id: "hearing-frequency-test",
    route: "/hearing-frequency-test",
    title: "Hearing Frequency Test",
    navigationCategory: "signal-frequency",
    implementationPhase: "P6.2",
    accent: "yellow",
    status: "live",
    relatedToolIds: ["tone-generator", "headphone-test"],
  },
];

export function getPublicTools(): readonly ToolDefinition[] {
  return toolRegistry.filter((tool) => tool.status === "live");
}

export function getPublicToolsByCategory(
  category: NavigationCategory,
): readonly ToolDefinition[] {
  return getPublicTools().filter(
    (tool) => tool.navigationCategory === category,
  );
}
