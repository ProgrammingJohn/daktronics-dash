import type {
  SnapshotErrorListener,
  SnapshotListener,
  SnapshotSource
} from "./snapshot_source";

export class FakeSnapshotSource implements SnapshotSource {
  aborted = false;

  private signal: AbortSignal | null = null;
  private on_snapshot: SnapshotListener | null = null;
  private on_error: SnapshotErrorListener | null = null;

  constructor(private readonly initial_snapshot?: unknown) {}

  subscribe(
    signal: AbortSignal,
    on_snapshot: SnapshotListener,
    on_error: SnapshotErrorListener
  ): void {
    this.signal = signal;
    this.on_snapshot = on_snapshot;
    this.on_error = on_error;
    this.aborted = signal.aborted;
    signal.addEventListener("abort", () => {
      this.aborted = true;
    });

    if (this.initial_snapshot !== undefined) {
      queueMicrotask(() => {
        if (!signal.aborted) on_snapshot(this.initial_snapshot);
      });
    }
  }

  emit(snapshot: unknown): void {
    if (this.signal?.aborted === false) this.on_snapshot?.(snapshot);
  }

  fail(error: Error): void {
    if (this.signal?.aborted === false) this.on_error?.(error);
  }
}
