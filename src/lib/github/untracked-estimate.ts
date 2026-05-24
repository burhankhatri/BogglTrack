// Turn raw commit timestamps from a cluster into a realistic time window.
//
// Commits only tell us when work was *committed* — they don't tell us when
// the user started writing or stopped reviewing. These constants fill that
// gap conservatively. Numbers were picked to land near the median behavior
// of "I sat down, wrote something, pushed it" without inflating estimates
// for trivial commits.
//
// - Single-commit cluster: 25 min total (20 before + 5 after). The single
//   data point is our weakest signal — this is a default, not a measurement.
// - Multi-commit cluster: (last − first) + 15 min ramp + 10 min tail. The
//   inter-commit span is real signal; we only pad the unseen edges.
// - Hard cap: 3h per cluster — even with many commits over a long stretch,
//   claiming a multi-hour session from commit timestamps alone is overreach.

export const RAMP_UP_MS = 15 * 60 * 1000;
export const TAIL_MS = 10 * 60 * 1000;
export const SOLO_BEFORE_MS = 20 * 60 * 1000;
export const SOLO_AFTER_MS = 5 * 60 * 1000;
export const CLUSTER_GAP_MS = 30 * 60 * 1000;
export const MAX_CLUSTER_MS = 3 * 60 * 60 * 1000;

export interface EstimatedWindow {
  startMs: number;
  endMs: number;
  durationSeconds: number;
}

/**
 * Estimate the work window for a cluster of commit timestamps.
 *
 * @param committedAtMs commit times in ms. Order doesn't matter.
 * @param opts.earliestStartMs if set, the estimated start is clamped so it
 *   never precedes this time. Used to prevent the ramp-up from overlapping
 *   a previously tracked entry.
 */
export function estimateClusterWindow(
  committedAtMs: number[],
  opts?: { earliestStartMs?: number }
): EstimatedWindow {
  if (committedAtMs.length === 0) {
    throw new Error("estimateClusterWindow: no commits");
  }
  const sorted = [...committedAtMs].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  let startMs: number;
  let endMs: number;
  if (sorted.length === 1) {
    startMs = first - SOLO_BEFORE_MS;
    endMs = first + SOLO_AFTER_MS;
  } else {
    startMs = first - RAMP_UP_MS;
    endMs = last + TAIL_MS;
  }

  if (opts?.earliestStartMs !== undefined && startMs < opts.earliestStartMs) {
    startMs = opts.earliestStartMs;
  }

  if (endMs - startMs > MAX_CLUSTER_MS) {
    endMs = startMs + MAX_CLUSTER_MS;
  }

  return {
    startMs,
    endMs,
    durationSeconds: Math.floor((endMs - startMs) / 1000),
  };
}
