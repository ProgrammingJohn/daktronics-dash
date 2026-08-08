export type SnapshotListener = (snapshot: unknown) => void;
export type SnapshotErrorListener = (error: Error) => void;

export interface SnapshotSource {
  subscribe(
    signal: AbortSignal,
    on_snapshot: SnapshotListener,
    on_error: SnapshotErrorListener
  ): void;
}
