// Custom hook for FloorPlan sidebar state and computed reservation lists.
// Encapsulates: sorting, collapsing, filtering, and the 5 sidebar sections.

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { Table, TableSession, Reservation, WaitlistEntry } from '../types';
import { getTableDisplayLabel, getTableLabelNumber } from '../utils/floorplan';

type SidebarSortKey = 'reservation_time' | 'arrival_time' | 'name' | 'party_size' | 'table' | 'created_at' | 'payment_status';
type SidebarSectionKey = 'waitlist' | 'reservations' | 'seated' | 'finished' | 'removed';

export type SidebarPlacedItem = Reservation & {
  __isSessionItem?: boolean;
  __sessionTableId?: string;
};

export const SIDEBAR_SORT_OPTIONS: { value: SidebarSortKey; label: string }[] = [
  { value: 'reservation_time', label: 'Reservierungszeit' },
  { value: 'arrival_time', label: 'Ankunftszeit' },
  { value: 'name', label: 'Name' },
  { value: 'party_size', label: 'Personenzahl' },
  { value: 'table', label: 'Tisch' },
  { value: 'created_at', label: 'Erstelltes Datum' },
  { value: 'payment_status', label: 'Kreditkartenstatus' },
];

interface UseFloorPlanSidebarParams {
  tables: Table[];
  sessions: Record<string, TableSession>;
  reservations: Reservation[];
  waitlistEntries: WaitlistEntry[];
}

export function useFloorPlanSidebar({
  tables,
  sessions,
  reservations,
  waitlistEntries,
}: UseFloorPlanSidebarParams) {
  // --- Sidebar UI State ---
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarSearch] = useState<Record<SidebarSectionKey, string>>({
    waitlist: '', reservations: '', seated: '', finished: '', removed: '',
  });
  const [sidebarSortBy, setSidebarSortBy] = useState<Record<SidebarSectionKey, SidebarSortKey>>({
    waitlist: 'created_at',
    reservations: 'reservation_time',
    seated: 'reservation_time',
    finished: 'reservation_time',
    removed: 'reservation_time',
  });
  const [sidebarSortMenuOpen, setSidebarSortMenuOpen] = useState<SidebarSectionKey | null>(null);
  const [sidebarResCollapsed, setSidebarResCollapsed] = useState(false);
  const [sidebarWaitlistCollapsed, setSidebarWaitlistCollapsed] = useState(false);
  const [sidebarSeatedCollapsed, setSidebarSeatedCollapsed] = useState(false);
  const [sidebarFinishedCollapsed, setSidebarFinishedCollapsed] = useState(true);
  const [sidebarRemovedCollapsed, setSidebarRemovedCollapsed] = useState(true);

  // --- Sorting/Filtering ---
  const applySidebarControls = useCallback((items: SidebarPlacedItem[], sectionKey: SidebarSectionKey) => {
    const q = sidebarSearch[sectionKey].trim().toLowerCase();
    const activeSort = sidebarSortBy[sectionKey];
    const paymentRank: Record<string, number> = { paid: 0, partial: 1, unpaid: 2 };

    const filtered = items.filter(r => {
      if (!q) return true;
      const tableName = r.tableId ? (getTableDisplayLabel(tables.find(t => t.id === r.tableId) || { name: '' }) || '') : '';
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
          const aTable = a.tableId ? (getTableDisplayLabel(tables.find(t => t.id === a.tableId) || { name: '' }) || '') : 'ZZZ';
          const bTable = b.tableId ? (getTableDisplayLabel(tables.find(t => t.id === b.tableId) || { name: '' }) || '') : 'ZZZ';
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
  }, [sidebarSearch, sidebarSortBy, tables]);

  // --- Computed Sections ---
  const todayStr = useMemo(() => {
    const today = new Date();
    return today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  }, []);

  const sidebarReservations = useMemo(() => {
    return applySidebarControls(
      reservations.filter(r => r.date === todayStr && ['confirmed', 'running_late', 'partially_arrived'].includes(r.status)),
      'reservations',
    );
  }, [applySidebarControls, reservations, todayStr]);

  const sidebarWaitlist = useMemo(() => {
    return waitlistEntries
      .filter(entry => entry.status === 'waiting' || entry.status === 'notified')
      .slice()
      .sort((a, b) => a.position - b.position || a.addedAt - b.addedAt);
  }, [waitlistEntries]);

  const sidebarSeated = useMemo(() => {
    const seatedStatuses = ['seated', 'partially_seated', 'appetizer', 'entree', 'dessert', 'cleared', 'check_dropped', 'paid', 'bussing_needed'];
    const seatedReservations = reservations.filter(r => r.date === todayStr && seatedStatuses.includes(r.status));
    const seatedReservationTableIds = new Set(
      seatedReservations.flatMap(r => [r.tableId, ...(r.tableIds || [])]).filter((id): id is string => Boolean(id)),
    );
    const sessionsById = new Map(Object.values(sessions).map(session => [session.id, session]));
    const seatedSessions = tables.reduce<SidebarPlacedItem[]>((items, table) => {
      if (!['occupied', 'billing'].includes(table.status) && !table.sessionId) return items;
      if (seatedReservationTableIds.has(table.id)) return items;

      const session = sessions[table.id] || (table.sessionId ? sessionsById.get(table.sessionId) : undefined);
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
      const strippedTableName = getTableLabelNumber(table);
      const source = session?.guestSource === 'phone' || session?.guestSource === 'online' ? session.guestSource : 'walk_in';
      const fallbackGuestName = source === 'walk_in' ? 'Walk-In' : `${source === 'phone' ? 'Telefon' : 'Online'} ${strippedTableName}`;
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

    return applySidebarControls([...seatedReservations, ...seatedSessions], 'seated');
  }, [applySidebarControls, reservations, sessions, tables, todayStr]);

  const sidebarFinished = useMemo(() => {
    return applySidebarControls(reservations.filter(r => r.date === todayStr && r.status === 'finished'), 'finished');
  }, [applySidebarControls, reservations, todayStr]);

  const sidebarRemoved = useMemo(() => {
    return applySidebarControls(reservations.filter(r => r.date === todayStr && ['cancelled', 'no_show'].includes(r.status)), 'removed');
  }, [applySidebarControls, reservations, todayStr]);

  // --- Counts ---
  const sidebarResParties = sidebarReservations.length;
  const sidebarResCovers = sidebarReservations.reduce((s, r) => s + r.partySize, 0);
  const sidebarSeatedParties = sidebarSeated.length;
  const sidebarSeatedCovers = sidebarSeated.reduce((s, r) => s + r.partySize, 0);
  const sidebarWaitlistParties = sidebarWaitlist.length;
  const sidebarWaitlistCovers = sidebarWaitlist.reduce((s, e) => s + e.partySize, 0);
  const sidebarFinishedParties = sidebarFinished.length;
  const sidebarFinishedCovers = sidebarFinished.reduce((s, r) => s + r.partySize, 0);
  const sidebarRemovedParties = sidebarRemoved.length;
  const sidebarRemovedCovers = sidebarRemoved.reduce((s, r) => s + r.partySize, 0);

  const sidebarReservationsEmpty = sidebarReservations.length === 0;
  const sidebarSeatedEmpty = sidebarSeated.length === 0;
  const sidebarWaitlistEmpty = sidebarWaitlist.length === 0;
  const resolvedSidebarResCollapsed = sidebarReservationsEmpty || sidebarResCollapsed;
  const resolvedSidebarSeatedCollapsed = sidebarSeatedEmpty || sidebarSeatedCollapsed;
  const resolvedSidebarWaitlistCollapsed = sidebarWaitlistEmpty || sidebarWaitlistCollapsed;

  // --- Auto-collapse empty sections ---
  useEffect(() => {
    if (sidebarReservationsEmpty && !sidebarResCollapsed) setSidebarResCollapsed(true);
    if (sidebarSeatedEmpty && !sidebarSeatedCollapsed) setSidebarSeatedCollapsed(true);
    if (sidebarWaitlistEmpty && !sidebarWaitlistCollapsed) setSidebarWaitlistCollapsed(true);
  }, [sidebarReservationsEmpty, sidebarResCollapsed, sidebarSeatedEmpty, sidebarSeatedCollapsed, sidebarWaitlistEmpty, sidebarWaitlistCollapsed]);

  return {
    // UI state
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

    // Computed lists
    sidebarReservations,
    sidebarSeated,
    sidebarWaitlist,
    sidebarFinished,
    sidebarRemoved,

    // Counts
    sidebarResParties, sidebarResCovers,
    sidebarSeatedParties, sidebarSeatedCovers,
    sidebarWaitlistParties, sidebarWaitlistCovers,
    sidebarFinishedParties, sidebarFinishedCovers,
    sidebarRemovedParties, sidebarRemovedCovers,
    sidebarReservationsEmpty,
    sidebarSeatedEmpty,
    sidebarWaitlistEmpty,
  };
}

export type { SidebarSortKey, SidebarSectionKey };
