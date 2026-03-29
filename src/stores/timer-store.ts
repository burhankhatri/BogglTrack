import { create } from "zustand";

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

export const useTimerStore = create<TimerState>((set, get) => ({
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
}));
