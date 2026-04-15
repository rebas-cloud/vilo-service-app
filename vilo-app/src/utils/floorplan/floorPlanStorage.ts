// FloorPlan localStorage persistence helpers.

// --- Storage Keys ---

export const FLOORPLAN_INSPECTOR_STORAGE_KEY = 'vilo.floorplan.inspector';
export const FLOORPLAN_VIEWPORT_STORAGE_KEY = 'vilo.floorplan.viewport';
export const FLOORPLAN_EDITOR_CANVAS_STORAGE_KEY = 'vilo.floorplan.editorCanvasSizes';
export const FLOORPLAN_BADGE_VISIBILITY_STORAGE_KEY = 'vilo.floorplan.badges';

// --- Types ---

export type PersistedFloorPlanInspector =
  | { type: 'reservation'; id: string }
  | { type: 'table'; id: string };

export type PersistedFloorPlanViewport = {
  activeZone: string;
  scale: number;
  translate: { x: number; y: number };
};

export type PersistedEditorCanvasSizes = Record<string, { width: number; height: number }>;

export type PersistedFloorPlanBadges = {
  showTimeBadges: boolean;
  showMoneyBadges: boolean;
  showStatusBadges: boolean;
  showServerBadges: boolean;
};

// --- Loaders ---

export function loadPersistedFloorPlanViewport(fallbackZone: string): PersistedFloorPlanViewport {
  if (typeof window === 'undefined') {
    return { activeZone: fallbackZone, scale: 1, translate: { x: 0, y: 0 } };
  }

  try {
    const raw = window.localStorage.getItem(FLOORPLAN_VIEWPORT_STORAGE_KEY);
    if (!raw) {
      return { activeZone: fallbackZone, scale: 1, translate: { x: 0, y: 0 } };
    }

    const parsed = JSON.parse(raw) as Partial<PersistedFloorPlanViewport>;
    return {
      activeZone: parsed.activeZone || fallbackZone,
      scale: typeof parsed.scale === 'number' ? parsed.scale : 1,
      translate: {
        x: typeof parsed.translate?.x === 'number' ? parsed.translate.x : 0,
        y: typeof parsed.translate?.y === 'number' ? parsed.translate.y : 0,
      },
    };
  } catch {
    return { activeZone: fallbackZone, scale: 1, translate: { x: 0, y: 0 } };
  }
}

export function loadPersistedEditorCanvasSizes(): PersistedEditorCanvasSizes {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(FLOORPLAN_EDITOR_CANVAS_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as PersistedEditorCanvasSizes;
  } catch {
    return {};
  }
}

export function loadPersistedFloorPlanBadges(): PersistedFloorPlanBadges {
  const defaults: PersistedFloorPlanBadges = {
    showTimeBadges: true,
    showMoneyBadges: true,
    showStatusBadges: true,
    showServerBadges: true,
  };

  if (typeof window === 'undefined') return defaults;

  try {
    const raw = window.localStorage.getItem(FLOORPLAN_BADGE_VISIBILITY_STORAGE_KEY);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw);
    return {
      showTimeBadges: typeof parsed.showTimeBadges === 'boolean' ? parsed.showTimeBadges : defaults.showTimeBadges,
      showMoneyBadges: typeof parsed.showMoneyBadges === 'boolean' ? parsed.showMoneyBadges : defaults.showMoneyBadges,
      showStatusBadges: typeof parsed.showStatusBadges === 'boolean' ? parsed.showStatusBadges : defaults.showStatusBadges,
      showServerBadges: typeof parsed.showServerBadges === 'boolean' ? parsed.showServerBadges : defaults.showServerBadges,
    };
  } catch {
    return defaults;
  }
}
