import { useCallback, useSyncExternalStore } from 'react';

// Per-project sidebar order, overview section order and view preferences.
// Saved in localStorage. To sync across devices, replace read()/write() with API calls.

export type SidebarItemId =
  | 'overview' | 'board' | 'backlog' | 'sprints' | 'timeline' | 'whiteboard' | 'requirements'
  | 'issues' | 'defects' | 'repository' | 'releases' | 'team' | 'settings';

export type SectionId = 'summary' | 'timeline' | 'engineering' | 'team' | 'quality' | 'work' | 'traceability';

export interface LayoutEntry<T extends string> { id: T; visible: boolean }

export interface ProjectPrefs {
  timelineZoom: 'month' | 'quarter' | 'half';
  deliveryChart: 'burnup' | 'burndown';
  compactTimeline: boolean;
}

export interface ProjectLayout {
  sidebar: LayoutEntry<SidebarItemId>[];
  sections: LayoutEntry<SectionId>[];
  prefs: ProjectPrefs;
}

// `path` is relative to /projects/:projectId. `locked` items cannot be hidden.
export const SIDEBAR_ITEMS: Record<SidebarItemId, { label: string; path: string; locked?: boolean }> = {
  overview: { label: 'Overview', path: '', locked: true },
  board: { label: 'Board', path: '/board' },
  backlog: { label: 'Backlog', path: '/backlog' },
  sprints: { label: 'Sprints', path: '/cycles' },
  timeline: { label: 'Timeline', path: '/milestones' },
  whiteboard: { label: 'Whiteboard', path: '/whiteboard' },
  requirements: { label: 'Requirements', path: '/requirements' },
  issues: { label: 'Issues', path: '/issues' },
  defects: { label: 'Defects', path: '/defects' },
  repository: { label: 'Repository', path: '/repositories' },
  releases: { label: 'Releases', path: '/releases' },
  team: { label: 'Team', path: '/members' },
  settings: { label: 'Settings', path: '/settings', locked: true },
};

export const SECTION_META: Record<SectionId, { label: string; hint: string }> = {
  summary: { label: 'Summary', hint: 'KPIs, delivery chart, project details, health' },
  timeline: { label: 'Timeline', hint: 'Gantt with phases, epics, sprints, milestones' },
  engineering: { label: 'Git activity', hint: 'Commits, contributors, pull requests' },
  team: { label: 'Team potential', hint: 'Capacity, output and potential per member' },
  quality: { label: 'Quality', hint: 'Defect trend and items needing attention' },
  work: { label: 'Work items', hint: 'Tasks, issues, defects and releases' },
  traceability: { label: 'Traceability', hint: 'Requirement chain, gaps and activity' },
};

const entries = <T extends string>(ids: T[]): LayoutEntry<T>[] => ids.map((id) => ({ id, visible: true }));

export const defaultLayout = (): ProjectLayout => ({
  sidebar: entries(Object.keys(SIDEBAR_ITEMS) as SidebarItemId[]),
  sections: entries(Object.keys(SECTION_META) as SectionId[]),
  prefs: { timelineZoom: 'quarter', deliveryChart: 'burnup', compactTimeline: false },
});

const toKey = (projectId: string | number) => String(projectId || '');
const storageKey = (projectId: string | number) => `devflow:project-layout:${toKey(projectId)}`;
const cache = new Map<string, ProjectLayout>();
const listeners = new Set<() => void>();

// Keeps saved order, drops ids that no longer exist, appends ids added in later versions.
const merge = <T extends string>(saved: LayoutEntry<T>[] | undefined, defaults: LayoutEntry<T>[]) => {
  const known = new Set(defaults.map((d) => d.id));
  const kept = (Array.isArray(saved) ? saved : []).filter((e) => known.has(e.id));
  const seen = new Set(kept.map((e) => e.id));
  return [...kept, ...defaults.filter((d) => !seen.has(d.id))];
};

const read = (projectId: string | number): ProjectLayout => {
  const k = toKey(projectId);
  const hit = cache.get(k);
  if (hit) return hit;
  const base = defaultLayout();
  let next = base;
  try {
    const raw = localStorage.getItem(storageKey(k));
    if (raw) {
      const saved = JSON.parse(raw) as Partial<ProjectLayout>;
      next = {
        sidebar: merge(saved.sidebar, base.sidebar),
        sections: merge(saved.sections, base.sections),
        prefs: { ...base.prefs, ...saved.prefs },
      };
    }
  } catch {
    next = base;
  }
  cache.set(k, next);
  return next;
};

const write = (projectId: string | number, next: ProjectLayout) => {
  const k = toKey(projectId);
  cache.set(k, next);
  try {
    localStorage.setItem(storageKey(k), JSON.stringify(next));
  } catch {
    // Storage unavailable: the layout still applies for this session.
  }
  listeners.forEach((l) => l());
};

const subscribe = (listener: () => void) => {
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith('devflow:project-layout:')) {
      cache.clear();
      listener();
    }
  };
  listeners.add(listener);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
};

export const useProjectLayout = (projectId: string | number) => {
  const k = toKey(projectId);
  const layout = useSyncExternalStore(subscribe, () => read(k));
  const update = useCallback(
    (patch: Partial<ProjectLayout>) => write(k, { ...read(k), ...patch }),
    [k]
  );
  const reset = useCallback(() => write(k, defaultLayout()), [k]);
  return { layout, update, reset };
};

// For your sidebar component: the visible items in the user's order, with resolved links.
export const useProjectSidebarItems = (projectId: string | number) => {
  const { layout } = useProjectLayout(projectId);
  return layout.sidebar
    .filter((e) => e.visible || SIDEBAR_ITEMS[e.id]?.locked)
    .map((e) => ({
      id: e.id,
      label: SIDEBAR_ITEMS[e.id]?.label || e.id,
      to: `/projects/${projectId}${SIDEBAR_ITEMS[e.id]?.path || ''}`,
      visible: e.visible,
    }));
};
