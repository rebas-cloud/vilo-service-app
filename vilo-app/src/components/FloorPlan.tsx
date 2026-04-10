import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Table, TableShape, Reservation, Guest, GuestNote, ReservationStatus, OccasionLabel, WaitlistEntry } from '../types';

import { IconAdjustmentsHorizontal, IconAlertTriangleFilled, IconAlignLeft, IconArmchair, IconBabyCarriage, IconBan, IconBell, IconBriefcaseFilled, IconCake, IconCheck, IconChevronDown, IconChevronRight, IconChevronUp, IconCircleCheckFilled, IconCircleX, IconCreditCard, IconClock, IconCoinFilled, IconConfetti, IconEdit, IconGiftFilled, IconGlobeFilled, IconHeartFilled, IconHeartHandshake, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand, IconLeaf, IconMail, IconMasksTheater, IconMessage, IconNews, IconPhone, IconPhoneFilled, IconPlant2, IconPlus, IconSchool, IconSparkles, IconStar, IconStarFilled, IconTrash, IconUser, IconUserCheck, IconUserPlus, IconUsers, IconWalk, IconWheelchair, IconX } from '@tabler/icons-react';
import { saveStorage, loadStorage, loadReservations, loadWaitlist, loadGuests, addGuest, addGuestNote, removeGuestNote, updateWaitlistEntry } from '../utils/storage';
import { ReservationPanel } from './Reservations';
import { TableManagement } from './TableManagement';
import { WaitlistPanel } from './Waitlist';
import { GuestProfile } from './GuestProfile';
import { ReservationDetail } from './ReservationDetail';

interface FloorPlanProps {
  voiceMode?: string;
  onStartVoice?: () => void;
  onStopVoice?: () => void;
  onZoneChange?: (zoneId: string, zoneName: string) => void;
  initialEditMode?: boolean;
}

type SidebarPlacedItem = Reservation & {
  __isSessionItem?: boolean;
  __sessionTableId?: string;
};

// OpenTable-style: size varies by seat count
function getTableSize(table: { shape?: string; seats?: number }): { w: number; h: number } {
  const shape = table.shape || 'rect';
  const seats = table.seats || 4;
  if (shape === 'barstool') return { w: 40, h: 40 };
  if (shape === 'round') {
    if (seats >= 8) return { w: 95, h: 95 };
    if (seats >= 6) return { w: 80, h: 80 };
    return { w: 65, h: 65 };
  }
  if (shape === 'diamond') return { w: 70, h: 70 };
  // rect, rect_v, square - scale by seats
  if (shape === 'square') {
    if (seats >= 8) return { w: 72, h: 72 };
    return { w: 56, h: 56 };
  }
  if (shape === 'rect_v') {
    if (seats >= 6) return { w: 60, h: 90 };
    return { w: 56, h: 80 };
  }
  // rect
  if (seats >= 10) return { w: 100, h: 70 };
  if (seats >= 6) return { w: 90, h: 62 };
  return { w: 75, h: 54 };
}

const SHAPE_SIZES: Record<string, { w: number; h: number }> = {
  diamond: { w: 70, h: 70 },
  rect: { w: 75, h: 54 },
  rect_v: { w: 56, h: 80 },
  square: { w: 56, h: 56 },
  round: { w: 80, h: 80 },
  barstool: { w: 40, h: 40 },
};

const SHAPE_OPTIONS: { value: TableShape; label: string }[] = [
  { value: 'rect', label: 'Rechteck' },
  { value: 'rect_v', label: 'Rechteck (hoch)' },
  { value: 'square', label: 'Quadrat' },
  { value: 'diamond', label: 'Diamant' },
  { value: 'round', label: 'Rund' },
  { value: 'barstool', label: 'Barhocker' },
];

const SERVICE_STATUS_SHORT: Record<string, string> = {
  teilweise_platziert: 'Teilw.',
  platziert: 'Platziert',
  getraenke: 'Getränke',
  vorspeise: 'Vorspeise',
  hauptgericht: 'Hauptgang',
  dessert: 'Dessert',
  gang_1: '1.Gang', gang_2: '2.Gang', gang_3: '3.Gang', gang_4: '4.Gang',
  gang_5: '5.Gang', gang_6: '6.Gang', gang_7: '7.Gang', gang_8: '8.Gang',
  gang_9: '9.Gang', gang_10: '10.Gang', gang_11: '11.Gang', gang_12: '12.Gang',
  digestif: 'Digestif',
  flaschenservice: 'Flasche',
  rechnung_faellig: 'Rechnung',
  bezahlt: 'Bezahlt',
  restaurantleiter: 'Manager!',
  abraeumen: 'Abraeumen',
  abgeraeumt: 'Abgeraeumt',
  beendet: 'Beendet',
};

type PersistedFloorPlanInspector =
  | { type: 'reservation'; id: string }
  | { type: 'table'; id: string };

const FLOORPLAN_INSPECTOR_STORAGE_KEY = 'vilo.floorplan.inspector';
const FLOORPLAN_VIEWPORT_STORAGE_KEY = 'vilo.floorplan.viewport';

type PersistedFloorPlanViewport = {
  activeZone: string;
  scale: number;
  translate: { x: number; y: number };
};

function loadPersistedFloorPlanViewport(fallbackZone: string): PersistedFloorPlanViewport {
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

export function FloorPlan({ onZoneChange, initialEditMode = false }: FloorPlanProps) {
  const { state, dispatch } = useApp();
  type SidebarSortKey = 'reservation_time' | 'arrival_time' | 'name' | 'party_size' | 'table' | 'created_at' | 'payment_status';
  type SidebarSectionKey = 'waitlist' | 'reservations' | 'seated' | 'finished' | 'removed';
  const initialViewportRef = useRef<PersistedFloorPlanViewport>(
    loadPersistedFloorPlanViewport(state.zones[0]?.id || ''),
  );
  const [activeZone, setActiveZone] = useState<string>(initialViewportRef.current.activeZone || state.zones[0]?.id || '');
  const [editMode, setEditMode] = useState(initialEditMode);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableManagementId, setTableManagementId] = useState<string | null>(null);
  const [newTableShape, setNewTableShape] = useState<TableShape>('rect');
  const [showShapePicker, setShowShapePicker] = useState(false);
  const [showReservations, setShowReservations] = useState(false);
  const [openReservationsInAddMode, setOpenReservationsInAddMode] = useState(false);
  const [showReservationCreatePanel, setShowReservationCreatePanel] = useState(false);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [activeWaitlistCardId, setActiveWaitlistCardId] = useState<string | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarSearch] = useState<Record<SidebarSectionKey, string>>({
    waitlist: '',
    reservations: '',
    seated: '',
    finished: '',
    removed: '',
  });
  const [sidebarSortBy, setSidebarSortBy] = useState<Record<SidebarSectionKey, SidebarSortKey>>({
    waitlist: 'created_at',
    reservations: 'reservation_time',
    seated: 'reservation_time',
    finished: 'reservation_time',
    removed: 'reservation_time',
  });
  const [sidebarResCollapsed, setSidebarResCollapsed] = useState(false);
  const [sidebarWaitlistCollapsed, setSidebarWaitlistCollapsed] = useState(false);
  const [sidebarSeatedCollapsed, setSidebarSeatedCollapsed] = useState(false);
  const [sidebarFinishedCollapsed, setSidebarFinishedCollapsed] = useState(false);
  const [sidebarRemovedCollapsed, setSidebarRemovedCollapsed] = useState(false);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [justAddedReservationId, setJustAddedReservationId] = useState<string | null>(null);
  const [pressedReservationId, setPressedReservationId] = useState<string | null>(null);
  const [highlightedTableId, setHighlightedTableId] = useState<string | null>(null);
  const [guestProfileGuest, setGuestProfileGuest] = useState<Guest | null>(null);
  const [guestProfileKey, setGuestProfileKey] = useState(0); // force re-render on guest update
  const [showGuestProfileView, setShowGuestProfileView] = useState(false);
  const previousReservationIdsRef = useRef<Set<string>>(new Set());
  const reservationsInitializedRef = useRef(false);
  const inspectorRestoredRef = useRef(false);
  const [activeNoteTab, setActiveNoteTab] = useState<GuestNote['category']>('general');
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showSeatOverlay, setShowSeatOverlay] = useState(false);
  const [seatOverlayTab, setSeatOverlayTab] = useState<'preassign' | 'seat'>('seat');
  const [seatOverlayZone, setSeatOverlayZone] = useState<string>(activeZone);
  const [showPartySizeOverlay, setShowPartySizeOverlay] = useState(false);
  const [showDurationOverlay, setShowDurationOverlay] = useState(false);
  const [resDetailId, setResDetailId] = useState<string | null>(null);
  const sidebarWidth = 280;

  const [scale, setScale] = useState(initialViewportRef.current.scale);
  const [translate, setTranslate] = useState(initialViewportRef.current.translate);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef({ startDist: 0, startScale: 1, startX: 0, startY: 0, startTx: 0, startTy: 0, isPinching: false, isPanning: false });
  const dragRef = useRef<{ tableId: string; startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);

  const switchZone = useCallback((zoneId: string) => {
    setActiveZone(zoneId);
    setSelectedTable(null);
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    const zone = state.zones.find(z => z.id === zoneId);
    if (onZoneChange && zone) onZoneChange(zoneId, zone.name);
  }, [state.zones, onZoneChange]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const getDistance = (t1: Touch, t2: Touch) =>
      Math.sqrt((t1.clientX - t2.clientX) ** 2 + (t1.clientY - t2.clientY) ** 2);
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const d = getDistance(e.touches[0], e.touches[1]);
        pinchRef.current = { ...pinchRef.current, startDist: d, startScale: scale, isPinching: true, isPanning: false };
      } else if (e.touches.length === 1 && scale > 1 && !editMode) {
        pinchRef.current = { ...pinchRef.current, startX: e.touches[0].clientX, startY: e.touches[0].clientY, startTx: translate.x, startTy: translate.y, isPanning: true, isPinching: false };
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (pinchRef.current.isPinching && e.touches.length === 2) {
        e.preventDefault();
        const d = getDistance(e.touches[0], e.touches[1]);
        const ns = Math.min(3, Math.max(0.5, pinchRef.current.startScale * (d / pinchRef.current.startDist)));
        setScale(ns);
      } else if (pinchRef.current.isPanning && e.touches.length === 1 && scale > 1) {
        const dx = e.touches[0].clientX - pinchRef.current.startX;
        const dy = e.touches[0].clientY - pinchRef.current.startY;
        setTranslate({ x: pinchRef.current.startTx + dx, y: pinchRef.current.startTy + dy });
      }
    };
    const handleTouchEnd = () => {
      pinchRef.current.isPinching = false;
      pinchRef.current.isPanning = false;
      if (scale <= 0.6) { setScale(1); setTranslate({ x: 0, y: 0 }); }
    };
    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [scale, translate, editMode]);

  const syncReservations = useCallback(() => {
    const nextReservations = loadReservations();
    setReservations(nextReservations);
    reservationsInitializedRef.current = true;
  }, []);

  // Load reservations and keep inspector/sidebar in sync
  useEffect(() => {
    const handleVisibilitySync = () => {
      if (document.visibilityState === 'visible') {
        syncReservations();
      }
    };

    syncReservations();
    const interval = window.setInterval(syncReservations, 30000);
    window.addEventListener('focus', syncReservations);
    window.addEventListener('visibilitychange', handleVisibilitySync);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', syncReservations);
      window.removeEventListener('visibilitychange', handleVisibilitySync);
    };
  }, [syncReservations]);

  // Keep sidebar waitlist in sync even when the waitlist panel is closed
  useEffect(() => {
    const syncWaitlist = () => {
      const wl = loadWaitlist();
      setWaitlistEntries(wl);
    };

    syncWaitlist();
    const interval = window.setInterval(syncWaitlist, 30000);
    window.addEventListener('focus', syncWaitlist);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', syncWaitlist);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      FLOORPLAN_VIEWPORT_STORAGE_KEY,
      JSON.stringify({ activeZone, scale, translate }),
    );
  }, [activeZone, scale, translate]);

  // Get today's active reservations for table indicators
  const tableReservationMap = useMemo(() => {
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    const map: Record<string, Reservation> = {};
    reservations
      .filter(r => r.date === todayStr && (r.status === 'confirmed' || r.status === 'seated') && r.tableId)
      .forEach(r => {
        if (r.tableId) map[r.tableId] = r;
      });
    return map;
  }, [reservations]);

  // Next upcoming reservation per table (for showing time under free tables like OpenTable)
  const nextReservationMap = useMemo(() => {
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    const nowMins = today.getHours() * 60 + today.getMinutes();
    const map: Record<string, string> = {};
    reservations
      .filter(r => r.date === todayStr && r.status === 'confirmed' && r.tableId)
      .forEach(r => {
        const [rh, rm] = r.time.split(':').map(Number);
        const resMins = rh * 60 + rm;
        if (resMins >= nowMins - 30 && r.tableId) {
          if (!map[r.tableId] || r.time < map[r.tableId]) {
            map[r.tableId] = r.time;
          }
        }
      });
    return map;
  }, [reservations]);

  const zoneTables = state.tables.filter(t => t.zone === activeZone);

  useEffect(() => {
    const unpositioned = state.tables.filter(t => t.zone === activeZone && (t.x === undefined || t.y === undefined));
    if (unpositioned.length === 0) return;
    let nextX = 30;
    let nextY = 30;
    const updatedTables = state.tables.map(t => {
      if (t.zone !== activeZone || (t.x !== undefined && t.y !== undefined)) return t;
      const pos = { ...t, x: nextX, y: nextY };
      nextX += 100;
      if (nextX > 350) { nextX = 30; nextY += 100; }
      return pos;
    });
    const storage = loadStorage();
    saveStorage({ ...storage, tables: updatedTables });
    dispatch({ type: 'UPDATE_CONFIG', restaurant: state.restaurant, zones: state.zones, tables: updatedTables, menu: state.menu, staff: state.staff });
  }, [activeZone]);

  const saveTableUpdate = useCallback((updatedTables: Table[]) => {
    dispatch({ type: 'UPDATE_CONFIG', restaurant: state.restaurant, zones: state.zones, tables: updatedTables, menu: state.menu, staff: state.staff });
    const storage = loadStorage();
    saveStorage({ ...storage, tables: updatedTables });
  }, [state, dispatch]);

  const persistInspectorState = useCallback((next: PersistedFloorPlanInspector | null) => {
    if (typeof window === 'undefined') return;
    if (!next) {
      window.localStorage.removeItem(FLOORPLAN_INSPECTOR_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(FLOORPLAN_INSPECTOR_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const clearPersistedInspector = useCallback(() => {
    persistInspectorState(null);
  }, [persistInspectorState]);

  const openTableManagementInspector = useCallback((tableId: string) => {
    const table = state.tables.find(t => t.id === tableId);
    if (table?.zone && table.zone !== activeZone) {
      setActiveZone(table.zone);
    }
    setSelectedReservationId(null);
    setHighlightedTableId(null);
    setGuestProfileGuest(null);
    setShowGuestProfileView(false);
    setShowAddNote(false);
    setNoteText('');
    setResDetailId(null);
    setShowWaitlist(false);
    setShowReservationCreatePanel(false);
    setTableManagementId(tableId);
    persistInspectorState({ type: 'table', id: tableId });
  }, [activeZone, persistInspectorState, state.tables]);

  const openReservationInspector = useCallback((reservation: Reservation) => {
    setShowReservationCreatePanel(false);
    setShowGuestProfileView(false);
    setShowWaitlist(false);
    setResDetailId(null);
    setTableManagementId(null);
    setSelectedReservationId(reservation.id);
    setHighlightedTableId(reservation.tableId || null);

    const nextZone = reservation.zone || (reservation.tableId ? state.tables.find(t => t.id === reservation.tableId)?.zone : null);
    if (nextZone && nextZone !== activeZone) {
      setActiveZone(nextZone);
    }

    const guests = loadGuests();
    let guest = reservation.guestPhone ? guests.find(g => g.phone === reservation.guestPhone) : null;
    if (!guest && reservation.guestName) {
      guest = guests.find(g => g.name === reservation.guestName) || null;
    }
    if (!guest && reservation.guestName) {
      const newGuest: Guest = {
        id: 'g-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        name: reservation.guestName,
        phone: reservation.guestPhone || '',
        email: '',
        tags: [],
        notes: [],
        visits: [],
        totalVisits: 1,
        totalSpend: 0,
        lastVisit: reservation.date,
        createdAt: Date.now(),
      };
      addGuest(newGuest);
      guest = newGuest;
    }
    setGuestProfileGuest(guest || null);
    persistInspectorState({ type: 'reservation', id: reservation.id });
  }, [activeZone, persistInspectorState, state.tables]);

  const getOrderInfo = (tableId: string) => {
    const session = state.sessions[tableId];
    if (!session) return { count: 0, total: 0, hasReady: false, startTime: 0 };
    const count = session.orders.length;
    const total = session.orders.reduce((s, o) => s + o.price * o.quantity, 0);
    const hasReady = session.orders.some(o => o.state === 'ready');
    return { count, total, hasReady, startTime: session.startTime };
  };

  const formatTime = (timestamp: number): string => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  };

  const handleTableClick = (table: Table) => {
    if (editMode) {
      setSelectedTable(prev => prev === table.id ? null : table.id);
      return;
    }
    closeGuestPanel();
    setShowWaitlist(false);
    setShowReservationCreatePanel(false);
    setResDetailId(null);
    setTableManagementId(null);
    clearPersistedInspector();

    const isActiveTable = table.status === 'occupied' || table.status === 'billing';
    if (isActiveTable) {
      dispatch({ type: 'SET_ACTIVE_TABLE', tableId: table.id });
      return;
    }

    openTableManagementInspector(table.id);
  };

  const handleAddTable = () => {
    const zoneName = state.zones.find(z => z.id === activeZone)?.name || 'Tisch';
    const existingNumbers = zoneTables.map(t => {
      const match = t.name.match(/(\d+)$/);
      return match ? parseInt(match[1]) : 0;
    });
    const nextNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    const shape = newTableShape;
    const size = SHAPE_SIZES[shape] || SHAPE_SIZES.rect;
    let px = 30, py = 30;
    const occupied = zoneTables.map(t => ({ x: t.x || 0, y: t.y || 0, w: SHAPE_SIZES[t.shape || 'rect']?.w || 80, h: SHAPE_SIZES[t.shape || 'rect']?.h || 56 }));
    let placed = false;
    for (let row = 0; row < 10 && !placed; row++) {
      for (let col = 0; col < 5 && !placed; col++) {
        const cx = 30 + col * 100;
        const cy = 30 + row * 100;
        const overlaps = occupied.some(o => Math.abs(o.x - cx) < Math.max(o.w, size.w) && Math.abs(o.y - cy) < Math.max(o.h, size.h));
        if (!overlaps) { px = cx; py = cy; placed = true; }
      }
    }
    const newTable: Table = {
      id: 'table-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      name: zoneName.charAt(0).toUpperCase() + ' ' + nextNum,
      zone: activeZone,
      status: 'free',
      shape: shape,
      seats: shape === 'barstool' ? 1 : shape === 'round' ? 6 : 4,
      x: px,
      y: py,
    };
    saveTableUpdate([...state.tables, newTable]);
    setSelectedTable(newTable.id);
  };

  const handleDeleteTable = () => {
    if (!selectedTable) return;
    saveTableUpdate(state.tables.filter(t => t.id !== selectedTable));
    setSelectedTable(null);
  };

  const handleChangeShape = (shape: TableShape) => {
    if (selectedTable) {
      saveTableUpdate(state.tables.map(t => t.id === selectedTable ? { ...t, shape } : t));
    } else {
      setNewTableShape(shape);
    }
    setShowShapePicker(false);
  };

  const handleMouseDown = (e: React.MouseEvent, tableId: string) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    const table = state.tables.find(t => t.id === tableId);
    if (!table) return;
    dragRef.current = { tableId, startX: e.clientX, startY: e.clientY, origX: table.x || 0, origY: table.y || 0, moved: false };
    setSelectedTable(tableId);
  };

  const handleTouchDown = (e: React.TouchEvent, tableId: string) => {
    if (!editMode) return;
    e.stopPropagation();
    const table = state.tables.find(t => t.id === tableId);
    if (!table) return;
    dragRef.current = { tableId, startX: e.touches[0].clientX, startY: e.touches[0].clientY, origX: table.x || 0, origY: table.y || 0, moved: false };
    setSelectedTable(tableId);
  };

  useEffect(() => {
    if (!editMode) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = (e.clientX - dragRef.current.startX) / scale;
      const dy = (e.clientY - dragRef.current.startY) / scale;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
      const newX = Math.max(0, dragRef.current.origX + dx);
      const newY = Math.max(0, dragRef.current.origY + dy);
      const updatedTables = state.tables.map(t =>
        t.id === dragRef.current!.tableId ? { ...t, x: Math.round(newX), y: Math.round(newY) } : t
      );
      dispatch({ type: 'UPDATE_CONFIG', restaurant: state.restaurant, zones: state.zones, tables: updatedTables, menu: state.menu, staff: state.staff });
    };
    const handleMouseUp = () => {
      if (dragRef.current) {
        const storage = loadStorage();
        saveStorage({ ...storage, tables: state.tables });
        dragRef.current = null;
      }
    };
    const handleTouchMoveDoc = (e: TouchEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();
      const dx = (e.touches[0].clientX - dragRef.current.startX) / scale;
      const dy = (e.touches[0].clientY - dragRef.current.startY) / scale;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
      const newX = Math.max(0, dragRef.current.origX + dx);
      const newY = Math.max(0, dragRef.current.origY + dy);
      const updatedTables = state.tables.map(t =>
        t.id === dragRef.current!.tableId ? { ...t, x: Math.round(newX), y: Math.round(newY) } : t
      );
      dispatch({ type: 'UPDATE_CONFIG', restaurant: state.restaurant, zones: state.zones, tables: updatedTables, menu: state.menu, staff: state.staff });
    };
    const handleTouchEndDoc = () => {
      if (dragRef.current) {
        const storage = loadStorage();
        saveStorage({ ...storage, tables: state.tables });
        dragRef.current = null;
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMoveDoc, { passive: false });
    window.addEventListener('touchend', handleTouchEndDoc);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMoveDoc);
      window.removeEventListener('touchend', handleTouchEndDoc);
    };
  }, [editMode, state.tables, scale, dispatch, state.restaurant, state.zones, state.menu, state.staff]);

  const applySidebarControls = useCallback((items: SidebarPlacedItem[], sectionKey: SidebarSectionKey) => {
    const q = sidebarSearch[sectionKey].trim().toLowerCase();
    const activeSort = sidebarSortBy[sectionKey];
    const paymentRank: Record<string, number> = { paid: 0, partial: 1, unpaid: 2 };

    const filtered = items.filter(r => {
      if (!q) return true;
      const tableName = r.tableId ? (state.tables.find(t => t.id === r.tableId)?.name || '') : '';
      return (
        r.guestName.toLowerCase().includes(q) ||
        r.time.toLowerCase().includes(q) ||
        String(r.partySize).includes(q) ||
        tableName.toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      switch (activeSort) {
        case 'name':
          return a.guestName.localeCompare(b.guestName, 'de');
        case 'party_size':
          return b.partySize - a.partySize || a.time.localeCompare(b.time);
        case 'table': {
          const aTable = a.tableId ? (state.tables.find(t => t.id === a.tableId)?.name || '') : 'ZZZ';
          const bTable = b.tableId ? (state.tables.find(t => t.id === b.tableId)?.name || '') : 'ZZZ';
          return aTable.localeCompare(bTable, 'de') || a.time.localeCompare(b.time);
        }
        case 'created_at':
          return (b.createdAt || 0) - (a.createdAt || 0);
        case 'payment_status':
          return (paymentRank[a.paymentStatus || 'unpaid'] ?? 9) - (paymentRank[b.paymentStatus || 'unpaid'] ?? 9) || a.time.localeCompare(b.time);
        case 'arrival_time':
        case 'reservation_time':
        default:
          return a.time.localeCompare(b.time);
      }
    });
  }, [sidebarSearch, sidebarSortBy, state.tables]);

  // OpenTable sidebar data
  const sidebarReservations = useMemo(() => {
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    return applySidebarControls(
      reservations.filter(r => r.date === todayStr && ['confirmed', 'running_late', 'partially_arrived'].includes(r.status)),
      'reservations'
    );
  }, [applySidebarControls, reservations]);

  const sidebarWaitlist = useMemo(() => {
    return waitlistEntries
      .filter(entry => entry.status === 'waiting' || entry.status === 'notified')
      .slice()
      .sort((a, b) => a.position - b.position || a.addedAt - b.addedAt);
  }, [waitlistEntries]);

  const sidebarSeated = useMemo(() => {
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    const seatedStatuses = ['seated', 'partially_seated', 'appetizer', 'entree', 'dessert', 'cleared', 'check_dropped', 'paid', 'bussing_needed'];
    const seatedReservations = reservations.filter(
      r => r.date === todayStr && seatedStatuses.includes(r.status),
    );
    const seatedReservationTableIds = new Set(
      seatedReservations
        .flatMap(r => [r.tableId, ...(r.tableIds || [])])
        .filter((tableId): tableId is string => Boolean(tableId)),
    );
    const sessionsById = new Map(Object.values(state.sessions).map(session => [session.id, session]));
    const seatedSessions = state.tables.reduce<SidebarPlacedItem[]>((items, table) => {
      if (!['occupied', 'billing'].includes(table.status) && !table.sessionId) return items;
      if (seatedReservationTableIds.has(table.id)) return items;

      const session = state.sessions[table.id] || (table.sessionId ? sessionsById.get(table.sessionId) : undefined);
      const hasEndedServiceStatus = !!(session?.serviceStatus && ['abgeraeumt', 'beendet'].includes(session.serviceStatus));
      if (hasEndedServiceStatus) return items;

      const hasPlacedStatus = ['occupied', 'billing'].includes(table.status) || Boolean(session?.serviceStatus);
      if (!hasPlacedStatus) return items;

      const guestCount = session?.guestCount || table.seats || 1;
      if (guestCount <= 0) return items;

      const startedAtValue = session?.startTime || Date.now();
      const startedAt = new Date(startedAtValue);
      const time = startedAt.getHours().toString().padStart(2, '0') + ':' + startedAt.getMinutes().toString().padStart(2, '0');
      const duration = Math.max(1, Math.round((Date.now() - startedAtValue) / 60000));
      const strippedTableName = table.name.replace(/^Tisch\s*/i, '').trim() || table.name;
      const source = session?.guestSource === 'phone' || session?.guestSource === 'online' ? session.guestSource : 'walk_in';
      const fallbackGuestName = source === 'walk_in' ? `Walk-In ${strippedTableName}` : `${source === 'phone' ? 'Telefon' : 'Online'} ${strippedTableName}`;
      const guestName = session?.guestName?.trim() || fallbackGuestName;

      items.push({
        id: `session:${session?.id || table.id}`,
        guestName,
        partySize: guestCount,
        date: todayStr,
        time,
        duration,
        tableId: table.id,
        zone: table.zone,
        status: 'seated',
        source,
        createdAt: startedAtValue,
        __isSessionItem: true,
        __sessionTableId: table.id,
      });

      return items;
    }, []);

    return applySidebarControls(
      [...seatedReservations, ...seatedSessions],
      'seated',
    );
  }, [applySidebarControls, reservations, state.sessions, state.tables]);

  const sidebarFinished = useMemo(() => {
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    return applySidebarControls(
      reservations.filter(r => r.date === todayStr && r.status === 'finished'),
      'finished'
    );
  }, [applySidebarControls, reservations]);

  const sidebarRemoved = useMemo(() => {
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    return applySidebarControls(
      reservations.filter(r => r.date === todayStr && ['cancelled', 'no_show'].includes(r.status)),
      'removed'
    );
  }, [applySidebarControls, reservations]);

  const sidebarResParties = sidebarReservations.length;
  const sidebarResCovers = sidebarReservations.reduce((s, r) => s + r.partySize, 0);
  const sidebarWaitlistParties = sidebarWaitlist.length;
  const sidebarWaitlistCovers = sidebarWaitlist.reduce((s, e) => s + e.partySize, 0);
  const sidebarSeatedParties = sidebarSeated.length;
  const sidebarSeatedCovers = sidebarSeated.reduce((s, r) => s + r.partySize, 0);
  const sidebarFinishedParties = sidebarFinished.length;
  const sidebarFinishedCovers = sidebarFinished.reduce((s, r) => s + r.partySize, 0);
  const sidebarRemovedParties = sidebarRemoved.length;
  const sidebarRemovedCovers = sidebarRemoved.reduce((s, r) => s + r.partySize, 0);

  // SVG-based table rendering (OpenTable style)
  // Generates SVG paths for table body + chairs as a unified shape
  const buildTableSvg = (shape: string, w: number, h: number, seats: number, _color: string) => {
    const isBarstool = shape === 'barstool';
    const isRound = shape === 'round' || isBarstool;
    const isDiamond = shape === 'diamond';

    // Chair dimensions (relative to SVG coordinate space)
    const cW = 12, cH = 5.5, cR = 2.5, cGap = 3, cOff = 2;
    // Padding around table for chairs
    const pad = isBarstool || isDiamond ? 0 : cH + cOff + 1;
    const svgW = w + pad * 2;
    const svgH = h + pad * 2;
    const ox = pad; // table offset x
    const oy = pad; // table offset y

    const paths: string[] = [];

    // Table body path
    if (isRound) {
      const cx = svgW / 2, cy = svgH / 2, r = w / 2;
      paths.push(`M${cx + r},${cy} A${r},${r} 0 1,1 ${cx - r},${cy} A${r},${r} 0 1,1 ${cx + r},${cy}Z`);
    } else if (isDiamond) {
      const cx = w / 2, cy = h / 2;
      paths.push(`M${cx},0 L${w},${cy} L${cx},${h} L0,${cy}Z`);
    } else {
      const br = shape === 'square' ? 5 : 7;
      paths.push(`M${ox + br},${oy} h${w - br * 2} a${br},${br} 0 0 1 ${br},${br} v${h - br * 2} a${br},${br} 0 0 1 -${br},${br} h-${w - br * 2} a${br},${br} 0 0 1 -${br},-${br} v-${h - br * 2} a${br},${br} 0 0 1 ${br},-${br}Z`);
    }

    // Chair paths
    if (!isBarstool && !isDiamond) {
      const chairSeats = Math.min(seats, 10);
      if (isRound) {
        const cx = svgW / 2, cy = svgH / 2, radius = w / 2 + cOff + cH / 2;
        for (let i = 0; i < chairSeats; i++) {
          const angle = (i / chairSeats) * Math.PI * 2 - Math.PI / 2;
          const px = cx + Math.cos(angle) * radius;
          const py = cy + Math.sin(angle) * radius;
          paths.push(`M${px},${py}` + ` m${-cW / 2},${-cH / 2}` + ` l${cW},0` + ` l0,${cH}` + ` l${-cW},0 Z`);
          // Use transform on this path for rotation
        }
      } else if (shape === 'rect_v') {
        // Chairs on left and right
        const leftCount = Math.ceil(chairSeats / 2);
        const rightCount = Math.floor(chairSeats / 2);
        const leftTotal = leftCount * cW + (leftCount - 1) * cGap;
        const leftStart = oy + (h - leftTotal) / 2;
        for (let i = 0; i < leftCount; i++) {
          const cy = leftStart + i * (cW + cGap);
          paths.push(`M${ox - cOff - cH},${cy} h${cH} q${cR},0 ${cR},${cR} v${cW - cR * 2} q0,${cR} -${cR},${cR} h-${cH} q-${cR},0 -${cR},-${cR} v-${cW - cR * 2} q0,-${cR} ${cR},-${cR}Z`);
        }
        const rightTotal = rightCount * cW + (rightCount - 1) * cGap;
        const rightStart = oy + (h - rightTotal) / 2;
        for (let i = 0; i < rightCount; i++) {
          const cy = rightStart + i * (cW + cGap);
          paths.push(`M${ox + w + cOff},${cy} h${cH} q${cR},0 ${cR},${cR} v${cW - cR * 2} q0,${cR} -${cR},${cR} h-${cH} q-${cR},0 -${cR},-${cR} v-${cW - cR * 2} q0,-${cR} ${cR},-${cR}Z`);
        }
      } else {
        // rect, square: chairs on top and bottom
        const topCount = Math.ceil(chairSeats / 2);
        const bottomCount = Math.floor(chairSeats / 2);
        const topTotal = topCount * cW + (topCount - 1) * cGap;
        const topStart = ox + (w - topTotal) / 2;
        for (let i = 0; i < topCount; i++) {
          const cx = topStart + i * (cW + cGap);
          paths.push(`M${cx},${oy - cOff - cH} h${cW} q${cR},0 ${cR},${cR} v${cH - cR * 2} q0,${cR} -${cR},${cR} h-${cW} q-${cR},0 -${cR},-${cR} v-${cH - cR * 2} q0,-${cR} ${cR},-${cR}Z`);
        }
        const bottomTotal = bottomCount * cW + (bottomCount - 1) * cGap;
        const bottomStart = ox + (w - bottomTotal) / 2;
        for (let i = 0; i < bottomCount; i++) {
          const cx = bottomStart + i * (cW + cGap);
          paths.push(`M${cx},${oy + h + cOff} h${cW} q${cR},0 ${cR},${cR} v${cH - cR * 2} q0,${cR} -${cR},${cR} h-${cW} q-${cR},0 -${cR},-${cR} v-${cH - cR * 2} q0,-${cR} ${cR},-${cR}Z`);
        }
      }
    }

    return { paths, svgW: isDiamond ? w : svgW, svgH: isDiamond ? h : svgH, ox: isDiamond ? 0 : ox, oy: isDiamond ? 0 : oy };
  };

  const renderTableShape = (table: Table) => {
    const shape = table.shape || 'rect';
    const info = getOrderInfo(table.id);
    const isOccupied = table.status === 'occupied';
    const isBilling = table.status === 'billing';
    const isSelected = selectedTable === table.id;
    const hasReservation = !!tableReservationMap[table.id];
    const reservation = tableReservationMap[table.id];
    const isBlocked = table.status === 'blocked';
    const isActive = isOccupied || isBilling;
    const bgColor = isBlocked ? '#ef4444' : isOccupied ? '#a855f7' : isBilling ? '#fbbf24' : (hasReservation && table.status === 'free') ? '#22d3ee' : '#3d3d5c';
    const size = getTableSize(table);
    const tableX = table.x || 0;
    const tableY = table.y || 0;
    const displayName = table.name.replace(/^[A-Za-z]+\s*/, '') || table.name;
    const tableSession = state.sessions[table.id];
    const serviceStatusLabel = tableSession?.serviceStatus ? SERVICE_STATUS_SHORT[tableSession.serviceStatus] : null;
    const isBarstool = shape === 'barstool';
    const isRound = shape === 'round' || isBarstool;
    const isDiamond = shape === 'diamond';
    const isPopupActive = !!(selectedReservationId && reservation && reservation.id === selectedReservationId);
    const seats = table.seats || 4;

    // Time below table (OpenTable style)
    const nextResTime = nextReservationMap[table.id];
    const activeTime = isActive && info.startTime > 0 ? formatTime(info.startTime) : null;
    const belowTime = isActive ? (activeTime || serviceStatusLabel) : nextResTime;

    // Progress bar for occupied tables (like OpenTable)
    let progressPct = 0;
    if (isActive && info.startTime > 0) {
      const elapsed = (Date.now() - info.startTime) / 60000; // minutes
      progressPct = Math.min(100, (elapsed / 90) * 100); // assume 90min dining
    }

    // Build SVG
    const svg = buildTableSvg(shape, size.w, size.h, seats, bgColor);
    const { paths, svgW, svgH, ox, oy } = svg;

    const isHighlighted = highlightedTableId === table.id;

    const wrapperStyle: React.CSSProperties = {
      position: 'absolute',
      left: tableX - (isDiamond ? 0 : (svgW - size.w) / 2),
      top: tableY - (isDiamond ? 0 : (svgH - size.h) / 2),
      width: svgW,
      height: svgH,
      cursor: editMode ? 'grab' : 'pointer',
      zIndex: isSelected || isHighlighted ? 10 : 1,
      filter: isSelected ? 'drop-shadow(0 0 8px rgba(167,139,250,0.6))' : isHighlighted ? 'drop-shadow(0 0 12px rgba(236,72,153,0.8)) brightness(1.2)' : 'none',
      transition: dragRef.current?.tableId === table.id ? 'none' : 'filter 0.15s',
    };

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (dragRef.current?.moved) return;
      handleTableClick(table);
    };

    return (
      <div key={table.id} style={wrapperStyle} onClick={handleClick}
        onMouseDown={(e) => handleMouseDown(e, table.id)}
        onTouchStart={(e) => handleTouchDown(e, table.id)}>
        {/* SVG table shape with chairs */}
        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="absolute inset-0">
          {/* Chair paths (slightly transparent) */}
          {paths.slice(1).map((d, i) => (
            <path key={`c${i}`} d={d} fill={bgColor} opacity={0.55} />
          ))}
          {/* Table body */}
          {isDiamond ? (
            <path d={paths[0]} fill={bgColor} />
          ) : (
            <path d={paths[0]} fill={bgColor} />
          )}
          
        </svg>
        {/* Selection borders */}
        {isSelected && editMode && (
          <div className="absolute pointer-events-none" style={{
            left: ox - 2, top: oy - 2, width: size.w + 4, height: size.h + 4,
            border: '2px solid #a78bfa', borderRadius: isRound ? '50%' : isDiamond ? 8 : 10,
            transform: isDiamond ? 'rotate(45deg)' : undefined, transformOrigin: 'center',
          }} />
        )}
        {isPopupActive && !editMode && (
          <div className="absolute pointer-events-none" style={{
            left: ox - 2, top: oy - 2, width: size.w + 4, height: size.h + 4,
            border: '2px solid #ffffff', borderRadius: isRound ? '50%' : isDiamond ? 8 : 10,
            transform: isDiamond ? 'rotate(45deg)' : undefined, transformOrigin: 'center',
          }} />
        )}
        {/* Overlay: table info (positioned on table body area) */}
        <div className="absolute flex flex-col items-center justify-center pointer-events-none"
          style={{ left: ox, top: oy, width: size.w, height: size.h, transform: isDiamond ? 'rotate(0deg)' : undefined }}>
          {/* Blocked icon */}
          {isBlocked && (
            <IconBan className="w-3.5 h-3.5" style={{ color: '#fff', position: 'absolute', top: isRound ? 6 : 4 }} />
          )}
          {/* Progress indicator above number (OpenTable style — white bar = progress) */}
          {!isBlocked && isActive && !isBarstool && (
            <div className="absolute" style={{ top: isRound ? 12 : 10, left: '15%', right: '15%', height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }}>
              <div style={{ width: `${Math.max(8, progressPct)}%`, height: '100%', borderRadius: 2, background: '#fff', transition: 'width 1s ease' }} />
            </div>
          )}
          {/* Table number */}
          <span className="font-bold leading-none select-none" style={{
            color: '#fff', fontSize: isBarstool ? 11 : isDiamond ? 14 : 18,
            marginTop: isActive && !isBarstool ? 4 : 0,
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          }}>
            {displayName}
          </span>
        </div>
        {/* Time callout with dark bg + chevron (OpenTable style) */}
        {belowTime && !isBarstool && (
          <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none" style={{ top: oy + size.h - 2 }}>
            {/* Chevron triangle pointing up */}
            <div style={{
              width: 0, height: 0, margin: '0 auto',
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderBottom: '5px solid rgba(0,0,0,0.7)',
            }} />
            {/* Dark pill with time */}
            <div style={{
              background: 'rgba(0,0,0,0.7)',
              borderRadius: 4,
              padding: '2px 6px',
              fontSize: 12, fontWeight: 700, color: '#fff',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              whiteSpace: 'nowrap',
              textAlign: 'center',
              lineHeight: '16px',
            }}>
              {belowTime}
            </div>
          </div>
        )}
      </div>
    );
  };

  const currentZone = state.zones.find(z => z.id === activeZone);
  const currentZoneIdx = state.zones.findIndex(z => z.id === activeZone);

  // Notify parent of initial zone on mount
  useEffect(() => {
    if (onZoneChange && currentZone) onZoneChange(activeZone, currentZone.name);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Expose zone switching for parent (App header arrows)
  const switchToPrevZone = useCallback(() => {
    const prev = currentZoneIdx > 0 ? currentZoneIdx - 1 : state.zones.length - 1;
    switchZone(state.zones[prev].id);
  }, [currentZoneIdx, state.zones, switchZone]);

  const switchToNextZone = useCallback(() => {
    const next = currentZoneIdx < state.zones.length - 1 ? currentZoneIdx + 1 : 0;
    switchZone(state.zones[next].id);
  }, [currentZoneIdx, state.zones, switchZone]);

  // Attach to window for parent access
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__floorPlanPrevZone = switchToPrevZone;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__floorPlanNextZone = switchToNextZone;
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__floorPlanPrevZone;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__floorPlanNextZone;
    };
  }, [switchToPrevZone, switchToNextZone]);

  // Source labels
 const SOURCE_ICONS: Record<string, typeof IconPhoneFilled> = {
    phone: IconPhone,
    online: IconGlobeFilled,
    walk_in: IconWalk,
  };

  const SOURCE_COLORS: Record<string, string> = {
    phone: '#8b5cf6',
    online: '#ec4899',
    walk_in: '#22c55e',
  };

  const OCCASION_ICONS: Record<OccasionLabel, { Icon: typeof IconConfetti; color: string }> = {
    geburtstag: { Icon: IconConfetti, color: '#22c55e' },
    jahrestag: { Icon: IconHeartFilled, color: '#22c55e' },
    besonderer_anlass: { Icon: IconSparkles, color: '#a855f7' },
    date: { Icon: IconHeartHandshake, color: '#ec4899' },
    geschaeftsessen: { Icon: IconBriefcaseFilled, color: '#a855f7' },
    gratis_extra: { Icon: IconGiftFilled, color: '#22c55e' },
    schulabschluss: { Icon: IconSchool, color: '#3b82f6' },
    theater_kino: { Icon: IconMasksTheater, color: '#f59e0b' },
  };

  const ALL_TAGS_MAP: Record<string, { label: string; color: string; Icon: typeof IconStarFilled }> = {
    vip: { label: 'VIP', color: '#eab308', Icon: IconStarFilled },
    stammgast: { label: 'Stammgast', color: '#22d3ee', Icon: IconUserPlus },
    allergiker: { label: 'Allergiker', color: '#ef4444', Icon: IconAlertTriangleFilled },
    vegetarier: { label: 'Vegetarier', color: '#22c55e', Icon: IconLeaf },
    vegan: { label: 'Vegan', color: '#16a34a', Icon: IconPlant2 },
    kinderstuhl: { label: 'Kinderstuhl', color: '#f97316', Icon: IconBabyCarriage },
    rollstuhl: { label: 'Rollstuhl', color: '#8b5cf6', Icon: IconWheelchair },
    geburtstag: { label: 'Geburtstag', color: '#ec4899', Icon: IconCake },
    business: { label: 'Business', color: '#6366f1', Icon: IconBriefcaseFilled },
    presse: { label: 'Presse', color: '#a78bfa', Icon: IconNews },
  };

  // Handle sidebar card click - toggle 3-panel OpenTable view
  const handleSidebarCardClick = (r: SidebarPlacedItem) => {
    setPressedReservationId(r.id);
    window.setTimeout(() => {
      setPressedReservationId(current => (current === r.id ? null : current));
    }, 160);

    if (r.__isSessionItem && r.__sessionTableId) {
      if (tableManagementId === r.__sessionTableId) {
        closeGuestPanel();
        return;
      }
      openTableManagementInspector(r.__sessionTableId);
      return;
    }

    if (selectedReservationId === r.id) {
      closeGuestPanel();
      return;
    }
    openReservationInspector(r);
  };

  // Get selected reservation object
  const selectedReservation = useMemo(() => {
    if (!selectedReservationId) return null;
    return reservations.find(r => r.id === selectedReservationId) || null;
  }, [selectedReservationId, reservations]);

  useEffect(() => {
    if (!reservationsInitializedRef.current) {
      previousReservationIdsRef.current = new Set(reservations.map(r => r.id));
      reservationsInitializedRef.current = true;
      return;
    }

    const previousIds = previousReservationIdsRef.current;
    const newlyAdded = reservations.find(r => !previousIds.has(r.id));

    previousReservationIdsRef.current = new Set(reservations.map(r => r.id));

    if (!newlyAdded) return;

    setJustAddedReservationId(newlyAdded.id);
    const timeout = window.setTimeout(() => {
      setJustAddedReservationId(current => (current === newlyAdded.id ? null : current));
    }, 2200);

    return () => window.clearTimeout(timeout);
  }, [reservations]);

  useEffect(() => {
    if (inspectorRestoredRef.current) return;
    if (typeof window === 'undefined') return;
    if (state.tables.length === 0) return;

    const raw = window.localStorage.getItem(FLOORPLAN_INSPECTOR_STORAGE_KEY);
    if (!raw) {
      inspectorRestoredRef.current = true;
      return;
    }

    try {
      const persisted = JSON.parse(raw) as PersistedFloorPlanInspector;

      if (persisted.type === 'table') {
        const table = state.tables.find(t => t.id === persisted.id);
        if (table) {
          inspectorRestoredRef.current = true;
          openTableManagementInspector(table.id);
          return;
        }
        inspectorRestoredRef.current = true;
      }

      if (persisted.type === 'reservation') {
        const reservation = reservations.find(r => r.id === persisted.id);
        if (reservation) {
          inspectorRestoredRef.current = true;
          openReservationInspector(reservation);
          return;
        }

        if (!reservationsInitializedRef.current) {
          return;
        }

        inspectorRestoredRef.current = true;
      }
    } catch {
      inspectorRestoredRef.current = true;
      clearPersistedInspector();
      return;
    }

    inspectorRestoredRef.current = true;
    clearPersistedInspector();
  }, [clearPersistedInspector, openReservationInspector, openTableManagementInspector, reservations, state.tables]);

  // OpenTable sidebar render - 1:1 match with Reservations card design
  const renderSidebarCard = (r: SidebarPlacedItem, _showDuration: boolean) => {
    const sourceColor = SOURCE_COLORS[r.source] || '#8888aa';
    const SourceIcon = SOURCE_ICONS[r.source] || IconUsers;

    const assignedTableId = r.tableId || (r.__isSessionItem ? r.__sessionTableId : undefined);
    const assignedTable = assignedTableId ? state.tables.find(t => t.id === assignedTableId) : null;
    const sessionForCard = r.__isSessionItem && r.__sessionTableId ? state.sessions[r.__sessionTableId] : undefined;
    const sessionTotal = sessionForCard
      ? sessionForCard.orders.reduce((sum, order) => sum + order.price * order.quantity, 0)
      : 0;
    const guests = loadGuests();
    const guestProfile = r.guestPhone ? guests.find(g => g.phone === r.guestPhone) : guests.find(g => g.name === r.guestName) || null;
    const isVip = guestProfile?.tags.includes('vip') || guestProfile?.tags.includes('stammgast');
    const guestTags = guestProfile?.tags || [];
    const occasions = (r.occasionLabels || []) as OccasionLabel[];
    const isCardSelected = r.__isSessionItem && r.__sessionTableId
      ? tableManagementId === r.__sessionTableId
      : selectedReservationId === r.id;
    const isJustAdded = !r.__isSessionItem && justAddedReservationId === r.id;
    const isPressed = pressedReservationId === r.id;
    const detailLabel = sessionForCard?.guestName?.trim() || r.guestName;

    return (
      <div key={r.id} style={{ marginBottom: '2px', padding: '0 4px' }}>
        <div
          className={'flex items-stretch min-h-[60px] hover:brightness-110 active:brightness-125 transition-all cursor-pointer ' +
            (isJustAdded ? 'animate-pulse' : '')}
          style={{
            background: isPressed ? '#312c4d' : isCardSelected ? '#2e2e50' : isJustAdded ? '#342f56' : '#2a2944',
            outline: isCardSelected ? '2px solid #a855f7' : isJustAdded ? '1px solid #a855f7' : 'none',
            boxShadow: isPressed
              ? '0 0 0 1px rgba(217, 70, 239, 0.18), 0 8px 18px rgba(139, 92, 246, 0.18)'
              : isJustAdded
                ? '0 0 0 1px rgba(168, 85, 247, 0.18), 0 0 20px rgba(168, 85, 247, 0.18)'
                : 'none',
            transform: isPressed ? 'translateY(-2px) scale(0.992)' : isJustAdded ? 'translateY(-1px)' : 'none',
            borderRadius: 0,
          }}
          onClick={() => handleSidebarCardClick(r)}
        >
          <div className="shrink-0 flex flex-col items-center justify-center gap-[2px]" style={{ background: sourceColor, width: '26px' }}>
            <span className="text-white font-bold text-[10px] leading-none">{r.partySize}</span>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#d7d3e8]">
                <SourceIcon size={12} color="#a855f7" />
                <span>{r.time}</span>
                <span className="text-[#6f7695]">·</span>
                <span className="text-[#8f97b3] font-medium">{Math.floor(r.duration / 60) > 0 ? `${Math.floor(r.duration / 60)}h ${r.duration % 60}m` : `${r.duration}m`}</span>
                {assignedTable && (
                  <>
                    <span className="text-[#6f7695]">·</span>
                    <span className="text-[#8f97b3] font-medium">
                    {assignedTable.name}
                    </span>
                  </>
                )}
              </div>

              <div className="mt-1 flex items-center gap-[4px]">
                {isVip && <IconStarFilled size={15} color="#FFCC00" />}
                <span className="truncate text-[13px] font-semibold text-white">{detailLabel}</span>
              </div>

              {(occasions.length > 0 || guestTags.some(t => t !== 'vip' && t !== 'stammgast') || r.paymentStatus !== 'open') && (
                <div className="mt-1 flex items-center gap-[3px]">
                  {r.paymentStatus === 'paid' && <IconCircleCheckFilled size={14} color="#22c55e" />}
                  {r.paymentStatus === 'partial' && <IconCoinFilled size={14} color="#f59e0b" />}
                  {occasions.map(oc => {
                    const info = OCCASION_ICONS[oc];
                    if (!info) return null;
                    const OcIcon = info.Icon;
                    return <OcIcon key={oc} size={14} color={info.color} />;
                  })}
                  {guestTags.filter(t => t !== 'vip' && t !== 'stammgast').map(tag => {
                    const info = ALL_TAGS_MAP[tag];
                    if (!info) return null;
                    const TagIcon = info.Icon;
                    return <TagIcon key={tag} size={14} color={info.color} />;
                  })}
                </div>
              )}
            </div>

            <div className="shrink-0">
              {r.__isSessionItem ? (
                <div className="flex h-[38px] min-w-[64px] items-center justify-center bg-[#9333ea] px-2" style={{ borderRadius: 0 }}>
                  <span className="text-[11px] font-bold leading-none text-white">
                    {sessionTotal.toFixed(2)} €
                  </span>
                </div>
              ) : assignedTable ? (
                <div className="flex h-[38px] min-w-[38px] items-center justify-center bg-[#9333ea] px-2" style={{ borderRadius: 0 }}>
                  <span className="text-[14px] font-bold leading-none text-white">
                    {assignedTable.name.replace(/[^0-9]/g, '') || assignedTable.name}
                  </span>
                </div>
              ) : (
                <div className="flex h-[38px] w-[38px] items-center justify-center bg-[#2f2d4a]" style={{ borderRadius: 0 }}>
                  <IconClock className="h-4.5 w-4.5 text-[#76709a]" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderWaitlistCard = (entry: WaitlistEntry) => {
    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - entry.addedAt) / 60000));
    const isActive = activeWaitlistCardId === entry.id;

    const handleNotifyWaitlist = (id: string) => {
      const updated = updateWaitlistEntry(id, { status: 'notified', notifiedAt: Date.now() });
      setWaitlistEntries(updated);
    };

    const handleNoShowWaitlist = (id: string) => {
      const updated = updateWaitlistEntry(id, { status: 'no_show' });
      setWaitlistEntries(updated);
      setActiveWaitlistCardId(current => (current === id ? null : current));
    };

    const handleCancelWaitlist = (id: string) => {
      const updated = updateWaitlistEntry(id, { status: 'cancelled' });
      setWaitlistEntries(updated);
      setActiveWaitlistCardId(current => (current === id ? null : current));
    };

    return (
      <div key={entry.id} style={{ marginBottom: '2px', padding: '0 4px' }}>
        <div
          className="flex items-stretch min-h-[60px] hover:brightness-110 transition-all cursor-pointer"
          style={{ background: '#2a2944', borderRadius: 0 }}
          onClick={() => setActiveWaitlistCardId(current => current === entry.id ? null : entry.id)}
        >
          <div className="shrink-0 flex flex-col items-center justify-center gap-[2px]" style={{ background: '#d946ef', width: '26px' }}>
            <span className="text-white font-bold text-[10px] leading-none">{entry.partySize}</span>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#d7d3e8]">
                <IconClock size={12} color="#d946ef" />
                <span>{elapsedMinutes}m</span>
                <span className="text-[#8f97b3] font-medium">~{entry.estimatedWaitMinutes}m</span>
              </div>

              <div className="mt-1 flex items-center gap-[4px]">
                <span className="truncate text-[13px] font-semibold text-white">{entry.guestName}</span>
              </div>
            </div>

            <div className="shrink-0">
              <div className="flex h-[38px] min-w-[38px] items-center justify-center bg-[#2f2d4a] px-2" style={{ borderRadius: 0 }}>
                <span className="text-[13px] font-bold leading-none text-white">{entry.position}</span>
              </div>
            </div>
          </div>
        </div>

        {isActive && (
          <div className="space-y-2 bg-[#1f1e33] px-0 py-2">
            <button
              type="button"
              onClick={() => setShowWaitlist(true)}
              className="flex w-full items-center justify-center gap-2 py-3 text-[14px] font-semibold text-white transition hover:brightness-110"
              style={{ background: '#8b5cf6' }}
            >
              <IconUserCheck className="h-4 w-4" />
              Platzieren
            </button>

            {entry.guestPhone && (
              <button
                type="button"
                onClick={() => handleNotifyWaitlist(entry.id)}
                className="flex w-full items-center justify-center gap-2 py-3 text-[14px] font-semibold text-[#d8c7ff] transition hover:brightness-110"
                style={{ background: '#2b2944' }}
              >
                <IconBell className="h-4 w-4" />
                Benachrichtigen
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleNoShowWaitlist(entry.id)}
                className="flex items-center justify-center gap-2 py-3 text-[14px] font-semibold text-[#f2c7ef] transition hover:brightness-110"
                style={{ background: '#2b2944' }}
              >
                <IconAlertTriangleFilled className="h-4 w-4" />
                No-Show
              </button>
              <button
                type="button"
                onClick={() => handleCancelWaitlist(entry.id)}
                className="flex items-center justify-center gap-2 py-3 text-[14px] font-semibold text-[#f2c7ef] transition hover:brightness-110"
                style={{ background: '#2b2944' }}
              >
                <IconCircleX className="h-4 w-4" />
                Stornieren
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

 const NOTE_CATS: { value: GuestNote['category']; label: string; icon: typeof IconStar }[] = [
  { value: 'general', label: 'Allgemein', icon: IconAlignLeft },
  { value: 'status', label: 'Gaststatus', icon: IconStar },
  { value: 'food', label: 'Speisen & Getränke', icon: IconUser },
  { value: 'seating', label: 'Sitzplätze', icon: IconArmchair },
  { value: 'info', label: 'Gastdetails', icon: IconUser },
  { value: 'history', label: 'Verlauf', icon: IconClock },
];
  const refreshGuest = () => {
    if (!guestProfileGuest) return;
    const guests = loadGuests();
    const updated = guests.find(g => g.id === guestProfileGuest.id);
    if (updated) { setGuestProfileGuest(updated); setGuestProfileKey(k => k + 1); }
  };

  const handleAddNote = () => {
    if (!noteText.trim() || !guestProfileGuest) return;
    const note: GuestNote = {
      id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      category: activeNoteTab,
      text: noteText.trim(),
      createdAt: Date.now(),
    };
    addGuestNote(guestProfileGuest.id, note);
    setNoteText('');
    setShowAddNote(false);
    refreshGuest();
  };

  const handleRemoveNote = (noteId: string) => {
    if (!guestProfileGuest) return;
    removeGuestNote(guestProfileGuest.id, noteId);
    refreshGuest();
  };

  const closeGuestPanel = () => {
    setSelectedReservationId(null);
    setHighlightedTableId(null);
    setGuestProfileGuest(null);
    setShowGuestProfileView(false);
    setShowAddNote(false);
    setNoteText('');
    clearPersistedInspector();
  };

  // OpenTable RIGHT PANEL - 1:1 OpenTable Design
  const [pacingExcluded, setPacingExcluded] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // Status config: groups of statuses based on current state (like OpenTable)
  const STATUS_CONFIG: { value: ReservationStatus; label: string; icon: string; color: string }[] = [
    { value: 'confirmed', label: 'Gebucht', icon: '📋', color: '#7c3aed' },
    { value: 'running_late', label: 'Verspätet', icon: '🕐', color: '#f59e0b' },
    { value: 'partially_arrived', label: 'Teilweise da', icon: '🚪', color: '#f97316' },
    { value: 'seated', label: 'Platziert', icon: '🪑', color: '#8b5cf6' },
    { value: 'partially_seated', label: 'Teilweise platziert', icon: '🪑', color: '#a78bfa' },
    { value: 'appetizer', label: 'Vorspeise', icon: '🥗', color: '#6366f1' },
    { value: 'entree', label: 'Hauptgang', icon: '🍽️', color: '#4f46e5' },
    { value: 'dessert', label: 'Dessert', icon: '🍰', color: '#7c3aed' },
    { value: 'cleared', label: 'Abgeräumt', icon: '✨', color: '#0891b2' },
    { value: 'check_dropped', label: 'Rechnung', icon: '🧾', color: '#059669' },
    { value: 'paid', label: 'Bezahlt', icon: '💳', color: '#16a34a' },
    { value: 'bussing_needed', label: 'Abräumen nötig', icon: '🧹', color: '#ca8a04' },
    { value: 'finished', label: 'Beendet', icon: '✅', color: '#22c55e' },
    { value: 'cancelled', label: 'Storniert', icon: '❌', color: '#ef4444' },
    { value: 'no_show', label: 'No-Show', icon: '👻', color: '#f59e0b' },
  ];

  // Get relevant statuses for dropdown based on current state
  const getStatusOptions = (currentStatus: ReservationStatus) => {
    const preSeated: ReservationStatus[] = ['confirmed', 'running_late', 'partially_arrived'];
    const seated: ReservationStatus[] = ['partially_seated', 'seated', 'appetizer', 'entree', 'dessert', 'cleared', 'check_dropped', 'paid', 'bussing_needed', 'finished'];
    const isPreSeated = preSeated.includes(currentStatus);
    return isPreSeated ? [...preSeated, ...seated] : [...seated, ...preSeated];
  };

  const renderRightPanel = () => {
    if (!selectedReservation) return null;
    if (showGuestProfileView && guestProfileGuest) {
      return (
        <div
          className="relative flex flex-col h-full overflow-hidden"
          style={{ width: 260, minWidth: 260, background: '#1f1e33', borderLeft: '1px solid rgba(255,255,255,0.03)' }}
        >
          <GuestProfile
            key={guestProfileKey}
            guest={guestProfileGuest}
            onClose={() => setShowGuestProfileView(false)}
            onUpdated={refreshGuest}
            onReserve={() => {
              setShowGuestProfileView(false);
              setShowReservationCreatePanel(true);
            }}
          />
        </div>
      );
    }
    const r = selectedReservation;
    const cardBg = '#2d2c48';
    const guestForInspector =
      guestProfileGuest ||
      loadGuests().find(guest =>
        guest.name === r.guestName ||
        (!!r.guestPhone && guest.phone === r.guestPhone) ||
        (!!r.guestEmail && guest.email === r.guestEmail)
      ) ||
      null;
    const inspectorGuest =
      guestProfileGuest && guestForInspector && guestProfileGuest.id === guestForInspector.id
        ? guestProfileGuest
        : guestForInspector;
    const tableNames = (() => {
      const ids = r.tableIds && r.tableIds.length > 0 ? r.tableIds : (r.tableId ? [r.tableId] : []);
      return ids.map(id => state.tables.find(t => t.id === id)?.name || '').filter(Boolean).join(', ');
    })();
    const tableName = tableNames || 'Kein Tisch';
    const currentConfig = STATUS_CONFIG.find(s => s.value === r.status) || STATUS_CONFIG[0];
    const hasPhone = !!(r.guestPhone || guestProfileGuest?.phone);
    const rawPhone = (r.guestPhone || guestProfileGuest?.phone || '').replace(/\s/g, '');
    const phoneValid = hasPhone && rawPhone.length >= 6;
    const maskedPhone = phoneValid
      ? rawPhone.replace(/^(.{2}).*(.{2})$/, '$1****$2')
      : 'Ungültige Telefonnummer';
    const displayGuestName = guestForInspector?.name || r.guestName || 'Gast';
    const activeInspectorCategory = NOTE_CATS.find(cat => cat.value === activeNoteTab) || NOTE_CATS[0];
    const inspectorNotes = inspectorGuest?.notes.filter(note => note.category === activeNoteTab) || [];
    const isSeatedGroup = ['seated', 'partially_seated', 'appetizer', 'entree', 'dessert', 'cleared', 'check_dropped', 'paid', 'bussing_needed'].includes(r.status);
    const statusOptions = getStatusOptions(r.status);

    return (
      <div className="flex flex-col h-full overflow-y-auto" style={{ width: 260, minWidth: 260, background: '#1f1e33', borderLeft: '1px solid rgba(255,255,255,0.03)' }}>
        {/* Status header */}
        <div className="relative pb-2">
          <button onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            className="w-full px-4 py-3 flex items-center justify-between text-white font-semibold text-[13px] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            style={{ background: `linear-gradient(90deg, ${currentConfig.color} 0%, #8b5cf6 55%, #7c3aed 100%)` }}>
            <div className="flex items-center gap-2">
              <IconCheck className="w-4 h-4" />
              {currentConfig.label}
            </div>
            <IconChevronDown className="w-4 h-4 opacity-70" />
          </button>
          {showStatusDropdown && (
            <div className="absolute top-full left-0 right-0 z-50 border border-white/[0.03] shadow-xl overflow-hidden max-h-[360px] overflow-y-auto mt-1" style={{ background: '#2a2944', borderRadius: 0 }}>
              {statusOptions.map(st => {
                const cfg = STATUS_CONFIG.find(s => s.value === st);
                if (!cfg) return null;
                return (
                  <button key={st} onClick={() => {
                    const updated = reservations.map(res => res.id === r.id ? { ...res, status: st } : res);
                    setReservations(updated);
                    saveStorage({ ...loadStorage(), reservations: updated } as never);
                    setShowStatusDropdown(false);
                  }}
                    className={'w-full px-4 py-3 text-left text-[13px] hover:bg-[#23223a] transition-colors flex items-center gap-2 ' +
                      (r.status === st ? 'font-semibold text-white bg-[#23223a]' : 'text-[#cbd5e1]')}>
                    <span>{cfg.label}</span>
                    {r.status === st && <IconCheck className="w-3.5 h-3.5 ml-auto text-[#8b5cf6]" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Card-based sections */}
        <div className="px-3 py-1.5 space-y-2.5 flex-1 overflow-y-auto">
          {!showGuestProfileView && (
            <>
              <div className="px-3 py-2.5" style={{ background: cardBg, borderRadius: 0 }}>
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center text-[22px] font-bold text-white"
                    style={{ background: '#8b5cf6' }}
                  >
                    {displayGuestName.trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold text-[#eef1fb]">{displayGuestName}</div>
                    {maskedPhone && (
                      <div className="mt-1 flex items-center gap-2 text-[12px] text-[#dbe4fb]">
                        <IconPhone className="h-3.5 w-3.5 shrink-0 text-[#c4b5fd]" />
                        <span className="truncate tracking-[0.08em]">{maskedPhone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div
                  className="px-3 py-2 flex items-center justify-center"
                  style={{ background: '#2b2944', borderRadius: 0 }}
                >
                  <span className="text-[#eef1fb] text-[12px] font-semibold">{r.time}</span>
                </div>
                <div
                  className="px-3 py-2 flex items-center justify-center"
                  style={{ background: '#2b2944', borderRadius: 0 }}
                >
                  <span className="text-[#eef1fb] text-[12px] font-semibold">{r.partySize} P.</span>
                </div>
                <div
                  className="px-3 py-2 flex items-center justify-center"
                  style={{ background: '#2b2944', borderRadius: 0 }}
                >
                  <span className="text-[#eef1fb] text-[12px] font-semibold">{Math.floor(r.duration / 60) > 0 ? `${Math.floor(r.duration / 60)}h ${r.duration % 60}m` : `${r.duration}m`}</span>
                </div>
              </div>
            </>
          )}

          {/* Table assignment card */}
          <button onClick={() => { setShowSeatOverlay(true); setSeatOverlayZone(activeZone); }}
            className="w-full text-left px-3 py-2.5 hover:brightness-110 transition-all"
            style={{
              background: !r.tableId && (!r.tableIds || r.tableIds.length === 0) ? 'transparent' : cardBg,
              borderRadius: 0,
              border: !r.tableId && (!r.tableIds || r.tableIds.length === 0) ? '1px dashed rgba(196,181,253,0.35)' : 'none',
            }}>
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <IconArmchair className="w-5 h-5 text-[#a9b5cb]" />
              </div>
              <div className="flex-1">
                <div className="text-[#eef1fb] text-[14px] font-semibold">{tableName}</div>
                {(r.tableId || (r.tableIds && r.tableIds.length > 0)) && (
                  <div className="text-[#8f97b3] text-[11px]">{isSeatedGroup ? 'Zugewiesen' : 'Vorgeschlagen'}</div>
                )}
                {!r.tableId && (!r.tableIds || r.tableIds.length === 0) && (
                  <div className="text-[#c4b5fd] text-[11px]">Kein Tisch zugewiesen</div>
                )}
              </div>
              <IconChevronRight className="w-4 h-4 text-[#8f97b3] shrink-0" />
            </div>
          </button>

          {/* Phone / SMS card */}
          <div className="px-3 py-2" style={{ background: cardBg, borderRadius: 0 }}>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <IconMessage className="w-5 h-5 text-[#a9b5cb]" />
              </div>
              <div>
                <div className={'text-[13px] font-semibold tracking-[0.02em] ' + (phoneValid ? 'text-[#eef1fb]' : 'text-[#8f97b3]')}>
                  {maskedPhone}
                </div>
                <div className="mt-0.5">
                  <span
                    className="inline-flex px-1.5 py-0.5 text-[9px] font-medium"
                    style={{
                      color: phoneValid ? '#c4b5fd' : '#8f97b3',
                      background: phoneValid ? 'rgba(139,92,246,0.14)' : 'rgba(143,151,179,0.12)',
                    }}
                  >
                    {phoneValid ? 'SMS-Updates aktiv' : 'SMS-Updates deaktiviert'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons card (mail + card icons) */}
          <div className="flex gap-2.5">
            <button className="flex-1 py-3 flex items-center justify-center hover:brightness-110 transition-all"
              style={{ background: cardBg, borderRadius: 0 }}>
              <IconMail className="w-5 h-5 text-[#a9b5cb]" />
            </button>
            <button className="flex-1 py-3 flex items-center justify-center hover:brightness-110 transition-all"
              style={{ background: cardBg, borderRadius: 0 }}>
              <IconCreditCard className="w-5 h-5 text-[#a9b5cb]" />
            </button>
          </div>

          {/* Kreditkarte + Pacing toggle grouped card */}
          <div className="overflow-hidden" style={{ background: cardBg, borderRadius: 0 }}>
            <button className="w-full text-left px-3 py-3 flex items-center justify-between hover:brightness-110 transition-all border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="text-[#eef1fb] text-[13px] font-medium">Kreditkarte hinzufügen</span>
              </div>
              <IconChevronRight className="w-5 h-5 text-[#8f97b3]" />
            </button>
            <div className="px-3.5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[#c7cde1] text-[12px] leading-tight">
                    Pacing ausnehmen
                  </p>
                </div>
                <button onClick={() => setPacingExcluded(!pacingExcluded)}
                  className={'relative w-14 h-8 rounded-full transition-colors shrink-0 ' +
                    (pacingExcluded ? 'bg-[#59647a]' : 'bg-[#59647a]')}>
                  <div className={'absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform flex items-center justify-center ' +
                    (pacingExcluded ? 'translate-x-[30px]' : 'translate-x-1')}>
                    {!pacingExcluded && <IconX className="w-4 h-4 text-[#94a3b8]" />}
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Vermittler*in card */}
          <div className="px-3 py-2.5" style={{ background: cardBg, borderRadius: 0 }}>
            {r.referralSource ? (
              <div className="flex items-center gap-2.5">
                <div>
                  <div className="text-[#eef1fb] text-[13px] font-semibold">Vermittler*in</div>
                  <div className="text-[#8f97b3] text-[11px]">{r.referralSource}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="flex-1">
                  <div className="text-[#eef1fb] text-[13px] font-semibold">Vermittler*in</div>
                  <div className="text-[#8f97b3] text-[11px]">Noch nicht zugewiesen</div>
                </div>
                <IconPlus className="w-4 h-4 text-[#c4b5fd] shrink-0" />
              </div>
            )}
          </div>

          {inspectorGuest && (
            <>
              <div className="overflow-hidden border-y border-white/[0.04]">
                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                  {NOTE_CATS.map(cat => {
                    const Icon = cat.icon;
                    const count = inspectorGuest.notes.filter(note => note.category === cat.value).length;
                    const isActive = activeNoteTab === cat.value;
                    return (
                      <button
                        key={cat.value}
                        onClick={() => {
                          setActiveNoteTab(cat.value);
                          setShowAddNote(false);
                          setNoteText('');
                        }}
                        className="relative flex h-8 w-8 items-center justify-center text-[#9da4bf] transition-colors hover:text-white"
                      >
                        <Icon className={`h-4 w-4 ${isActive ? 'text-[#f0abfc]' : ''}`} />
                        {count > 0 && (
                          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center bg-[#8b5cf6] px-1 text-[9px] font-semibold text-white">
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="overflow-hidden" style={{ background: cardBg, borderRadius: 0 }}>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-[13px] font-semibold text-[#eef1fb]">{activeInspectorCategory.label}</span>
                  <button
                    onClick={() => {
                      setShowAddNote(show => !show);
                      setNoteText('');
                    }}
                    className="flex items-center gap-1 text-[12px] text-[#d6c4ff] transition-colors hover:text-white"
                  >
                    <IconPlus className="h-4 w-4" />
                    Hinzufügen
                  </button>
                </div>

                {showAddNote && (
                  <div className="px-4 pb-3">
                    <textarea
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Notiz eingeben..."
                      rows={2}
                      className="w-full resize-none bg-[#23223a] px-3 py-2 text-[12px] text-[#e2e8f0] placeholder:text-[#8f97b3] focus:outline-none"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={handleAddNote}
                        disabled={!noteText.trim()}
                        className="bg-[#8b5cf6] px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-50"
                      >
                        Speichern
                      </button>
                      <button
                        onClick={() => {
                          setShowAddNote(false);
                          setNoteText('');
                        }}
                        className="px-2 py-1.5 text-[11px] text-[#b8bfd7]"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                )}

                {inspectorNotes.length > 0 ? (
                  <div className="px-4 pb-3 space-y-2">
                    {inspectorNotes.map(note => (
                      <div key={note.id} className="group">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] text-[#e2e8f0]">{note.text}</p>
                            <p className="mt-1 text-[10px] text-[#7f87a4]">{new Date(note.createdAt).toLocaleDateString('de-DE')}</p>
                          </div>
                          <button
                            onClick={() => handleRemoveNote(note.id)}
                            className="opacity-0 transition-opacity group-hover:opacity-100 text-[#8f97b3] hover:text-white"
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !showAddNote ? (
                  <div className="px-4 pb-3 text-[12px] text-[#7f87a4]">Keine Einträge</div>
                ) : null}
              </div>
            </>
          )}
        </div>

        {/* Primary action + Cancel at bottom */}
        <div className="px-3 pb-3 pt-2 space-y-2 shrink-0">
          {(isSeatedGroup || r.status === 'confirmed') && (
            isSeatedGroup ? (
              <button onClick={() => {
                const updated = reservations.map(res => res.id === r.id ? { ...res, status: 'finished' as const } : res);
                setReservations(updated);
                saveStorage({ ...loadStorage(), reservations: updated } as never);
              }}
                className="w-full py-3 font-semibold text-[13px] flex items-center justify-center gap-2 transition-colors text-white hover:brightness-110"
                style={{ background: '#8b5cf6' }}>
                Beenden
              </button>
            ) : (
              <button onClick={() => {
                const updated = reservations.map(res => res.id === r.id ? { ...res, status: 'seated' as const } : res);
                setReservations(updated);
                saveStorage({ ...loadStorage(), reservations: updated } as never);
              }}
                className="w-full py-3 font-semibold text-[13px] flex items-center justify-center gap-2 transition-colors text-white hover:brightness-110"
                style={{ background: '#8b5cf6' }}>
                Platzieren
              </button>
            )
          )}
          {r.status !== 'cancelled' && r.status !== 'no_show' && r.status !== 'finished' && (
            <button onClick={() => {
              const updated = reservations.map(res => res.id === r.id ? { ...res, status: 'cancelled' as const } : res);
              setReservations(updated);
              saveStorage({ ...loadStorage(), reservations: updated } as never);
              closeGuestPanel();
            }}
              className="w-full py-3 font-semibold text-[13px] transition-colors text-[#f0abfc] border border-[#7c3aed] hover:brightness-110"
              style={{ background: 'rgba(124,58,237,0.08)' }}>
              Stornieren
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderSidebar = () => {
    if (!showSidebar || editMode) return null;
    if (showReservations) {
      return (
        <div
          className="flex flex-col h-full relative overflow-visible"
          style={{ width: sidebarWidth, minWidth: sidebarWidth, background: '#1a1a2e', borderRight: '1px solid rgba(255,255,255,0.03)' }}
        >
          <ReservationPanel
            embedded
            initialShowForm={openReservationsInAddMode}
            onReservationsChange={syncReservations}
            onClose={() => { setShowReservations(false); setOpenReservationsInAddMode(false); }}
            onSeatReservation={(tableId) => {
              setShowReservations(false);
              setOpenReservationsInAddMode(false);
              dispatch({ type: 'SET_ACTIVE_TABLE', tableId });
            }}
          />
        </div>
      );
    }
    const renderSidebarHeader = (
      label: string,
      parties: number,
      covers: number,
      collapsed: boolean,
      onToggle: () => void,
      sectionKey: SidebarSectionKey,
    ) => (
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0 flex items-center gap-2">
          <span className="text-[12px] font-semibold text-white whitespace-nowrap">{label}</span>
          <span className="text-[11px] text-[#8888aa] whitespace-nowrap">
            <IconUsers className="w-3 h-3 inline" /> {parties} <IconUser className="w-3 h-3 inline ml-0.5" /> {covers}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!collapsed && (
            <div className="relative flex h-[24px] w-[24px] items-center justify-center text-[#aeb5cc]">
              <IconAdjustmentsHorizontal className="w-3.5 h-3.5 pointer-events-none" />
              <select
                value={sidebarSortBy[sectionKey]}
                onChange={e => setSidebarSortBy(prev => ({ ...prev, [sectionKey]: e.target.value as SidebarSortKey }))}
                className="absolute inset-0 opacity-0 cursor-pointer"
                aria-label={`${label} sortieren`}
              >
                <option value="reservation_time">Reservierungszeit</option>
                <option value="arrival_time">Ankunftszeit</option>
                <option value="name">Name</option>
                <option value="party_size">Personenzahl</option>
                <option value="table">Tisch</option>
                <option value="created_at">Erstelltes Datum</option>
                <option value="payment_status">Kreditkartenstatus</option>
              </select>
            </div>
          )}
          <button
            onClick={onToggle}
            className="flex h-[24px] w-[24px] shrink-0 items-center justify-center text-[#d7dae2]"
          >
            {collapsed ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
    );

    return (
      <div className="flex flex-col h-full" style={{ width: sidebarWidth, minWidth: sidebarWidth, background: '#1a1a2e', borderRight: '1px solid rgba(255,255,255,0.03)' }}>
        <div className="flex-1 overflow-y-auto">
        {/* Reservations section */}
          <div className="border-b border-white/[0.03]">
            {renderSidebarHeader('Reservierungen', sidebarResParties, sidebarResCovers, sidebarResCollapsed, () => setSidebarResCollapsed(!sidebarResCollapsed), 'reservations')}
            {!sidebarResCollapsed && (
              <div className="pb-2">
                {sidebarReservations.length === 0 && (
                  <div className="px-3 py-2 text-[11px] text-[#666688]">Keine Reservierungen</div>
                )}
                {sidebarReservations.map(r => renderSidebarCard(r, false))}
              </div>
            )}
          </div>

          {/* Seated section */}
          <div className="border-t border-white/[0.03]">
            {renderSidebarHeader('Platziert', sidebarSeatedParties, sidebarSeatedCovers, sidebarSeatedCollapsed, () => setSidebarSeatedCollapsed(!sidebarSeatedCollapsed), 'seated')}
            {!sidebarSeatedCollapsed && (
              <div className="pb-2">
                {sidebarSeated.length === 0 && (
                  <div className="px-3 py-2 text-[11px] text-[#666688]">Keine platzierten Gaeste</div>
                )}
                {sidebarSeated.map(r => renderSidebarCard(r, true))}
              </div>
            )}
          </div>

          {/* Waitlist section */}
          <div className="border-t border-white/[0.03]">
            {renderSidebarHeader('Warteliste', sidebarWaitlistParties, sidebarWaitlistCovers, sidebarWaitlistCollapsed, () => setSidebarWaitlistCollapsed(!sidebarWaitlistCollapsed), 'waitlist')}
            {!sidebarWaitlistCollapsed && (
              <div className="pb-2">
                {sidebarWaitlist.length === 0 && (
                  <div className="px-3 py-2 text-[11px] text-[#666688]">Keine Warteliste</div>
                )}
                {sidebarWaitlist.map(entry => renderWaitlistCard(entry))}
              </div>
            )}
          </div>

          {sidebarFinished.length > 0 && (
            <div className="border-t border-white/[0.03]">
              {renderSidebarHeader('Beendet', sidebarFinishedParties, sidebarFinishedCovers, sidebarFinishedCollapsed, () => setSidebarFinishedCollapsed(!sidebarFinishedCollapsed), 'finished')}
              {!sidebarFinishedCollapsed && (
                <div className="pb-2">
                  {sidebarFinished.map(r => renderSidebarCard(r, true))}
                </div>
              )}
            </div>
          )}

          {sidebarRemoved.length > 0 && (
            <div className="border-t border-white/[0.03]">
              {renderSidebarHeader('Entfernt', sidebarRemovedParties, sidebarRemovedCovers, sidebarRemovedCollapsed, () => setSidebarRemovedCollapsed(!sidebarRemovedCollapsed), 'removed')}
              {!sidebarRemovedCollapsed && (
                <div className="pb-2">
                  {sidebarRemoved.map(r => renderSidebarCard(r, false))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-white/[0.03] p-3 space-y-2" style={{ background: '#1d1c31' }}>
          <button
            onClick={() => {
              setShowWaitlist(false);
              setShowReservationCreatePanel(true);
              setSelectedReservationId(null);
              setGuestProfileGuest(null);
              clearPersistedInspector();
            }}
            className="w-full py-3 text-[14px] font-semibold text-white transition-colors hover:brightness-110"
            style={{ background: '#8b5cf6' }}
          >
            Reservieren
          </button>
          <button
            onClick={() => {
              setShowReservationCreatePanel(false);
              setSelectedReservationId(null);
              setGuestProfileGuest(null);
              setShowWaitlist(true);
              clearPersistedInspector();
            }}
            className="w-full py-3 text-[14px] font-semibold text-[#d8c7ff] transition-colors hover:brightness-110"
            style={{ background: '#2b2944' }}
          >
            Warteliste
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col" style={{ background: '#1a1a2e' }}>

      {editMode && (
        <div className="px-4 py-2 flex items-center gap-2 flex-wrap relative" style={{ background: '#1a1a2e' }}>
          <button onClick={handleAddTable}
            className="flex items-center gap-1.5 bg-[#7bb7ef] text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-[#7bb7ef] transition-colors">
            <IconPlus className="w-3.5 h-3.5" /> Tisch
          </button>
          <button onClick={() => setShowShapePicker(!showShapePicker)}
            className="flex items-center gap-1.5 bg-[#353558] text-[#c0c0dd] rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-[#555] transition-colors">
            Form: {SHAPE_OPTIONS.find(s => s.value === (selectedTable ? (state.tables.find(t => t.id === selectedTable)?.shape || 'rect') : newTableShape))?.label}
          </button>
          {selectedTable && (
            <button onClick={handleDeleteTable}
              className="flex items-center gap-1.5 bg-red-900/50 text-red-300 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-red-800/50 transition-colors">
              <IconTrash className="w-3.5 h-3.5" /> Loeschen
            </button>
          )}
          <span className="text-[#8888aa] text-[10px] ml-auto">Drag zum Verschieben</span>
          {showShapePicker && (
            <div className="absolute top-full left-16 z-50 bg-[#2a2a42] rounded-xl border border-[#333355] p-2 shadow-2xl mt-1">
              {SHAPE_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => handleChangeShape(opt.value)}
                  className={'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ' +
                    ((selectedTable ? state.tables.find(t => t.id === selectedTable)?.shape === opt.value : newTableShape === opt.value)
                      ? 'bg-[#7bb7ef] text-white' : 'text-[#c0c0dd] hover:bg-[#353558]')}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* OpenTable-style sidebar */}
        {renderSidebar()}

        {/* Sidebar toggle */}
        {!editMode && (
          <button onClick={() => setShowSidebar(!showSidebar)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-[#1a1a2e] border border-white/[0.03] rounded-r-lg p-1"
            style={{ left: showSidebar ? sidebarWidth : 0 }}>
            {showSidebar ? <IconLayoutSidebarLeftCollapse className="w-4 h-4 text-[#8888aa]" /> : <IconLayoutSidebarLeftExpand className="w-4 h-4 text-[#8888aa]" />}
          </button>
        )}

        {/* Stage stays visible; reservation details open as right inspector */}
        <div ref={canvasRef} className="flex-1 overflow-hidden relative"
          style={{ background: '#1a1a2e', touchAction: scale > 1 || editMode ? 'none' : 'auto' }}
          onClick={() => {
            if (editMode) {
              setSelectedTable(null);
              setShowShapePicker(false);
              return;
            }
            if (selectedReservationId || showWaitlist || showReservationCreatePanel || resDetailId) {
              closeGuestPanel();
              setShowWaitlist(false);
              setShowReservationCreatePanel(false);
              setResDetailId(null);
              setTableManagementId(null);
            }
          }}>
          <div style={{
            transform: 'scale(' + scale + ') translate(' + (translate.x / scale) + 'px, ' + (translate.y / scale) + 'px)',
            transformOrigin: 'center center', width: '100%', height: '100%', position: 'relative',
            transition: pinchRef.current.isPinching ? 'none' : 'transform 0.1s ease-out',
          }}>
            {zoneTables.map(table => renderTableShape(table))}
          </div>

          {/* Zone selector - OpenTable style bottom-right */}
          {!editMode && (
            <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
              <button
                onClick={() => { setEditMode(!editMode); setSelectedTable(null); setShowShapePicker(false); }}
                className={'px-3 py-2.5 rounded-lg text-[14px] font-medium transition-colors flex items-center gap-1.5 ' +
                  (editMode ? 'bg-[#8b5cf6] text-white' : 'bg-[#2a2a42] text-[#c4b5fd] hover:bg-[#353558]')}>
                {editMode ? <><IconCheck className="w-4 h-4" />Fertig</> : <><IconEdit className="w-4 h-4" />Edit</>}
              </button>
              <button
                onClick={() => { const idx = state.zones.findIndex(z => z.id === activeZone); switchZone(state.zones[(idx + 1) % state.zones.length].id); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-[14px] font-medium"
                style={{ background: '#2a2a42' }}>
                {currentZone?.name || 'Hauptetage'}
                <IconChevronUp className="w-4 h-4 text-[#8888aa]" />
              </button>
            </div>
          )}
        </div>

        {showReservationCreatePanel && !editMode && (
          <div className="flex flex-col h-full overflow-hidden" style={{ width: 280, minWidth: 280, background: '#1f1e33', borderLeft: '1px solid rgba(255,255,255,0.03)' }}>
            <ReservationPanel
              embedded
              initialShowForm
              onReservationsChange={syncReservations}
              onClose={() => setShowReservationCreatePanel(false)}
              onSeatReservation={(tableId) => {
                setShowReservationCreatePanel(false);
                dispatch({ type: 'SET_ACTIVE_TABLE', tableId });
              }}
            />
          </div>
        )}
        {showWaitlist && !showReservationCreatePanel && !editMode && (
          <div className="flex flex-col h-full overflow-hidden" style={{ width: 280, minWidth: 280, background: '#1f1e33', borderLeft: '1px solid rgba(255,255,255,0.03)' }}>
            <WaitlistPanel
              embedded
              onClose={() => setShowWaitlist(false)}
              onSeatGuest={(tableId) => {
                setShowWaitlist(false);
                dispatch({ type: 'SET_ACTIVE_TABLE', tableId });
              }}
              tables={state.tables}
            />
          </div>
        )}

        {selectedReservation && !showGuestProfileView && !showReservationCreatePanel && !showWaitlist && !editMode && renderRightPanel()}
      </div>

      {showPartySizeOverlay && selectedReservation && (() => {
        const r = selectedReservation;
        const zoneTabs = state.zones.slice(0, 3);
        const currentZoneId = r.zone && zoneTabs.some(zone => zone.id === r.zone) ? r.zone : zoneTabs[0]?.id;
        const partySizes = Array.from({ length: 20 }, (_, idx) => idx + 1);
        const applyPartySize = (partySize: number) => {
          const updated = reservations.map(res => res.id === r.id ? { ...res, partySize } : res);
          setReservations(updated);
          saveStorage({ ...loadStorage(), reservations: updated } as never);
          setShowPartySizeOverlay(false);
        };

        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center" style={{ background: 'rgba(12,11,24,0.72)' }}>
            <div className="w-[760px] max-w-[92vw] max-h-[88vh] overflow-hidden" style={{ background: '#1f1e33', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center justify-between px-8 py-6 border-b border-white/[0.05]">
                <h2 className="text-[#eef1fb] text-[22px] font-bold">Personenzahl ändern</h2>
                <button onClick={() => setShowPartySizeOverlay(false)} className="text-[#a9b5cb] hover:text-white transition-colors">
                  <IconX className="w-7 h-7" />
                </button>
              </div>

              <div className="px-8 pt-5">
                <div className="grid grid-cols-3 gap-6">
                  {zoneTabs.map(zone => (
                    <div key={zone.id} className="pb-3 border-b-2 text-center"
                      style={{ borderColor: currentZoneId === zone.id ? '#8b5cf6' : 'rgba(255,255,255,0.08)' }}>
                      <span className={'text-[15px] font-medium ' + (currentZoneId === zone.id ? 'text-[#d8c7ff]' : 'text-[#8f97b3]')}>
                        {zone.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-8 py-6">
                <div className="max-h-[420px] overflow-y-auto border border-white/[0.05]">
                  {partySizes.map(size => (
                    <button
                      key={size}
                      onClick={() => applyPartySize(size)}
                      className={'w-full px-8 py-5 text-left text-[18px] border-b border-white/[0.05] transition-colors last:border-b-0 ' +
                        (r.partySize === size ? 'bg-[#2b2944] text-[#d8c7ff] font-semibold' : 'text-[#eef1fb] hover:bg-[#26243f]')}
                    >
                      {size} Gäste
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={1}
                  placeholder="Personenzahl eingeben"
                  className="w-full mt-5 px-5 py-4 bg-[#161526] text-[#eef1fb] text-[17px] border border-white/[0.08] focus:border-[#8b5cf6] focus:outline-none placeholder:text-[#8f97b3]"
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    const value = Number((e.target as HTMLInputElement).value);
                    if (!Number.isFinite(value) || value < 1) return;
                    applyPartySize(value);
                  }}
                />
              </div>
            </div>
          </div>
        );
      })()}

      {showDurationOverlay && selectedReservation && (() => {
        const r = selectedReservation;
        const durationOptions = Array.from({ length: 19 }, (_, idx) => 30 + idx * 15);
        const formatDuration = (minutes: number) => {
          const hours = Math.floor(minutes / 60);
          const mins = minutes % 60;
          if (hours > 0 && mins > 0) return `${hours} Std. ${mins}m`;
          if (hours > 0) return `${hours} Std.`;
          return `${mins}m`;
        };
        const applyDuration = (duration: number) => {
          const updated = reservations.map(res => res.id === r.id ? { ...res, duration } : res);
          setReservations(updated);
          saveStorage({ ...loadStorage(), reservations: updated } as never);
          setShowDurationOverlay(false);
        };

        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center" style={{ background: 'rgba(12,11,24,0.72)' }}>
            <div className="w-[520px] max-w-[92vw] max-h-[88vh] overflow-hidden" style={{ background: '#1f1e33', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center justify-between px-8 py-6 border-b border-white/[0.05]">
                <h2 className="text-[#eef1fb] text-[22px] font-bold">Dauer ändern</h2>
                <button onClick={() => setShowDurationOverlay(false)} className="text-[#a9b5cb] hover:text-white transition-colors">
                  <IconX className="w-7 h-7" />
                </button>
              </div>

              <div className="px-8 py-6">
                <div className="max-h-[520px] overflow-y-auto border border-white/[0.05]">
                  {durationOptions.map(option => (
                    <button
                      key={option}
                      onClick={() => applyDuration(option)}
                      className={'w-full px-8 py-5 text-left text-[18px] border-b border-white/[0.05] transition-colors last:border-b-0 flex items-center justify-between ' +
                        (r.duration === option ? 'bg-[#2b2944] text-[#d8c7ff] font-semibold' : 'text-[#eef1fb] hover:bg-[#26243f]')}
                    >
                      <span>{formatDuration(option)}</span>
                      {r.duration === option && <IconCheck className="w-5 h-5 text-[#c4b5fd]" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* OpenTable Seat Overlay - Full-screen floor plan for table assignment */}
      {showSeatOverlay && selectedReservation && (() => {
        const r = selectedReservation;
        const overlayZoneTables = state.tables.filter(t => t.zone === seatOverlayZone);
        const assignedIds = r.tableIds && r.tableIds.length > 0 ? r.tableIds : (r.tableId ? [r.tableId] : []);
        const assignedNames = assignedIds.map(id => state.tables.find(t => t.id === id)?.name || '').filter(Boolean).join(', ');
        const handleOverlayTableClick = (tableId: string) => {
          const currentIds = r.tableIds && r.tableIds.length > 0 ? [...r.tableIds] : (r.tableId ? [r.tableId] : []);
          let newIds: string[];
          if (currentIds.includes(tableId)) {
            newIds = currentIds.filter(id => id !== tableId);
          } else {
            newIds = [...currentIds, tableId];
          }
          const updated = reservations.map(res => res.id === r.id ? { ...res, tableId: newIds[0] || '', tableIds: newIds } : res);
          setReservations(updated);
          saveStorage({ ...loadStorage(), reservations: updated } as never);
        };

        const handleSeatNow = () => {
          const updated = reservations.map(res => res.id === r.id ? { ...res, status: 'seated' as const } : res);
          setReservations(updated);
          saveStorage({ ...loadStorage(), reservations: updated } as never);
          setShowSeatOverlay(false);
        };

        return (
          <div className="fixed inset-0 z-[100] flex" style={{ background: '#1a1a2e' }}>
            {/* Left sidebar - dark mode */}
            <div className="flex flex-col h-full" style={{ width: 240, minWidth: 240, background: '#1f1e33', borderRight: '1px solid rgba(255,255,255,0.03)' }}>
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div />
                <button onClick={() => setShowSeatOverlay(false)} className="text-[#64748b] hover:text-[#e2e8f0] transition-colors">
                  <IconX className="w-5 h-5" />
                </button>
              </div>
              <div className="px-4 pb-3">
                <h2 className="text-[#f3ecff] font-bold text-[16px] leading-tight">{r.guestName}</h2>
                <p className="text-[#b6acca] text-[12px] mt-1">{r.time} · {r.partySize} Gäste</p>
              </div>
              {/* Pre-Assign / Seat tabs */}
              <div className="flex border-b border-white/[0.03] px-4">
                <button onClick={() => setSeatOverlayTab('preassign')}
                  className={'pb-2 px-2 text-[13px] font-medium border-b-2 transition-colors mr-4 ' +
                    (seatOverlayTab === 'preassign' ? 'border-[#d946ef] text-[#f3ecff]' : 'border-transparent text-[#7f7898] hover:text-[#b6acca]')}>
                  Vorschlagen
                </button>
                <button onClick={() => setSeatOverlayTab('seat')}
                  className={'pb-2 px-2 text-[13px] font-medium border-b-2 transition-colors ' +
                    (seatOverlayTab === 'seat' ? 'border-[#8b5cf6] text-[#f3ecff]' : 'border-transparent text-[#7f7898] hover:text-[#b6acca]')}>
                  Platzieren
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {assignedNames ? (
                  <div className="flex items-center gap-2 mb-3 px-3 py-3 bg-[#26243f]">
                    <IconArmchair className="w-4 h-4 text-[#cfc5ff]" />
                    <span className="text-[#f3ecff] text-[13px] font-medium">Tisch {assignedNames}</span>
                  </div>
                ) : (
                  <div className="mb-3 px-3 py-3 border border-dashed border-[#7f5bb0]">
                    <p className="text-[#bfa8ee] text-[13px]">Tisch auf dem Plan anklicken</p>
                  </div>
                )}
                {/* Seat now button */}
                <button onClick={handleSeatNow}
                  className="w-full py-3 font-semibold text-[14px] flex items-center justify-center gap-2 transition-colors bg-[#8b5cf6] text-white hover:bg-[#7c3aed] mb-4">
                  {seatOverlayTab === 'seat' ? 'Jetzt platzieren' : 'Tisch vorschlagen'}
                </button>
                {/* Seating Preferences */}
                <div className="flex items-center gap-2 text-[13px] px-3 py-3 bg-[#26243f]">
                  <IconArmchair className="w-4 h-4 text-[#cfc5ff]" />
                  <div>
                    <div className="text-[#f3ecff] font-medium">Sitzplatzpräferenzen</div>
                    <div className="text-[#b6acca] text-[12px]">{state.zones.find(z => z.id === r.zone)?.name || 'Restaurantbereich'} gebucht</div>
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 border-t border-white/[0.03]">
                <button onClick={() => setShowSeatOverlay(false)}
                  className="text-[#d8c7ff] text-[13px] font-medium hover:text-white transition-colors">Mehr Details</button>
              </div>
            </div>

            {/* Floor plan area - dark background like OpenTable */}
            <div className="flex-1 flex flex-col">
              {/* Top bar */}
              <div className="flex items-center justify-center px-4 py-2.5 border-b border-white/[0.03]" style={{ background: '#252545' }}>
                <span className="text-white text-[14px] font-medium">{r.guestName} jetzt platzieren</span>
              </div>
              {/* Floor plan canvas */}
              <div className="flex-1 overflow-hidden relative" style={{ background: '#1a1a2e' }}>
                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                  {overlayZoneTables.map(table => {
                    const shape = table.shape || 'rect';
                    const sizeKey = shape === 'barstool' ? 'barstool' : shape;
                    const size = SHAPE_SIZES[sizeKey] || SHAPE_SIZES.rect;
                    const isAssigned = assignedIds.includes(table.id);
                    const tableRes = tableReservationMap[table.id];
                    const isOccupiedByOther = tableRes && tableRes.id !== r.id;
                    const isAvail = !isOccupiedByOther && table.status !== 'blocked';

                    // Color logic like OpenTable: purple=occupied, gray=available, highlighted=assigned
                    let bgColor = '#6b7280'; // gray for available
                    let textColor = 'white';
                    if (isAssigned) {
                      bgColor = '#4a5568'; // darker for selected/assigned
                    }
                    if (isOccupiedByOther) {
                      bgColor = '#9333ea'; // purple for occupied
                    }
                    if (table.status === 'blocked') {
                      bgColor = '#2a2a42';
                      textColor = '#666688';
                    }

                    const w = size.w;
                    const h = size.h;
                    const isRound = shape === 'round' || shape === 'barstool';

                    return (
                      <div key={table.id}
                        onClick={() => isAvail && handleOverlayTableClick(table.id)}
                        className={'absolute flex flex-col items-center justify-center transition-all ' + (isAvail ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-60')}
                        style={{
                          left: table.x || 0, top: table.y || 0,
                          width: w, height: h,
                          background: bgColor, color: textColor,
                          borderRadius: isRound ? '50%' : 8,
                          border: isAssigned ? '3px solid #fff' : '1px solid rgba(255,255,255,0.15)',
                          boxShadow: isAssigned ? '0 0 12px rgba(255,255,255,0.3)' : 'none',
                        }}>
                        {isAvail && !isAssigned && (
                          <IconPlus className="w-3.5 h-3.5 text-white/60 mb-0.5" />
                        )}
                        <span className="text-[12px] font-bold">{table.name}</span>
                        {isAssigned && (
                          <span className="text-[9px] font-semibold mt-0.5 px-1.5 py-0.5 rounded" style={{ background: '#38bdf8', color: '#fff' }}>
                            {r.time}
                          </span>
                        )}
                        {isOccupiedByOther && tableRes && (
                          <span className="text-[9px] mt-0.5">{tableRes.time}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Zone selector bottom-right */}
              <div className="absolute bottom-4 right-4 z-10">
                <div className="flex items-center gap-1 bg-[#1a1a2e] rounded-lg shadow-lg px-3 py-2 border border-white/[0.03]">
                  <select value={seatOverlayZone} onChange={e => setSeatOverlayZone(e.target.value)}
                    className="text-[#e2e8f0] text-[13px] font-medium bg-transparent border-none outline-none cursor-pointer appearance-none pr-4">
                    {state.zones.map(z => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                  </select>
                  <IconChevronUp className="w-4 h-4 text-[#64748b]" />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {tableManagementId && (() => {
        const managedTable = state.tables.find(t => t.id === tableManagementId);
        if (!managedTable) return null;
        return (
          <TableManagement
            table={managedTable}
            onClose={() => {
              setTableManagementId(null);
              clearPersistedInspector();
            }}
            onOpenTableDetail={(tableId) => {
              setTableManagementId(null);
              clearPersistedInspector();
              dispatch({ type: 'SET_ACTIVE_TABLE', tableId });
            }}
            onReserve={() => {
              setTableManagementId(null);
              clearPersistedInspector();
              setShowReservations(true);
            }}
            allTables={state.tables}
          />
        );
      })()}

      {resDetailId && (() => {
        const detailRes = reservations.find(r => r.id === resDetailId);
        if (!detailRes) return null;
        return (
          <ReservationDetail
            reservation={detailRes}
            allTables={state.tables}
            onClose={() => {
              setResDetailId(null);
              setHighlightedTableId(null);
              clearPersistedInspector();
            }}
            onUpdated={(updated) => setReservations(updated)}
            onEdit={() => {
              setResDetailId(null);
              clearPersistedInspector();
              setShowReservations(true);
            }}
            onSeat={() => {
              setResDetailId(null);
              setHighlightedTableId(null);
              clearPersistedInspector();
            }}
          />
        );
      })()}
    </div>
  );
}
