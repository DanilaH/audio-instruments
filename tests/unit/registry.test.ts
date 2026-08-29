import { describe, expect, it } from "vitest";

import { getPublicTools, toolRegistry } from "../../src/registry/tools";

const expectedToolIds = [
  "sound-test",
  "speaker-test",
  "headphone-test",
  "stereo-test",
  "phase-test",
  "surround-sound-test",
  "bass-test",
  "tone-generator",
  "frequency-sweep",
  "noise-generator",
  "microphone-test",
  "spectrum-analyzer",
  "pitch-detector",
  "decibel-meter",
  "audio-latency-test",
  "hearing-frequency-test",
];

describe("tool registry", () => {
  it("contains the complete 16-tool v1 set exactly once", () => {
    const ids = toolRegistry.map((tool) => tool.id);
    const routes = toolRegistry.map((tool) => tool.route);

    expect(ids).toHaveLength(16);
    expect([...ids].sort()).toEqual([...expectedToolIds].sort());
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("contains only planned/live statuses", () => {
    for (const tool of toolRegistry) {
      expect(["planned", "live"]).toContain(tool.status);
    }
  });

  it("publishes only implemented routes", () => {
    expect(getPublicTools().map(({ id, route }) => ({ id, route }))).toEqual([
      { id: "sound-test", route: "/sound-test" },
      { id: "speaker-test", route: "/speaker-test" },
      { id: "headphone-test", route: "/headphone-test" },
      { id: "stereo-test", route: "/stereo-test" },
      { id: "phase-test", route: "/phase-test" },
      { id: "surround-sound-test", route: "/surround-sound-test" },
      { id: "bass-test", route: "/bass-test" },
      { id: "tone-generator", route: "/tone-generator" },
      { id: "frequency-sweep", route: "/frequency-sweep" },
      { id: "noise-generator", route: "/noise-generator" },
    ]);
  });

  it("never leaks a planned tool into public data", () => {
    const publicIds = new Set(getPublicTools().map((tool) => tool.id));

    for (const tool of toolRegistry) {
      if (tool.status === "planned") {
        expect(publicIds.has(tool.id)).toBe(false);
      }
    }
  });
});
