import { create } from "zustand";
import { persist } from "zustand/middleware";

// Cross-tab sync: a single BroadcastChannel shared by every tab in this
// origin. When one tab starts/stops/restores the timer, the others see it
// immediately instead of waiting for the once-per-session /api/time-entries/
// running check to fire. elapsedSeconds is NOT synced — each tab computes
// it independently from startTime, which avoids a feedback loop where every
// tick() re-broadcasts and floods the channel.
const channel: BroadcastChannel | null =
  typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("boggltrack-timer")
    : null;

// Suppress echo when we're applying a state received from another tab.
let applyingRemote = false;

interface StartParams {
  entryId: string;
  startTime: string;
  description: string;
  projectId: string | null;
  billable: boolean;
  tagIds: string[];
  hourlyRate: number;
}

interface TimerState {
  isRunning: boolean;
  entryId: string | null;
  startTime: Date | null;
  description: string;
  projectId: string | null;
  billable: boolean;
  tagIds: string[];
  elapsedSeconds: number;
  hourlyRate: number;

  startTimer: (params: StartParams) => void;
  stopTimer: () => void;
  tick: () => void;
  setDescription: (desc: string) => void;
  setProjectId: (id: string | null) => void;
  setBillable: (b: boolean) => void;
  setTagIds: (ids: string[]) => void;
  setHourlyRate: (rate: number) => void;
  setEntryId: (id: string) => void;
  restoreTimer: (params: StartParams) => void;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      isRunning: false,
      entryId: null,
      startTime: null,
      description: "",
      projectId: null,
      billable: true,
      tagIds: [],
      elapsedSeconds: 0,
      hourlyRate: 0,

      startTimer: (params) => {
        const st = new Date(params.startTime);
        set({
          isRunning: true,
          entryId: params.entryId,
          startTime: st,
          description: params.description,
          projectId: params.projectId,
          billable: params.billable,
          tagIds: params.tagIds,
          hourlyRate: params.hourlyRate,
          elapsedSeconds: Math.max(0, Math.floor((Date.now() - st.getTime()) / 1000)),
        });
      },

      stopTimer: () => {
        set({
          isRunning: false,
          entryId: null,
          startTime: null,
          description: "",
          projectId: null,
          billable: true,
          tagIds: [],
          elapsedSeconds: 0,
          hourlyRate: 0,
        });
      },

      tick: () => {
        const { startTime } = get();
        if (startTime) {
          set({ elapsedSeconds: Math.max(0, Math.floor((Date.now() - startTime.getTime()) / 1000)) });
        }
      },

      setDescription: (description) => set({ description }),
      setProjectId: (projectId) => set({ projectId }),
      setBillable: (billable) => set({ billable }),
      setTagIds: (tagIds) => set({ tagIds }),
      setHourlyRate: (hourlyRate) => set({ hourlyRate }),
      setEntryId: (entryId) => set({ entryId }),

      restoreTimer: (params) => {
        const st = new Date(params.startTime);
        set({
          isRunning: true,
          entryId: params.entryId,
          startTime: st,
          description: params.description,
          projectId: params.projectId,
          billable: params.billable,
          tagIds: params.tagIds,
          hourlyRate: params.hourlyRate,
          elapsedSeconds: Math.max(0, Math.floor((Date.now() - st.getTime()) / 1000)),
        });
      },
    }),
    {
      name: "boggltrack-timer",
      partialize: (state) => ({
        isRunning: state.isRunning,
        entryId: state.entryId,
        startTime: state.startTime ? state.startTime.toISOString() : null,
        description: state.description,
        projectId: state.projectId,
        billable: state.billable,
        tagIds: state.tagIds,
        hourlyRate: state.hourlyRate,
      }),
      onRehydrateStorage: () => (state) => {
        // After rehydration, recompute elapsedSeconds from startTime
        if (state?.isRunning && state.startTime) {
          // startTime comes back as string from JSON — convert to Date
          const st = typeof state.startTime === "string"
            ? new Date(state.startTime)
            : state.startTime;
          state.startTime = st;
          state.elapsedSeconds = Math.max(
            0,
            Math.floor((Date.now() - st.getTime()) / 1000)
          );
        }
      },
    }
  )
);

// ---------------------------------------------------------------------------
// Cross-tab sync (BroadcastChannel)
// ---------------------------------------------------------------------------

if (channel) {
  // Receive: apply remote state without re-broadcasting.
  channel.addEventListener("message", (ev) => {
    const data = ev.data as
      | { type: "state"; payload: Record<string, unknown> }
      | undefined;
    if (data?.type !== "state") return;
    const p = data.payload as {
      isRunning: boolean;
      entryId: string | null;
      startTime: string | null;
      description: string;
      projectId: string | null;
      billable: boolean;
      tagIds: string[];
      hourlyRate: number;
    };
    const st = p.startTime ? new Date(p.startTime) : null;
    applyingRemote = true;
    useTimerStore.setState({
      isRunning: p.isRunning,
      entryId: p.entryId,
      startTime: st,
      description: p.description,
      projectId: p.projectId,
      billable: p.billable,
      tagIds: p.tagIds,
      hourlyRate: p.hourlyRate,
      elapsedSeconds: st
        ? Math.max(0, Math.floor((Date.now() - st.getTime()) / 1000))
        : 0,
    });
    applyingRemote = false;
  });

  // Send: broadcast on any non-tick change. elapsedSeconds-only updates are
  // filtered out by checking the other tracked fields.
  const trackedKeys = [
    "isRunning",
    "entryId",
    "startTime",
    "description",
    "projectId",
    "billable",
    "tagIds",
    "hourlyRate",
  ] as const;

  useTimerStore.subscribe((state, prev) => {
    if (applyingRemote) return;
    const meaningful = trackedKeys.some((k) => state[k] !== prev[k]);
    if (!meaningful) return;
    channel.postMessage({
      type: "state",
      payload: {
        isRunning: state.isRunning,
        entryId: state.entryId,
        startTime: state.startTime ? state.startTime.toISOString() : null,
        description: state.description,
        projectId: state.projectId,
        billable: state.billable,
        tagIds: state.tagIds,
        hourlyRate: state.hourlyRate,
      },
    });
  });
}
