let active_interval = null;
let active_clear_interval = null;

export function map_connection_status(status) {
  if (status === "LIVE") return "live";
  if (status === "STALE_SOURCE" || status === "WAITING_FOR_CLIENT") return "stale";
  return "disconnected";
}

export async function poll_score_revision(status, lastRevision, getScore, onScore) {
  if (typeof status.revision !== "number" || status.revision === lastRevision) {
    return lastRevision;
  }
  const score = await getScore();
  if (score !== null && typeof score === "object") onScore(score);
  return status.revision;
}

export function start_synced_polling(
  tick,
  setIntervalFn = window.setInterval.bind(window),
  clearIntervalFn = window.clearInterval.bind(window)
) {
  stop_synced_polling();
  active_clear_interval = clearIntervalFn;
  active_interval = setIntervalFn(tick, 1000);
}

export function stop_synced_polling() {
  if (active_interval !== null && active_clear_interval !== null) {
    active_clear_interval(active_interval);
  }
  active_interval = null;
  active_clear_interval = null;
}
