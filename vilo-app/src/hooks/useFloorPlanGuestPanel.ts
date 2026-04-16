// Custom hook for FloorPlan guest/reservation panel state and handlers.
// Encapsulates: reservations/waitlist sync, inspector open/close,
// guest profile + notes, reservation/waitlist/seat/party overlays,
// badge visibility persistence, minute tick, and inspector-restore.

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Guest, GuestNote, Reservation, Table, WaitlistEntry } from '../types';
import {
  loadReservations, loadWaitlist, loadGuests,
  addGuest, addGuestNote, removeGuestNote,
} from '../utils/storage';
import {
  type PersistedFloorPlanInspector, type PersistedFloorPlanBadges,
  FLOORPLAN_INSPECTOR_STORAGE_KEY,
  FLOORPLAN_BADGE_VISIBILITY_STORAGE_KEY,
  loadPersistedFloorPlanBadges,
} from '../utils/floorplan';

export type SeatQuickActionState = {
  tableId: string;
  seatNumber: number;
  x: number;
  y: number;
};

export type PendingWaitlistPlacementState = {
  entryId: string;
  guestName: string;
  partySize: number;
};

interface UseFloorPlanGuestPanelParams {
  tables: Table[];
  activeZone: string;
  setActiveZone: (zone: string) => void;
  tableManagementId: string | null;
  setTableManagementId: (id: string | null) => void;
  setMoveSelection: (v: { fromTableId: string } | null) => void;
  closeSeatInspector: () => void;
  setSeatQuickAction: Dispatch<SetStateAction<SeatQuickActionState | null>>;
}

export function useFloorPlanGuestPanel({
  tables,
  activeZone,
  setActiveZone,
  tableManagementId: _tableManagementId,
  setTableManagementId,
  setMoveSelection,
  closeSeatInspector,
  setSeatQuickAction,
}: UseFloorPlanGuestPanelParams) {
  // --- Panel visibility / routing ---
  const [showReservations, setShowReservations] = useState(false);
  const [openReservationsInAddMode, setOpenReservationsInAddMode] = useState(false);
  const [showReservationCreatePanel, setShowReservationCreatePanel] = useState(false);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [activeWaitlistCardId, setActiveWaitlistCardId] = useState<string | null>(null);
  const [pendingWaitlistPlacement, setPendingWaitlistPlacement] = useState<PendingWaitlistPlacementState | null>(null);

  // --- Reservations / waitlist data ---
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);

  // --- Inspector / selection ---
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [justAddedReservationId, setJustAddedReservationId] = useState<string | null>(null);
  const [pressedReservationId, setPressedReservationId] = useState<string | null>(null);
  const [highlightedTableId, setHighlightedTableId] = useState<string | null>(null);
  const [guestProfileGuest, setGuestProfileGuest] = useState<Guest | null>(null);
  const [guestProfileKey, setGuestProfileKey] = useState(0);
  const [showGuestProfileView, setShowGuestProfileView] = useState(false);
  const [resDetailId, setResDetailId] = useState<string | null>(null);

  // --- Refs for reservation tracking / one-shot restore ---
  const previousReservationIdsRef = useRef<Set<string>>(new Set());
  const reservationsInitializedRef = useRef(false);
  const inspectorRestoredRef = useRef(false);

  // --- Note management ---
  const [activeNoteTab, setActiveNoteTab] = useState<GuestNote['category']>('general');
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteText, setNoteText] = useState('');

  // --- Seat/party/duration overlays ---
  const [showSeatOverlay, setShowSeatOverlay] = useState(false);
  const [seatOverlayTab, setSeatOverlayTab] = useState<'preassign' | 'seat'>('seat');
  const [seatOverlayZone, setSeatOverlayZone] = useState<string>(activeZone);
  const [showPartySizeOverlay, setShowPartySizeOverlay] = useState(false);
  const [showDurationOverlay, setShowDurationOverlay] = useState(false);

  // --- Badge visibility (persisted to localStorage) ---
  const initialBadgeVisibilityRef = useRef<PersistedFloorPlanBadges>(loadPersistedFloorPlanBadges());
  const [showFloorTimeBadges, setShowFloorTimeBadges] = useState(initialBadgeVisibilityRef.current.showTimeBadges);
  const [showFloorMoneyBadges, setShowFloorMoneyBadges] = useState(initialBadgeVisibilityRef.current.showMoneyBadges);
  const [showFloorStatusBadges, setShowFloorStatusBadges] = useState(initialBadgeVisibilityRef.current.showStatusBadges);
  const [showFloorServerBadges, setShowFloorServerBadges] = useState(initialBadgeVisibilityRef.current.showServerBadges);

  // --- Minute tick (for countdown labels) ---
  const [, setMinuteTick] = useState(0);

  // --- Reservation sync ---
  const syncReservations = useCallback(() => {
    const nextReservations = loadReservations();
    setReservations(nextReservations);
    reservationsInitializedRef.current = true;
  }, []);

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

  // --- Waitlist sync ---
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

  // --- Badge visibility persistence ---
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

  // --- Minute tick for countdown labels ---
  useEffect(() => {
    const timer = window.setInterval(() => setMinuteTick(tick => tick + 1), 60000);
    return () => window.clearInterval(timer);
  }, []);

  // --- Inspector persistence helpers ---
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

  // --- Inspector open handlers ---
  const openTableManagementInspector = useCallback((tableId: string) => {
    const table = tables.find(t => t.id === tableId);
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
  }, [activeZone, closeSeatInspector, persistInspectorState, setActiveZone, setMoveSelection, setTableManagementId, tables]);

  const openReservationInspector = useCallback((reservation: Reservation) => {
    setMoveSelection(null);
    setShowReservationCreatePanel(false);
    setShowGuestProfileView(false);
    setShowWaitlist(false);
    setResDetailId(null);
    setTableManagementId(null);
    setSelectedReservationId(reservation.id);
    setHighlightedTableId(reservation.tableId || null);

    const nextZone = reservation.zone || (reservation.tableId ? tables.find(t => t.id === reservation.tableId)?.zone : null);
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
  }, [activeZone, persistInspectorState, setActiveZone, setMoveSelection, setTableManagementId, tables]);

  // --- Just-added reservation flash (2.2s) ---
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

  // --- Inspector restore from localStorage on mount ---
  useEffect(() => {
    if (inspectorRestoredRef.current) return;
    if (typeof window === 'undefined') return;
    if (tables.length === 0) return;

    const raw = window.localStorage.getItem(FLOORPLAN_INSPECTOR_STORAGE_KEY);
    if (!raw) {
      inspectorRestoredRef.current = true;
      return;
    }

    try {
      const persisted = JSON.parse(raw) as PersistedFloorPlanInspector;

      if (persisted.type === 'table') {
        const table = tables.find(t => t.id === persisted.id);
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
  }, [clearPersistedInspector, openReservationInspector, openTableManagementInspector, reservations, tables]);

  // --- Guest profile + note handlers ---
  const refreshGuest = useCallback(() => {
    if (!guestProfileGuest) return;
    const guests = loadGuests();
    const updated = guests.find(g => g.id === guestProfileGuest.id);
    if (updated) {
      setGuestProfileGuest(updated);
      setGuestProfileKey(k => k + 1);
    }
  }, [guestProfileGuest]);

  const handleAddNote = useCallback(() => {
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
  }, [activeNoteTab, guestProfileGuest, noteText, refreshGuest]);

  const handleRemoveNote = useCallback((noteId: string) => {
    if (!guestProfileGuest) return;
    removeGuestNote(guestProfileGuest.id, noteId);
    refreshGuest();
  }, [guestProfileGuest, refreshGuest]);

  // --- Close guest panel (clears selection + inspector) ---
  const closeGuestPanel = useCallback(() => {
    setSelectedReservationId(null);
    setHighlightedTableId(null);
    setGuestProfileGuest(null);
    setShowGuestProfileView(false);
    setShowAddNote(false);
    setNoteText('');
    setSeatQuickAction(null);
    closeSeatInspector();
    clearPersistedInspector();
  }, [clearPersistedInspector, closeSeatInspector, setSeatQuickAction]);

  // --- Sidebar → create / waitlist routing ---
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
  }, [clearPersistedInspector, closeGuestPanel, setTableManagementId]);

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
  }, [clearPersistedInspector, closeGuestPanel, setTableManagementId]);

  return {
    // Reservations data
    reservations, setReservations,
    waitlistEntries, setWaitlistEntries,
    syncReservations,

    // Panel visibility
    showReservations, setShowReservations,
    openReservationsInAddMode, setOpenReservationsInAddMode,
    showReservationCreatePanel, setShowReservationCreatePanel,
    showWaitlist, setShowWaitlist,
    activeWaitlistCardId, setActiveWaitlistCardId,
    pendingWaitlistPlacement, setPendingWaitlistPlacement,

    // Inspector / selection
    selectedReservationId, setSelectedReservationId,
    justAddedReservationId,
    pressedReservationId, setPressedReservationId,
    highlightedTableId, setHighlightedTableId,
    guestProfileGuest, setGuestProfileGuest,
    guestProfileKey,
    showGuestProfileView, setShowGuestProfileView,
    resDetailId, setResDetailId,

    // Notes
    activeNoteTab, setActiveNoteTab,
    showAddNote, setShowAddNote,
    noteText, setNoteText,

    // Overlays
    showSeatOverlay, setShowSeatOverlay,
    seatOverlayTab, setSeatOverlayTab,
    seatOverlayZone, setSeatOverlayZone,
    showPartySizeOverlay, setShowPartySizeOverlay,
    showDurationOverlay, setShowDurationOverlay,

    // Badges
    showFloorTimeBadges, setShowFloorTimeBadges,
    showFloorMoneyBadges, setShowFloorMoneyBadges,
    showFloorStatusBadges, setShowFloorStatusBadges,
    showFloorServerBadges, setShowFloorServerBadges,

    // Handlers
    persistInspectorState,
    clearPersistedInspector,
    openTableManagementInspector,
    openReservationInspector,
    openReservationCreateFromSidebar,
    openWaitlistFromSidebar,
    closeGuestPanel,
    refreshGuest,
    handleAddNote,
    handleRemoveNote,
  };
}
