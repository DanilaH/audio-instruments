export type ToolStatus = "planned" | "live";
export type NavigationCategory =
  "output" | "signal-frequency" | "input-analysis" | "timing-specialist";
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
    status: "planned",
    relatedToolIds: [],
  },
  {
    id: "speaker-test",
    route: "/speaker-test",
    title: "Speaker Test",
    navigationCategory: "output",
    implementationPhase: "P3.3",
    accent: "peach",
    status: "planned",
    relatedToolIds: [],
  },
  {
    id: "headphone-test",
    route: "/headphone-test",
    title: "Headphone Test",
    navigationCategory: "output",
    implementationPhase: "P3.4",
    accent: "blue",
    status: "planned",
    relatedToolIds: [],
  },
  {
    id: "stereo-test",
    route: "/stereo-test",
    title: "Stereo Test",
    navigationCategory: "output",
    implementationPhase: "P3.2",
    accent: "lavender",
    status: "planned",
    relatedToolIds: [],
  },
  {
    id: "phase-test",
    route: "/phase-test",
    title: "Phase Test",
    navigationCategory: "output",
    implementationPhase: "P3.2",
    accent: "lavender",
    status: "planned",
    relatedToolIds: [],
  },
  {
    id: "surround-sound-test",
    route: "/surround-sound-test",
    title: "Surround Sound Test",
    navigationCategory: "output",
    implementationPhase: "P3.5",
    accent: "blue",
    status: "planned",
    relatedToolIds: [],
  },
  {
    id: "bass-test",
    route: "/bass-test",
    title: "Bass Test",
    navigationCategory: "signal-frequency",
    implementationPhase: "P4.1",
    accent: "mint",
    status: "planned",
    relatedToolIds: [],
  },
  {
    id: "tone-generator",
    route: "/tone-generator",
    title: "Tone Generator",
    navigationCategory: "signal-frequency",
    implementationPhase: "P2.1",
    accent: "lavender",
    status: "planned",
    relatedToolIds: [],
  },
  {
    id: "frequency-sweep",
    route: "/frequency-sweep",
    title: "Frequency Sweep",
    navigationCategory: "signal-frequency",
    implementationPhase: "P4.2",
    accent: "lavender",
    status: "planned",
    relatedToolIds: [],
  },
  {
    id: "noise-generator",
    route: "/noise-generator",
    title: "Noise Generator",
    navigationCategory: "signal-frequency",
    implementationPhase: "P4.3",
    accent: "neutral",
    status: "planned",
    relatedToolIds: [],
  },
  {
    id: "microphone-test",
    route: "/microphone-test",
    title: "Microphone Test",
    navigationCategory: "input-analysis",
    implementationPhase: "P5.2",
    accent: "cyan",
    status: "planned",
    relatedToolIds: [],
  },
  {
    id: "spectrum-analyzer",
    route: "/spectrum-analyzer",
    title: "Spectrum Analyzer",
    navigationCategory: "input-analysis",
    implementationPhase: "P5.3",
    accent: "spectral",
    status: "planned",
    relatedToolIds: [],
  },
  {
    id: "pitch-detector",
    route: "/pitch-detector",
    title: "Pitch Detector",
    navigationCategory: "input-analysis",
    implementationPhase: "P5.4",
    accent: "mint",
    status: "planned",
    relatedToolIds: [],
  },
  {
    id: "decibel-meter",
    route: "/decibel-meter",
    title: "Decibel Meter",
    navigationCategory: "input-analysis",
    implementationPhase: "P5.5",
    accent: "cyan",
    status: "planned",
    relatedToolIds: [],
  },
  {
    id: "audio-latency-test",
    route: "/audio-latency-test",
    title: "Audio Latency / AV Sync Test",
    navigationCategory: "timing-specialist",
    implementationPhase: "P6.1",
    accent: "yellow",
    status: "planned",
    relatedToolIds: [],
  },
  {
    id: "hearing-frequency-test",
    route: "/hearing-frequency-test",
    title: "Hearing Frequency Test",
    navigationCategory: "signal-frequency",
    implementationPhase: "P6.2",
    accent: "yellow",
    status: "planned",
    relatedToolIds: [],
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
