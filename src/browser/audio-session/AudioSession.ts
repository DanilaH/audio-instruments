export interface SessionResource {
  stop?: () => void | Promise<void>;
  dispose?: () => void | Promise<void>;
}

export type AudioContextFactory = () => AudioContext;

function createBrowserAudioContext(): AudioContext {
  return new AudioContext({ latencyHint: "interactive" });
}

async function runSettled(
  resources: readonly SessionResource[],
  operation: "stop" | "dispose",
): Promise<void> {
  const failures: unknown[] = [];

  for (const resource of resources) {
    const action =
      operation === "dispose" ? (resource.dispose ?? resource.stop) : resource.stop;

    if (!action) continue;

    try {
      await action.call(resource);
    } catch (error) {
      failures.push(error);
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, `AudioSession ${operation} failed`);
  }
}

export class AudioSession {
  readonly #createContext: AudioContextFactory;
  readonly #resources = new Set<SessionResource>();

  #context: AudioContext | null = null;
  #disposed = false;

  constructor(createContext: AudioContextFactory = createBrowserAudioContext) {
    this.#createContext = createContext;
  }

  get isCreated(): boolean {
    return this.#context !== null;
  }

  get isDisposed(): boolean {
    return this.#disposed;
  }

  get currentContext(): AudioContext | null {
    return this.#context;
  }

  async getContext(): Promise<AudioContext> {
    if (this.#disposed) {
      throw new Error("Cannot use a disposed AudioSession");
    }

    const context = this.#context ?? this.#createContext();
    this.#context = context;

    if (context.state === "suspended") {
      await context.resume();
    }

    return context;
  }

  register(resource: SessionResource): () => void {
    if (this.#disposed) {
      throw new Error("Cannot register resources on a disposed AudioSession");
    }

    this.#resources.add(resource);
    return () => this.#resources.delete(resource);
  }

  async stop(): Promise<void> {
    await runSettled([...this.#resources], "stop");
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;

    const resources = [...this.#resources];
    this.#resources.clear();

    let resourceError: unknown;
    try {
      await runSettled(resources, "dispose");
    } catch (error) {
      resourceError = error;
    }

    const context = this.#context;
    this.#context = null;

    let closeError: unknown;
    if (context && context.state !== "closed") {
      try {
        await context.close();
      } catch (error) {
        closeError = error;
      }
    }

    if (resourceError || closeError) {
      const errors = [resourceError, closeError].filter(
        (error): error is NonNullable<typeof error> => error != null,
      );
      throw new AggregateError(errors, "AudioSession dispose failed");
    }
  }
}
