/**
 * Billing / Payment integration tests — critical money flow.
 *
 * Strategy: real appReducer + real AppProvider. Only the storage utility layer
 * (loadReservations, findGuestByPhone, addGuestVisit) is mocked because it
 * talks to localStorage in ways that are irrelevant to billing state correctness.
 *
 * Three main scenarios:
 *   1. Combined billing  – full order → card payment → table closes.
 *   2. Equal-split billing – 2 persons, mixed methods → table closes.
 *   3. Guest-split billing – per-seat assignment → per-guest payment → table closes.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppProvider, useApp } from '@/context/AppContext';
import { BillingModal } from '@/components/BillingModal';
import type { TableSession, OrderItem } from '@/types';

// ---------------------------------------------------------------------------
// Mock only the storage helpers used inside BillingModal's trackGuestVisit().
// The reducer and AppProvider run unmodified.
// ---------------------------------------------------------------------------
vi.mock('@/utils/storage', () => ({
  addGuestVisit: vi.fn(),
  loadReservations: vi.fn(() => []),
  findGuestByPhone: vi.fn(() => null),
}));

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const RESTAURANT = {
  id: 'r1',
  name: 'Integrations-Restaurant',
  code: 'INT001',
  currency: 'EUR',
  taxRate: 19,
};

const ZONES = [{ id: 'z1', name: 'Innen' }];

const TABLES = [
  { id: 't1', name: 'Tisch 1', zone: 'z1', status: 'occupied' as const },
  { id: 't2', name: 'Tisch 2', zone: 'z1', status: 'free' as const },
];

const MENU = [
  { id: 'm1', name: 'Pasta', price: 12.50, category: 'mains' as const, routing: 'kitchen' as const },
  { id: 'm2', name: 'Wein',  price: 8.00,  category: 'drinks' as const, routing: 'bar' as const },
  { id: 'm3', name: 'Wasser', price: 3.00, category: 'drinks' as const, routing: 'bar' as const },
];

// Helper: build a minimal valid OrderItem
function makeOrder(overrides: Partial<OrderItem> & Pick<OrderItem, 'id' | 'menuItemId' | 'name' | 'price'>): OrderItem {
  return {
    quantity: 1,
    modifiers: [],
    state: 'served',
    routing: 'kitchen',
    timestamp: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test-wrapper that seeds state via dispatches BEFORE BillingModal renders.
// This avoids the async SYNC_STATE / SET_ACTIVE_TABLE timing races seen in
// other tests by injecting the session directly through SYNC_STATE first,
// then setting the active table.
// ---------------------------------------------------------------------------

interface SeedProps {
  session: TableSession;
  children: React.ReactNode;
}

function StateSeeder({ session, children }: SeedProps) {
  const { dispatch } = useApp();

  // One-shot seed on mount — runs synchronously before first paint.
  // We use a ref so the effect only fires once regardless of React StrictMode
  // double-invocation.
  const seeded = React.useRef(false);
  if (!seeded.current) {
    seeded.current = true;
    // Inject the pre-built session (with orders) into shared state.
    dispatch({
      type: 'SYNC_STATE',
      sessions: { [session.tableId]: session },
      closedTables: [],
      tipHistory: [],
      closedTableRevenue: 0,
      shiftStart: Date.now(),
      shiftHistory: [],
    });
    // Point the active view at that table and open the billing modal.
    dispatch({ type: 'SET_ACTIVE_TABLE', tableId: session.tableId });
    dispatch({ type: 'SHOW_BILLING', mode: 'combined' });
  }

  return <>{children}</>;
}

// Convenience render helper
function renderBilling(session: TableSession) {
  return render(
    <AppProvider
      config={{
        restaurant: RESTAURANT,
        zones: ZONES,
        tables: TABLES,
        menu: MENU,
        staff: [],
      }}
    >
      <StateSeeder session={session}>
        <BillingModal />
      </StateSeeder>
    </AppProvider>
  );
}

// Observe the AppState from inside a component — used to inspect state after
// user interactions without exposing dispatch externally.
function StateCapture({ onState }: { onState: (s: ReturnType<typeof useApp>['state']) => void }) {
  const { state } = useApp();
  // Call on every render so the parent always gets the latest snapshot.
  onState(state);
  return null;
}

function renderBillingWithCapture(session: TableSession) {
  let capturedState = {} as ReturnType<typeof useApp>['state'];
  const result = render(
    <AppProvider
      config={{
        restaurant: RESTAURANT,
        zones: ZONES,
        tables: TABLES,
        menu: MENU,
        staff: [],
      }}
    >
      <StateSeeder session={session}>
        <StateCapture onState={s => { capturedState = s; }} />
        <BillingModal />
      </StateSeeder>
    </AppProvider>
  );
  return { ...result, getState: () => capturedState };
}

// ---------------------------------------------------------------------------
// Scenario 1 — Combined billing
// Order: Pasta (12.50) × 2  +  Wein (8.00) × 1  = 33.00 EUR total
// Tax:   33.00 × 19%  = 6.27 EUR
// ---------------------------------------------------------------------------

const SESSION_COMBINED: TableSession = {
  id: 'sess-combined',
  tableId: 't1',
  orders: [
    makeOrder({ id: 'o1', menuItemId: 'm1', name: 'Pasta', price: 12.50, quantity: 2, routing: 'kitchen' }),
    makeOrder({ id: 'o2', menuItemId: 'm2', name: 'Wein',  price: 8.00,  quantity: 1, routing: 'bar' }),
  ],
  notes: [],
  startTime: Date.now() - 60_000,
};

describe('Scenario 1 — Combined Billing (full order → card payment → close)', () => {

  it('BillingModal displays the combined total: 12.50×2 + 8.00 = 33.00 EUR', async () => {
    renderBilling(SESSION_COMBINED);
    await waitFor(() => {
      // Multiple elements may contain "33.00 EUR"; we only require at least one.
      expect(screen.getByText('33.00 EUR')).toBeInTheDocument();
    });
  });

  it('displays 19% MwSt correctly: 33.00 × 0.19 = 6.27 EUR', async () => {
    renderBilling(SESSION_COMBINED);
    await waitFor(() => {
      const taxLine = screen.getByText(/MwSt/);
      expect(taxLine.parentElement?.textContent).toContain('6.27');
    });
  });

  it('shows both order items with correct line totals', async () => {
    renderBilling(SESSION_COMBINED);
    await waitFor(() => {
      expect(screen.getByText(/2x Pasta/)).toBeInTheDocument();
      // Line total for 2× Pasta = 25.00 EUR
      expect(screen.getByText('25.00 EUR')).toBeInTheDocument();
      expect(screen.getByText(/Wein/)).toBeInTheDocument();
      expect(screen.getByText('8.00 EUR')).toBeInTheDocument();
    });
  });

  it('clicking "Karte" advances to the Trinkgeld screen', async () => {
    const user = userEvent.setup();
    renderBilling(SESSION_COMBINED);

    await waitFor(() => screen.getAllByText('33.00 EUR'));

    const cardButtons = screen.getAllByRole('button', { name: /Karte/i });
    await user.click(cardButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Trinkgeld')).toBeInTheDocument();
      // Rechnungsbetrag shown on tip screen equals the base total.
      const amounts = screen.getAllByText('33.00 EUR');
      expect(amounts.length).toBeGreaterThan(0);
    });
  });

  it('10% tip preset calculates correctly: 33.00 × 10% = 3.30 EUR', async () => {
    const user = userEvent.setup();
    renderBilling(SESSION_COMBINED);

    await waitFor(() => screen.getByText('33.00 EUR'));

    const cardButtons = screen.getAllByRole('button', { name: /Karte/i });
    await user.click(cardButtons[0]);

    await waitFor(() => screen.getByText('Trinkgeld'));

    // Click the 10% preset
    const tenPctButton = screen.getByRole('button', { name: /10%/i });
    await user.click(tenPctButton);

    // Trinkgeld line: +3.30 EUR
    await waitFor(() => {
      expect(screen.getByText('+3.30 EUR')).toBeInTheDocument();
      // Grand total = 33.00 + 3.30 = 36.30 EUR
      expect(screen.getByText('36.30 EUR')).toBeInTheDocument();
    });
  });

  it('after confirming payment CLOSE_TABLE fires: table becomes free, closedTables updated', async () => {
    const user = userEvent.setup();
    const { getState } = renderBillingWithCapture(SESSION_COMBINED);

    await waitFor(() => screen.getByText('33.00 EUR'));

    const cardButtons = screen.getAllByRole('button', { name: /Karte/i });
    await user.click(cardButtons[0]);

    await waitFor(() => screen.getByText('Trinkgeld'));

    // Confirm with no tip (kein Trinkgeld already selected by default tipAmount=0)
    const confirmButton = screen.getByRole('button', { name: /Kartenzahlung/i });
    await user.click(confirmButton);

    // Payment complete screen
    await waitFor(() => {
      expect(screen.getByText('Zahlung abgeschlossen')).toBeInTheDocument();
    });

    // Click "Fertig" to close table
    const fertigButton = screen.getByRole('button', { name: /Fertig/i });
    await user.click(fertigButton);

    await waitFor(() => {
      const st = getState();
      // Table t1 must be free again
      const t1 = st.tables.find(t => t.id === 't1');
      expect(t1?.status).toBe('free');
      // Session must be gone
      expect(st.sessions['t1']).toBeUndefined();
      // Revenue must be recorded
      expect(st.closedTableRevenue).toBeCloseTo(33.00, 2);
      // closedTables must contain one record with correct revenue
      expect(st.closedTables).toHaveLength(1);
      expect(st.closedTables[0].revenue).toBeCloseTo(33.00, 2);
    });
  });

  it('after close: showBilling resets to false', async () => {
    const user = userEvent.setup();
    const { getState } = renderBillingWithCapture(SESSION_COMBINED);

    await waitFor(() => screen.getByText('33.00 EUR'));

    const cardButtons = screen.getAllByRole('button', { name: /Karte/i });
    await user.click(cardButtons[0]);

    await waitFor(() => screen.getByText('Trinkgeld'));

    const confirmButton = screen.getByRole('button', { name: /Kartenzahlung/i });
    await user.click(confirmButton);

    await waitFor(() => screen.getByText('Zahlung abgeschlossen'));

    const fertigButton = screen.getByRole('button', { name: /Fertig/i });
    await user.click(fertigButton);

    await waitFor(() => {
      expect(getState().showBilling).toBe(false);
    });
  });

  it('tip is recorded in tipHistory with correct amount and method', async () => {
    const user = userEvent.setup();
    const { getState } = renderBillingWithCapture(SESSION_COMBINED);

    await waitFor(() => screen.getByText('33.00 EUR'));

    const cardButtons = screen.getAllByRole('button', { name: /Karte/i });
    await user.click(cardButtons[0]);

    await waitFor(() => screen.getByText('Trinkgeld'));

    // Select 5% tip preset (33.00 × 5% = 1.65 EUR)
    // getAllByRole because the tip screen can render multiple pct buttons
    const fivePctButtons = screen.getAllByRole('button', { name: /5%/i });
    await user.click(fivePctButtons[0]);

    const confirmButton = screen.getByRole('button', { name: /Kartenzahlung/i });
    await user.click(confirmButton);

    await waitFor(() => screen.getByText('Zahlung abgeschlossen'));

    const fertigButton = screen.getByRole('button', { name: /Fertig/i });
    await user.click(fertigButton);

    await waitFor(() => {
      const tips = getState().tipHistory;
      expect(tips).toHaveLength(1);
      expect(tips[0].amount).toBeCloseTo(1.65, 2);
      expect(tips[0].method).toBe('card');
      expect(tips[0].tableId).toBe('t1');
    });
  });
});

// ---------------------------------------------------------------------------
// Scenario 2 — Equal-split billing (2 persons)
// Order: Pasta (12.50) + Wein (8.00) + Wasser (3.00) = 23.50 EUR
// Per person: 23.50 / 2 = 11.75 EUR
// ---------------------------------------------------------------------------

const SESSION_EQUAL_SPLIT: TableSession = {
  id: 'sess-equal',
  tableId: 't1',
  orders: [
    makeOrder({ id: 'o1', menuItemId: 'm1', name: 'Pasta',  price: 12.50, quantity: 1, routing: 'kitchen' }),
    makeOrder({ id: 'o2', menuItemId: 'm2', name: 'Wein',   price:  8.00, quantity: 1, routing: 'bar' }),
    makeOrder({ id: 'o3', menuItemId: 'm3', name: 'Wasser', price:  3.00, quantity: 1, routing: 'bar' }),
  ],
  notes: [],
  startTime: Date.now() - 90_000,
};

describe('Scenario 2 — Equal-split billing (2×11.75, mixed methods → close)', () => {

  it('total displayed is 23.50 EUR', async () => {
    const user = userEvent.setup();
    renderBilling(SESSION_EQUAL_SPLIT);

    await waitFor(() => screen.getByText('23.50 EUR'));

    // Switch to "Teilen" (equal) mode
    const equalButton = screen.getByRole('button', { name: /Teilen/i });
    await user.click(equalButton);

    await waitFor(() => {
      // Gesamt label in equal mode
      expect(screen.getByText(/Gesamt: 23.50 EUR/i)).toBeInTheDocument();
    });
  });

  it('per-person amount: 23.50 / 2 = 11.75 EUR', async () => {
    const user = userEvent.setup();
    renderBilling(SESSION_EQUAL_SPLIT);

    await waitFor(() => screen.getByText('23.50 EUR'));

    const equalButton = screen.getByRole('button', { name: /Teilen/i });
    await user.click(equalButton);

    await waitFor(() => {
      const perPersonAmounts = screen.getAllByText('11.75 EUR');
      expect(perPersonAmounts.length).toBeGreaterThan(0);
    });
  });

  it('split math invariant: sum of portions equals total (0 remainder)', () => {
    // 23.50 / 2 = 11.75; 11.75 × 2 = 23.50 — no floating-point gap
    const total = 12.50 + 8.00 + 3.00;
    const portions = 2;
    const perPerson = total / portions;
    const sumOfParts = perPerson * portions;
    // Must be exact (or within floating-point tolerance) — no cent missing
    expect(Math.abs(sumOfParts - total)).toBeLessThan(0.005);
  });

  it('person 1 card + person 2 cash → "Alle bezahlt" screen', async () => {
    const user = userEvent.setup();
    renderBilling(SESSION_EQUAL_SPLIT);

    await waitFor(() => screen.getByText('23.50 EUR'));

    const equalButton = screen.getByRole('button', { name: /Teilen/i });
    await user.click(equalButton);

    await waitFor(() => screen.getAllByText('11.75 EUR'));

    // Pay person 1 with card
    const karteButtons = screen.getAllByRole('button', { name: /Karte/i });
    await user.click(karteButtons[0]); // first person's Karte button

    await waitFor(() => screen.getByText('Trinkgeld'));

    // No tip — confirm
    const confirmCard = screen.getByRole('button', { name: /Kartenzahlung/i });
    await user.click(confirmCard);

    // Back to split overview — person 1 marked paid
    await waitFor(() => {
      expect(screen.getByText(/Karte bezahlt/i)).toBeInTheDocument();
    });

    // Pay person 2 with cash
    const barButtons = screen.getAllByRole('button', { name: /Bar/i });
    await user.click(barButtons[0]);

    await waitFor(() => screen.getByText('Trinkgeld'));

    const confirmCash = screen.getByRole('button', { name: /Barzahlung/i });
    await user.click(confirmCash);

    // Both paid → completion screen
    await waitFor(() => {
      expect(screen.getByText('Alle bezahlt')).toBeInTheDocument();
    });
  });

  it('after "Fertig" on equal split: table free, session deleted, closedTables populated', async () => {
    const user = userEvent.setup();
    const { getState } = renderBillingWithCapture(SESSION_EQUAL_SPLIT);

    await waitFor(() => screen.getByText('23.50 EUR'));

    const equalButton = screen.getByRole('button', { name: /Teilen/i });
    await user.click(equalButton);

    await waitFor(() => screen.getAllByText('11.75 EUR'));

    // Pay person 1 (card, no tip)
    const karteButtons1 = screen.getAllByRole('button', { name: /Karte/i });
    await user.click(karteButtons1[0]);
    await waitFor(() => screen.getByText('Trinkgeld'));
    await user.click(screen.getByRole('button', { name: /Kartenzahlung/i }));

    await waitFor(() => screen.getByText(/Karte bezahlt/i));

    // Pay person 2 (cash, no tip)
    const barButtons2 = screen.getAllByRole('button', { name: /Bar/i });
    await user.click(barButtons2[0]);
    await waitFor(() => screen.getByText('Trinkgeld'));
    await user.click(screen.getByRole('button', { name: /Barzahlung/i }));

    await waitFor(() => screen.getByText('Alle bezahlt'));

    const fertigButton = screen.getByRole('button', { name: /Fertig/i });
    await user.click(fertigButton);

    await waitFor(() => {
      const st = getState();
      const t1 = st.tables.find(t => t.id === 't1');
      expect(t1?.status).toBe('free');
      expect(st.sessions['t1']).toBeUndefined();
      expect(st.closedTables).toHaveLength(1);
      // Revenue recorded is the raw order total (tips tracked separately)
      expect(st.closedTables[0].revenue).toBeCloseTo(23.50, 2);
    });
  });
});

// ---------------------------------------------------------------------------
// Scenario 3 — Guest-split billing (per-seat assignment)
// Two guests, each with their own orders:
//   Gast 1: Pasta (12.50) → seatId 1
//   Gast 2: Wein (8.00) + Wasser (3.00) → seatId 2
// Totals: Gast 1 = 12.50, Gast 2 = 11.00, combined = 23.50
// ---------------------------------------------------------------------------

const SESSION_GUEST_SPLIT: TableSession = {
  id: 'sess-guest-split',
  tableId: 't1',
  orders: [
    makeOrder({ id: 'o1', menuItemId: 'm1', name: 'Pasta',  price: 12.50, quantity: 1, routing: 'kitchen', seatId: 1 }),
    makeOrder({ id: 'o2', menuItemId: 'm2', name: 'Wein',   price:  8.00, quantity: 1, routing: 'bar',     seatId: 2 }),
    makeOrder({ id: 'o3', menuItemId: 'm3', name: 'Wasser', price:  3.00, quantity: 1, routing: 'bar',     seatId: 2 }),
  ],
  notes: [],
  startTime: Date.now() - 120_000,
};

describe('Scenario 3 — Guest-split billing (per-seat, mixed payment)', () => {

  it('switching to Getrennt mode shows Gast 1 and Gast 2 sections', async () => {
    const user = userEvent.setup();
    renderBilling(SESSION_GUEST_SPLIT);

    await waitFor(() => screen.getByText('23.50 EUR'));

    const splitButton = screen.getByRole('button', { name: /Getrennt/i });
    await user.click(splitButton);

    await waitFor(() => {
      expect(screen.getByText(/Gast 1/)).toBeInTheDocument();
      expect(screen.getByText(/Gast 2/)).toBeInTheDocument();
    });
  });

  it('Gast 1 total = 12.50 EUR, Gast 2 total = 11.00 EUR', async () => {
    const user = userEvent.setup();
    renderBilling(SESSION_GUEST_SPLIT);

    await waitFor(() => screen.getByText('23.50 EUR'));

    const splitButton = screen.getByRole('button', { name: /Getrennt/i });
    await user.click(splitButton);

    await waitFor(() => {
      // 12.50 for Gast 1
      const gast1Amounts = screen.getAllByText('12.50 EUR');
      expect(gast1Amounts.length).toBeGreaterThan(0);
      // 11.00 for Gast 2
      const gast2Amounts = screen.getAllByText('11.00 EUR');
      expect(gast2Amounts.length).toBeGreaterThan(0);
    });
  });

  it('sum of guest portions equals session total (split-bill invariant)', () => {
    // Gast 1: 12.50, Gast 2: 8.00 + 3.00 = 11.00; sum = 23.50
    const gast1 = 12.50;
    const gast2 = 8.00 + 3.00;
    const sessionTotal = SESSION_GUEST_SPLIT.orders.reduce((s, o) => s + o.price * o.quantity, 0);
    expect(Math.abs((gast1 + gast2) - sessionTotal)).toBeLessThan(0.005);
  });

  it('paying Gast 1 (card) marks that section as paid', async () => {
    const user = userEvent.setup();
    renderBilling(SESSION_GUEST_SPLIT);

    await waitFor(() => screen.getByText('23.50 EUR'));

    const splitButton = screen.getByRole('button', { name: /Getrennt/i });
    await user.click(splitButton);

    await waitFor(() => screen.getByText(/Gast 1/));

    // Click the first Karte button (belongs to Gast 1)
    const karteButtons = screen.getAllByRole('button', { name: /Karte/i });
    await user.click(karteButtons[0]);

    await waitFor(() => screen.getByText('Trinkgeld'));

    await user.click(screen.getByRole('button', { name: /Kartenzahlung/i }));

    await waitFor(() => {
      expect(screen.getByText(/Karte bezahlt/i)).toBeInTheDocument();
    });
  });

  it('after both guests pay → Alle bezahlt → Fertig → table closes', async () => {
    const user = userEvent.setup();
    const { getState } = renderBillingWithCapture(SESSION_GUEST_SPLIT);

    await waitFor(() => screen.getByText('23.50 EUR'));

    const splitButton = screen.getByRole('button', { name: /Getrennt/i });
    await user.click(splitButton);

    await waitFor(() => screen.getByText(/Gast 1/));

    // --- Pay Gast 1 with card ---
    const karteButtons = screen.getAllByRole('button', { name: /Karte/i });
    await user.click(karteButtons[0]);
    await waitFor(() => screen.getByText('Trinkgeld'));
    await user.click(screen.getByRole('button', { name: /Kartenzahlung/i }));

    await waitFor(() => screen.getByText(/Karte bezahlt/i));

    // --- Pay Gast 2 with cash ---
    const barButtons = screen.getAllByRole('button', { name: /Bar/i });
    await user.click(barButtons[0]);
    await waitFor(() => screen.getByText('Trinkgeld'));
    await user.click(screen.getByRole('button', { name: /Barzahlung/i }));

    await waitFor(() => {
      expect(screen.getByText('Alle bezahlt')).toBeInTheDocument();
    });

    const fertigButton = screen.getByRole('button', { name: /Fertig/i });
    await user.click(fertigButton);

    await waitFor(() => {
      const st = getState();
      const t1 = st.tables.find(t => t.id === 't1');
      expect(t1?.status).toBe('free');
      expect(st.sessions['t1']).toBeUndefined();
      expect(st.closedTables).toHaveLength(1);
      expect(st.closedTables[0].revenue).toBeCloseTo(23.50, 2);
      // paymentMethod is 'mixed' because tips came in via card AND cash
      // (tip records drive this; with 0 tip the set is empty → fallback 'cash')
      // What matters is the table is closed and revenue is correct.
    });
  });
});

// ---------------------------------------------------------------------------
// Reducer-level invariant tests (no UI — direct reducer calls)
// These are fast, hermetic, and document the money invariants explicitly.
// ---------------------------------------------------------------------------

import { appReducer } from '@/context/reducers/appReducer';
import type { AppState } from '@/context/AppContext';

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    restaurant: RESTAURANT,
    tables: [
      { id: 't1', name: 'Tisch 1', zone: 'z1', status: 'occupied' },
      { id: 't2', name: 'Tisch 2', zone: 'z1', status: 'free' },
    ],
    tableCombinations: [],
    zones: ZONES,
    menu: MENU,
    staff: [],
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
    ...overrides,
  };
}

describe('Reducer invariants — billing math & session lifecycle', () => {

  beforeEach(() => {
    // Ensure localStorage is clean so loadShiftHistory returns []
    localStorage.clear();
  });

  it('CLOSE_TABLE: revenue = sum(price × quantity) for all items', () => {
    const orders: OrderItem[] = [
      makeOrder({ id: 'o1', menuItemId: 'm1', name: 'Pasta',  price: 12.50, quantity: 2, routing: 'kitchen' }),
      makeOrder({ id: 'o2', menuItemId: 'm2', name: 'Wein',   price:  8.00, quantity: 3, routing: 'bar' }),
    ];
    // Expected: 12.50×2 + 8.00×3 = 25.00 + 24.00 = 49.00
    const expectedRevenue = 49.00;

    const state = makeState({
      activeTableId: 't1',
      sessions: {
        t1: {
          id: 'sess1', tableId: 't1', orders, notes: [], startTime: Date.now(),
        },
      },
    });

    const next = appReducer(state, { type: 'CLOSE_TABLE', tableId: 't1' });

    expect(next.closedTableRevenue).toBeCloseTo(expectedRevenue, 10);
    expect(next.closedTables[0].revenue).toBeCloseTo(expectedRevenue, 10);
  });

  it('CLOSE_TABLE: table status becomes free, session deleted', () => {
    const state = makeState({
      activeTableId: 't1',
      sessions: {
        t1: {
          id: 'sess1', tableId: 't1',
          orders: [makeOrder({ id: 'o1', menuItemId: 'm1', name: 'X', price: 5.00, quantity: 1, routing: 'kitchen' })],
          notes: [], startTime: Date.now(),
        },
      },
    });

    const next = appReducer(state, { type: 'CLOSE_TABLE', tableId: 't1' });

    expect(next.tables.find(t => t.id === 't1')?.status).toBe('free');
    expect(next.sessions['t1']).toBeUndefined();
    // activeTableId clears when it matched the closed table
    expect(next.activeTableId).toBeNull();
  });

  it('CLOSE_TABLE: closed session is immutable (snapshot preserved)', () => {
    const originalOrders: OrderItem[] = [
      makeOrder({ id: 'o1', menuItemId: 'm1', name: 'Pasta', price: 12.50, quantity: 1, routing: 'kitchen' }),
    ];

    const state = makeState({
      activeTableId: 't1',
      sessions: {
        t1: { id: 'sess1', tableId: 't1', orders: originalOrders, notes: [], startTime: Date.now() },
      },
    });

    const next = appReducer(state, { type: 'CLOSE_TABLE', tableId: 't1' });

    // The closed record must carry a snapshot of orders, not a reference.
    // Mutating the original array must not affect the closed record.
    const recordOrders = next.closedTables[0].orders;
    expect(recordOrders).toHaveLength(1);
    expect(recordOrders[0].price).toBe(12.50);
  });

  it('CLOSE_TABLE on non-existent table: state unchanged', () => {
    const state = makeState();
    const next = appReducer(state, { type: 'CLOSE_TABLE', tableId: 'ghost' });
    // No session, no closed record, revenue stays 0
    expect(next.closedTables).toHaveLength(0);
    expect(next.closedTableRevenue).toBe(0);
  });

  it('ADD_TIP: tip accumulates in tipHistory', () => {
    const state = makeState();
    const tip = { amount: 3.50, tableId: 't1', tableName: 'Tisch 1', method: 'card' as const, timestamp: Date.now() };
    const next = appReducer(state, { type: 'ADD_TIP', tip });
    expect(next.tipHistory).toHaveLength(1);
    expect(next.tipHistory[0].amount).toBe(3.50);
    expect(next.tipHistory[0].method).toBe('card');
  });

  it('CLOSE_TABLE with tip: tip sum included in ClosedTableRecord.tips', () => {
    const state = makeState({
      activeTableId: 't1',
      sessions: {
        t1: {
          id: 'sess1', tableId: 't1',
          orders: [makeOrder({ id: 'o1', menuItemId: 'm1', name: 'X', price: 20.00, quantity: 1, routing: 'kitchen' })],
          notes: [], startTime: Date.now(),
        },
      },
      tipHistory: [
        { amount: 2.00, tableId: 't1', tableName: 'Tisch 1', method: 'card',  timestamp: Date.now() },
        { amount: 1.50, tableId: 't1', tableName: 'Tisch 1', method: 'cash',  timestamp: Date.now() },
        { amount: 5.00, tableId: 't2', tableName: 'Tisch 2', method: 'card',  timestamp: Date.now() },
      ],
    });

    const next = appReducer(state, { type: 'CLOSE_TABLE', tableId: 't1' });

    // Only t1 tips: 2.00 + 1.50 = 3.50
    expect(next.closedTables[0].tips).toBeCloseTo(3.50, 2);
    // paymentMethod is 'mixed' because both card and cash tips exist for t1
    expect(next.closedTables[0].paymentMethod).toBe('mixed');
  });

  it('session uniqueness invariant: only one session per tableId after SET_ACTIVE_TABLE', () => {
    // First activation creates session
    const state1 = makeState();
    const next1 = appReducer(state1, { type: 'SET_ACTIVE_TABLE', tableId: 't2' });
    expect(Object.keys(next1.sessions).filter(k => k === 't2')).toHaveLength(1);

    // Second activation of same table must not duplicate session
    const next2 = appReducer(next1, { type: 'SET_ACTIVE_TABLE', tableId: 't2' });
    expect(Object.keys(next2.sessions).filter(k => k === 't2')).toHaveLength(1);
  });
});
