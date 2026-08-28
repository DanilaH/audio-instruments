import { describe, expect, it, vi } from "vitest";

import { AudioSession } from "../../src/browser/audio-session/AudioSession";

function createFakeContext(initialState: AudioContextState = "suspended") {
  let state = initialState;
  const resume = vi.fn(async () => {
    state = "running";
  });
  const close = vi.fn(async () => {
    state = "closed";
  });

  return {
    get state() {
      return state;
    },
    resume,
    close,
  } as unknown as AudioContext & {
    resume: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
}

describe("AudioSession", () => {
  it("creates and resumes the AudioContext lazily", async () => {
    const context = createFakeContext();
    const factory = vi.fn(() => context);
    const session = new AudioSession(factory);

    expect(session.isCreated).toBe(false);
    expect(factory).not.toHaveBeenCalled();

    const first = await session.getContext();
    const second = await session.getContext();

    expect(first).toBe(context);
    expect(second).toBe(context);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(context.resume).toHaveBeenCalledTimes(1);
  });

  it("stops registered resources without closing the context", async () => {
    const context = createFakeContext("running");
    const stop = vi.fn();
    const session = new AudioSession(() => context);
    await session.getContext();
    session.register({ stop });

    await session.stop();

    expect(stop).toHaveBeenCalledTimes(1);
    expect(context.close).not.toHaveBeenCalled();
    expect(session.isDisposed).toBe(false);
  });

  it("disposes resources and closes the context exactly once", async () => {
    const context = createFakeContext("running");
    const dispose = vi.fn();
    const session = new AudioSession(() => context);
    await session.getContext();
    session.register({ dispose });

    await session.dispose();
    await session.dispose();

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(session.currentContext).toBeNull();
    expect(session.isDisposed).toBe(true);
  });

  it("supports unregistering a resource before teardown", async () => {
    const stop = vi.fn();
    const session = new AudioSession(() => createFakeContext("running"));
    const unregister = session.register({ stop });

    unregister();
    await session.stop();

    expect(stop).not.toHaveBeenCalled();
  });

  it("rejects reuse after disposal", async () => {
    const session = new AudioSession(() => createFakeContext("running"));
    await session.dispose();

    await expect(session.getContext()).rejects.toThrow("disposed AudioSession");
    expect(() => session.register({})).toThrow("disposed AudioSession");
  });
});
