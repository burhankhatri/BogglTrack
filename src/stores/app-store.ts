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

// Page-specific types (richer than the global dropdown versions)

interface ProjectWithStats {
  id: string;
  name: string;
  color: string;
  hourlyRate: number | null;
  estimatedHours: number | null;
  status: string;
  client: { id: string; name: string } | null;
  totalSeconds: number;
  _count: { timeEntries: number };
}

interface ClientWithStats {
  id: string;
  name: string;
  email: string | null;
  notes: string | null;
  projectCount: number;
  totalHours: number;
  totalEarnings: number;
  _count?: { projects: number };
}

interface TagWithCount {
  id: string;
  name: string;
  color: string;
  usageCount: number;
}

interface TimeEntryTag {
  tagId: string;
  tag: { id: string; name: string; color: string };
}

interface TimeEntry {
  id: string;
  description: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  billable: boolean;
  projectId: string | null;
  project: {
    id: string;
    name: string;
    color: string;
    hourlyRate: number | null;
    client?: { id: string; name: string } | null;
  } | null;
  tags: TimeEntryTag[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface DashboardData {
  today: { hours: number; earnings: number };
  thisWeek: { hours: number; earnings: number };
  thisMonth: { hours: number; earnings: number };
  activeProjects: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recentEntries: any[];
  earningsTrend: { date: string; earnings: number }[];
  topProjects: { id: string; name: string; color: string; hours: number; earnings: number }[];
}

interface CacheEntry<T> {
  data: T | null;
  loading: boolean;
  promise: Promise<T> | null;
  fetchedAt: number | null;
}

type CacheKey = "projects" | "tags" | "settings" | "clients";

const STALE_MS = 30_000; // 30 seconds — return cached + refresh in background
const EXPIRED_MS = 5 * 60_000; // 5 minutes — must wait for fresh data

function freshCache<T>(): CacheEntry<T> {
  return { data: null, loading: false, promise: null, fetchedAt: null };
}

// ---------------------------------------------------------------------------
// SWR fetch helper
// ---------------------------------------------------------------------------

type SetState = (
  partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)
) => void;
type GetState = () => AppState;

function createSWRFetcher<T>(
  key: string,
  url: string,
  getCache: (s: AppState) => CacheEntry<T>,
  setCache: (set: SetState, entry: Partial<CacheEntry<T>>) => void
) {
  return async (set: SetState, get: GetState, force = false): Promise<T> => {
    const cache = getCache(get());
    const age = cache.fetchedAt ? Date.now() - cache.fetchedAt : Infinity;

    // Fresh: return immediately
    if (!force && cache.data && age < STALE_MS) {
      return cache.data;
    }

    // Stale but not expired: return cached data AND trigger background refresh
    if (!force && cache.data && age < EXPIRED_MS) {
      if (!cache.promise) {
        const promise = fetch(url)
          .then((r) => {
            if (!r.ok) throw new Error(`Failed to fetch ${key}`);
            return r.json();
          })
          .then((data: T) => {
            setCache(set, { data, loading: false, promise: null, fetchedAt: Date.now() });
            return data;
          })
          .catch((err) => {
            setCache(set, { loading: false, promise: null });
            throw err;
          });
        setCache(set, { promise });
      }
      return cache.data; // Return stale data immediately
    }

    // Expired or no data: wait for fetch
    if (cache.promise) return cache.promise;

    const promise = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch ${key}`);
        return r.json();
      })
      .then((data: T) => {
        setCache(set, { data, loading: false, promise: null, fetchedAt: Date.now() });
        return data;
      })
      .catch((err) => {
        setCache(set, { loading: false, promise: null });
        throw err;
      });

    setCache(set, { loading: true, promise });
    return promise;
  };
}

// ---------------------------------------------------------------------------
// Route → data mapping for prefetch
// ---------------------------------------------------------------------------

const ROUTE_PREFETCH_MAP: Record<string, string[]> = {
  "/": ["dashboard"],
  "/timer": ["projects", "tags", "settings", "timerEntries"],
  "/tracking": ["trackingEntries"],
  "/projects": ["pageProjects", "clients", "settings"],
  "/clients": ["pageClients"],
  "/tags": ["pageTags"],
  "/settings": ["settings"],
  "/reports": ["projects", "clients", "tags", "settings"],
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface AppState {
  // Global dropdown caches (lightweight)
  projects: CacheEntry<Project[]>;
  tags: CacheEntry<Tag[]>;
  settings: CacheEntry<UserSettings>;
  clients: CacheEntry<Client[]>;
  runningTimerChecked: boolean;

  // Page-specific caches (richer data)
  dashboard: CacheEntry<DashboardData>;
  timerEntries: CacheEntry<TimeEntry[]>;
  trackingEntries: CacheEntry<TimeEntry[]>;
  pageProjects: CacheEntry<ProjectWithStats[]>;
  pageClients: CacheEntry<ClientWithStats[]>;
  pageTags: CacheEntry<TagWithCount[]>;

  // Global fetchers (SWR)
  fetchProjects: (force?: boolean) => Promise<Project[]>;
  fetchTags: (force?: boolean) => Promise<Tag[]>;
  fetchSettings: (force?: boolean) => Promise<UserSettings>;
  fetchClients: (force?: boolean) => Promise<Client[]>;

  // Page-specific fetchers (SWR)
  fetchDashboard: (force?: boolean) => Promise<DashboardData>;
  fetchTimerEntries: (force?: boolean) => Promise<TimeEntry[]>;
  fetchTrackingEntries: (force?: boolean) => Promise<TimeEntry[]>;
  fetchPageProjects: (force?: boolean) => Promise<ProjectWithStats[]>;
  fetchPageClients: (force?: boolean) => Promise<ClientWithStats[]>;
  fetchPageTags: (force?: boolean) => Promise<TagWithCount[]>;

  // Prefetch
  prefetchForRoute: (route: string) => void;

  // Cache management
  invalidate: (key: CacheKey | "dashboard" | "timerEntries" | "trackingEntries" | "pageProjects" | "pageClients" | "pageTags") => void;
  setRunningTimerChecked: () => void;

  // Optimistic mutation helpers
  optimisticUpdateTimerEntries: (updater: (entries: TimeEntry[]) => TimeEntry[]) => void;
  optimisticUpdatePageProjects: (updater: (projects: ProjectWithStats[]) => ProjectWithStats[]) => void;
  optimisticUpdatePageClients: (updater: (clients: ClientWithStats[]) => ClientWithStats[]) => void;
  optimisticUpdatePageTags: (updater: (tags: TagWithCount[]) => TagWithCount[]) => void;
}

// Create SWR fetchers
const swrProjects = createSWRFetcher<Project[]>(
  "projects", "/api/projects",
  (s) => s.projects,
  (set, entry) => set((s) => ({ projects: { ...s.projects, ...entry } }))
);
const swrTags = createSWRFetcher<Tag[]>(
  "tags", "/api/tags",
  (s) => s.tags,
  (set, entry) => set((s) => ({ tags: { ...s.tags, ...entry } }))
);
const swrSettings = createSWRFetcher<UserSettings>(
  "settings", "/api/settings",
  (s) => s.settings,
  (set, entry) => set((s) => ({ settings: { ...s.settings, ...entry } }))
);
const swrClients = createSWRFetcher<Client[]>(
  "clients", "/api/clients",
  (s) => s.clients,
  (set, entry) => set((s) => ({ clients: { ...s.clients, ...entry } }))
);
const swrDashboard = createSWRFetcher<DashboardData>(
  "dashboard", "/api/dashboard",
  (s) => s.dashboard,
  (set, entry) => set((s) => ({ dashboard: { ...s.dashboard, ...entry } }))
);
const swrTimerEntries = createSWRFetcher<TimeEntry[]>(
  "timerEntries", "/api/time-entries?limit=50",
  (s) => s.timerEntries,
  (set, entry) => set((s) => ({ timerEntries: { ...s.timerEntries, ...entry } }))
);
const swrTrackingEntries = createSWRFetcher<TimeEntry[]>(
  "trackingEntries", "/api/time-entries?limit=200",
  (s) => s.trackingEntries,
  (set, entry) => set((s) => ({ trackingEntries: { ...s.trackingEntries, ...entry } }))
);
const swrPageProjects = createSWRFetcher<ProjectWithStats[]>(
  "pageProjects", "/api/projects",
  (s) => s.pageProjects,
  (set, entry) => set((s) => ({ pageProjects: { ...s.pageProjects, ...entry } }))
);
const swrPageClients = createSWRFetcher<ClientWithStats[]>(
  "pageClients", "/api/clients",
  (s) => s.pageClients,
  (set, entry) => set((s) => ({ pageClients: { ...s.pageClients, ...entry } }))
);
const swrPageTags = createSWRFetcher<TagWithCount[]>(
  "pageTags", "/api/tags",
  (s) => s.pageTags,
  (set, entry) => set((s) => ({ pageTags: { ...s.pageTags, ...entry } }))
);

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  projects: freshCache(),
  tags: freshCache(),
  settings: freshCache(),
  clients: freshCache(),
  runningTimerChecked: false,
  dashboard: freshCache(),
  timerEntries: freshCache(),
  trackingEntries: freshCache(),
  pageProjects: freshCache(),
  pageClients: freshCache(),
  pageTags: freshCache(),

  // Global fetchers
  fetchProjects: (force) => swrProjects(set, get, force),
  fetchTags: (force) => swrTags(set, get, force),
  fetchSettings: (force) => swrSettings(set, get, force),
  fetchClients: (force) => swrClients(set, get, force),

  // Page-specific fetchers
  fetchDashboard: (force) => swrDashboard(set, get, force),
  fetchTimerEntries: (force) => swrTimerEntries(set, get, force),
  fetchTrackingEntries: (force) => swrTrackingEntries(set, get, force),
  fetchPageProjects: (force) => swrPageProjects(set, get, force),
  fetchPageClients: (force) => swrPageClients(set, get, force),
  fetchPageTags: (force) => swrPageTags(set, get, force),

  // Prefetch: fire fetches for a target route
  prefetchForRoute: (route: string) => {
    const keys = ROUTE_PREFETCH_MAP[route];
    if (!keys) return;
    const state = get();
    for (const key of keys) {
      switch (key) {
        case "projects": state.fetchProjects(); break;
        case "tags": state.fetchTags(); break;
        case "settings": state.fetchSettings(); break;
        case "clients": state.fetchClients(); break;
        case "dashboard": state.fetchDashboard(); break;
        case "timerEntries": state.fetchTimerEntries(); break;
        case "trackingEntries": state.fetchTrackingEntries(); break;
        case "pageProjects": state.fetchPageProjects(); break;
        case "pageClients": state.fetchPageClients(); break;
        case "pageTags": state.fetchPageTags(); break;
      }
    }
  },

  // Cache management
  invalidate: (key) => {
    set((s) => ({
      [key]: { ...s[key as keyof AppState] as CacheEntry<unknown>, fetchedAt: null },
    }));
  },

  setRunningTimerChecked: () => set({ runningTimerChecked: true }),

  // Optimistic mutation helpers — update cached data in-place
  optimisticUpdateTimerEntries: (updater) => {
    set((s) => {
      const current = s.timerEntries.data;
      if (!current) return {};
      return { timerEntries: { ...s.timerEntries, data: updater(current) } };
    });
  },
  optimisticUpdatePageProjects: (updater) => {
    set((s) => {
      const current = s.pageProjects.data;
      if (!current) return {};
      return { pageProjects: { ...s.pageProjects, data: updater(current) } };
    });
  },
  optimisticUpdatePageClients: (updater) => {
    set((s) => {
      const current = s.pageClients.data;
      if (!current) return {};
      return { pageClients: { ...s.pageClients, data: updater(current) } };
    });
  },
  optimisticUpdatePageTags: (updater) => {
    set((s) => {
      const current = s.pageTags.data;
      if (!current) return {};
      return { pageTags: { ...s.pageTags, data: updater(current) } };
    });
  },
}));
