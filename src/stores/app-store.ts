import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project {
  id: string;
  name: string;
  color: string;
  hourlyRate: number | null;
  client?: { id: string; name: string } | null;
  estimatedHours?: number | null;
  status?: string;
  totalSeconds?: number;
  _count?: { timeEntries: number };
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Client {
  id: string;
  name: string;
}

interface UserSettings {
  name: string;
  email: string | null;
  defaultHourlyRate: number;
  currency: string;
  currencySymbol: string;
  dateFormat: string;
  timeFormat: string;
  weekStartDay: string;
  theme: string;
}

interface CacheEntry<T> {
  data: T | null;
  loading: boolean;
  promise: Promise<T> | null;
  fetchedAt: number | null;
}

type CacheKey = "projects" | "tags" | "settings" | "clients";

const STALE_MS = 5 * 60 * 1000; // 5 minutes

function freshCache<T>(): CacheEntry<T> {
  return { data: null, loading: false, promise: null, fetchedAt: null };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface AppState {
  projects: CacheEntry<Project[]>;
  tags: CacheEntry<Tag[]>;
  settings: CacheEntry<UserSettings>;
  clients: CacheEntry<Client[]>;
  runningTimerChecked: boolean;

  fetchProjects: (force?: boolean) => Promise<Project[]>;
  fetchTags: (force?: boolean) => Promise<Tag[]>;
  fetchSettings: (force?: boolean) => Promise<UserSettings>;
  fetchClients: (force?: boolean) => Promise<Client[]>;
  invalidate: (key: CacheKey) => void;
  setRunningTimerChecked: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  projects: freshCache(),
  tags: freshCache(),
  settings: freshCache(),
  clients: freshCache(),
  runningTimerChecked: false,

  fetchProjects: async (force = false) => {
    const { projects } = get();
    if (
      !force &&
      projects.data &&
      projects.fetchedAt &&
      Date.now() - projects.fetchedAt < STALE_MS
    ) {
      return projects.data;
    }
    if (projects.promise) return projects.promise;

    const promise = fetch("/api/projects")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch projects");
        return r.json();
      })
      .then((data: Project[]) => {
        set({
          projects: { data, loading: false, promise: null, fetchedAt: Date.now() },
        });
        return data;
      })
      .catch((err) => {
        set((s) => ({
          projects: { ...s.projects, loading: false, promise: null },
        }));
        throw err;
      });

    set({ projects: { ...projects, loading: true, promise } });
    return promise;
  },

  fetchTags: async (force = false) => {
    const { tags } = get();
    if (
      !force &&
      tags.data &&
      tags.fetchedAt &&
      Date.now() - tags.fetchedAt < STALE_MS
    ) {
      return tags.data;
    }
    if (tags.promise) return tags.promise;

    const promise = fetch("/api/tags")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch tags");
        return r.json();
      })
      .then((data: Tag[]) => {
        set({
          tags: { data, loading: false, promise: null, fetchedAt: Date.now() },
        });
        return data;
      })
      .catch((err) => {
        set((s) => ({
          tags: { ...s.tags, loading: false, promise: null },
        }));
        throw err;
      });

    set({ tags: { ...tags, loading: true, promise } });
    return promise;
  },

  fetchSettings: async (force = false) => {
    const { settings } = get();
    if (
      !force &&
      settings.data &&
      settings.fetchedAt &&
      Date.now() - settings.fetchedAt < STALE_MS
    ) {
      return settings.data;
    }
    if (settings.promise) return settings.promise;

    const promise = fetch("/api/settings")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch settings");
        return r.json();
      })
      .then((data: UserSettings) => {
        set({
          settings: { data, loading: false, promise: null, fetchedAt: Date.now() },
        });
        return data;
      })
      .catch((err) => {
        set((s) => ({
          settings: { ...s.settings, loading: false, promise: null },
        }));
        throw err;
      });

    set({ settings: { ...settings, loading: true, promise } });
    return promise;
  },

  fetchClients: async (force = false) => {
    const { clients } = get();
    if (
      !force &&
      clients.data &&
      clients.fetchedAt &&
      Date.now() - clients.fetchedAt < STALE_MS
    ) {
      return clients.data;
    }
    if (clients.promise) return clients.promise;

    const promise = fetch("/api/clients")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch clients");
        return r.json();
      })
      .then((data: Client[]) => {
        set({
          clients: { data, loading: false, promise: null, fetchedAt: Date.now() },
        });
        return data;
      })
      .catch((err) => {
        set((s) => ({
          clients: { ...s.clients, loading: false, promise: null },
        }));
        throw err;
      });

    set({ clients: { ...clients, loading: true, promise } });
    return promise;
  },

  invalidate: (key) => {
    set((s) => ({
      [key]: { ...s[key], fetchedAt: null },
    }));
  },

  setRunningTimerChecked: () => set({ runningTimerChecked: true }),
}));
