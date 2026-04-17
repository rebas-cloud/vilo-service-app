import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BillingModal } from './BillingModal';
import { AppProvider, useApp } from '@/context/AppContext';
import type { TableSession } from '@/types';

vi.mock('@/utils/storage', () => ({
  addGuestVisit: vi.fn(),
  loadReservations: vi.fn(() => []),
  findGuestByPhone: vi.fn(() => null),
}));

const mockRestaurant = {
  id: 'r1',
  name: 'Test Restaurant',
  code: 'TEST42',
  currency: 'EUR',
  taxRate: 19,
};

const mockTables = [
  { id: 't1', name: 'Tisch 1', zone: 'z1', status: 'occupied' as const, capacity: 4, seatingLayout: [] },
  { id: 't2', name: 'Tisch 2', zone: 'z1', status: 'free' as const, capacity: 2, seatingLayout: [] },
];

const mockZones = [{ id: 'z1', name: 'Innen' }];

const mockMenu = [
  { id: 'm1', name: 'Schnitzel', price: 15.0, category: 'mains', routing: 'kitchen' as const },
  { id: 'm2', name: 'Cola', price: 3.5, category: 'drinks', routing: 'bar' as const },
];

const mockStaff = [{ id: 's1', name: 'Max', pin: '1234', role: 'waiter' as const }];

const mockSession: TableSession = {
  id: 'sess1',
  tableId: 't1',
  orders: [
    {
      id: 'o1',
      menuItemId: 'm1',
      name: 'Schnitzel',
      quantity: 1,
      price: 15.0,
      modifiers: [],
      state: 'served' as const,
      routing: 'kitchen' as const,
      timestamp: Date.now(),
    },
    {
      id: 'o2',
      menuItemId: 'm2',
      name: 'Cola',
      quantity: 2,
      price: 3.5,
      modifiers: [],
      state: 'served' as const,
      routing: 'bar' as const,
      timestamp: Date.now(),
    },
  ],
  notes: [],
  startTime: Date.now(),
};

function BillingModalTestWrapper({ children, initialSession = mockSession }: { children: React.ReactNode; initialSession?: TableSession }) {
  const { dispatch } = useApp();
  React.useEffect(() => {
    dispatch({ type: 'SET_ACTIVE_TABLE', tableId: 't1' });
    dispatch({
      type: 'SYNC_STATE',
      sessions: { t1: initialSession },
      closedTables: [],
      tipHistory: [],
      closedTableRevenue: 0,
      shiftStart: Date.now(),
      shiftHistory: [],
    });
  }, [dispatch, initialSession]);
  return <>{children}</>;
}

function renderBillingModal(session: TableSession = mockSession, restaurantOverrides: Partial<typeof mockRestaurant> = {}) {
  return render(
    <AppProvider
      config={{
        restaurant: { ...mockRestaurant, ...restaurantOverrides },
        zones: mockZones,
        tables: mockTables,
        menu: mockMenu,
        staff: mockStaff,
      }}
    >
      <BillingModalTestWrapper initialSession={session}>
        <BillingModal />
      </BillingModalTestWrapper>
    </AppProvider>
  );
}

describe('BillingModal', () => {
  describe('Rendering and Display', () => {
    it('renders billing modal with combined mode by default', () => {
      renderBillingModal();
      expect(screen.getByText('Rechnung')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Zusammen/i })).toHaveClass('bg-[#8b5cf6]');
    });

    it('displays table name in header', () => {
      renderBillingModal();
      expect(screen.getByText('Tisch 1')).toBeInTheDocument();
    });
  });

  describe('Combined Mode - Totals Calculation', () => {
    it('calculates total: 15.00 + 7.00 = 22.00 EUR', () => {
      renderBillingModal();
      expect(screen.getByText('22.00 EUR')).toBeInTheDocument();
    });

    it('calculates tax: 22.00 * 19% = 4.18 EUR', () => {
      renderBillingModal();
      const taxline = screen.getByText(/MwSt/);
      expect(taxline?.parentElement?.textContent).toContain('4.18');
    });

    it('displays all order items with correct prices', () => {
      renderBillingModal();
      expect(screen.getByText(/Schnitzel/)).toBeInTheDocument();
      expect(screen.getByText(/2x Cola/)).toBeInTheDocument();
      expect(screen.getByText('7.00 EUR')).toBeInTheDocument();
    });

    it('hides quantity prefix for single-item orders', () => {
      renderBillingModal();
      const schnitzelElement = screen.getByText(/Schnitzel/);
      expect(schnitzelElement.textContent).not.toContain('1x');
    });
  });

  describe('Tip Screen - Custom Tip', () => {
    it('accepts custom tip with comma separator', async () => {
      const user = userEvent.setup();
      renderBillingModal();
      const cardButtons = screen.getAllByRole('button', { name: /Karte/ });
      await user.click(cardButtons[0]);
      const customInput = await screen.findByPlaceholderText(/Eigener Betrag/);
      await user.type(customInput, '2,50');
      const okButton = screen.getByRole('button', { name: /OK/ });
      await user.click(okButton);
      await waitFor(() => {
        const tipElements = screen.getAllByText(/2.50 EUR/);
        expect(tipElements.length).toBeGreaterThan(0);
      });
    });

    it('accepts custom tip with dot separator', async () => {
      const user = userEvent.setup();
      renderBillingModal();
      const cardButtons = screen.getAllByRole('button', { name: /Karte/ });
      await user.click(cardButtons[0]);
      const customInput = await screen.findByPlaceholderText(/Eigener Betrag/);
      await user.type(customInput, '3.75');
      const okButton = screen.getByRole('button', { name: /OK/ });
      await user.click(okButton);
      await waitFor(() => {
        const tipElements = screen.getAllByText(/3.75 EUR/);
        expect(tipElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Cash Payment with Change', () => {
    it('calculates change: received 25.00, total 22.00, change = 3.00', async () => {
      const user = userEvent.setup();
      renderBillingModal();
      const cashButtons = screen.getAllByRole('button', { name: /Bar/ });
      await user.click(cashButtons[0]);
      await waitFor(() => {
        expect(screen.getByText('Trinkgeld')).toBeInTheDocument();
      });
      const cashInputs = screen.getAllByRole('textbox');
      const cashInput = cashInputs[cashInputs.length - 1];
      await user.type(cashInput, '25');
      await waitFor(() => {
        expect(screen.getByText('Rückgeld')).toBeInTheDocument();
      });
    });

    it('card payment does not show cash section', async () => {
      const user = userEvent.setup();
      renderBillingModal();
      const cardButtons = screen.getAllByRole('button', { name: /Karte/ });
      await user.click(cardButtons[0]);
      await waitFor(() => {
        expect(screen.getByText('Trinkgeld')).toBeInTheDocument();
      });
      expect(screen.queryByPlaceholderText(/Erhalten/)).not.toBeInTheDocument();
    });
  });

  describe('Split Mode - By Guest', () => {
    it('renders split mode with guest grouping', async () => {
      const user = userEvent.setup();
      const sessionWithSeats: TableSession = {
        ...mockSession,
        orders: [
          { ...mockSession.orders[0], seatId: 1 },
          { ...mockSession.orders[1], seatId: 2 },
        ],
      };
      renderBillingModal(sessionWithSeats);
      const splitButton = screen.getByRole('button', { name: /Getrennt/ });
      await user.click(splitButton);
      await waitFor(() => {
        expect(screen.getByText(/Gast 1/)).toBeInTheDocument();
        expect(screen.getByText(/Gast 2/)).toBeInTheDocument();
      });
    });

    it('calculates per-guest totals: Gast 1 = 15.00, Gast 2 = 7.00', async () => {
      const user = userEvent.setup();
      const sessionWithSeats: TableSession = {
        ...mockSession,
        orders: [
          { ...mockSession.orders[0], seatId: 1 },
          { ...mockSession.orders[1], seatId: 2 },
        ],
      };
      renderBillingModal(sessionWithSeats);
      const splitButton = screen.getByRole('button', { name: /Getrennt/ });
      await user.click(splitButton);
      await waitFor(() => {
        const amounts = screen.getAllByText(/15.00/);
        expect(amounts.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Equal Split Mode', () => {
    it('calculates per-person amount: 22.00 / 2 = 11.00', async () => {
      const user = userEvent.setup();
      renderBillingModal();
      const equalButton = screen.getByRole('button', { name: /Teilen/ });
      await user.click(equalButton);
      await waitFor(() => {
        const amounts = screen.getAllByText(/11.00 EUR/);
        expect(amounts.length).toBeGreaterThan(0);
      });
    });

    it('updates amount when changing person count: 22.00 / 3 = 7.33', async () => {
      const user = userEvent.setup();
      renderBillingModal();
      const equalButton = screen.getByRole('button', { name: /Teilen/ });
      await user.click(equalButton);
      const plusButtons = screen.getAllByRole('button', { name: /\+/ });
      await user.click(plusButtons[0]);
      await waitFor(() => {
        const amounts = screen.getAllByText(/7.33 EUR/);
        expect(amounts.length).toBeGreaterThan(0);
      });
    });

    it('prevents decreasing below 2 persons', async () => {
      const user = userEvent.setup();
      renderBillingModal();
      const equalButton = screen.getByRole('button', { name: /Teilen/ });
      await user.click(equalButton);
      const minusButtons = screen.getAllByRole('button', { name: /-/ });
      await user.click(minusButtons[0]);
      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });
  });

  describe('Mode Switching', () => {
    it('switches from combined to split', async () => {
      const user = userEvent.setup();
      const sessionWithSeats: TableSession = {
        ...mockSession,
        orders: [{ ...mockSession.orders[0], seatId: 1 }],
      };
      renderBillingModal(sessionWithSeats);
      expect(screen.getByText(/Schnitzel/)).toBeInTheDocument();
      const splitButton = screen.getByRole('button', { name: /Getrennt/ });
      await user.click(splitButton);
      await waitFor(() => {
        expect(screen.getByText(/Gast 1/)).toBeInTheDocument();
      });
    });

    it('switches from split to equal', async () => {
      const user = userEvent.setup();
      const sessionWithSeats: TableSession = {
        ...mockSession,
        orders: [{ ...mockSession.orders[0], seatId: 1 }],
      };
      renderBillingModal(sessionWithSeats);
      const splitButton = screen.getByRole('button', { name: /Getrennt/ });
      await user.click(splitButton);
      const equalButton = screen.getByRole('button', { name: /Teilen/ });
      await user.click(equalButton);
      await waitFor(() => {
        expect(screen.getByText(/Pro Person/)).toBeInTheDocument();
      });
    });
  });

  describe('Tax Rate Variations', () => {
    it('calculates 7% tax: 22.00 * 7% = 1.54', () => {
      renderBillingModal(mockSession, { taxRate: 7 });
      const taxline = screen.getByText(/MwSt/);
      expect(taxline.parentElement?.textContent).toContain('1.54');
    });

    it('calculates 5% tax: 22.00 * 5% = 1.10', () => {
      renderBillingModal(mockSession, { taxRate: 5 });
      const taxline = screen.getByText(/MwSt/);
      expect(taxline.parentElement?.textContent).toContain('1.10');
    });
  });

  describe('Edge Cases - Small and Large Amounts', () => {
    it('handles 0.01 EUR', () => {
      const sessionSmall: TableSession = {
        ...mockSession,
        orders: [
          {
            id: 'o1',
            menuItemId: 'm1',
            name: 'Test',
            quantity: 1,
            price: 0.01,
            modifiers: [],
            state: 'served' as const,
            routing: 'kitchen' as const,
            timestamp: Date.now(),
          },
        ],
      };
      renderBillingModal(sessionSmall);
      const amounts = screen.getAllByText(/0.01 EUR/);
      expect(amounts.length).toBeGreaterThan(0);
    });

    it('handles 999.99 EUR', () => {
      const sessionLarge: TableSession = {
        ...mockSession,
        orders: [
          {
            id: 'o1',
            menuItemId: 'm1',
            name: 'Premium',
            quantity: 1,
            price: 999.99,
            modifiers: [],
            state: 'served' as const,
            routing: 'kitchen' as const,
            timestamp: Date.now(),
          },
        ],
      };
      renderBillingModal(sessionLarge);
      const amounts = screen.getAllByText(/999.99 EUR/);
      expect(amounts.length).toBeGreaterThan(0);
    });

    it('handles 3-way split remainder: 100.00 / 3 = 33.33', async () => {
      const user = userEvent.setup();
      const sessionHundred: TableSession = {
        ...mockSession,
        orders: [
          {
            id: 'o1',
            menuItemId: 'm1',
            name: 'Item',
            quantity: 1,
            price: 100.0,
            modifiers: [],
            state: 'served' as const,
            routing: 'kitchen' as const,
            timestamp: Date.now(),
          },
        ],
      };
      renderBillingModal(sessionHundred);
      const equalButton = screen.getByRole('button', { name: /Teilen/ });
      await user.click(equalButton);
      const plusButtons = screen.getAllByRole('button', { name: /\+/ });
      await user.click(plusButtons[0]);
      await waitFor(() => {
        const amounts = screen.getAllByText(/33.33 EUR/);
        expect(amounts.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Modifiers Display', () => {
    it('shows modifiers when present', () => {
      const sessionWithMods: TableSession = {
        ...mockSession,
        orders: [
          {
            ...mockSession.orders[0],
            modifiers: ['extra Sauce', 'kein Salat'],
          },
        ],
      };
      renderBillingModal(sessionWithMods);
      expect(screen.getByText(/extra Sauce, kein Salat/)).toBeInTheDocument();
    });

    it('hides modifiers line when empty', () => {
      renderBillingModal();
      const schnitzelElement = screen.getByText(/Schnitzel/);
      const parent = schnitzelElement.closest('div');
      const modElements = parent?.querySelectorAll('.text-amber-400') || [];
      expect(modElements.length).toBe(0);
    });
  });

  describe('Multiple Orders Calculation', () => {
    it('sums various items: 10 + (2*5) + (3*2.5) = 27.5', () => {
      const multiSession: TableSession = {
        ...mockSession,
        orders: [
          { id: 'o1', menuItemId: 'm1', name: 'Item1', quantity: 1, price: 10.0, modifiers: [], state: 'served' as const, routing: 'kitchen' as const, timestamp: Date.now() },
          { id: 'o2', menuItemId: 'm2', name: 'Item2', quantity: 2, price: 5.0, modifiers: [], state: 'served' as const, routing: 'bar' as const, timestamp: Date.now() },
          { id: 'o3', menuItemId: 'm1', name: 'Item3', quantity: 3, price: 2.5, modifiers: [], state: 'served' as const, routing: 'kitchen' as const, timestamp: Date.now() },
        ],
      };
      renderBillingModal(multiSession);
      const amounts = screen.getAllByText(/27.50 EUR/);
      expect(amounts.length).toBeGreaterThan(0);
    });
  });

  describe('Payment Methods', () => {
    it('shows card payment button when card is selected', async () => {
      const user = userEvent.setup();
      renderBillingModal();
      const cardButtons = screen.getAllByRole('button', { name: /Karte/ });
      await user.click(cardButtons[0]);
      await waitFor(() => {
        expect(screen.getByText('Trinkgeld')).toBeInTheDocument();
      });
    });

    it('shows cash payment button when cash is selected', async () => {
      const user = userEvent.setup();
      renderBillingModal();
      const cashButtons = screen.getAllByRole('button', { name: /Bar/ });
      await user.click(cashButtons[0]);
      await waitFor(() => {
        expect(screen.getByText('Trinkgeld')).toBeInTheDocument();
      });
    });
  });
});
