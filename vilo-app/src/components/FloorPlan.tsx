import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Table, TableCombination, TablePlacementType, TableVariant, Reservation, Guest, GuestNote, ReservationStatus, OccasionLabel, WaitlistEntry } from '../types';
import { useFloorPlanEditor } from '../hooks/useFloorPlanEditor';
import { useFloorPlanSidebar, SIDEBAR_SORT_OPTIONS, type SidebarPlacedItem, type SidebarSectionKey } from '../hooks/useFloorPlanSidebar';

import { IconAdjustmentsHorizontal, IconAlertTriangleFilled, IconAlignLeft, IconArmchair, IconBabyCarriage, IconBell, IconBriefcaseFilled, IconCake, IconCashBanknoteFilled, IconCheck, IconChevronDown, IconChevronRight, IconChevronUp, IconCircleCheckFilled, IconCircleX, IconCreditCard, IconClock, IconCoinFilled, IconConfetti, IconEdit, IconGiftFilled, IconGlobeFilled, IconHeartFilled, IconHeartHandshake, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand, IconLeaf, IconMail, IconMasksTheater, IconMessage, IconNews, IconPhone, IconPhoneFilled, IconPlant2, IconPlus, IconSchool, IconSparkles, IconStar, IconStarFilled, IconTrash, IconUser, IconUserCheck, IconUserPlus, IconUsers, IconWalk, IconWheelchair, IconX } from '@tabler/icons-react';
import { saveStorage, loadStorage, loadReservations, loadWaitlist, loadGuests, addGuest, addGuestNote, removeGuestNote, updateWaitlistEntry } from '../utils/storage';
import { ReservationPanel } from './Reservations';
import { TableManagement } from './TableManagement';
import { WaitlistPanel } from './Waitlist';
import { GuestProfile } from './GuestProfile';
import { ReservationDetail } from './ReservationDetail';
import { ActionButton, SurfaceCard } from './ui';
import { buildTableSvg, renderRectSvg } from './floorplan/tableSvgRendering';

import {
  type TableVariantDefinition,
  TABLE_VARIANTS, TABLE_VARIANT_MAP, EDITOR_TABLE_VARIANTS, DEFAULT_TABLE_VARIANT, BAR_SEAT_VARIANT,
  inferTableVariant, inferPlacementType, getTableVariantConfig,
  getTableLabelNumber, getTableKindLabel, getTableDisplayLabel,
  ROTATION_HANDLE_OFFSET, ROTATION_HANDLE_SIZE,
  getTableSize, getTableCenter, snapRotation, getTableRotation,
  getRotatedWrapperBounds, setTableCenterAndRotation,
  snapPointToGrid, clampTableToBounds,
  SERVICE_STATUS_SHORT, TABLE_STATUS_META,
  type PersistedFloorPlanInspector, type PersistedFloorPlanViewport,
  type PersistedFloorPlanBadges,
  FLOORPLAN_INSPECTOR_STORAGE_KEY, FLOORPLAN_VIEWPORT_STORAGE_KEY,
  FLOORPLAN_BADGE_VISIBILITY_STORAGE_KEY,
  loadPersistedFloorPlanViewport, loadPersistedFloorPlanBadges,
} from '../utils/floorplan';

interface FloorPlanProps {
  voiceMode?: string;
  onStartVoice?: () => void;
  onStopVoice?: () => void;
  onZoneChange?: (zoneId: string, zoneName: string) => void;
  initialEditMode?: boolean;
}

type SeatInspectorState = {
  tableId: string;
  seatNumber: number;
};

type SeatQuickActionState = {
  tableId: string;
  seatNumber: number;
  x: number;
  y: number;
};

type PendingWaitlistPlacementState = {
  entryId: string;
  guestName: string;
  partySize: number;
};

// Types and constants are now imported from '../utils/floorplan'
export function FloorPlan({ onZoneChange, initialEditMode = false }: FloorPlanProps) {
  const { state, dispatch } = useApp();
  const seatAssignmentEnabled = false;
  const initialViewportRef = useRef<PersistedFloorPlanViewport>(
    loadPersistedFloorPlanViewport(state.zones[0]?.id || ''),
  );
  const [activeZone, setActiveZone] = useState<string>(initialViewportRef.current.activeZone || state.zones[0]?.id || '');
  const [editMode, setEditMode] = useState(initialEditMode);
  // Editor state provided by useFloorPlanEditor hook
  const [tableManagementId, setTableManagementId] = useState<string | null>(null);
  const [moveSelection, setMoveSelection] = useState<{ fromTableId: string } | null>(null);
  const [showReservations, setShowReservations] = useState(false);
  const [openReservationsInAddMode, setOpenReservationsInAddMode] = useState(false);
  const [showReservationCreatePanel, setShowReservationCreatePanel] = useState(false);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [activeWaitlistCardId, setActiveWaitlistCardId] = useState<string | null>(null);
  const [pendingWaitlistPlacement, setPendingWaitlistPlacement] = useState<PendingWaitlistPlacementState | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  // Sidebar state provided by useFloorPlanSidebar hook
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
  const initialBadgeVisibilityRef = useRef<PersistedFloorPlanBadges>(loadPersistedFloorPlanBadges());
  const [showFloorTimeBadges, setShowFloorTimeBadges] = useState(initialBadgeVisibilityRef.current.showTimeBadges);
  const [showFloorMoneyBadges, setShowFloorMoneyBadges] = useState(initialBadgeVisibilityRef.current.showMoneyBadges);
  const [showFloorStatusBadges, setShowFloorStatusBadges] = useState(initialBadgeVisibilityRef.current.showStatusBadges);
  const [showFloorServerBadges, setShowFloorServerBadges] = useState(initialBadgeVisibilityRef.current.showServerBadges);
  const [resDetailId, setResDetailId] = useState<string | null>(null);
  const [seatInspector, setSeatInspector] = useState<SeatInspectorState | null>(null);
  const [seatQuickAction, setSeatQuickAction] = useState<SeatQuickActionState | null>(null);
  const [seatGuestSearch, setSeatGuestSearch] = useState('');
  const [seatGuestName, setSeatGuestName] = useState('');
  const [seatGuestPhone, setSeatGuestPhone] = useState('');
  const sidebarWidth = 'min(78vw, 320px)';
  const [, setMinuteTick] = useState(0);
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;

  const [scale, setScale] = useState(initialViewportRef.current.scale);
  const [translate, setTranslate] = useState(initialViewportRef.current.translate);
  const [liveScaleFactor, setLiveScaleFactor] = useState(() => Math.min(2.4, Math.max(1, initialViewportRef.current.scale || 1)));
  const [liveTranslate, setLiveTranslate] = useState(initialViewportRef.current.translate);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef({ startDist: 0, startScale: 1, startX: 0, startY: 0, startTx: 0, startTy: 0, isPinching: false, isPanning: false });
  const dragRef = useRef<{ tableId: string; startX: number; startY: number; origX: number; origY: number; moved: boolean; snapshot: Table[] } | null>(null);
  const rotateRef = useRef<{ tableId: string; snapshot: Table[]; rotated: boolean } | null>(null);
  const canvasPanRef = useRef<{ startX: number; startY: number; startTranslate: { x: number; y: number } } | null>(null);
  const livePanRef = useRef<{ startX: number; startY: number; startTranslate: { x: number; y: number }; moved: boolean } | null>(null);
  const suppressLiveStageClickRef = useRef(false);

  const saveTableUpdate = useCallback((updatedTables: Table[]) => {
    dispatch({ type: 'UPDATE_CONFIG', restaurant: state.restaurant, zones: state.zones, tables: updatedTables, tableCombinations: state.tableCombinations, menu: state.menu, staff: state.staff });
    const storage = loadStorage();
    saveStorage({ ...storage, tables: updatedTables });
  }, [state, dispatch]);

  const saveTableCombinationsUpdate = useCallback((updatedTableCombinations: TableCombination[]) => {
    dispatch({
      type: 'UPDATE_CONFIG',
      restaurant: state.restaurant,
      zones: state.zones,
      tables: state.tables,
      tableCombinations: updatedTableCombinations,
      menu: state.menu,
      staff: state.staff,
    });
    const storage = loadStorage();
    saveStorage({ ...storage, tableCombinations: updatedTableCombinations });
  }, [dispatch, state.menu, state.restaurant, state.staff, state.tables, state.zones]);

  const editor = useFloorPlanEditor({
    tables: state.tables,
    tableCombinations: state.tableCombinations,
    zones: state.zones,
    activeZone,
    saveTableUpdate,
    saveCombinationUpdate: saveTableCombinationsUpdate,
  });
  const sidebar = useFloorPlanSidebar({
    tables: state.tables,
    sessions: state.sessions,
    reservations,
    waitlistEntries,
  });

  const {
    editorMode, setEditorMode,
    selectedTable, setSelectedTable,
    editorTool, setEditorTool,
    placementVariant, setPlacementVariant,
    setDraggedVariant,
    setNewTableVariant,
    editorNameDraft, setEditorNameDraft,
    selectedEditorTable,
    layoutUndoStack, layoutRedoStack,
    handleUndoLayout, handleRedoLayout,
    commitLayoutUpdate,
    updateTableField,
    duplicateSelectedTable,
    handleDeleteTable,
    handleChangeVariant,
    handleCommitEditorName,
    editorFrameRef, editorStageRef,
    editorCanvasSize,
    handleEditorCanvasClick,
    handleEditorCanvasDragOver,
    handleEditorCanvasDrop,
    startEditorResize,
    comboDraftTableIds, setComboDraftTableIds,
    focusedCombinationId, setFocusedCombinationId,
    focusedCombinationTableId, setFocusedCombinationTableId,
    comboError, setComboError,
    comboSaveFeedback,
    saveCombinationDraft,
    updateCombinationField,
    deleteCombination,
    zoneTables, zoneCombinations,
  } = editor;

  const {
    showSidebar, setShowSidebar,
    sidebarSortBy, setSidebarSortBy,
    sidebarSortMenuOpen, setSidebarSortMenuOpen,
    sidebarResCollapsed, setSidebarResCollapsed,
    sidebarWaitlistCollapsed, setSidebarWaitlistCollapsed,
    sidebarSeatedCollapsed, setSidebarSeatedCollapsed,
    sidebarFinishedCollapsed, setSidebarFinishedCollapsed,
    sidebarRemovedCollapsed, setSidebarRemovedCollapsed,
    resolvedSidebarResCollapsed,
    resolvedSidebarSeatedCollapsed,
    resolvedSidebarWaitlistCollapsed,
    sidebarReservations,
    sidebarSeated,
    sidebarWaitlist,
    sidebarFinished,
    sidebarRemoved,
    sidebarResParties, sidebarResCovers,
    sidebarSeatedParties, sidebarSeatedCovers,
    sidebarWaitlistParties, sidebarWaitlistCovers,
    sidebarFinishedParties, sidebarFinishedCovers,
    sidebarRemovedParties, sidebarRemovedCovers,
    sidebarReservationsEmpty,
    sidebarSeatedEmpty,
    sidebarWaitlistEmpty,
  } = sidebar;

  const switchZone = useCallback((zoneId: string) => {
    setActiveZone(zoneId);
    setSelectedTable(null);
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    setLiveScaleFactor(1);
    setLiveTranslate({ x: 0, y: 0 });
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
      } else if (e.touches.length === 1 && !editMode) {
        pinchRef.current = { ...pinchRef.current, startX: e.touches[0].clientX, startY: e.touches[0].clientY, startTx: liveTranslate.x, startTy: liveTranslate.y, isPanning: true, isPinching: false };
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (pinchRef.current.isPinching && e.touches.length === 2) {
        e.preventDefault();
        const d = getDistance(e.touches[0], e.touches[1]);
        const ns = Math.min(3, Math.max(0.5, pinchRef.current.startScale * (d / pinchRef.current.startDist)));
        setLiveScaleFactor(Math.min(2.4, Math.max(0.75, ns)));
      } else if (pinchRef.current.isPanning && e.touches.length === 1 && !editMode) {
        e.preventDefault();
        const dx = e.touches[0].clientX - pinchRef.current.startX;
        const dy = e.touches[0].clientY - pinchRef.current.startY;
        suppressLiveStageClickRef.current = true;
        setLiveTranslate({ x: pinchRef.current.startTx + dx, y: pinchRef.current.startTy + dy });
      }
    };
    const handleTouchEnd = () => {
      pinchRef.current.isPinching = false;
      pinchRef.current.isPanning = false;
      if (liveScaleFactor <= 0.76) {
        setLiveScaleFactor(1);
        setLiveTranslate({ x: 0, y: 0 });
      }
      window.setTimeout(() => {
        suppressLiveStageClickRef.current = false;
      }, 0);
    };
    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [editMode, liveScaleFactor, liveTranslate.x, liveTranslate.y]);

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
      JSON.stringify({ activeZone, scale: liveScaleFactor, translate: liveTranslate }),
    );
  }, [activeZone, liveScaleFactor, liveTranslate]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      FLOORPLAN_BADGE_VISIBILITY_STORAGE_KEY,
      JSON.stringify({
        showTimeBadges: showFloorTimeBadges,
        showMoneyBadges: showFloorMoneyBadges,
        showStatusBadges: showFloorStatusBadges,
        showServerBadges: showFloorServerBadges,
      }),
    );
  }, [showFloorMoneyBadges, showFloorServerBadges, showFloorStatusBadges, showFloorTimeBadges]);

  useEffect(() => {
    const timer = window.setInterval(() => setMinuteTick(tick => tick + 1), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const updateCanvasSize = () => {
      setCanvasSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    updateCanvasSize();
    const observer = new ResizeObserver(() => updateCanvasSize());
    observer.observe(element);

    return () => observer.disconnect();
  }, [editMode, showSidebar, showReservationCreatePanel, showWaitlist, tableManagementId]);

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
    const map: Record<string, Reservation> = {};
    reservations
      .filter(r => r.date === todayStr && r.status === 'confirmed' && r.tableId)
      .forEach(r => {
        const [rh, rm] = r.time.split(':').map(Number);
        const resMins = rh * 60 + rm;
        if (resMins >= nowMins - 30 && r.tableId) {
          if (!map[r.tableId] || r.time < map[r.tableId].time) {
            map[r.tableId] = r;
          }
        }
      });
    return map;
  }, [reservations]);

  const formatDurationLabel = useCallback((duration: number) => (
    duration >= 60
      ? `${Math.floor(duration / 60)}h ${duration % 60}m`
      : `${duration}m`
  ), []);

  const activeReservationByTableId = useMemo(() => {
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    const activeStatuses: Reservation['status'][] = [
      'seated',
      'partially_seated',
      'appetizer',
      'entree',
      'dessert',
      'cleared',
      'check_dropped',
      'paid',
      'bussing_needed',
    ];

    const map: Record<string, Reservation> = {};
    reservations
      .filter(r => r.date === todayStr && activeStatuses.includes(r.status))
      .forEach(r => {
        const tableIds = r.tableIds && r.tableIds.length > 0
          ? r.tableIds
          : (r.tableId ? [r.tableId] : []);
        tableIds.forEach(tableId => {
          const existing = map[tableId];
          if (!existing || r.time < existing.time) {
            map[tableId] = r;
          }
        });
      });

    return map;
  }, [reservations]);

  const getCombinationByTableId = useCallback((tableId: string) => (
    state.tableCombinations.find(combination => combination.tableIds.includes(tableId)) || null
  ), [state.tableCombinations]);

  const getActiveCombinationContext = useCallback((tableId: string) => {
    const direct = Object.values(state.sessions).find(session => session.tableId === tableId || session.combinedTableIds?.includes(tableId));
    if (!direct) return null;
    return {
      ownerTableId: direct.tableId,
      memberTableIds: [direct.tableId, ...(direct.combinedTableIds || [])],
      session: direct,
    };
  }, [state.sessions]);

  const getDisplaySessionForTable = useCallback((tableId: string) => {
    const directSession = state.sessions[tableId];
    if (directSession) {
      return {
        ownerTableId: directSession.tableId,
        memberTableIds: [directSession.tableId, ...(directSession.combinedTableIds || [])],
        session: directSession,
        isCombinationActive: Boolean(directSession.combinedTableIds?.length),
      };
    }

    const combinationContext = getActiveCombinationContext(tableId);
    if (!combinationContext) return null;

    return {
      ...combinationContext,
      isCombinationActive: combinationContext.memberTableIds.length > 1,
    };
  }, [getActiveCombinationContext, state.sessions]);

  const getServerBadgeLabel = useCallback((tableId: string) => {
    const displaySession = getDisplaySessionForTable(tableId);
    const rawName = displaySession?.session?.servedByName?.trim();
    if (!rawName) return null;
    return rawName.split(/\s+/)[0] || rawName;
  }, [getDisplaySessionForTable]);

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
    dispatch({ type: 'UPDATE_CONFIG', restaurant: state.restaurant, zones: state.zones, tables: updatedTables, tableCombinations: state.tableCombinations, menu: state.menu, staff: state.staff });
  }, [activeZone]);

  const closeSeatInspector = useCallback(() => {
    setSeatInspector(null);
    setSeatQuickAction(null);
    setSeatGuestSearch('');
    setSeatGuestName('');
    setSeatGuestPhone('');
  }, []);

  const formatCompactMinutes = useCallback((minutes: number) => {
    const sign = minutes < 0 ? '-' : '';
    const absoluteMinutes = Math.abs(minutes);
    const hours = Math.floor(absoluteMinutes / 60);
    const restMinutes = absoluteMinutes % 60;

    if (hours > 0) {
      return restMinutes === 0
        ? `${sign}${hours}h`
        : `${sign}${hours}h ${restMinutes}m`;
    }

    return `${sign}${restMinutes}m`;
  }, []);

  const getReservationCountdownLabel = useCallback((reservation: Reservation) => {
    const [hours, minutes] = reservation.time.split(':').map(Number);
    const reservationStart = new Date(reservation.date + 'T' + reservation.time + ':00');
    if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(reservationStart.getTime())) {
      return null;
    }

    const reservationEnd = reservationStart.getTime() + reservation.duration * 60000;
    const remainingMinutes = Math.ceil((reservationEnd - Date.now()) / 60000);
    return formatCompactMinutes(remainingMinutes);
  }, [formatCompactMinutes]);

  const getElapsedSessionLabel = useCallback((startTime?: number) => {
    if (!startTime) return null;
    const elapsedMinutes = Math.max(1, Math.floor((Date.now() - startTime) / 60000));
    return formatCompactMinutes(elapsedMinutes);
  }, [formatCompactMinutes]);

  const getTableDisplayMeta = useCallback((table: Table) => {
    const displaySession = getDisplaySessionForTable(table.id);
    const tableSession = displaySession?.session;
    const effectiveStatus: Table['status'] = table.status === 'blocked'
      ? 'blocked'
      : displaySession
        ? (table.status === 'billing' ? 'billing' : 'occupied')
        : table.status;
    const statusMeta = TABLE_STATUS_META[effectiveStatus];
    const seats = table.seats || 4;
    const guestCount = tableSession?.guestCount || (effectiveStatus === 'free' ? 0 : seats);
    const problemCount = tableSession?.orders.filter(order => order.state === 'problem').length || 0;
    const nextReservation = nextReservationMap[table.id];
    const nextReservationTime = nextReservation?.time || null;
    const hasReservation = Boolean(nextReservationTime);
    const activeReservation = activeReservationByTableId[table.id];
    const serviceStatusKey = tableSession?.serviceStatus;
    const serviceStatusLabel = serviceStatusKey ? SERVICE_STATUS_SHORT[serviceStatusKey] || serviceStatusKey : null;

    let nextActionLabel: string | null = null;
    let nextActionSubLabel: string | null = null;
    let nextActionTone: 'billing' | 'problem' | 'service' | 'neutral' = 'neutral';
    if (effectiveStatus === 'occupied' || effectiveStatus === 'billing') {
      if (activeReservation?.duration) {
        nextActionLabel = getReservationCountdownLabel(activeReservation);
        nextActionTone = 'neutral';
      }

      if (!nextActionLabel && tableSession?.startTime) {
        nextActionLabel = getElapsedSessionLabel(tableSession.startTime);
        nextActionTone = 'neutral';
      }

      if (!nextActionLabel && (effectiveStatus === 'billing' || serviceStatusKey === 'rechnung_faellig')) {
        nextActionLabel = 'Rechnung';
        nextActionTone = 'billing';
      } else if (!nextActionLabel && problemCount > 0) {
        nextActionLabel = problemCount === 1 ? 'Problem' : `${problemCount} Probleme`;
        nextActionTone = 'problem';
      } else if (!nextActionLabel && serviceStatusLabel) {
        nextActionLabel = serviceStatusLabel;
        nextActionTone = 'service';
      }
    } else if (effectiveStatus === 'free' && hasReservation) {
      nextActionLabel = nextReservationTime;
      nextActionSubLabel = nextReservation?.duration ? formatDurationLabel(nextReservation.duration) : null;
      nextActionTone = 'service';
    }

    return {
      effectiveStatus,
      statusMeta,
      guestCount,
      serviceStatusLabel,
      nextReservationTime,
      nextActionLabel,
      nextActionSubLabel,
      nextActionTone,
    };
  }, [activeReservationByTableId, formatDurationLabel, getDisplaySessionForTable, getElapsedSessionLabel, getReservationCountdownLabel, nextReservationMap]);

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
    setMoveSelection(null);
    setSelectedReservationId(null);
    setHighlightedTableId(null);
    setGuestProfileGuest(null);
    setShowGuestProfileView(false);
    setShowAddNote(false);
    setNoteText('');
    setResDetailId(null);
    closeSeatInspector();
    setShowWaitlist(false);
    setShowReservationCreatePanel(false);
    setTableManagementId(tableId);
    persistInspectorState({ type: 'table', id: tableId });
  }, [activeZone, closeSeatInspector, persistInspectorState, state.tables]);

  const openReservationInspector = useCallback((reservation: Reservation) => {
    setMoveSelection(null);
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
    const displaySession = getDisplaySessionForTable(tableId);
    const session = displaySession?.session;
    if (!session) return { count: 0, total: 0, hasReady: false, startTime: 0 };
    const count = session.orders.length;
    const total = session.orders.reduce((s, o) => s + o.price * o.quantity, 0);
    const hasReady = session.orders.some(o => o.state === 'ready');
    return { count, total, hasReady, startTime: session.startTime };
  };

  const getSeatDisplayStateForTable = useCallback((tableId: string, localSeatNumber: number) => {
    const displaySession = getDisplaySessionForTable(tableId);
    const session = displaySession?.session;
    if (!session) {
      return {
        globalSeatNumber: localSeatNumber,
        isActiveSeat: false,
        seatAssignment: null,
      };
    }

    const guestCount = Math.max(0, session.guestCount || 0);
    if (!displaySession.isCombinationActive || displaySession.memberTableIds.length < 2) {
      return {
        globalSeatNumber: localSeatNumber,
        isActiveSeat: localSeatNumber <= guestCount,
        seatAssignment: session.seatAssignments?.find(assignment => assignment.seatNumber === localSeatNumber) || null,
      };
    }

    let seatOffset = 0;
    for (const memberTableId of displaySession.memberTableIds) {
      const memberTable = state.tables.find(entry => entry.id === memberTableId);
      if (!memberTable || inferPlacementType(memberTable) !== 'table') continue;

      const capacity = Math.max(1, getTableVariantConfig(memberTable).seats || memberTable.seats || 1);
      if (memberTableId === tableId) {
        const globalSeatNumber = seatOffset + localSeatNumber;
        return {
          globalSeatNumber,
          isActiveSeat: globalSeatNumber <= guestCount,
          seatAssignment: session.seatAssignments?.find(assignment => assignment.seatNumber === globalSeatNumber) || null,
        };
      }

      seatOffset += capacity;
    }

    return {
      globalSeatNumber: localSeatNumber,
      isActiveSeat: localSeatNumber <= guestCount,
      seatAssignment: session.seatAssignments?.find(assignment => assignment.seatNumber === localSeatNumber) || null,
    };
  }, [getDisplaySessionForTable, state.tables]);

  const handleTableClick = (table: Table) => {
    if (editMode) {
      if (editorMode === 'combos') {
        if (inferPlacementType(table) === 'bar_seat') {
          setComboError('Bar-Sitze können nicht kombiniert werden.');
          return;
        }
        setComboError('');
        setFocusedCombinationTableId(table.id);
        setFocusedCombinationId(getCombinationByTableId(table.id)?.id || null);
        setSelectedTable(null);
        setComboDraftTableIds(current => (
          current.includes(table.id)
            ? current.filter(id => id !== table.id)
            : [...current, table.id]
        ));
        return;
      }
      setSelectedTable(table.id);
      return;
    }
    if (moveSelection) {
      if (table.id === moveSelection.fromTableId) return;
      if (table.status !== 'free') return;
      closeGuestPanel();
      setShowWaitlist(false);
      setShowReservationCreatePanel(false);
      setResDetailId(null);
      setPendingWaitlistPlacement(null);
      dispatch({ type: 'MOVE_TABLE_SESSION', fromTableId: moveSelection.fromTableId, toTableId: table.id });
      setMoveSelection(null);
      openTableManagementInspector(table.id);
      return;
    }
    if (pendingWaitlistPlacement && table.status === 'free') {
      closeGuestPanel();
      setShowWaitlist(false);
      setShowReservationCreatePanel(false);
      setResDetailId(null);
      setTableManagementId(null);
      clearPersistedInspector();
      openTableManagementInspector(table.id);
      return;
    }
    closeGuestPanel();
    setShowWaitlist(false);
    setShowReservationCreatePanel(false);
    setResDetailId(null);
    setTableManagementId(null);
    clearPersistedInspector();

    const displaySession = getDisplaySessionForTable(table.id);
    const isActiveTable = (
      table.status === 'occupied' ||
      table.status === 'billing' ||
      Boolean(displaySession?.session)
    );
    if (isActiveTable) {
      dispatch({ type: 'SET_ACTIVE_TABLE', tableId: table.id });
      return;
    }

    openTableManagementInspector(table.id);
  };

  const getEditorStagePointFromClient = useCallback((clientX: number, clientY: number) => {
    const rect = editorStageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  }, [scale]);

  const handleMouseDown = (e: React.MouseEvent, tableId: string) => {
    if (editorMode !== 'combos') {
      setSelectedTable(tableId);
    }
    if (editorMode === 'combos') return;
    if (!editMode || editorTool !== 'move') return;
    e.preventDefault();
    e.stopPropagation();
    const table = state.tables.find(t => t.id === tableId);
    if (!table) return;
    dragRef.current = {
      tableId,
      startX: e.clientX,
      startY: e.clientY,
      origX: table.x || 0,
      origY: table.y || 0,
      moved: false,
      snapshot: state.tables,
    };
  };

  const handleTouchDown = (e: React.TouchEvent, tableId: string) => {
    if (editorMode !== 'combos') {
      setSelectedTable(tableId);
    }
    if (editorMode === 'combos') return;
    if (!editMode || editorTool !== 'move') return;
    e.stopPropagation();
    const table = state.tables.find(t => t.id === tableId);
    if (!table) return;
    dragRef.current = {
      tableId,
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      origX: table.x || 0,
      origY: table.y || 0,
      moved: false,
      snapshot: state.tables,
    };
  };

  const startRotationDrag = useCallback((event: { stopPropagation: () => void; preventDefault: () => void }, tableId: string) => {
    event.stopPropagation();
    event.preventDefault();
    const table = state.tables.find(entry => entry.id === tableId);
    if (!table) return;
    setSelectedTable(tableId);
    rotateRef.current = {
      tableId,
      snapshot: state.tables,
      rotated: false,
    };
  }, [state.tables]);

  useEffect(() => {
    if (!editMode) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current || rotateRef.current) return;
      const dx = (e.clientX - dragRef.current.startX) / scale;
      const dy = (e.clientY - dragRef.current.startY) / scale;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
      const snapped = snapPointToGrid(dragRef.current.origX + dx, dragRef.current.origY + dy);
      const draggedTable = state.tables.find(t => t.id === dragRef.current!.tableId);
      if (!draggedTable) return;
      const clamped = clampTableToBounds(snapped.x, snapped.y, draggedTable, editorCanvasSize.width, editorCanvasSize.height);
      const updatedTables = state.tables.map(t =>
        t.id === dragRef.current!.tableId ? { ...t, x: clamped.x, y: clamped.y } : t
      );
      dispatch({ type: 'UPDATE_CONFIG', restaurant: state.restaurant, zones: state.zones, tables: updatedTables, tableCombinations: state.tableCombinations, menu: state.menu, staff: state.staff });
    };
    const handleMouseUp = () => {
      if (rotateRef.current) return;
      if (dragRef.current) {
        const currentDrag = dragRef.current;
        if (currentDrag.moved) {
          commitLayoutUpdate(state.tables, currentDrag.snapshot);
        } else {
          const storage = loadStorage();
          saveStorage({ ...storage, tables: state.tables });
        }
        dragRef.current = null;
      }
    };
    const handleTouchMoveDoc = (e: TouchEvent) => {
      if (!dragRef.current || rotateRef.current) return;
      e.preventDefault();
      const dx = (e.touches[0].clientX - dragRef.current.startX) / scale;
      const dy = (e.touches[0].clientY - dragRef.current.startY) / scale;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
      const snapped = snapPointToGrid(dragRef.current.origX + dx, dragRef.current.origY + dy);
      const draggedTable = state.tables.find(t => t.id === dragRef.current!.tableId);
      if (!draggedTable) return;
      const clamped = clampTableToBounds(snapped.x, snapped.y, draggedTable, editorCanvasSize.width, editorCanvasSize.height);
      const updatedTables = state.tables.map(t =>
        t.id === dragRef.current!.tableId ? { ...t, x: clamped.x, y: clamped.y } : t
      );
      dispatch({ type: 'UPDATE_CONFIG', restaurant: state.restaurant, zones: state.zones, tables: updatedTables, tableCombinations: state.tableCombinations, menu: state.menu, staff: state.staff });
    };
    const handleTouchEndDoc = () => {
      if (rotateRef.current) return;
      if (dragRef.current) {
        const currentDrag = dragRef.current;
        if (currentDrag.moved) {
          commitLayoutUpdate(state.tables, currentDrag.snapshot);
        } else {
          const storage = loadStorage();
          saveStorage({ ...storage, tables: state.tables });
        }
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
  }, [editMode, editorTool, state.tables, scale, dispatch, state.restaurant, state.zones, state.menu, state.staff, editorCanvasSize.width, editorCanvasSize.height, commitLayoutUpdate]);

  useEffect(() => {
    if (!editMode) return;

    const updateRotatedTable = (clientX: number, clientY: number) => {
      if (!rotateRef.current) return;
      const rotatedTable = state.tables.find(table => table.id === rotateRef.current!.tableId);
      if (!rotatedTable) return;
      const stagePoint = getEditorStagePointFromClient(clientX, clientY);
      if (!stagePoint) return;
      const currentCenter = getTableCenter(rotatedTable);
      const snappedCenter = snapPointToGrid(currentCenter.x, currentCenter.y);
      const angleDeg = (Math.atan2(stagePoint.y - snappedCenter.y, stagePoint.x - snappedCenter.x) * 180) / Math.PI;
      const nextAngle = snapRotation(angleDeg);
      const nextState = setTableCenterAndRotation(
        rotatedTable,
        snappedCenter,
        nextAngle,
        editorCanvasSize.width,
        editorCanvasSize.height,
      );
      if (
        nextState.rotation === getTableRotation(rotatedTable) &&
        nextState.x === (rotatedTable.x || 0) &&
        nextState.y === (rotatedTable.y || 0)
      ) {
        return;
      }
      rotateRef.current.rotated = true;
      const updatedTables = state.tables.map(table => (
        table.id === rotatedTable.id
          ? { ...table, x: nextState.x, y: nextState.y, rotation: nextState.rotation }
          : table
      ));
      dispatch({ type: 'UPDATE_CONFIG', restaurant: state.restaurant, zones: state.zones, tables: updatedTables, tableCombinations: state.tableCombinations, menu: state.menu, staff: state.staff });
    };

    const finishRotation = () => {
      if (!rotateRef.current) return;
      const currentRotation = rotateRef.current;
      if (currentRotation.rotated) {
        commitLayoutUpdate(state.tables, currentRotation.snapshot);
      } else {
        const storage = loadStorage();
        saveStorage({ ...storage, tables: state.tables });
      }
      rotateRef.current = null;
    };

    const handleMouseMove = (event: MouseEvent) => updateRotatedTable(event.clientX, event.clientY);
    const handleTouchMove = (event: TouchEvent) => {
      if (!rotateRef.current) return;
      event.preventDefault();
      const touch = event.touches[0];
      if (!touch) return;
      updateRotatedTable(touch.clientX, touch.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', finishRotation);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', finishRotation);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', finishRotation);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', finishRotation);
    };
  }, [commitLayoutUpdate, dispatch, editMode, editorCanvasSize.height, editorCanvasSize.width, getEditorStagePointFromClient, state.menu, state.restaurant, state.staff, state.tableCombinations, state.tables, state.zones]);

  // buildTableSvg and renderRectSvg imported from ./floorplan/tableSvgRendering

  const estimateBadgeSize = useCallback((label: string, subLabel?: string | null) => {
    const compactLabel = label.length <= 5;
    const baseWidth = compactLabel ? Math.max(36, label.length * 7 + 12) : Math.max(48, label.length * 6 + 16);
    const subLabelWidth = subLabel ? Math.max(40, subLabel.length * 5 + 14) : 0;
    return {
      width: Math.max(baseWidth, subLabelWidth),
      height: subLabel ? 42 : 20,
    };
  }, []);

  const tableLayoutMap = useMemo(() => {
    return Object.fromEntries(zoneTables.map(table => {
      const displayMeta = getTableDisplayMeta(table);
      const size = getTableSize(table);
      const svg = buildTableSvg(inferTableVariant(table));
      const wrapperLeft = (table.x || 0) - svg.bodyBounds.x;
      const wrapperTop = (table.y || 0) - svg.bodyBounds.y;
      const center = getTableCenter(table);
      const rotation = getTableRotation(table);
      const rotatedWrapperBounds = getRotatedWrapperBounds(wrapperLeft, wrapperTop, svg.svgW, svg.svgH, center, rotation);

      return [table.id, {
        wrapperLeft,
        wrapperTop,
        wrapperRight: rotatedWrapperBounds.right,
        wrapperBottom: rotatedWrapperBounds.bottom,
        wrapperVisibleLeft: rotatedWrapperBounds.left,
        wrapperVisibleTop: rotatedWrapperBounds.top,
        size,
        svg,
        displayMeta,
      }];
    }));
  }, [getTableDisplayMeta, zoneTables]);

  const liveViewport = useMemo(() => {
    const layouts = Object.values(tableLayoutMap);
    if (layouts.length === 0 || canvasSize.width === 0 || canvasSize.height === 0) {
      return { scale: 1, translate: { x: 0, y: 0 } };
    }

    const minLeft = Math.min(...layouts.map(layout => layout.wrapperVisibleLeft));
    const minTop = Math.min(...layouts.map(layout => layout.wrapperVisibleTop));
    const maxRight = Math.max(...layouts.map(layout => layout.wrapperRight));
    const maxBottom = Math.max(...layouts.map(layout => layout.wrapperBottom));

    const contentWidth = Math.max(1, maxRight - minLeft);
    const contentHeight = Math.max(1, maxBottom - minTop);
    const horizontalPadding = Math.max(28, canvasSize.width * 0.06);
    const verticalPadding = Math.max(28, canvasSize.height * 0.08);
    const fitScaleX = (canvasSize.width - horizontalPadding * 2) / contentWidth;
    const fitScaleY = (canvasSize.height - verticalPadding * 2) / contentHeight;
    const nextScale = Math.max(0.45, Math.min(1.8, Math.min(fitScaleX, fitScaleY)));

    const scaledWidth = contentWidth * nextScale;
    const scaledHeight = contentHeight * nextScale;
    const translateX = (canvasSize.width - scaledWidth) / 2 - minLeft * nextScale;
    const translateY = (canvasSize.height - scaledHeight) / 2 - minTop * nextScale;

    return {
      scale: nextScale,
      translate: {
        x: Math.round(translateX),
        y: Math.round(translateY),
      },
    };
  }, [canvasSize.height, canvasSize.width, tableLayoutMap]);

  const effectiveLiveViewport = useMemo(() => ({
    scale: liveViewport.scale * liveScaleFactor,
    translate: {
      x: liveViewport.translate.x + liveTranslate.x,
      y: liveViewport.translate.y + liveTranslate.y,
    },
  }), [liveScaleFactor, liveTranslate.x, liveTranslate.y, liveViewport.scale, liveViewport.translate.x, liveViewport.translate.y]);

  const resetLiveViewport = useCallback(() => {
    setLiveScaleFactor(1);
    setLiveTranslate({ x: 0, y: 0 });
  }, []);

  const handleLiveCanvasMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (editMode || event.target !== event.currentTarget) return;
    livePanRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startTranslate: liveTranslate,
      moved: false,
    };
  }, [editMode, liveTranslate]);

  useEffect(() => {
    if (editMode) return;

    const handleMouseMove = (event: MouseEvent) => {
      if (!livePanRef.current) return;
      const dx = event.clientX - livePanRef.current.startX;
      const dy = event.clientY - livePanRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        livePanRef.current.moved = true;
        suppressLiveStageClickRef.current = true;
      }
      setLiveTranslate({
        x: livePanRef.current.startTranslate.x + dx,
        y: livePanRef.current.startTranslate.y + dy,
      });
    };

    const handleMouseUp = () => {
      if (livePanRef.current?.moved) {
        window.setTimeout(() => {
          suppressLiveStageClickRef.current = false;
        }, 0);
      }
      livePanRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [editMode]);

  const activeCombinationOverlays = useMemo(() => {
    const seenOwners = new Set<string>();

    return zoneTables.flatMap(table => {
      const displaySession = getDisplaySessionForTable(table.id);
      if (!displaySession || !displaySession.isCombinationActive || seenOwners.has(displaySession.ownerTableId)) {
        return [];
      }

      seenOwners.add(displaySession.ownerTableId);

      const memberTables = displaySession.memberTableIds
        .map(id => zoneTables.find(entry => entry.id === id))
        .filter((entry): entry is Table => Boolean(entry))
        .filter(entry => inferPlacementType(entry) === 'table');

      if (memberTables.length < 2) return [];

      const ownerTable = memberTables.find(entry => entry.id === displaySession.ownerTableId) || memberTables[0];
      const ownerDisplayMeta = getTableDisplayMeta(ownerTable);
      const ownerServerLabel = getServerBadgeLabel(displaySession.ownerTableId);
      const info = getOrderInfo(displaySession.ownerTableId);
      const totalLabel = info.total > 0
        ? `${info.total.toFixed(2)}${state.restaurant?.currency === 'EUR' ? ' €' : ` ${state.restaurant?.currency || 'EUR'}`}`
        : null;

      const badges = [
        showFloorTimeBadges && ownerDisplayMeta.nextActionLabel
          ? {
              label: ownerDisplayMeta.nextActionLabel,
              subLabel: ownerDisplayMeta.nextActionSubLabel,
              border: ownerDisplayMeta.nextActionTone === 'billing'
                ? '1px solid rgba(245,158,11,0.55)'
                : ownerDisplayMeta.nextActionTone === 'problem'
                  ? '1px solid rgba(239,68,68,0.5)'
                  : ownerDisplayMeta.nextActionTone === 'service'
                    ? '1px solid rgba(125,211,252,0.35)'
                    : '1px solid rgba(255,255,255,0.08)',
              color: ownerDisplayMeta.nextActionTone === 'billing'
                ? '#fde68a'
                : ownerDisplayMeta.nextActionTone === 'problem'
                  ? '#fecaca'
                  : '#f8fafc',
            }
          : null,
        showFloorServerBadges && ownerDisplayMeta.effectiveStatus !== 'free' && ownerServerLabel
          ? {
              label: ownerServerLabel,
              subLabel: null,
              border: '1px solid rgba(139,92,246,0.35)',
              color: '#efe5ff',
            }
          : null,
        showFloorStatusBadges && ownerDisplayMeta.effectiveStatus !== 'free' && ownerDisplayMeta.serviceStatusLabel
          ? {
              label: ownerDisplayMeta.serviceStatusLabel,
              subLabel: null,
              border: '1px solid rgba(192,132,252,0.38)',
              color: '#f5d0fe',
            }
          : null,
        showFloorMoneyBadges && totalLabel
          ? {
              label: totalLabel,
              subLabel: null,
              border: '1px solid rgba(168,85,247,0.35)',
              color: '#e9dcff',
              interactive: true,
            }
          : null,
      ].filter(Boolean) as { label: string; subLabel?: string | null; border: string; color: string; interactive?: boolean }[];

      if (badges.length === 0) return [];

      const centers = memberTables.map(memberTable => {
        const layout = tableLayoutMap[memberTable.id];
        return layout ? getTableCenter(memberTable) : null;
      }).filter((center): center is { x: number; y: number } => Boolean(center));

      if (centers.length < 2) return [];

      const tableAnchors = memberTables
        .map(memberTable => {
          const layout = tableLayoutMap[memberTable.id];
          if (!layout) return null;
          const center = getTableCenter(memberTable);
          return {
            tableId: memberTable.id,
            x: center.x,
            y: center.y,
            top: layout.wrapperVisibleTop,
            width: layout.size.w,
          };
        })
        .filter((anchor): anchor is { tableId: string; x: number; y: number; top: number; width: number } => Boolean(anchor))
        .sort((a, b) => a.x - b.x);

      if (tableAnchors.length < 2) return [];

      const minCenterX = Math.min(...centers.map(center => center.x));
      const maxCenterX = Math.max(...centers.map(center => center.x));
      const topMostTableTop = Math.min(...memberTables.map(memberTable => {
        const layout = tableLayoutMap[memberTable.id];
        return layout ? layout.wrapperVisibleTop : memberTable.y || 0;
      }));
      const anchorX = (minCenterX + maxCenterX) / 2;
      const averageBodyWidth = tableAnchors.reduce((sum, anchor) => sum + anchor.width, 0) / tableAnchors.length;
      const groupWidth = maxCenterX - minCenterX;
      const groupHeight = Math.max(...centers.map(center => center.y)) - Math.min(...centers.map(center => center.y));

      const maxBadgeWidth = Math.max(...badges.map(badge => estimateBadgeSize(badge.label, badge.subLabel).width));
      const totalBadgeHeight = badges.reduce((sum, badge) => sum + estimateBadgeSize(badge.label, badge.subLabel).height, 0) + Math.max(0, badges.length - 1) * 4;
      const kind: 'shared' | 'split' = (
        groupWidth <= Math.max(maxBadgeWidth + averageBodyWidth * 1.2, averageBodyWidth * tableAnchors.length * 1.15) &&
        groupHeight <= averageBodyWidth * 1.4
      ) ? 'shared' : 'split';
      const routeSegments = tableAnchors.slice(0, -1).map((anchor, index) => {
        const nextAnchor = tableAnchors[index + 1];
        return {
          x1: anchor.x,
          y1: anchor.y,
          x2: nextAnchor.x,
          y2: nextAnchor.y,
        };
      });

      const sharedBadge = kind === 'shared'
        ? {
            left: anchorX - maxBadgeWidth / 2,
            top: topMostTableTop - totalBadgeHeight + 4,
            width: maxBadgeWidth,
          }
        : null;

      const splitBadges = kind === 'split'
        ? tableAnchors.map(anchor => ({
            tableId: anchor.tableId,
            left: anchor.x - maxBadgeWidth / 2,
            top: anchor.top - totalBadgeHeight - 10,
            width: maxBadgeWidth,
          }))
        : [];

      return [{
        ownerTableId: displaySession.ownerTableId,
        memberTableIds: tableAnchors.map(anchor => anchor.tableId),
        kind,
        routeSegments,
        sharedBadge,
        splitBadges,
        badges,
      }];
    });
  }, [estimateBadgeSize, getDisplaySessionForTable, getOrderInfo, getServerBadgeLabel, getTableDisplayMeta, showFloorMoneyBadges, showFloorServerBadges, showFloorStatusBadges, showFloorTimeBadges, state.restaurant?.currency, tableLayoutMap, zoneTables]);

  const sharedCombinationMemberIds = useMemo(() => {
    const ids = new Set<string>();
    activeCombinationOverlays.forEach(overlay => {
      if (overlay.kind !== 'shared') return;
      overlay.memberTableIds.forEach(id => ids.add(id));
    });
    return ids;
  }, [activeCombinationOverlays]);

  const renderTableShape = (table: Table) => {
    const variant = getTableVariantConfig(table);
    const shape = variant.shape;
    const placementType = inferPlacementType(table);
    const displaySession = getDisplaySessionForTable(table.id);
    const info = getOrderInfo(table.id);
    const isSelected = selectedTable === table.id;
    const hasReservation = !!tableReservationMap[table.id];
    const reservation = tableReservationMap[table.id];
    const effectiveStatus = table.status === 'blocked'
      ? 'blocked'
      : displaySession
        ? (table.status === 'billing' ? 'billing' : 'occupied')
        : table.status;
    const isOccupied = effectiveStatus === 'occupied';
    const isBilling = effectiveStatus === 'billing';
    const isBlocked = effectiveStatus === 'blocked';
    const isActive = isOccupied || isBilling;
    const displayMeta = getTableDisplayMeta(table);
    const serverBadgeLabel = getServerBadgeLabel(table.id);
    const isBarSeat = placementType === 'bar_seat';
    const bgColor = isBlocked
      ? TABLE_STATUS_META.blocked.color
      : isOccupied
        ? TABLE_STATUS_META.occupied.color
        : isBilling
          ? TABLE_STATUS_META.billing.color
          : (hasReservation && table.status === 'free')
            ? '#0ea5e9'
            : isBarSeat
              ? '#4a4f86'
              : TABLE_STATUS_META.free.color;
    const size = getTableSize(table);
    const tableX = table.x || 0;
    const tableY = table.y || 0;
    const tableRotation = getTableRotation(table);
    const displayName = getTableLabelNumber(table);
    const isBarstool = shape === 'barstool';
    const isRound = shape === 'round' || isBarstool;
    const isDiamond = shape === 'diamond';
    const isPopupActive = !!(selectedReservationId && reservation && reservation.id === selectedReservationId);
    const isTableInspectorActive = tableManagementId === table.id;
    const draftComboSelected = comboDraftTableIds.includes(table.id);
    const focusedCombination = focusedCombinationId ? state.tableCombinations.find(combination => combination.id === focusedCombinationId) || null : null;
    const isFocusedCombinationMember = Boolean(focusedCombination?.tableIds.includes(table.id));
    const isFocusedCombinationTable = focusedCombinationTableId === table.id;
    const activeCombinationContext = getActiveCombinationContext(table.id);
    const isActiveCombinationMember = Boolean(activeCombinationContext?.memberTableIds.includes(table.id));
    const showsSharedCombinationOverlay = sharedCombinationMemberIds.has(table.id);

    // Progress bar for occupied tables (like OpenTable)
    let progressPct = 0;
    if (isActive && info.startTime > 0) {
      const elapsed = (Date.now() - info.startTime) / 60000; // minutes
      progressPct = Math.min(100, (elapsed / 90) * 100); // assume 90min dining
    }

    // Build SVG
    const svg = buildTableSvg(variant.id);
    const { body, bodyBounds, seatRects, seatAnchors, svgW, svgH } = svg;
    const totalLabel = info.total > 0
      ? `${info.total.toFixed(2)}${state.restaurant?.currency === 'EUR' ? ' €' : ` ${state.restaurant?.currency || 'EUR'}`}`
      : null;
    const hasVisibleBadges = !showsSharedCombinationOverlay && Boolean(displayMeta.nextActionLabel || totalLabel);

    const isHighlighted = highlightedTableId === table.id;
    const isLinkedInspectorTable = isPopupActive || isTableInspectorActive;
    const isMoveSelectionSource = moveSelection?.fromTableId === table.id;
    const isMoveSelectionTarget = Boolean(moveSelection) && !isMoveSelectionSource && table.status === 'free';
    const isMoveSelectionBlocked = Boolean(moveSelection) && !isMoveSelectionSource && table.status !== 'free';

    const wrapperStyle: React.CSSProperties = {
      position: 'absolute',
      left: tableX - bodyBounds.x,
      top: tableY - bodyBounds.y,
      width: svgW,
      height: svgH,
      cursor: editMode ? (editorMode === 'combos' ? 'pointer' : 'grab') : moveSelection ? (isMoveSelectionTarget ? 'pointer' : 'not-allowed') : 'pointer',
      zIndex: isSelected || isHighlighted || isLinkedInspectorTable || isMoveSelectionSource || isMoveSelectionTarget || draftComboSelected || isFocusedCombinationMember || isFocusedCombinationTable
        ? 10
        : hasVisibleBadges || isActiveCombinationMember || isActive
          ? 6
          : 1,
      transform: `rotate(${tableRotation}deg)`,
      transformOrigin: `${bodyBounds.x + size.w / 2}px ${bodyBounds.y + size.h / 2}px`,
      filter: isSelected
        ? `drop-shadow(0 0 12px ${displayMeta.statusMeta.glow})`
        : isMoveSelectionSource
          ? 'drop-shadow(0 0 14px rgba(251,191,36,0.32)) brightness(1.08)'
          : isMoveSelectionTarget
            ? 'drop-shadow(0 0 14px rgba(96,165,250,0.28)) brightness(1.12)'
            : draftComboSelected
              ? 'drop-shadow(0 0 14px rgba(96,165,250,0.26)) brightness(1.08)'
              : isFocusedCombinationMember
                ? 'drop-shadow(0 0 14px rgba(168,85,247,0.22)) brightness(1.04)'
        : isHighlighted
          ? 'drop-shadow(0 0 12px rgba(236,72,153,0.8)) brightness(1.2)'
          : isLinkedInspectorTable
            ? 'drop-shadow(0 0 12px rgba(168,85,247,0.45)) brightness(1.08)'
            : isActiveCombinationMember
              ? 'drop-shadow(0 0 10px rgba(96,165,250,0.18))'
          : 'none',
      opacity: isMoveSelectionBlocked ? 0.38 : 1,
      transition: dragRef.current?.tableId === table.id || rotateRef.current?.tableId === table.id ? 'none' : 'filter 0.15s',
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
        {/* SVG table shape */}
        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="absolute inset-0">
          {seatRects.map((seatRect, index) => {
            const seatNumber = index + 1;
            const { isActiveSeat, seatAssignment } = getSeatDisplayStateForTable(table.id, seatNumber);
            const hasProfile = Boolean(seatAssignment?.guestName);
            const fill = hasProfile ? '#dbeafe' : isActiveSeat ? '#f8fafc' : '#28274C';
            const stroke = hasProfile
              ? 'rgba(96,165,250,0.95)'
              : isActiveSeat
                ? 'rgba(255,255,255,0.35)'
                : undefined;
            return renderRectSvg(seatRect, fill, `${table.id}-seat-${index}`, stroke, stroke ? 1 : undefined);
          })}
          {body.kind === 'circle' ? (
            <circle cx={body.cx} cy={body.cy} r={body.r} fill={bgColor} />
          ) : (
            renderRectSvg(body, bgColor, `${table.id}-body`)
          )}
        </svg>
        {seatRects.map((seatRect, index) => {
          const seatNumber = index + 1;
          const { globalSeatNumber, isActiveSeat, seatAssignment } = getSeatDisplayStateForTable(table.id, seatNumber);
          const hasProfile = Boolean(seatAssignment?.guestName);
          const seat = seatAnchors[index];
          const hitPadding = 3;
          return (
            <button
              key={`seat-${table.id}-${index}`}
              type="button"
              onMouseDown={event => event.stopPropagation()}
              onTouchStart={event => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                if (!seatAssignmentEnabled || !isActiveSeat || editMode) return;
                handleSeatCircleClick(table.id, globalSeatNumber, hasProfile, {
                  x: seat.x,
                  y: seat.y,
                });
              }}
              className={'absolute transition-all ' + (seatAssignmentEnabled && isActiveSeat && !editMode ? 'cursor-pointer hover:scale-105' : 'pointer-events-none')}
              style={{
                left: seatRect.x - hitPadding,
                top: seatRect.y - hitPadding,
                width: seatRect.width + hitPadding * 2,
                height: seatRect.height + hitPadding * 2,
                background: 'transparent',
                border: 'none',
                boxShadow: 'none',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: Math.max(10, seatRect.rx + hitPadding),
              }}
              aria-label={`Sitz ${globalSeatNumber}`}
            >
              {hasProfile && (
                <span className="block text-center text-[8px] font-bold leading-none text-[#1e3a8a]">
                  {seatAssignment?.guestName?.trim().charAt(0).toUpperCase()}
                </span>
              )}
            </button>
          );
        })}
        {seatAssignmentEnabled && seatQuickAction?.tableId === table.id && (
          <div
            className="absolute z-20 flex items-center gap-1 rounded-lg border border-white/[0.08] px-1.5 py-1 shadow-xl"
            style={{
              left: seatQuickAction.x + 18,
              top: seatQuickAction.y - 14,
              background: 'rgba(15,23,42,0.94)',
            }}
            onClick={event => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => clearSeatGuestAssignmentDirect(seatQuickAction.tableId, seatQuickAction.seatNumber)}
              className="rounded-md px-2 py-1 text-[11px] font-semibold text-[#fecaca] transition-colors hover:bg-white/[0.06]"
            >
              Entfernen
            </button>
            <button
              type="button"
              onClick={() => openSeatInspector(seatQuickAction.tableId, seatQuickAction.seatNumber)}
              className="rounded-md px-2 py-1 text-[11px] font-semibold text-[#d8c7ff] transition-colors hover:bg-white/[0.06]"
            >
              Wechseln
            </button>
          </div>
        )}
        {/* Selection borders */}
        {isSelected && editMode && (
          <div className="absolute pointer-events-none" style={{
            left: bodyBounds.x - 2, top: bodyBounds.y - 2, width: size.w + 4, height: size.h + 4,
            border: '2px solid #a78bfa', borderRadius: isRound ? '50%' : isDiamond ? 8 : 10,
          }} />
        )}
        {isLinkedInspectorTable && !editMode && (
          <div className="absolute pointer-events-none" style={{
            left: bodyBounds.x - 2, top: bodyBounds.y - 2, width: size.w + 4, height: size.h + 4,
            border: isPopupActive ? '2px solid #ffffff' : '2px solid rgba(168,85,247,0.9)',
            boxShadow: isPopupActive ? 'none' : '0 0 18px rgba(168,85,247,0.22)',
            borderRadius: isRound ? '50%' : isDiamond ? 8 : 10,
          }} />
        )}
        {isMoveSelectionSource && !editMode && (
          <div className="absolute pointer-events-none" style={{
            left: bodyBounds.x - 3, top: bodyBounds.y - 3, width: size.w + 6, height: size.h + 6,
            border: '2px solid rgba(251,191,36,0.92)',
            boxShadow: '0 0 18px rgba(251,191,36,0.18)',
            borderRadius: isRound ? '50%' : isDiamond ? 8 : 10,
          }} />
        )}
        {isMoveSelectionTarget && !editMode && (
          <div className="absolute pointer-events-none" style={{
            left: bodyBounds.x - 3, top: bodyBounds.y - 3, width: size.w + 6, height: size.h + 6,
            border: '2px solid rgba(96,165,250,0.95)',
            boxShadow: '0 0 18px rgba(96,165,250,0.18)',
            borderRadius: isRound ? '50%' : isDiamond ? 8 : 10,
          }} />
        )}
        {editMode && editorMode === 'combos' && (draftComboSelected || isFocusedCombinationMember || isFocusedCombinationTable) && (
          <div className="absolute pointer-events-none" style={{
            left: bodyBounds.x - 3,
            top: bodyBounds.y - 3,
            width: size.w + 6,
            height: size.h + 6,
            border: draftComboSelected
              ? '2px solid rgba(96,165,250,0.95)'
              : isFocusedCombinationTable
                ? '2px solid rgba(255,255,255,0.9)'
                : '2px solid rgba(168,85,247,0.82)',
            boxShadow: draftComboSelected
              ? '0 0 18px rgba(96,165,250,0.18)'
              : '0 0 16px rgba(168,85,247,0.14)',
            borderRadius: isRound ? '50%' : isDiamond ? 8 : 10,
          }} />
        )}
        {editMode && editorMode !== 'combos' && isSelected && (
          <button
            type="button"
            onMouseDown={event => startRotationDrag(event, table.id)}
            onTouchStart={event => startRotationDrag(event, table.id)}
            className="absolute z-20 flex items-center justify-center rounded-full border border-[#b79bff] bg-[#241f3d] text-[#e9dcff] shadow-[0_0_0_1px_rgba(139,92,246,0.22),0_10px_28px_rgba(12,11,24,0.35)]"
            style={{
              left: bodyBounds.x + size.w + ROTATION_HANDLE_OFFSET - ROTATION_HANDLE_SIZE / 2,
              top: bodyBounds.y + size.h / 2 - ROTATION_HANDLE_SIZE / 2,
              width: ROTATION_HANDLE_SIZE,
              height: ROTATION_HANDLE_SIZE,
              cursor: 'grab',
            }}
            aria-label="Tisch drehen"
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '999px',
                background: '#7dd3fc',
              }}
            />
          </button>
        )}
        {/* Overlay: table info (positioned on table body area) */}
        <div className="absolute flex flex-col items-center justify-center pointer-events-none"
          style={{
            left: bodyBounds.x,
            top: bodyBounds.y,
            width: size.w,
            height: size.h,
            transform: `rotate(${-tableRotation}deg)`,
            transformOrigin: 'center',
          }}>
          {!isBlocked && !isBarstool && (
            <div
              className="absolute"
              style={{
                top: isRound ? 12 : 10,
                left: '16%',
                right: '16%',
                height: 3,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.16)',
              }}
            >
              <div
                style={{
                  width: isActive ? `${Math.max(8, progressPct)}%` : '0%',
                  height: '100%',
                  borderRadius: 999,
                  background: '#fff',
                  transition: 'width 1s ease',
                }}
              />
            </div>
          )}
          <span className="font-bold leading-none select-none" style={{
            color: '#fff',
            fontSize: isBarstool ? 9 : isDiamond ? 12 : 14,
            marginTop: isBarstool ? 0 : isRound ? 6 : 4,
            textShadow: '0 1px 2px rgba(0,0,0,0.28)',
          }}>
            {displayName}
          </span>
          {isBarSeat && !isBarstool && (
            <span
              className="absolute bottom-[6px] text-[8px] font-semibold uppercase tracking-[0.18em] text-[#c9d4ff]"
              style={{ opacity: 0.88 }}
            >
              Bar
            </span>
          )}
        </div>
        {!showsSharedCombinationOverlay && ((showFloorTimeBadges && displayMeta.nextActionLabel) || (showFloorServerBadges && isActive && serverBadgeLabel) || (showFloorMoneyBadges && totalLabel) || (showFloorStatusBadges && isActive && displayMeta.serviceStatusLabel)) && (() => {
          const badges = [
            showFloorTimeBadges && displayMeta.nextActionLabel
              ? {
                  label: displayMeta.nextActionLabel,
                  subLabel: displayMeta.nextActionSubLabel,
                  border: displayMeta.nextActionTone === 'billing'
                    ? '1px solid rgba(245,158,11,0.55)'
                    : displayMeta.nextActionTone === 'problem'
                      ? '1px solid rgba(239,68,68,0.5)'
                      : displayMeta.nextActionTone === 'service'
                        ? '1px solid rgba(125,211,252,0.35)'
                        : '1px solid rgba(255,255,255,0.08)',
                  color: displayMeta.nextActionTone === 'billing'
                    ? '#fde68a'
                    : displayMeta.nextActionTone === 'problem'
                      ? '#fecaca'
                      : '#f8fafc',
                }
              : null,
            showFloorServerBadges && isActive && serverBadgeLabel
              ? {
                  label: serverBadgeLabel,
                  subLabel: null,
                  border: '1px solid rgba(139,92,246,0.35)',
                  color: '#efe5ff',
                }
              : null,
            showFloorStatusBadges && isActive && displayMeta.serviceStatusLabel
              ? {
                  label: displayMeta.serviceStatusLabel,
                  subLabel: null,
                  border: '1px solid rgba(192,132,252,0.38)',
                  color: '#f5d0fe',
                }
              : null,
            showFloorMoneyBadges && totalLabel
              ? {
                  label: totalLabel,
                  subLabel: null,
                  border: '1px solid rgba(168,85,247,0.35)',
                  color: '#e9dcff',
                  interactive: true,
                }
              : null,
          ].filter(Boolean) as { label: string; subLabel?: string | null; border: string; color: string; interactive?: boolean }[];

          const maxBadgeWidth = Math.max(...badges.map(badge => estimateBadgeSize(badge.label, badge.subLabel).width));
          const totalBadgeHeight = badges.reduce((sum, badge) => sum + estimateBadgeSize(badge.label, badge.subLabel).height, 0) + Math.max(0, badges.length - 1) * 4;
          const left = bodyBounds.x + size.w / 2 - maxBadgeWidth / 2;
          const top = bodyBounds.y - totalBadgeHeight + 6;

          return (
            <div
              className="absolute flex flex-col items-center gap-1"
              style={{
                left,
                top,
                width: maxBadgeWidth,
                transform: `rotate(${-tableRotation}deg)`,
                transformOrigin: 'center',
                zIndex: 30,
                pointerEvents: 'auto',
              }}
            >
              {badges.map(badge => {
                const badgeSize = estimateBadgeSize(badge.label, badge.subLabel);
                return (
                  <div
                    key={`${table.id}-${badge.label}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: badge.subLabel ? 4 : 0,
                      width: badgeSize.width,
                    }}
                  >
                    <div
                      className={badge.interactive && !editMode ? 'cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(139,92,246,0.28)] active:scale-[0.98]' : ''}
                      onClick={badge.interactive && !editMode ? event => {
                        event.stopPropagation();
                        handleTableClick(table);
                      } : undefined}
                      title={badge.interactive && !editMode ? 'POS öffnen' : undefined}
                      style={{
                        background: 'rgba(15,23,42,0.82)',
                        border: badge.border,
                        borderRadius: 8,
                        minWidth: 0,
                        width: badgeSize.width,
                        height: 20,
                        padding: '3px 10px',
                        textAlign: 'center',
                        boxShadow: badge.interactive
                          ? '0 8px 24px rgba(76,29,149,0.22)'
                          : '0 8px 22px rgba(2,6,23,0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div
                        style={{
                          color: badge.color,
                          fontSize: 10,
                          fontWeight: 700,
                          lineHeight: '12px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {badge.label}
                      </div>
                    </div>
                    {badge.subLabel && (
                      <div
                        style={{
                          background: 'rgba(15,23,42,0.82)',
                          border: '1px solid rgba(125,211,252,0.2)',
                          borderRadius: 8,
                          minWidth: 0,
                          width: badgeSize.width,
                          height: 18,
                          padding: '2px 10px',
                          textAlign: 'center',
                          boxShadow: '0 8px 22px rgba(2,6,23,0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <div
                          style={{
                            color: '#eef1fb',
                            fontSize: 9,
                            fontWeight: 700,
                            lineHeight: '11px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {badge.subLabel}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    );
  };

  const currentZone = state.zones.find(z => z.id === activeZone);
  const currentZoneIdx = state.zones.findIndex(z => z.id === activeZone);
  const handleCanvasViewportMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!editMode || editorMode === 'combos' || editorTool !== 'move' || e.target !== e.currentTarget) return;
    canvasPanRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startTranslate: translate,
    };
  }, [editMode, editorMode, editorTool, translate]);

  useEffect(() => {
    if (!editMode || editorMode === 'combos' || editorTool !== 'move') return;
    const handleMouseMove = (event: MouseEvent) => {
      if (!canvasPanRef.current || dragRef.current) return;
      const dx = event.clientX - canvasPanRef.current.startX;
      const dy = event.clientY - canvasPanRef.current.startY;
      setTranslate({
        x: canvasPanRef.current.startTranslate.x + dx,
        y: canvasPanRef.current.startTranslate.y + dy,
      });
    };
    const handleMouseUp = () => {
      canvasPanRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [editMode, editorMode, editorTool]);

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
    const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
    setPressedReservationId(r.id);
    const targetTableId = r.tableId || (r.__isSessionItem ? r.__sessionTableId : undefined);
    if (targetTableId) {
      setHighlightedTableId(targetTableId);
      window.setTimeout(() => setHighlightedTableId(null), 1200);
    }
    window.setTimeout(() => {
      setPressedReservationId(current => (current === r.id ? null : current));
    }, 160);

    if (r.__isSessionItem && r.__sessionTableId) {
      if (tableManagementId === r.__sessionTableId) {
        closeGuestPanel();
        return;
      }
      if (isMobileViewport) setShowSidebar(false);
      openTableManagementInspector(r.__sessionTableId);
      return;
    }

    if (selectedReservationId === r.id) {
      closeGuestPanel();
      return;
    }
    if (isMobileViewport) setShowSidebar(false);
    openReservationInspector(r);
  };

  const openSeatInspector = useCallback((tableId: string, seatNumber: number) => {
    setSelectedReservationId(null);
    setShowWaitlist(false);
    setShowReservationCreatePanel(false);
    setTableManagementId(null);
    setResDetailId(null);
    setShowGuestProfileView(false);
    setSeatQuickAction(null);
    setSeatInspector({ tableId, seatNumber });
    setSeatGuestSearch('');
    setSeatGuestName('');
    setSeatGuestPhone('');
  }, []);

  const handleSeatCircleClick = useCallback((tableId: string, seatNumber: number, hasAssignment: boolean, position: { x: number; y: number }) => {
    if (hasAssignment) {
      setSeatQuickAction(current => (
        current?.tableId === tableId && current.seatNumber === seatNumber
          ? null
          : { tableId, seatNumber, x: position.x, y: position.y }
      ));
      return;
    }

    openSeatInspector(tableId, seatNumber);
  }, [openSeatInspector]);

  const assignGuestToSeat = useCallback((guest: Guest) => {
    if (!seatInspector) return;
    dispatch({
      type: 'ASSIGN_SEAT_GUEST',
      tableId: seatInspector.tableId,
      seatNumber: seatInspector.seatNumber,
      guestId: guest.id,
      guestName: guest.name,
    });
    setSeatGuestSearch('');
    setSeatGuestName('');
    setSeatGuestPhone('');
  }, [dispatch, seatInspector]);

  const handleCreateSeatGuest = useCallback(() => {
    if (!seatInspector) return;
    const name = seatGuestName.trim() || seatGuestSearch.trim();
    if (!name) return;
    const newGuest: Guest = {
      id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      name,
      phone: seatGuestPhone.trim() || undefined,
      tags: [],
      notes: [],
      visits: [],
      totalVisits: 0,
      totalSpend: 0,
      createdAt: Date.now(),
    };
    addGuest(newGuest);
    dispatch({
      type: 'ASSIGN_SEAT_GUEST',
      tableId: seatInspector.tableId,
      seatNumber: seatInspector.seatNumber,
      guestId: newGuest.id,
      guestName: newGuest.name,
    });
    setSeatGuestSearch('');
    setSeatGuestName('');
    setSeatGuestPhone('');
  }, [dispatch, seatGuestName, seatGuestPhone, seatGuestSearch, seatInspector]);

  const clearSeatGuestAssignment = useCallback(() => {
    if (!seatInspector) return;
    dispatch({ type: 'CLEAR_SEAT_GUEST', tableId: seatInspector.tableId, seatNumber: seatInspector.seatNumber });
  }, [dispatch, seatInspector]);

  const clearSeatGuestAssignmentDirect = useCallback((tableId: string, seatNumber: number) => {
    dispatch({ type: 'CLEAR_SEAT_GUEST', tableId, seatNumber });
    setSeatQuickAction(null);
  }, [dispatch]);

  // Get selected reservation object
  const selectedReservation = useMemo(() => {
    if (!selectedReservationId) return null;
    return reservations.find(r => r.id === selectedReservationId) || null;
  }, [selectedReservationId, reservations]);

  const seatInspectorTable = useMemo(() => {
    if (!seatInspector) return null;
    return state.tables.find(table => table.id === seatInspector.tableId) || null;
  }, [seatInspector, state.tables]);

  const seatInspectorSession = useMemo(() => {
    if (!seatInspector) return null;
    return state.sessions[seatInspector.tableId] || null;
  }, [seatInspector, state.sessions]);

  const seatInspectorAssignment = useMemo(() => {
    if (!seatInspectorSession || !seatInspector) return null;
    return seatInspectorSession.seatAssignments?.find(assignment => assignment.seatNumber === seatInspector.seatNumber) || null;
  }, [seatInspector, seatInspectorSession]);

  const seatInspectorGuests = useMemo(() => {
    const guests = loadGuests();
    const query = seatGuestSearch.trim().toLowerCase();
    if (!query) return guests.slice(0, 8);
    return guests
      .filter(guest =>
        guest.name.toLowerCase().includes(query) ||
        guest.phone?.toLowerCase().includes(query) ||
        guest.email?.toLowerCase().includes(query)
      )
      .slice(0, 8);
  }, [seatGuestSearch]);

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

  useEffect(() => {
    if (!sidebarSortMenuOpen) return;
    const handleDocumentClick = () => setSidebarSortMenuOpen(null);
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [sidebarSortMenuOpen]);

  // OpenTable sidebar render - 1:1 match with Reservations card design
  const renderSidebarCard = (r: SidebarPlacedItem, _showDuration: boolean) => {
    const sourceColor = SOURCE_COLORS[r.source] || '#8888aa';
    const SourceIcon = SOURCE_ICONS[r.source] || IconUsers;
    const confirmationStatus = r.confirmationStatus ?? 'confirmed';
    const ConfirmationIcon = confirmationStatus === 'pending' ? IconClock : IconCheck;
    const confirmationColor = confirmationStatus === 'pending' ? '#f8b84e' : '#ecfdf5';

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
    const walkInServiceStatus = sessionForCard?.serviceStatus;
    const walkInServiceIconState =
      r.__isSessionItem && walkInServiceStatus && !['teilweise_platziert', 'platziert'].includes(walkInServiceStatus)
        ? 'served'
        : 'waiting';
    const WalkInServiceIcon = walkInServiceIconState === 'served' ? IconUserCheck : IconClock;
    const walkInServiceColor = walkInServiceIconState === 'served' ? '#ecfdf5' : '#f8b84e';

    return (
      <div key={r.id} style={{ marginBottom: '1px', padding: '0 4px' }}>
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
          <div className="shrink-0 flex flex-col items-center justify-center gap-[3px]" style={{ background: sourceColor, width: '26px' }}>
            {!r.__isSessionItem ? (
              <button
                type="button"
                className={
                  'flex h-[10px] w-[10px] items-center justify-center rounded-full transition-transform ' +
                  (confirmationStatus === 'pending' ? 'hover:scale-110 cursor-pointer' : 'cursor-default')
                }
                style={{
                  background: confirmationStatus === 'pending' ? 'rgba(31, 22, 56, 0.28)' : 'rgba(255, 255, 255, 0.16)',
                  boxShadow: confirmationStatus === 'pending'
                    ? '0 0 0 1px rgba(248,184,78,0.25)'
                    : '0 0 0 1px rgba(255,255,255,0.12)',
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (confirmationStatus === 'pending') openReservationInspector(r);
                }}
                aria-label={confirmationStatus === 'pending' ? 'Reservierung offen, Kommunikation öffnen' : 'Reservierung bestätigt'}
              >
                <ConfirmationIcon size={8} color={confirmationColor} stroke={2.25} />
              </button>
            ) : (
              <div
                className="flex h-[10px] w-[10px] items-center justify-center rounded-full"
                style={{
                  background: walkInServiceIconState === 'served' ? 'rgba(20, 66, 49, 0.32)' : 'rgba(31, 22, 56, 0.28)',
                  boxShadow: walkInServiceIconState === 'served'
                    ? '0 0 0 1px rgba(34,197,94,0.18)'
                    : '0 0 0 1px rgba(248,184,78,0.22)',
                }}
                aria-label={walkInServiceIconState === 'served' ? 'Serviert' : 'Wartet auf Service'}
              >
                <WalkInServiceIcon size={8} color={walkInServiceColor} stroke={2.25} />
              </div>
            )}
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
                    {r.__isSessionItem && state.currentUser?.name && (
                      <>
                        <span className="text-[#6f7695]">·</span>
                        <span className="text-[#8f97b3] font-medium">
                          {state.currentUser.name}
                        </span>
                      </>
                    )}
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
                <button
                  type="button"
                  className="flex h-[38px] min-w-[64px] items-center justify-center bg-[#9333ea] px-2 transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{ borderRadius: 0 }}
                  onMouseDown={event => event.stopPropagation()}
                  onTouchStart={event => event.stopPropagation()}
                  onClick={event => {
                    event.stopPropagation();
                    if (assignedTable) {
                      handleTableClick(assignedTable);
                      return;
                    }
                    if (r.__sessionTableId) {
                      dispatch({ type: 'SET_ACTIVE_TABLE', tableId: r.__sessionTableId });
                    }
                  }}
                  aria-label={`POS fuer ${detailLabel} oeffnen`}
                >
                  <span className="text-[11px] font-bold leading-none text-white">
                    {sessionTotal.toFixed(2)} €
                  </span>
                </button>
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

    const handleStartWaitlistPlacement = (waitlistEntry: WaitlistEntry) => {
      const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
      setPendingWaitlistPlacement({
        entryId: waitlistEntry.id,
        guestName: waitlistEntry.guestName,
        partySize: waitlistEntry.partySize,
      });
      setActiveWaitlistCardId(null);
      setShowWaitlist(false);
      closeGuestPanel();
      if (isMobileViewport) {
        setShowSidebar(false);
      }
    };

    return (
      <div key={entry.id} style={{ marginBottom: '1px', padding: '0 4px' }}>
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
              onClick={() => handleStartWaitlistPlacement(entry)}
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
    setSeatQuickAction(null);
    closeSeatInspector();
    clearPersistedInspector();
  };

  const openReservationCreateFromSidebar = useCallback(() => {
    const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
    setPendingWaitlistPlacement(null);

    if (isMobileViewport) {
      closeGuestPanel();
      setResDetailId(null);
      setTableManagementId(null);
      setShowWaitlist(false);
    } else {
      setShowWaitlist(false);
      setSelectedReservationId(null);
      setGuestProfileGuest(null);
      clearPersistedInspector();
    }

    setShowReservationCreatePanel(true);
  }, [clearPersistedInspector]);

  const openWaitlistFromSidebar = useCallback(() => {
    const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
    setPendingWaitlistPlacement(null);

    if (isMobileViewport) {
      closeGuestPanel();
      setResDetailId(null);
      setTableManagementId(null);
      setShowReservationCreatePanel(false);
    } else {
      setShowReservationCreatePanel(false);
      setSelectedReservationId(null);
      setGuestProfileGuest(null);
      clearPersistedInspector();
    }

    setShowWaitlist(true);
  }, [clearPersistedInspector]);

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

  const renderSeatInspector = () => {
    if (!seatAssignmentEnabled) return null;
    if (!seatInspector || !seatInspectorTable || !seatInspectorSession) return null;

    const maxAssignableSeat = Math.max(0, seatInspectorSession.guestCount || 0);
    const isAssignable = seatInspector.seatNumber <= maxAssignableSeat;
    const assignedGuest = seatInspectorAssignment?.guestId
      ? loadGuests().find(guest => guest.id === seatInspectorAssignment.guestId) || null
      : null;

    return (
      <div className="flex flex-col h-full overflow-hidden" style={{ width: 300, minWidth: 300, background: '#1f1e33', borderLeft: '1px solid var(--vilo-border-subtle)' }}>
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: '#2a2a42' }}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f97b3]">Sitzplatz</p>
            <p className="mt-0.5 text-[16px] font-bold text-white">
              {seatInspectorTable.name.replace(/^[A-Za-z]+\s*/, '') || seatInspectorTable.name} · Sitz {seatInspector.seatNumber}
            </p>
          </div>
          <button onClick={closeSeatInspector} className="ml-3 p-1 text-vilo-text-secondary hover:text-vilo-text-primary shrink-0">
            <IconX className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <SurfaceCard className="px-4 py-4">
            <div className="text-[#eef1fb] text-[13px] font-semibold">Zugewiesener Gast</div>
            <div className="mt-1 text-[16px] font-bold text-white">{seatInspectorAssignment?.guestName || 'Noch kein Profil zugewiesen'}</div>
            {assignedGuest?.phone && (
              <div className="mt-1 flex items-center gap-2 text-[12px] font-medium text-[#d8c7ff]">
                <IconPhone className="w-4 h-4 shrink-0" />
                <span className="truncate">{assignedGuest.phone}</span>
              </div>
            )}
          </SurfaceCard>

          {isAssignable && (
            <>
              <SurfaceCard className="px-4 py-4 space-y-3">
                <div className="text-[#eef1fb] text-[13px] font-semibold">Gast suchen</div>
                <input
                  type="text"
                  value={seatGuestSearch}
                  onChange={event => setSeatGuestSearch(event.target.value)}
                  placeholder="Name, Telefon, E-Mail"
                  className="w-full bg-[#161526] px-4 py-3 text-[13px] text-white outline-none border border-vilo-border-subtle focus:border-[#8b5cf6] placeholder:text-[#8f97b3]"
                />
                <div className="space-y-2">
                  {seatInspectorGuests.map(guest => (
                    <button
                      key={guest.id}
                      onClick={() => assignGuestToSeat(guest)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-3 text-left bg-[#1c1b30] hover:bg-[#26243d] transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-white">{guest.name}</p>
                        <p className="truncate text-[11px] text-[#8f97b3]">{guest.phone || guest.email || `${guest.totalVisits} Besuche`}</p>
                      </div>
                      <IconChevronRight className="w-4 h-4 text-[#8f97b3] shrink-0" />
                    </button>
                  ))}
                  {seatInspectorGuests.length === 0 && (
                    <p className="text-[12px] text-[#8f97b3]">Keine passenden Gäste gefunden.</p>
                  )}
                </div>
              </SurfaceCard>

              <SurfaceCard className="px-4 py-4 space-y-3">
                <div className="text-[#eef1fb] text-[13px] font-semibold">Neuen Gast anlegen</div>
                <input
                  type="text"
                  value={seatGuestName}
                  onChange={event => setSeatGuestName(event.target.value)}
                  placeholder="Name"
                  className="w-full bg-[#161526] px-4 py-3 text-[13px] text-white outline-none border border-vilo-border-subtle focus:border-[#8b5cf6] placeholder:text-[#8f97b3]"
                />
                <input
                  type="text"
                  value={seatGuestPhone}
                  onChange={event => setSeatGuestPhone(event.target.value)}
                  placeholder="Telefon (optional)"
                  className="w-full bg-[#161526] px-4 py-3 text-[13px] text-white outline-none border border-vilo-border-subtle focus:border-[#8b5cf6] placeholder:text-[#8f97b3]"
                />
                <ActionButton
                  onClick={handleCreateSeatGuest}
                  disabled={!(seatGuestName.trim() || seatGuestSearch.trim())}
                  icon={<IconUserPlus className="w-5 h-5" />}
                  className="disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Gast anlegen und zuweisen
                </ActionButton>
              </SurfaceCard>

              {seatInspectorAssignment && (
                <ActionButton
                  onClick={clearSeatGuestAssignment}
                  variant="secondary"
                  className="text-[#d7d3ea]"
                >
                  Zuweisung entfernen
                </ActionButton>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderRightPanel = () => {
    if (!selectedReservation) return null;
    const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
    const floorInspectorWidth = isMobileViewport && !showSidebar ? 'calc(100vw - 68px)' : 320;
    if (showGuestProfileView && guestProfileGuest) {
      return (
        <div
          className="relative flex flex-col h-full overflow-hidden"
          style={{
            width: floorInspectorWidth,
            minWidth: floorInspectorWidth,
            maxWidth: floorInspectorWidth,
            background: '#1f1e33',
            borderLeft: '1px solid var(--vilo-border-subtle)',
          }}
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
      return ids.map(id => {
        const table = state.tables.find(t => t.id === id);
        return table ? getTableDisplayLabel(table) : '';
      }).filter(Boolean).join(', ');
    })();
    const tableName = tableNames || 'Kein Platz';
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
    const sectionLabelClass = 'mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f97b3]';
    const textInputClass = 'w-full bg-vilo-card px-4 py-3 text-[13px] text-white outline-none placeholder:text-vilo-text-muted';
    const getPickerButtonClass = (active: boolean) => (
      'flex min-h-[48px] items-center justify-center px-3 text-[13px] font-semibold transition-colors ' +
      (active
        ? 'bg-[#8b5cf6] text-white'
        : 'bg-vilo-card text-vilo-text-soft hover:bg-vilo-elevated')
    );
    const applyPartySize = (partySize: number) => {
      const updated = reservations.map(res => res.id === r.id ? { ...res, partySize } : res);
      setReservations(updated);
      saveStorage({ ...loadStorage(), reservations: updated } as never);
      setShowPartySizeOverlay(false);
    };
    const applyDuration = (duration: number) => {
      const updated = reservations.map(res => res.id === r.id ? { ...res, duration } : res);
      setReservations(updated);
      saveStorage({ ...loadStorage(), reservations: updated } as never);
      setShowDurationOverlay(false);
    };

    return (
      <div
        className="relative flex flex-col h-full overflow-y-auto"
        style={{
          width: floorInspectorWidth,
          minWidth: floorInspectorWidth,
          maxWidth: floorInspectorWidth,
          background: '#1f1e33',
          borderLeft: '1px solid var(--vilo-border-subtle)',
        }}
      >
        {/* Status header */}
        <div className="border-b px-4 py-3" style={{ borderColor: '#2a2a42' }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f97b3]">Reservierung</p>
            </div>
            <button
              onClick={closeGuestPanel}
              className="flex h-9 w-9 items-center justify-center text-vilo-text-secondary transition-colors hover:text-white"
              aria-label="Schliessen"
            >
              <IconX className="h-5 w-5" />
            </button>
          </div>
        </div>
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
            <div className="absolute top-full left-0 right-0 z-50 border border-vilo-border-subtle shadow-xl overflow-hidden max-h-[360px] overflow-y-auto mt-1" style={{ background: '#2a2944', borderRadius: 0 }}>
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
                  className="border border-vilo-border-strong bg-vilo-card px-3 py-3 flex items-center justify-center"
                  style={{ borderRadius: 0 }}
                >
                  <span className="text-[#eef1fb] text-[12px] font-semibold">{r.time}</span>
                </div>
                <button
                  onClick={() => setShowPartySizeOverlay(true)}
                  className="border border-vilo-border-strong bg-vilo-card px-3 py-3 flex items-center justify-center text-left transition-colors hover:bg-vilo-surface active:bg-vilo-elevated"
                  style={{ borderRadius: 0 }}
                >
                  <span className="text-[#eef1fb] text-[12px] font-semibold">{r.partySize} P.</span>
                </button>
                <button
                  onClick={() => setShowDurationOverlay(true)}
                  className="border border-vilo-border-strong bg-vilo-card px-3 py-3 flex items-center justify-center text-left transition-colors hover:bg-vilo-surface active:bg-vilo-elevated"
                  style={{ borderRadius: 0 }}
                >
                  <span className="text-[#eef1fb] text-[12px] font-semibold">{Math.floor(r.duration / 60) > 0 ? `${Math.floor(r.duration / 60)}h ${r.duration % 60}m` : `${r.duration}m`}</span>
                </button>
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
                  <div className="text-[#c4b5fd] text-[11px]">Kein Platz zugewiesen</div>
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
            <button className="w-full text-left px-3 py-3 flex items-center justify-between hover:brightness-110 transition-all border-b border-vilo-border-subtle">
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
              <div className="overflow-hidden border-y border-vilo-border-subtle">
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

        {showPartySizeOverlay && (
          <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/20" onClick={() => setShowPartySizeOverlay(false)}>
            <div className="border-t border-[#2a2a42] bg-[#1f1d33] px-4 py-4" onClick={e => e.stopPropagation()}>
              <p className={sectionLabelClass}>Anzahl Gäste</p>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <button key={n} onClick={() => applyPartySize(n)} className={getPickerButtonClass(r.partySize === n)}>
                    {n}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                placeholder="Andere Anzahl..."
                className={`${textInputClass} mt-2`}
                value={r.partySize > 8 ? r.partySize : ''}
                onChange={e => {
                  const val = parseInt(e.target.value);
                  if (val > 0) {
                    const updated = reservations.map(res => res.id === r.id ? { ...res, partySize: val } : res);
                    setReservations(updated);
                    saveStorage({ ...loadStorage(), reservations: updated } as never);
                  }
                }}
                onBlur={e => {
                  const val = parseInt(e.target.value);
                  if (val > 0) {
                    applyPartySize(val);
                  } else {
                    setShowPartySizeOverlay(false);
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const val = parseInt((e.target as HTMLInputElement).value);
                    if (val > 0) applyPartySize(val);
                  }
                }}
              />
            </div>
          </div>
        )}

        {showDurationOverlay && (
          <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/20" onClick={() => setShowDurationOverlay(false)}>
            <div className="border-t border-[#2a2a42] bg-[#1f1d33] px-4 py-4" onClick={e => e.stopPropagation()}>
              <p className={sectionLabelClass}>Dauer</p>
              <div className="grid grid-cols-3 gap-2">
                {[60, 90, 120, 150, 180].map(duration => (
                  <button key={duration} onClick={() => applyDuration(duration)} className={getPickerButtonClass(r.duration === duration)}>
                    {duration}m
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSidebar = () => {
    if (editMode) return null;
    const forceCompactSidebar = typeof window !== 'undefined' && window.innerWidth < 768 && (showReservationCreatePanel || showWaitlist);
    if (!showSidebar || forceCompactSidebar) {
      const compactItems = [
        {
          key: 'reservations',
          label: 'Reservierungen',
          Icon: IconUsers,
          count: sidebarReservations.length,
          onClick: () => {
            setShowSidebar(true);
            setSidebarResCollapsed(false);
          },
        },
        {
          key: 'seated',
          label: 'Platziert',
          Icon: IconArmchair,
          count: sidebarSeated.length,
          onClick: () => {
            setShowSidebar(true);
            setSidebarSeatedCollapsed(false);
          },
        },
        {
          key: 'waitlist',
          label: 'Warteliste',
          Icon: IconBell,
          count: sidebarWaitlist.length,
          onClick: () => {
            setShowSidebar(true);
            setSidebarWaitlistCollapsed(false);
          },
        },
      ];

      return (
        <div
          className="flex h-full shrink-0 flex-col overflow-hidden cursor-pointer"
          style={{ width: 68, background: '#17182a', borderRight: '1px solid #2a2a42' }}
          onClick={() => setShowSidebar(true)}
        >
          <div className="flex h-[61px] shrink-0 items-center justify-center border-b px-2" style={{ background: '#1d1e31', borderColor: '#2a2a42' }}>
            <button
              onClick={() => setShowSidebar(true)}
              className="flex h-10 w-10 items-center justify-center text-vilo-text-soft transition-colors hover:text-white"
              aria-label="Seitenleiste einblenden"
            >
              <IconLayoutSidebarLeftExpand className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto px-2 py-3">
            {compactItems.map(({ key, label, Icon, count, onClick }) => (
              <button
                key={key}
                onClick={onClick}
                className="flex w-full flex-col items-center gap-1 px-2 py-3 text-center transition-colors hover:text-white"
                aria-label={label}
                title={label}
              >
                <Icon className="h-5 w-5 text-[#d8c7ff]" />
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8f97b3]">{label.slice(0, 4)}</span>
                <span className="text-[11px] font-bold text-white">{count}</span>
              </button>
            ))}
          </div>
          <div className="shrink-0 px-2 py-3 space-y-2">
            <button
              onClick={() => {
                openReservationCreateFromSidebar();
              }}
              className="flex h-12 w-full items-center justify-center rounded-none text-white transition-colors hover:brightness-110"
              style={{ background: '#8b5cf6' }}
              aria-label="Reservieren"
              title="Reservieren"
            >
              <IconPlus className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setShowSidebar(true);
                openWaitlistFromSidebar();
              }}
              className="flex h-12 w-full items-center justify-center rounded-none text-[#d8c7ff] transition-colors hover:brightness-110"
              style={{ background: '#2b2944' }}
              aria-label="Warteliste"
              title="Warteliste"
            >
              <IconBell className="h-4 w-4" />
            </button>
          </div>
        </div>
      );
    }
    if (showReservations) {
      return (
        <div
          className="flex flex-col h-full relative overflow-hidden shrink-0"
          style={{ width: sidebarWidth, maxWidth: '40vw', background: '#1a1a2e', borderRight: '1px solid var(--vilo-border-subtle)' }}
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
          <span className="text-[11px] text-vilo-text-muted whitespace-nowrap">
            <IconUsers className="w-3 h-3 inline" /> {parties} <IconUser className="w-3 h-3 inline ml-0.5" /> {covers}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!collapsed && (
            <div className="relative">
              <button
                type="button"
                className="flex h-[24px] w-[24px] items-center justify-center rounded-md text-[#aeb5cc] transition-colors hover:bg-[#26263d] hover:text-white"
                onClick={event => {
                  event.stopPropagation();
                  setSidebarSortMenuOpen(current => current === sectionKey ? null : sectionKey);
                }}
                aria-label={`${label} sortieren`}
              >
                <IconAdjustmentsHorizontal className="w-3.5 h-3.5 pointer-events-none" />
              </button>
              {sidebarSortMenuOpen === sectionKey && (
                <div
                  className="absolute right-0 top-[28px] z-30 min-w-[168px] overflow-hidden rounded-lg border bg-[#1f1d33] shadow-[0_16px_48px_rgba(9,8,20,0.45)]"
                  style={{ borderColor: '#2a2a42' }}
                  onClick={event => event.stopPropagation()}
                >
                  {SIDEBAR_SORT_OPTIONS.map((option: { value: string; label: string }) => (
                    <button
                      key={option.value}
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] text-[#d7d3e8] transition-colors hover:bg-[#2a2944]"
                      onClick={() => {
                        setSidebarSortBy(prev => ({ ...prev, [sectionKey]: option.value }));
                        setSidebarSortMenuOpen(null);
                      }}
                    >
                      <span>{option.label}</span>
                      {sidebarSortBy[sectionKey] === option.value && <IconCheck className="h-3.5 w-3.5 text-[#a855f7]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={event => {
              event.stopPropagation();
              setSidebarSortMenuOpen(null);
              onToggle();
            }}
            className="flex h-[24px] w-[24px] shrink-0 items-center justify-center text-[#d7dae2]"
          >
            {collapsed ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
    );

    return (
      <div className="flex flex-col h-full shrink-0 overflow-hidden" style={{ width: sidebarWidth, background: '#17182a', borderRight: '1px solid #2a2a42' }}>
        <div className="shrink-0 border-b px-3 py-3" style={{ background: '#1d1e31', borderColor: '#2a2a42' }}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8f97b3]">Raumplan</p>
              <div className="mt-1 flex items-center gap-1.5 text-[14px] font-semibold text-white">
                <span>{currentZone?.name || 'Hauptetage'} ·</span>
                <div className="relative inline-flex items-center gap-1 text-[#d8c7ff] text-[13px] font-medium">
                  <select
                    value={activeZone}
                    onChange={e => setActiveZone(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  >
                    {state.zones.map(z => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                  </select>
                  <span>{zoneTables.length} Tische</span>
                  <IconChevronDown className="h-4 w-4 text-[#64748b]" />
                </div>
              </div>
            </div>
            {!editMode && (
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="flex h-10 w-10 items-center justify-center text-vilo-text-soft transition-colors hover:text-white"
                aria-label={showSidebar ? 'Seitenleiste ausblenden' : 'Seitenleiste einblenden'}
              >
                {showSidebar ? <IconLayoutSidebarLeftCollapse className="h-5 w-5" /> : <IconLayoutSidebarLeftExpand className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Reservations section */}
          <div className="border-b" style={{ borderColor: '#2a2a42' }}>
            {renderSidebarHeader('Reservierungen', sidebarResParties, sidebarResCovers, resolvedSidebarResCollapsed, () => {
              if (sidebarReservationsEmpty) return;
              setSidebarResCollapsed(!sidebarResCollapsed);
            }, 'reservations')}
            {!resolvedSidebarResCollapsed && (
              <div>
                {sidebarReservations.map(r => renderSidebarCard(r, false))}
              </div>
            )}
          </div>

          {/* Seated section */}
          <div className="border-b" style={{ borderColor: '#2a2a42' }}>
            {renderSidebarHeader('Platziert', sidebarSeatedParties, sidebarSeatedCovers, resolvedSidebarSeatedCollapsed, () => {
              if (sidebarSeatedEmpty) return;
              setSidebarSeatedCollapsed(!sidebarSeatedCollapsed);
            }, 'seated')}
            {!resolvedSidebarSeatedCollapsed && (
              <div>
                {sidebarSeated.map(r => renderSidebarCard(r, true))}
              </div>
            )}
          </div>

          {/* Waitlist section */}
          <div className="border-b" style={{ borderColor: '#2a2a42' }}>
            {renderSidebarHeader('Warteliste', sidebarWaitlistParties, sidebarWaitlistCovers, resolvedSidebarWaitlistCollapsed, () => {
              if (sidebarWaitlistEmpty) return;
              setSidebarWaitlistCollapsed(!sidebarWaitlistCollapsed);
            }, 'waitlist')}
            {!resolvedSidebarWaitlistCollapsed && (
              <div>
                {sidebarWaitlist.map(entry => renderWaitlistCard(entry))}
              </div>
            )}
          </div>

          {sidebarFinished.length > 0 && (
            <div className="border-b" style={{ borderColor: '#2a2a42' }}>
              {renderSidebarHeader('Beendet', sidebarFinishedParties, sidebarFinishedCovers, sidebarFinishedCollapsed, () => setSidebarFinishedCollapsed(!sidebarFinishedCollapsed), 'finished')}
              {!sidebarFinishedCollapsed && (
                <div>
                  {sidebarFinished.map(r => renderSidebarCard(r, true))}
                </div>
              )}
            </div>
          )}

          {sidebarRemoved.length > 0 && (
            <div className="border-b" style={{ borderColor: '#2a2a42' }}>
              {renderSidebarHeader('Entfernt', sidebarRemovedParties, sidebarRemovedCovers, sidebarRemovedCollapsed, () => setSidebarRemovedCollapsed(!sidebarRemovedCollapsed), 'removed')}
              {!sidebarRemovedCollapsed && (
                <div>
                  {sidebarRemoved.map(r => renderSidebarCard(r, false))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 p-3 space-y-2" style={{ background: '#1d1c31' }}>
          <button
            onClick={() => {
              openReservationCreateFromSidebar();
            }}
            className="flex w-full items-center justify-center gap-2 py-3 text-[14px] font-semibold text-white transition-colors hover:brightness-110"
            style={{ background: '#8b5cf6' }}
          >
            <IconPlus className="h-4 w-4" />
            Reservieren
          </button>
          <button
            onClick={() => {
              openWaitlistFromSidebar();
            }}
            className="flex w-full items-center justify-center gap-2 py-3 text-[14px] font-semibold text-[#d8c7ff] transition-colors hover:brightness-110"
            style={{ background: '#2b2944' }}
          >
            <IconBell className="h-4 w-4" />
            Warteliste
          </button>
        </div>
      </div>
    );
  };

  const renderEditorWorkspace = () => {
    const renderShapePreview = (variant: TableVariantDefinition) => {
      const previewSvg = buildTableSvg(variant.id, 0.72);
      const isActive = placementVariant === variant.id;
      return (
        <button
          key={variant.id}
          type="button"
          draggable
          onDragStart={e => {
            e.dataTransfer.setData('application/x-vilo-table-variant', variant.id);
            e.dataTransfer.effectAllowed = 'copy';
            setDraggedVariant(variant.id);
            setNewTableVariant(variant.id);
            setPlacementVariant(variant.id);
            setSelectedTable(null);
          }}
          onDragEnd={() => setDraggedVariant(null)}
          onClick={() => {
            setNewTableVariant(variant.id);
            setPlacementVariant(variant.id);
            setSelectedTable(null);
          }}
          className={`group flex flex-col items-center justify-center gap-2 rounded-lg border px-2 py-3 transition-colors ${
            isActive
              ? 'border-[#9b7cff] bg-transparent text-white'
              : 'border-transparent bg-transparent text-vilo-text-soft hover:border-vilo-border-subtle/70 hover:bg-[#211f35]'
          }`}
        >
          <svg width={previewSvg.svgW} height={previewSvg.svgH} viewBox={`0 0 ${previewSvg.svgW} ${previewSvg.svgH}`} className="opacity-95">
            {previewSvg.seatRects.map((seatRect, index) => (
              renderRectSvg(seatRect, isActive ? '#dcd3ff' : '#303751', `${variant.id}-preview-seat-${index}`, '#58607d', 1)
            ))}
            {previewSvg.body.kind === 'circle' ? (
              <circle cx={previewSvg.body.cx} cy={previewSvg.body.cy} r={previewSvg.body.r} fill={isActive ? '#8b5cf6' : '#5a5677'} />
            ) : (
              renderRectSvg(previewSvg.body, isActive ? '#8b5cf6' : '#5a5677', `${variant.id}-preview-body`)
            )}
          </svg>
        </button>
      );
    };

    const renderZoneOverview = () => (
      <div className="space-y-4">
        <div className="rounded-xl border border-vilo-border-subtle bg-vilo-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f97b3]">Aktiver Bereich</p>
          <p className="mt-2 text-[22px] font-bold text-white">{currentZone?.name || 'Raumplan'}</p>
          <p className="mt-1 text-sm text-vilo-text-secondary">{zoneTables.length} Tische auf der Bühne</p>
        </div>
        <div className="rounded-xl border border-vilo-border-subtle bg-vilo-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f97b3]">Bereiche</p>
            <span className="text-xs text-vilo-text-muted">{state.zones.length}</span>
          </div>
          <div className="space-y-2">
            {state.zones.map(zone => {
              const count = state.tables.filter(table => table.zone === zone.id).length;
              const active = zone.id === activeZone;
              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => switchZone(zone.id)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left transition-colors ${
                    active
                      ? 'border-[#9b7cff] bg-[#2f2949] text-white'
                      : 'border-vilo-border-subtle bg-[#232139] text-vilo-text-soft hover:bg-[#2b2742]'
                  }`}
                >
                  <span className="font-medium">{zone.name}</span>
                  <span className="text-xs opacity-80">{count} Tische</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );

    const renderCombinationInspector = () => {
      const focusedCombination = focusedCombinationId
        ? zoneCombinations.find(combination => combination.id === focusedCombinationId) || null
        : null;
      const focusedTable = focusedCombinationTableId
        ? state.tables.find(table => table.id === focusedCombinationTableId) || null
        : null;
      const relatedCombinations = focusedTable
        ? zoneCombinations.filter(combination => combination.tableIds.includes(focusedTable.id))
        : zoneCombinations;

      return (
        <div className="space-y-3">
          <div className="rounded-2xl border border-vilo-border-subtle bg-vilo-card p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f97b3]">Tischkombinationen</p>
              <p className="mt-2 text-[20px] font-bold leading-tight text-white">
                {focusedTable ? `Kombinationen mit ${getTableDisplayLabel(focusedTable)}` : 'Kombinationen im Bereich'}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-vilo-border-subtle bg-[#232139] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#d2c8f6]">
                {comboDraftTableIds.length > 1
                  ? `${comboDraftTableIds.length} Tische ausgewählt`
                  : 'Auswahl starten'}
              </span>
              <span className="text-xs text-vilo-text-secondary">
                {comboDraftTableIds.length > 1 ? 'Bereit zum Speichern' : 'Mehrere Tische per Klick auswählen'}
              </span>
            </div>
            <button
              type="button"
              onClick={saveCombinationDraft}
              disabled={comboDraftTableIds.length < 2}
              className={`mt-3 w-full rounded-lg border px-3 py-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                comboSaveFeedback === 'saved'
                  ? 'border-[#a78bfa] bg-[#6d50d8]'
                  : 'border-[#9b7cff] bg-[#8b5cf6]'
              }`}
            >
              {comboSaveFeedback === 'saved' ? 'Gespeichert' : 'Hinzufügen'}
            </button>
            {comboError && <p className="mt-3 text-xs font-medium text-[#f0bfd7]">{comboError}</p>}
          </div>

          {focusedCombination && (
            <div className="space-y-3 rounded-2xl border border-vilo-border-subtle bg-vilo-card p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f97b3]">Ausgewählte Kombination</p>
                  <p className="mt-2 text-[18px] font-bold text-white">{focusedCombination.name}</p>
                </div>
                <span className="shrink-0 rounded-full border border-vilo-border-subtle bg-[#232139] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#d2c8f6]">
                  {focusedCombination.tableIds.length} Tische
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f97b3]">Min.</span>
                  <input
                    type="number"
                    min={1}
                    value={focusedCombination.minPartySize}
                    onChange={e => updateCombinationField(focusedCombination.id, 'minPartySize', Math.max(1, Number(e.target.value) || 1))}
                    className="w-full rounded-xl border border-vilo-border-subtle bg-[#232139] px-3 py-2.5 text-white outline-none focus:border-[#8b5cf6]"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f97b3]">Max.</span>
                  <input
                    type="number"
                    min={focusedCombination.minPartySize}
                    value={focusedCombination.maxPartySize}
                    onChange={e => updateCombinationField(focusedCombination.id, 'maxPartySize', Math.max(focusedCombination.minPartySize, Number(e.target.value) || focusedCombination.minPartySize))}
                    className="w-full rounded-xl border border-vilo-border-subtle bg-[#232139] px-3 py-2.5 text-white outline-none focus:border-[#8b5cf6]"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => deleteCombination(focusedCombination.id)}
                className="w-full rounded-xl border border-[#6f3d66] bg-[#352338] px-4 py-2.5 text-sm font-semibold text-[#f0bfd7] transition-colors hover:bg-[#412943]"
              >
                Kombination löschen
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-vilo-border-subtle bg-vilo-card p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f97b3]">Alle Kombinationen</p>
              <span className="rounded-full border border-vilo-border-subtle bg-[#232139] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#d2c8f6]">
                {relatedCombinations.length}
              </span>
            </div>
            <div className="space-y-2">
              {relatedCombinations.length === 0 ? (
                <div className="rounded-xl border border-vilo-border-subtle bg-[#232139] px-3 py-3 text-sm leading-relaxed text-vilo-text-secondary">
                  {focusedTable ? 'Dieser Tisch ist keiner Kombination zugeordnet.' : 'Noch keine Kombinationen gespeichert.'}
                </div>
              ) : relatedCombinations.map(combination => (
                <button
                  key={combination.id}
                  type="button"
                  onClick={() => {
                    setFocusedCombinationId(combination.id);
                    setFocusedCombinationTableId(null);
                    setComboDraftTableIds(combination.tableIds);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition-colors ${
                    focusedCombinationId === combination.id
                      ? 'border-[#9b7cff] bg-[#2b2944] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                      : 'border-vilo-border-subtle bg-[#232139] text-vilo-text-soft hover:bg-[#2b2944]'
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold">{combination.name}</p>
                    <p className="mt-1 text-xs text-vilo-text-secondary">{combination.tableIds.length} Tische · {combination.minPartySize}-{combination.maxPartySize} Gäste</p>
                  </div>
                  <IconChevronRight className="h-4 w-4 text-[#8f97b3]" />
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    };

    const renderSelectedTableInspector = () => {
      if (editorMode === 'combos') return renderCombinationInspector();
      if (!selectedEditorTable) return renderZoneOverview();
      const selectedVariant = getTableVariantConfig(selectedEditorTable);
      const selectedPlacementType = inferPlacementType(selectedEditorTable);
      const selectedKindLabel = getTableKindLabel(selectedEditorTable);
      const minPartySize = selectedEditorTable.minPartySize || selectedVariant.defaultMinPartySize;
      const maxPartySize = selectedEditorTable.maxPartySize || selectedVariant.defaultMaxPartySize;
      const rotationLabel = `${getTableRotation(selectedEditorTable)}°`;
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-vilo-border-subtle bg-vilo-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f97b3]">{selectedKindLabel}</p>
            <p className="mt-2 text-[22px] font-bold text-white">{getTableDisplayLabel(selectedEditorTable)}</p>
            <p className="mt-1 text-sm text-vilo-text-secondary">{selectedVariant.label} · {selectedVariant.seats} Sitze</p>
            <p className="mt-1 text-xs font-medium text-[#b9addc]">Rotation: {rotationLabel}</p>
          </div>

          <div className="rounded-xl border border-vilo-border-subtle bg-vilo-card p-4">
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f97b3]">Tischnummer</span>
                <input
                  value={editorNameDraft}
                  onChange={e => setEditorNameDraft(e.target.value)}
                  onBlur={handleCommitEditorName}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      (e.currentTarget as HTMLInputElement).blur();
                    }
                  }}
                  className="w-full rounded-lg border border-vilo-border-subtle bg-[#232139] px-3 py-3 text-white outline-none focus:border-[#8b5cf6]"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f97b3]">Bereich</span>
                <select
                  value={selectedEditorTable.zone}
                  onChange={e => {
                    updateTableField(selectedEditorTable.id, 'zone', e.target.value);
                    switchZone(e.target.value);
                  }}
                  className="w-full rounded-lg border border-vilo-border-subtle bg-[#232139] px-3 py-3 text-white outline-none focus:border-[#8b5cf6]"
                >
                  {state.zones.map(zone => (
                    <option key={zone.id} value={zone.id}>{zone.name}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f97b3]">Platztyp</span>
                <select
                  value={selectedPlacementType}
                  onChange={e => {
                    const nextPlacementType = e.target.value as TablePlacementType;
                    if (nextPlacementType === selectedPlacementType) return;
                    if (nextPlacementType === 'bar_seat') {
                      const barVariant = TABLE_VARIANT_MAP[BAR_SEAT_VARIANT];
                      const updatedTables = state.tables.map(table => (
                        table.id === selectedEditorTable.id
                          ? {
                              ...table,
                              placementType: 'bar_seat' as const,
                              variant: barVariant.id,
                              shape: barVariant.shape,
                              seats: barVariant.seats,
                              minPartySize: barVariant.defaultMinPartySize,
                              maxPartySize: barVariant.defaultMaxPartySize,
                              name: table.name.startsWith('Barplatz') ? table.name : `Barplatz ${getTableLabelNumber(table)}`,
                            }
                          : table
                      ));
                      commitLayoutUpdate(updatedTables, state.tables);
                      setEditorNameDraft(`Barplatz ${getTableLabelNumber(selectedEditorTable)}`);
                      return;
                    }

                    const fallbackVariant = TABLE_VARIANT_MAP[DEFAULT_TABLE_VARIANT];
                    const updatedTables = state.tables.map(table => (
                      table.id === selectedEditorTable.id
                        ? {
                            ...table,
                            placementType: 'table' as const,
                            variant: inferTableVariant(table) === BAR_SEAT_VARIANT ? fallbackVariant.id : table.variant,
                            shape: inferTableVariant(table) === BAR_SEAT_VARIANT ? fallbackVariant.shape : table.shape,
                            seats: inferTableVariant(table) === BAR_SEAT_VARIANT ? fallbackVariant.seats : table.seats,
                            minPartySize: inferTableVariant(table) === BAR_SEAT_VARIANT ? fallbackVariant.defaultMinPartySize : table.minPartySize,
                            maxPartySize: inferTableVariant(table) === BAR_SEAT_VARIANT ? fallbackVariant.defaultMaxPartySize : table.maxPartySize,
                            name: table.name.startsWith('Barplatz') ? `Tisch ${getTableLabelNumber(table)}` : table.name,
                          }
                        : table
                    ));
                    commitLayoutUpdate(updatedTables, state.tables);
                    if (selectedEditorTable.name.startsWith('Barplatz')) {
                      setEditorNameDraft(`Tisch ${getTableLabelNumber(selectedEditorTable)}`);
                    }
                  }}
                  className="w-full rounded-lg border border-vilo-border-subtle bg-[#232139] px-3 py-3 text-white outline-none focus:border-[#8b5cf6]"
                >
                  <option value="table">Tisch</option>
                  <option value="bar_seat">Bar-Sitz</option>
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f97b3]">Min. Größe</span>
                  <input
                    type="number"
                    min={1}
                    value={minPartySize}
                    onChange={e => updateTableField(selectedEditorTable.id, 'minPartySize', Math.max(1, Number(e.target.value) || 1))}
                    className="w-full rounded-lg border border-vilo-border-subtle bg-[#232139] px-3 py-3 text-white outline-none focus:border-[#8b5cf6]"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f97b3]">Max. Größe</span>
                  <input
                    type="number"
                    min={minPartySize}
                    value={maxPartySize}
                    onChange={e => updateTableField(selectedEditorTable.id, 'maxPartySize', Math.max(minPartySize, Number(e.target.value) || minPartySize))}
                    className="w-full rounded-lg border border-vilo-border-subtle bg-[#232139] px-3 py-3 text-white outline-none focus:border-[#8b5cf6]"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f97b3]">Variante</span>
                <select
                  value={selectedVariant.id}
                  onChange={e => handleChangeVariant(e.target.value as TableVariant)}
                  className="w-full rounded-lg border border-vilo-border-subtle bg-[#232139] px-3 py-3 text-white outline-none focus:border-[#8b5cf6]"
                >
                  {TABLE_VARIANTS.map(option => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={duplicateSelectedTable}
              className="rounded-xl border border-vilo-border-subtle bg-[#2b2944] px-4 py-3 text-sm font-semibold text-[#d8c7ff] transition-colors hover:bg-[#342f52]"
            >
              Kopieren
            </button>
            <button
              type="button"
              onClick={handleDeleteTable}
              className="rounded-xl border border-[#6f3d66] bg-[#352338] px-4 py-3 text-sm font-semibold text-[#f0bfd7] transition-colors hover:bg-[#412943]"
            >
              Löschen
            </button>
          </div>
        </div>
      );
    };

    return (
      <div className="grid h-full min-h-0 w-full min-w-0 grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_280px] xl:grid-cols-[224px_minmax(0,1fr)_288px] 2xl:grid-cols-[228px_minmax(0,1fr)_296px]">
        <aside className="shrink-0 border-b border-r-0 border-vilo-border-subtle bg-[#1d1e31] lg:border-b-0 lg:border-r">
          <div className="border-b border-vilo-border-subtle px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f97b3]">Bearbeiten</p>
            <div className="mt-2 rounded-xl border border-vilo-border-subtle bg-[#232139] p-1">
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditorMode('layout');
                    setComboError('');
                    setComboDraftTableIds([]);
                  }}
                  className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${editorMode === 'layout' ? 'bg-[#8b5cf6] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]' : 'text-vilo-text-soft hover:bg-[#2d2945]'}`}
                >
                  Layout
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditorMode('combos');
                    setSelectedTable(null);
                    setPlacementVariant(null);
                  }}
                  className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${editorMode === 'combos' ? 'bg-[#8b5cf6] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]' : 'text-vilo-text-soft hover:bg-[#2d2945]'}`}
                >
                  Kombis
                </button>
              </div>
            </div>
            <div className="mt-2">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8f97b3]">
                Bereich
              </label>
              <select
                value={activeZone}
                onChange={e => switchZone(e.target.value)}
                className="w-full rounded-xl border border-vilo-border-subtle bg-[#232139] px-3 py-2.5 text-[15px] font-medium text-white outline-none focus:border-[#8b5cf6]"
              >
                {state.zones.map(zone => (
                  <option key={zone.id} value={zone.id}>{zone.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="px-3 py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f97b3]">Elemente</p>
              {editorMode === 'layout' && placementVariant && (
                <button
                  type="button"
                  onClick={() => setPlacementVariant(null)}
                  className="text-xs font-medium text-[#d8c7ff] hover:text-white"
                >
                  Auswahl
                </button>
              )}
            </div>
            {editorMode === 'layout' ? (
              <div className="grid grid-cols-3 gap-1.5">
                {EDITOR_TABLE_VARIANTS.map(option => renderShapePreview(option))}
              </div>
            ) : (
              <div className="rounded-xl border border-vilo-border-subtle bg-vilo-card px-3 py-2.5 text-[13px] text-vilo-text-secondary">
                Tische per Klick auswählen. Bar-Sitze sind im Kombinationsmodus gesperrt.
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-vilo-border-subtle lg:border-b-0 lg:border-r">
          <div className="flex flex-wrap items-center gap-2 border-b border-vilo-border-subtle bg-[#1d1e31] px-4 py-3">
            <button onClick={() => setScale(prev => Math.max(0.6, prev - 0.1))} className="rounded-lg border border-vilo-border-subtle bg-vilo-card px-3 py-2 text-sm font-medium text-vilo-text-soft hover:bg-[#332d4e]">
              -
            </button>
            <button onClick={() => setScale(prev => Math.min(2.4, prev + 0.1))} className="rounded-lg border border-vilo-border-subtle bg-vilo-card px-3 py-2 text-sm font-medium text-vilo-text-soft hover:bg-[#332d4e]">
              +
            </button>
            <button onClick={() => { setScale(1); setTranslate({ x: 0, y: 0 }); }} className="rounded-lg border border-vilo-border-subtle bg-vilo-card px-3 py-2 text-sm font-medium text-vilo-text-soft hover:bg-[#332d4e]">
              Fit
            </button>
            <button
              onClick={() => { setEditorTool('select'); setPlacementVariant(null); }}
              disabled={editorMode === 'combos'}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${editorTool === 'select' ? 'border-[#9b7cff] bg-[#8b5cf6] text-white' : 'border-vilo-border-subtle bg-vilo-card text-vilo-text-soft hover:bg-[#332d4e]'} disabled:cursor-not-allowed disabled:opacity-35`}
            >
              Auswahl
            </button>
            <button
              onClick={() => { setEditorTool('move'); }}
              disabled={editorMode === 'combos'}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${editorTool === 'move' ? 'border-[#9b7cff] bg-[#8b5cf6] text-white' : 'border-vilo-border-subtle bg-vilo-card text-vilo-text-soft hover:bg-[#332d4e]'} disabled:cursor-not-allowed disabled:opacity-35`}
            >
              Bewegen
            </button>
            <button
              onClick={handleUndoLayout}
              disabled={layoutUndoStack.length === 0}
              className="rounded-lg border border-vilo-border-subtle bg-vilo-card px-3 py-2 text-sm font-medium text-vilo-text-soft transition-colors hover:bg-[#332d4e] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Undo
            </button>
            <button
              onClick={handleRedoLayout}
              disabled={layoutRedoStack.length === 0}
              className="rounded-lg border border-vilo-border-subtle bg-vilo-card px-3 py-2 text-sm font-medium text-vilo-text-soft transition-colors hover:bg-[#332d4e] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Redo
            </button>
            <button
              onClick={() => {
                setEditMode(false);
                setEditorMode('layout');
                setSelectedTable(null);
                setPlacementVariant(null);
                setComboDraftTableIds([]);
                setFocusedCombinationId(null);
                setFocusedCombinationTableId(null);
                setEditorTool('move');
              }}
              className="rounded-lg border border-[#9b7cff] bg-[#8b5cf6] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#7c3aed]"
            >
              Fertig
            </button>
            <div className="ml-auto text-xs text-vilo-text-muted">
              {editorMode === 'combos'
                ? `${zoneCombinations.length} Kombinationen im Bereich`
                : placementVariant
                  ? `Klicke auf die Bühne, um ${TABLE_VARIANT_MAP[placementVariant]?.label || 'Element'} zu platzieren`
                  : `${zoneTables.length} Tische im Bereich`}
            </div>
          </div>

          <div
            className="relative min-h-0 flex-1 overflow-hidden bg-[#18192b]"
          >
            <div className="absolute inset-0 overflow-auto p-4 md:p-6">
              <div
                ref={editorFrameRef}
                className="relative overflow-hidden rounded-2xl border border-vilo-border-subtle bg-[#1f2035]"
                style={{
                  width: editorCanvasSize.width,
                  height: editorCanvasSize.height,
                }}
              >
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage: 'none',
                  }}
                />
                <div className="pointer-events-none absolute inset-0 border border-white/[0.03]" />
                <div
                  ref={editorStageRef}
                  className="absolute inset-0"
                  onClick={handleEditorCanvasClick}
                  onDragOver={handleEditorCanvasDragOver}
                  onDrop={handleEditorCanvasDrop}
                  onMouseDown={handleCanvasViewportMouseDown}
                  style={{
                    width: editorCanvasSize.width,
                    height: editorCanvasSize.height,
                    transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                    transformOrigin: '0 0',
                  }}
                >
                  {zoneTables.map(table => renderTableShape(table))}
                </div>
                <button
                  type="button"
                  onMouseDown={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    startEditorResize(event.clientX, event.clientY);
                  }}
                  onTouchStart={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    const touch = event.touches[0];
                    if (!touch) return;
                    startEditorResize(touch.clientX, touch.clientY);
                  }}
                  className="absolute bottom-0 right-0 z-20 h-5 w-5 translate-x-1/2 translate-y-1/2 border border-vilo-border-subtle bg-[#31324a] shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
                  aria-label="Bühne skalieren"
                />
              </div>
            </div>
          </div>
        </section>

        <aside className="shrink-0 overflow-y-auto border-t border-vilo-border-subtle bg-[#1d1e31] p-3 lg:border-t-0 lg:p-4">
          {renderSelectedTableInspector()}
        </aside>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col" style={{ background: '#1a1a2e' }}>
      <div className="flex-1 flex overflow-hidden min-w-0">
        {editMode ? (
          renderEditorWorkspace()
        ) : (
          <>
        {/* OpenTable-style sidebar */}
        {renderSidebar()}

        {/* Stage stays visible; reservation details open as right inspector */}
        <div ref={canvasRef} className={`${isMobileViewport && (showReservationCreatePanel || showWaitlist) ? 'hidden' : 'flex-1'} overflow-hidden relative`}
          style={{ background: '#1a1a2e', touchAction: editMode ? 'none' : 'none' }}
          onClick={() => {
            if (suppressLiveStageClickRef.current) {
              suppressLiveStageClickRef.current = false;
              return;
            }
            if (editMode) {
              setSelectedTable(null);
              return;
            }
            if (isMobileViewport) {
              setShowSidebar(false);
            }
            if (selectedReservationId || showWaitlist || showReservationCreatePanel || resDetailId || seatInspector || tableManagementId) {
              closeGuestPanel();
              setShowWaitlist(false);
              setShowReservationCreatePanel(false);
              setResDetailId(null);
              setTableManagementId(null);
            }
          }}>
          {!editMode && (
            <div className="absolute right-4 top-4 z-20 flex flex-col gap-2">
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation();
                  setLiveScaleFactor(prev => Math.max(0.75, +(prev - 0.1).toFixed(2)));
                }}
                className="rounded-lg border border-vilo-border-subtle bg-vilo-card px-3 py-2 text-[13px] font-semibold text-vilo-text-soft shadow-[0_10px_30px_rgba(2,6,23,0.16)] transition-colors hover:bg-[#332d4e]"
                aria-label="Bühne verkleinern"
              >
                -
              </button>
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation();
                  setLiveScaleFactor(prev => Math.min(2.4, +(prev + 0.1).toFixed(2)));
                }}
                className="rounded-lg border border-vilo-border-subtle bg-vilo-card px-3 py-2 text-[13px] font-semibold text-vilo-text-soft shadow-[0_10px_30px_rgba(2,6,23,0.16)] transition-colors hover:bg-[#332d4e]"
                aria-label="Bühne vergrößern"
              >
                +
              </button>
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation();
                  resetLiveViewport();
                }}
                className="rounded-lg border border-vilo-border-subtle bg-vilo-card px-3 py-2 text-[12px] font-semibold text-vilo-text-soft shadow-[0_10px_30px_rgba(2,6,23,0.16)] transition-colors hover:bg-[#332d4e]"
                aria-label="Bühne einpassen"
              >
                Fit
              </button>
            </div>
          )}
          <div style={{
            transform: `translate(${effectiveLiveViewport.translate.x}px, ${effectiveLiveViewport.translate.y}px) scale(${effectiveLiveViewport.scale})`,
            transformOrigin: '0 0',
            width: '100%',
            height: '100%',
            position: 'relative',
            transition: 'transform 0.18s ease-out',
            cursor: editMode ? 'default' : (livePanRef.current ? 'grabbing' : 'grab'),
          }}
          onMouseDown={handleLiveCanvasMouseDown}>
            {zoneTables.map(table => renderTableShape(table))}
            {activeCombinationOverlays.map(overlay => (
              <div key={`combo-overlay-${overlay.ownerTableId}`} className="absolute pointer-events-none" style={{ inset: 0 }}>
                <svg className="absolute inset-0 h-full w-full overflow-visible" style={{ pointerEvents: 'none' }}>
                  {overlay.routeSegments.map((segment, index) => (
                    <line
                      key={`${overlay.ownerTableId}-segment-${index}`}
                      x1={segment.x1}
                      y1={segment.y1}
                      x2={segment.x2}
                      y2={segment.y2}
                      stroke="rgba(139,92,246,0.76)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray="8 6"
                      filter="drop-shadow(0 0 10px rgba(139,92,246,0.18))"
                    >
                      <animate
                        attributeName="stroke-dashoffset"
                        from="14"
                        to="0"
                        dur="1.4s"
                        repeatCount="indefinite"
                      />
                    </line>
                  ))}
                </svg>
                {overlay.kind === 'shared' && overlay.sharedBadge && (
                  <div
                    className="absolute flex flex-col items-center gap-1"
                    style={{
                      left: overlay.sharedBadge.left,
                      top: overlay.sharedBadge.top,
                      width: overlay.sharedBadge.width,
                      pointerEvents: 'auto',
                      zIndex: 40,
                    }}
                  >
                    {overlay.badges.map(badge => {
                      const badgeSize = estimateBadgeSize(badge.label, badge.subLabel);
                      return (
                        <div
                          key={`${overlay.ownerTableId}-${badge.label}`}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: badge.subLabel ? 4 : 0,
                            width: badgeSize.width,
                          }}
                        >
                          <div
                            className={badge.interactive && !editMode ? 'cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(139,92,246,0.28)] active:scale-[0.98]' : ''}
                            onClick={badge.interactive && !editMode ? event => {
                              event.stopPropagation();
                              const ownerTable = zoneTables.find(table => table.id === overlay.ownerTableId);
                              if (ownerTable) handleTableClick(ownerTable);
                            } : undefined}
                            title={badge.interactive && !editMode ? 'POS öffnen' : undefined}
                            style={{
                              background: 'rgba(15,23,42,0.82)',
                              border: badge.border,
                              borderRadius: 8,
                              minWidth: 0,
                              width: badgeSize.width,
                              height: 20,
                              padding: '3px 10px',
                              textAlign: 'center',
                              boxShadow: badge.interactive
                                ? '0 8px 24px rgba(76,29,149,0.22)'
                                : '0 8px 22px rgba(2,6,23,0.25)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <div
                              style={{
                                color: badge.color,
                                fontSize: 10,
                                fontWeight: 700,
                                lineHeight: '12px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {badge.label}
                            </div>
                          </div>
                          {badge.subLabel && (
                            <div
                              style={{
                                background: 'rgba(15,23,42,0.82)',
                                border: '1px solid rgba(125,211,252,0.2)',
                                borderRadius: 8,
                                minWidth: 0,
                                width: badgeSize.width,
                                height: 18,
                                padding: '2px 10px',
                                textAlign: 'center',
                                boxShadow: '0 8px 22px rgba(2,6,23,0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <div
                                style={{
                                  color: '#eef1fb',
                                  fontSize: 9,
                                  fontWeight: 700,
                                  lineHeight: '11px',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {badge.subLabel}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Zone selector - OpenTable style bottom-right */}
      {!editMode && (
        <div
          className="absolute right-4 z-10 flex items-center gap-2"
          style={{ bottom: 'calc(0.6rem + env(safe-area-inset-bottom, 0px))' }}
        >
              <button
                type="button"
                onClick={() => setShowFloorStatusBadges(prev => !prev)}
                className={'px-3 py-2.5 rounded-lg text-[14px] font-medium transition-colors flex items-center justify-center ' +
                  (showFloorStatusBadges ? 'bg-[#8b5cf6] text-white' : 'bg-vilo-surface text-[#c4b5fd] hover:bg-vilo-elevated')}
                aria-label={showFloorStatusBadges ? 'POS-Status auf dem Floor ausblenden' : 'POS-Status auf dem Floor einblenden'}
                title={showFloorStatusBadges ? 'POS-Status ausblenden' : 'POS-Status einblenden'}
              >
                <IconAlignLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowFloorServerBadges(prev => !prev)}
                className={'px-3 py-2.5 rounded-lg text-[14px] font-medium transition-colors flex items-center justify-center ' +
                  (showFloorServerBadges ? 'bg-[#8b5cf6] text-white' : 'bg-vilo-surface text-[#c4b5fd] hover:bg-vilo-elevated')}
                aria-label={showFloorServerBadges ? 'Bediener auf dem Floor ausblenden' : 'Bediener auf dem Floor einblenden'}
                title={showFloorServerBadges ? 'Bediener ausblenden' : 'Bediener einblenden'}
              >
                <IconUserCheck className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowFloorMoneyBadges(prev => !prev)}
                className={'px-3 py-2.5 rounded-lg text-[14px] font-medium transition-colors flex items-center justify-center ' +
                  (showFloorMoneyBadges ? 'bg-[#8b5cf6] text-white' : 'bg-vilo-surface text-[#c4b5fd] hover:bg-vilo-elevated')}
                aria-label={showFloorMoneyBadges ? 'Geld auf dem Floor ausblenden' : 'Geld auf dem Floor einblenden'}
                title={showFloorMoneyBadges ? 'Geld ausblenden' : 'Geld einblenden'}
              >
                <IconCashBanknoteFilled className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowFloorTimeBadges(prev => !prev)}
                className={'px-3 py-2.5 rounded-lg text-[14px] font-medium transition-colors flex items-center justify-center ' +
                  (showFloorTimeBadges ? 'bg-[#8b5cf6] text-white' : 'bg-vilo-surface text-[#c4b5fd] hover:bg-vilo-elevated')}
                aria-label={showFloorTimeBadges ? 'Zeiten auf dem Floor ausblenden' : 'Zeiten auf dem Floor einblenden'}
                title={showFloorTimeBadges ? 'Zeiten ausblenden' : 'Zeiten einblenden'}
              >
                <IconClock className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setEditMode(!editMode);
                  setSelectedTable(null);
                  setPlacementVariant(null);
                  setEditorTool('move');
                }}
                className={'px-3 py-2.5 rounded-lg text-[14px] font-medium transition-colors flex items-center gap-1.5 ' +
                  (editMode ? 'bg-[#8b5cf6] text-white' : 'bg-vilo-surface text-[#c4b5fd] hover:bg-vilo-elevated')}>
                {editMode ? <><IconCheck className="w-4 h-4" />Fertig</> : <><IconEdit className="w-4 h-4" />Edit</>}
              </button>
              <button
                onClick={() => { const idx = state.zones.findIndex(z => z.id === activeZone); switchZone(state.zones[(idx + 1) % state.zones.length].id); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-[14px] font-medium"
                style={{ background: '#2a2a42' }}>
                {currentZone?.name || 'Hauptetage'}
                <IconChevronUp className="w-4 h-4 text-vilo-text-muted" />
              </button>
            </div>
          )}
        </div>

        {showReservationCreatePanel && !editMode && (
          <div
            className="flex flex-col h-full overflow-hidden"
            style={{
              width: isMobileViewport ? 'calc(100vw - 68px)' : 360,
              minWidth: isMobileViewport ? 'calc(100vw - 68px)' : 360,
              background: '#1f1e33',
              borderLeft: '1px solid var(--vilo-border-subtle)',
            }}
          >
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
          <div className="flex flex-col h-full overflow-hidden" style={{ width: 360, minWidth: 360, background: '#1f1e33', borderLeft: '1px solid var(--vilo-border-subtle)' }}>
            <WaitlistPanel
              embedded
              initialShowAddForm
              onClose={() => setShowWaitlist(false)}
              onSeatGuest={(tableId) => {
                setShowWaitlist(false);
                dispatch({ type: 'SET_ACTIVE_TABLE', tableId });
              }}
              tables={state.tables}
            />
          </div>
        )}

        {tableManagementId && !showReservationCreatePanel && !showWaitlist && !editMode && (() => {
          const managedTable = state.tables.find(t => t.id === tableManagementId);
          if (!managedTable) return null;
          return (
            <TableManagement
              table={managedTable}
              onClose={() => {
                setMoveSelection(null);
                setTableManagementId(null);
                setPendingWaitlistPlacement(null);
                clearPersistedInspector();
              }}
              onOpenTableDetail={(tableId) => {
                setMoveSelection(null);
                setTableManagementId(null);
                setPendingWaitlistPlacement(null);
                clearPersistedInspector();
                dispatch({ type: 'SET_ACTIVE_TABLE', tableId });
              }}
              onReserve={() => {
                setMoveSelection(null);
                setTableManagementId(null);
                clearPersistedInspector();
                setShowReservations(true);
              }}
              onStartMoveSelection={(fromTableId) => {
                setMoveSelection({ fromTableId });
              }}
              onCancelMoveSelection={() => {
                setMoveSelection(null);
              }}
              isMoveSelectionActive={moveSelection?.fromTableId === managedTable.id}
              allTables={state.tables}
              isSidebarExpanded={showSidebar}
              initialSubView={pendingWaitlistPlacement && managedTable.status === 'free' ? 'walkin_count' : 'main'}
              initialWalkInGuestName={pendingWaitlistPlacement?.guestName || ''}
              initialWalkInGuestCount={pendingWaitlistPlacement?.partySize || 2}
              onSeatFromWaitlist={(tableId, guestName, guestCount) => {
                if (!pendingWaitlistPlacement) return;
                const updated = updateWaitlistEntry(pendingWaitlistPlacement.entryId, {
                  status: 'seated',
                  seatedAt: Date.now(),
                  assignedTableId: tableId,
                  guestName: guestName || pendingWaitlistPlacement.guestName,
                  partySize: guestCount,
                });
                setWaitlistEntries(updated);
                setPendingWaitlistPlacement(null);
              }}
              inline
            />
          );
        })()}

        {seatAssignmentEnabled && seatInspector && !showReservationCreatePanel && !showWaitlist && !editMode && renderSeatInspector()}
        {selectedReservation && !showGuestProfileView && !showReservationCreatePanel && !showWaitlist && !editMode && renderRightPanel()}
          </>
        )}
      </div>

      {/* OpenTable Seat Overlay - Full-screen floor plan for table assignment */}
      {showSeatOverlay && selectedReservation && (() => {
        const r = selectedReservation;
        const overlayZoneTables = state.tables.filter(t => t.zone === seatOverlayZone);
        const assignedIds = r.tableIds && r.tableIds.length > 0 ? r.tableIds : (r.tableId ? [r.tableId] : []);
        const assignedNames = assignedIds.map(id => {
          const table = state.tables.find(t => t.id === id);
          return table ? getTableDisplayLabel(table) : '';
        }).filter(Boolean).join(', ');
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
            <div className="flex flex-col h-full" style={{ width: 240, minWidth: 240, background: '#1f1e33', borderRight: '1px solid var(--vilo-border-subtle)' }}>
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
              <div className="flex border-b border-vilo-border-subtle px-4">
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
                  <div className="flex items-center gap-2 mb-3 px-3 py-3 bg-vilo-card">
                    <IconArmchair className="w-4 h-4 text-[#cfc5ff]" />
                    <span className="text-[#f3ecff] text-[13px] font-medium">{assignedNames}</span>
                  </div>
                ) : (
                  <div className="mb-3 px-3 py-3 border border-dashed border-[#7f5bb0]">
                    <p className="text-[#bfa8ee] text-[13px]">Platz auf dem Plan anklicken</p>
                  </div>
                )}
                {/* Seat now button */}
                <button onClick={handleSeatNow}
                  className="w-full py-3 font-semibold text-[14px] flex items-center justify-center gap-2 transition-colors bg-[#8b5cf6] text-white hover:bg-[#7c3aed] mb-4">
                  {seatOverlayTab === 'seat' ? 'Jetzt platzieren' : 'Platz vorschlagen'}
                </button>
                {/* Seating Preferences */}
                <div className="flex items-center gap-2 text-[13px] px-3 py-3 bg-vilo-card">
                  <IconArmchair className="w-4 h-4 text-[#cfc5ff]" />
                  <div>
                    <div className="text-[#f3ecff] font-medium">Sitzplatzpräferenzen</div>
                    <div className="text-[#b6acca] text-[12px]">{state.zones.find(z => z.id === r.zone)?.name || 'Restaurantbereich'} gebucht</div>
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 border-t border-vilo-border-subtle">
                <button onClick={() => setShowSeatOverlay(false)}
                  className="text-[#d8c7ff] text-[13px] font-medium hover:text-white transition-colors">Mehr Details</button>
              </div>
            </div>

            {/* Floor plan area - dark background like OpenTable */}
            <div className="flex-1 flex flex-col">
              {/* Top bar */}
              <div className="flex items-center justify-center px-4 py-2.5 border-b border-vilo-border-subtle" style={{ background: '#252545' }}>
                <span className="text-white text-[14px] font-medium">{r.guestName} jetzt platzieren</span>
              </div>
              {/* Floor plan canvas */}
              <div className="flex-1 overflow-hidden relative" style={{ background: '#1a1a2e' }}>
                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                  {overlayZoneTables.map(table => {
                    const variant = getTableVariantConfig(table);
                    const shape = variant.shape;
                    const size = getTableSize(table);
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
                        <span className="text-[12px] font-bold">{getTableDisplayLabel(table)}</span>
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
                <div className="flex items-center gap-1 bg-[#1a1a2e] rounded-lg shadow-lg px-3 py-2 border border-vilo-border-subtle">
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
