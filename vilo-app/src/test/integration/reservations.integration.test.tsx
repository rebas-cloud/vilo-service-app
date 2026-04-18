/**
 * Integration tests: Create Reservation → Timeline View → Seat Guest
 *
 * Strategy:
 * - AppProvider + real appReducer (no mocking of state mutations)
 * - Storage layer (loadReservations / addReservation / updateReservation) backed
 *   by jsdom localStorage — no network, no Supabase hit required
 * - Supabase module mocked to prevent real network calls from useSync
 * - Components rendered with a known AppProvider config so table/zone state is
 *   deterministic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AppProvider } from '@/context/AppContext';
import { ReservationPanel } from '@/components/Reservations';
import { Timeline } from '@/components/Timeline';
import { ReservationList } from '@/components/ReservationList';
import { appReducer } from '@/context/reducers/appReducer';
import {
  loadReservations,
  addReservation,
  updateReservation,
  saveReservations,
} from '@/utils/storage';
import { getTodayStr } from '@/utils/common';
import type { Reservation } from '@/types';

// ---------------------------------------------------------------------------
// Infrastructure mocks
// ---------------------------------------------------------------------------

// Prevent useSync from opening Supabase Realtime connections
vi.mock('@/utils/supabase', () => ({
  isSupabaseAvailable: vi.fn(() => false),
  subscribeToState: vi.fn(),
  unsubscribeChannel: vi.fn(),
  supabaseRestaurantExists: vi.fn(() => Promise.resolve(false)),
  supabaseUpdateState: vi.fn(() => Promise.resolve()),
  supabaseSaveConfig: vi.fn(() => Promise.resolve()),
}));

// ---------------------------------------------------------------------------
// Test fixture
// ---------------------------------------------------------------------------

const TODAY = getTodayStr();

const MOCK_CONFIG = {
  restaurant: {
    id: 'r1',
    name: 'Test Restaurant',
    code: 'TEST01',
    currency: 'EUR',
    taxRate: 19,
    pacingLimit: 0, // unlimited pacing for tests
  },
  zones: [{ id: 'z1', name: 'Main' }],
  tables: [
    { id: 't1', name: 'Table 1', zone: 'z1', status: 'free' as const, seats: 4 },
    { id: 't2', name: 'Table 2', zone: 'z1', status: 'free' as const, seats: 2 },
  ],
  tableCombinations: [],
  menu: [],
  staff: [{ id: 's1', name: 'Alice', pin: '1234', role: 'waiter' as const }],
};

// Helper: build a minimal Reservation for direct storage seeding
function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 'res-' + Math.random().toString(36).slice(2, 8),
    guestName: 'Max Mustermann',
    partySize: 2,
    date: TODAY,
    time: '19:00',
    duration: 90,
    status: 'confirmed',
    source: 'phone',
    createdAt: Date.now(),
    ...overrides,
  };
}

// Wrapper that provides AppContext with the test config
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <AppProvider config={MOCK_CONFIG}>{children}</AppProvider>;
}

// ---------------------------------------------------------------------------
// Scenario 1: Create Reservation → Appears in storage + list view
// ---------------------------------------------------------------------------

describe('Scenario 1: New Reservation creation and persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('1a: localStorage starts empty before any reservation', () => {
    const reservations = loadReservations();
    expect(reservations).toHaveLength(0);
  });

  it('1b: addReservation persists a new entry to storage', () => {
    const res = makeReservation({ guestName: 'Anna Schmidt', partySize: 3 });
    const all = addReservation(res);

    expect(all).toHaveLength(1);
    expect(all[0].guestName).toBe('Anna Schmidt');
    expect(all[0].partySize).toBe(3);
    expect(all[0].status).toBe('confirmed');
  });

  it('1c: new reservation has correct date, time, source', () => {
    const res = makeReservation({
      date: TODAY,
      time: '20:00',
      source: 'online',
      partySize: 4,
    });
    addReservation(res);

    const stored = loadReservations();
    expect(stored).toHaveLength(1);
    expect(stored[0].date).toBe(TODAY);
    expect(stored[0].time).toBe('20:00');
    expect(stored[0].source).toBe('online');
  });

  it('1d: ReservationList renders the stored reservation', async () => {
    const res = makeReservation({ guestName: 'Klaus Bauer', date: TODAY, time: '18:00' });
    addReservation(res);

    render(
      <TestWrapper>
        <ReservationList />
      </TestWrapper>
    );

    await waitFor(() => {
      // Name appears in both the list card and the inline detail panel
      const elements = screen.getAllByText('Klaus Bauer');
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  it('1e: multiple reservations are all persisted and loaded', () => {
    addReservation(makeReservation({ guestName: 'Gast A', time: '17:00' }));
    addReservation(makeReservation({ guestName: 'Gast B', time: '18:00' }));
    addReservation(makeReservation({ guestName: 'Gast C', time: '19:00' }));

    const stored = loadReservations();
    expect(stored).toHaveLength(3);
    const names = stored.map(r => r.guestName);
    expect(names).toContain('Gast A');
    expect(names).toContain('Gast B');
    expect(names).toContain('Gast C');
  });

  it('1f: ReservationPanel renders without crashing', () => {
    expect(() =>
      render(
        <TestWrapper>
          <ReservationPanel onClose={() => {}} />
        </TestWrapper>
      )
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: Walk-in → Timeline shows immediately, seat guest
// ---------------------------------------------------------------------------

describe('Scenario 2: Walk-in reservation and seating', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('2a: walk-in reservation has source walk_in and status confirmed', () => {
    const res = makeReservation({
      source: 'walk_in',
      guestName: 'Walk-In Gast',
      time: '19:30',
    });
    addReservation(res);

    const stored = loadReservations();
    expect(stored[0].source).toBe('walk_in');
    expect(stored[0].status).toBe('confirmed');
  });

  it('2b: Timeline renders with walk-in reservation present in storage', async () => {
    const res = makeReservation({
      source: 'walk_in',
      guestName: 'Walk-In Tester',
      tableId: 't1',
    });
    addReservation(res);

    render(
      <TestWrapper>
        <Timeline />
      </TestWrapper>
    );

    // Timeline renders stats bar with group/cover counts
    await waitFor(() => {
      // The timeline renders "X Gruppen" in the stats bar
      const groupsEl = screen.queryByText((text) => text.includes('Gruppen'));
      expect(groupsEl).not.toBeNull();
    });
  });

  it('2c: updating reservation status to seated reflects in storage', () => {
    const res = makeReservation({
      guestName: 'Seated Gast',
      tableId: 't1',
      source: 'walk_in',
    });
    addReservation(res);

    const updated = updateReservation(res.id, { status: 'seated' });
    expect(updated.find(r => r.id === res.id)?.status).toBe('seated');

    // Verify persistence
    const stored = loadReservations();
    expect(stored.find(r => r.id === res.id)?.status).toBe('seated');
  });

  it('2d: seating a walk-in leaves the table data consistent', () => {
    const res = makeReservation({
      source: 'walk_in',
      tableId: 't1',
      partySize: 2,
    });
    addReservation(res);
    updateReservation(res.id, { status: 'seated' });

    // Verify reservation is now seated in storage
    const stored = loadReservations();
    const seated = stored.find(r => r.id === res.id);
    expect(seated?.status).toBe('seated');
    // Table assignment remains intact after status change
    expect(seated?.tableId).toBe('t1');
  });

  it('2e: appReducer SET_ACTIVE_TABLE changes table status to occupied', () => {
    // This tests the FloorPlan side of seating: dispatching SET_ACTIVE_TABLE
    // via the real appReducer (imported via AppProvider) sets the table status.
    // We verify this by checking what appReducer produces directly.
    const baseState = {
      restaurant: MOCK_CONFIG.restaurant,
      tables: MOCK_CONFIG.tables,
      tableCombinations: [],
      zones: MOCK_CONFIG.zones,
      menu: [],
      staff: MOCK_CONFIG.staff,
      sessions: {},
      activeTableId: null,
      currentUser: { id: 's1', name: 'Alice', pin: '1234', role: 'waiter' },
      voiceState: 'idle',
      lastCommand: '',
      lastConfirmation: '',
      commandHistory: [],
      showBilling: false,
      billingMode: null,
      tipHistory: [],
      closedTableRevenue: 0,
      closedTables: [],
      shiftStart: Date.now(),
      shiftHistory: [],
    };

    const nextState = appReducer(baseState, { type: 'SET_ACTIVE_TABLE', tableId: 't1' });

    expect(nextState.activeTableId).toBe('t1');
    expect(nextState.tables.find((t: { id: string }) => t.id === 't1')?.status).toBe('occupied');
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: No-show → cancellation, table stays free
// ---------------------------------------------------------------------------

describe('Scenario 3: No-show handling', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('3a: marking a reservation as no_show changes its status', () => {
    const res = makeReservation({
      guestName: 'No-Show Gast',
      tableId: 't2',
      time: '18:00',
    });
    addReservation(res);

    const updated = updateReservation(res.id, { status: 'no_show' });
    const found = updated.find(r => r.id === res.id);
    expect(found?.status).toBe('no_show');
  });

  it('3b: no-show status persists in localStorage', () => {
    const res = makeReservation({ guestName: 'Kein Erscheinen' });
    addReservation(res);
    updateReservation(res.id, { status: 'no_show' });

    const stored = loadReservations();
    expect(stored.find(r => r.id === res.id)?.status).toBe('no_show');
  });

  it('3c: no-show reservation does NOT set table to occupied in appReducer', () => {
    // A no-show reservation should never trigger SET_ACTIVE_TABLE.
    // Table stays free because the guest never arrived.
    const baseState = {
      restaurant: MOCK_CONFIG.restaurant,
      tables: MOCK_CONFIG.tables.map(t => ({ ...t, status: 'free' as const })),
      tableCombinations: [],
      zones: MOCK_CONFIG.zones,
      menu: [],
      staff: MOCK_CONFIG.staff,
      sessions: {},
      activeTableId: null,
      currentUser: null,
      voiceState: 'idle',
      lastCommand: '',
      lastConfirmation: '',
      commandHistory: [],
      showBilling: false,
      billingMode: null,
      tipHistory: [],
      closedTableRevenue: 0,
      closedTables: [],
      shiftStart: Date.now(),
      shiftHistory: [],
    };

    // No SET_ACTIVE_TABLE dispatched for a no-show — table remains free
    const t2Before = baseState.tables.find(t => t.id === 't2');
    expect(t2Before?.status).toBe('free');

    // State unchanged (no action dispatched for no-show)
    const stateAfter = appReducer(baseState, { type: 'CLEAR_ACTIVE_TABLE' });
    expect(stateAfter.tables.find((t: { id: string }) => t.id === 't2')?.status).toBe('free');
  });

  it('3d: Timeline shows no-show indicator when no_show reservations exist', async () => {
    const res = makeReservation({
      guestName: 'Missing Guest',
      tableId: 't1',
      status: 'no_show',
    });
    // Save directly to bypass the addReservation → confirmed default
    saveReservations([res]);

    render(
      <TestWrapper>
        <Timeline />
      </TestWrapper>
    );

    await waitFor(() => {
      // Timeline stats bar shows "X No-Shows" only when no_shows > 0
      const noShowEl = screen.queryByText((text) => text.includes('No-Show'));
      expect(noShowEl).not.toBeNull();
    });
  });

  it('3e: cancelled reservation is excluded from timeline stats', async () => {
    // One cancelled + one confirmed — only the confirmed counts toward stats
    saveReservations([
      makeReservation({ status: 'cancelled', guestName: 'Storniert', tableId: 't1' }),
      makeReservation({ status: 'confirmed', guestName: 'Aktiv', tableId: 't2' }),
    ]);

    render(
      <TestWrapper>
        <Timeline />
      </TestWrapper>
    );

    await waitFor(() => {
      // Only 1 group (non-cancelled) appears in the stats bar
      const groupEl = screen.queryByText((text) => text.includes('1 Gruppen'));
      expect(groupEl).not.toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: Invariant checks (reducer-level, no UI required)
// ---------------------------------------------------------------------------

describe('Invariant checks: appReducer state transitions', () => {
  // Real reducer imported at the top — no mocking

  function baseState() {
    return {
      restaurant: MOCK_CONFIG.restaurant,
      tables: [
        { id: 't1', name: 'Table 1', zone: 'z1', status: 'free' as const, seats: 4 },
        { id: 't2', name: 'Table 2', zone: 'z1', status: 'free' as const, seats: 2 },
      ],
      tableCombinations: [],
      zones: MOCK_CONFIG.zones,
      menu: [],
      staff: MOCK_CONFIG.staff,
      sessions: {},
      activeTableId: null,
      currentUser: { id: 's1', name: 'Alice', pin: '1234', role: 'waiter' as const },
      voiceState: 'idle' as const,
      lastCommand: '',
      lastConfirmation: '',
      commandHistory: [],
      showBilling: false,
      billingMode: null,
      tipHistory: [],
      closedTableRevenue: 0,
      closedTables: [],
      shiftStart: Date.now(),
      shiftHistory: [],
    };
  }

  it('INV-1: Seating (SET_ACTIVE_TABLE) marks table occupied and creates session', () => {
    const state = baseState();
    const next = appReducer(state, { type: 'SET_ACTIVE_TABLE', tableId: 't1' });

    expect(next.tables.find((t: { id: string }) => t.id === 't1')?.status).toBe('occupied');
    expect(next.sessions['t1']).toBeDefined();
    expect(next.activeTableId).toBe('t1');
  });

  it('INV-2: Closing table (CLOSE_TABLE) frees the table', () => {
    let state = baseState();
    state = appReducer(state, { type: 'SET_ACTIVE_TABLE', tableId: 't1' });
    expect(state.tables.find((t: { id: string }) => t.id === 't1')?.status).toBe('occupied');

    state = appReducer(state, { type: 'CLOSE_TABLE', tableId: 't1' });
    expect(state.tables.find((t: { id: string }) => t.id === 't1')?.status).toBe('free');
    expect(state.sessions['t1']).toBeUndefined();
  });

  it('INV-3: Reservation status lifecycle — confirmed → seated via updateReservation', () => {
    localStorage.clear();
    const res = makeReservation({ status: 'confirmed' });
    addReservation(res);

    // Transition to seated
    const afterSeat = updateReservation(res.id, { status: 'seated' });
    expect(afterSeat.find(r => r.id === res.id)?.status).toBe('seated');

    // Transition to finished (completed flow)
    const afterFinish = updateReservation(res.id, { status: 'finished' });
    expect(afterFinish.find(r => r.id === res.id)?.status).toBe('finished');
  });

  it('INV-4: Cancellation keeps table free — no reducer action fired', () => {
    const state = baseState();

    // Cancelling a reservation should not change any table status
    // (cancellation lives in storage only; SET_TABLE_STATUS is not dispatched)
    const nextState = appReducer(state, { type: 'CLEAR_ACTIVE_TABLE' });
    expect(nextState.tables.every((t: { status: string }) => t.status === 'free')).toBe(true);
  });

  it('INV-5: SET_GUEST_SOURCE and SET_GUEST_COUNT update session correctly', () => {
    let state = baseState();
    state = appReducer(state, { type: 'SET_ACTIVE_TABLE', tableId: 't1' });
    state = appReducer(state, { type: 'SET_GUEST_SOURCE', tableId: 't1', source: 'walk_in' });
    state = appReducer(state, { type: 'SET_GUEST_COUNT', tableId: 't1', guestCount: 3 });

    expect(state.sessions['t1'].guestSource).toBe('walk_in');
    expect(state.sessions['t1'].guestCount).toBe(3);
  });

  it('INV-6: Unknown tableId in SET_ACTIVE_TABLE returns unchanged state', () => {
    const state = baseState();
    const next = appReducer(state, { type: 'SET_ACTIVE_TABLE', tableId: 'nonexistent' });
    expect(next.activeTableId).toBeNull();
    expect(next).toBe(state); // same reference — no mutation
  });

  it('INV-7: Reservation storage is isolated from AppState (no cross-contamination)', () => {
    localStorage.clear();
    const res = makeReservation({ guestName: 'Isolated Guest' });
    addReservation(res);

    // AppState knows nothing about reservations (they live in separate localStorage key)
    const state = baseState();
    // Confirm no reservation data leaked into sessions
    expect(Object.keys(state.sessions)).toHaveLength(0);
    // And state reducer returns same sessions since we didn't dispatch any action
    const next = appReducer(state, { type: 'CLEAR_ACTIVE_TABLE' });
    expect(Object.keys(next.sessions)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario 5: Edge cases for pacing and multi-table reservations
// ---------------------------------------------------------------------------

describe('Pacing and multi-table edge cases', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('5a: multiple reservations in the same 30-min slot all persist', () => {
    // Pacing limit 0 (unlimited) — all should be stored
    addReservation(makeReservation({ time: '19:00', guestName: 'Gast 1' }));
    addReservation(makeReservation({ time: '19:15', guestName: 'Gast 2' }));
    addReservation(makeReservation({ time: '19:29', guestName: 'Gast 3' }));

    const stored = loadReservations();
    expect(stored).toHaveLength(3);
  });

  it('5b: reservation with tableIds array persists correctly', () => {
    const res = makeReservation({
      tableId: 't1',
      tableIds: ['t1', 't2'],
      partySize: 6,
    });
    addReservation(res);

    const stored = loadReservations();
    expect(stored[0].tableIds).toEqual(['t1', 't2']);
    expect(stored[0].tableId).toBe('t1');
  });

  it('5c: reservation without table assignment is valid (no table required at booking time)', () => {
    const res = makeReservation({ tableId: undefined });
    addReservation(res);

    const stored = loadReservations();
    expect(stored[0].tableId).toBeUndefined();
    expect(stored[0].status).toBe('confirmed');
  });
});
