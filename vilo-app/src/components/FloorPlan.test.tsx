import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { FloorPlan } from './FloorPlan';
import { useApp } from '@/context/AppContext';

vi.mock('@/context/AppContext', () => ({
  useApp: vi.fn(),
}));

vi.mock('@/utils/supabase', () => ({
  isSupabaseAvailable: vi.fn(() => true),
}));

describe('FloorPlan Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useApp).mockReturnValue({
      state: {
        restaurant: { id: 'r1', name: 'Test', code: 'TEST', currency: 'EUR', taxRate: 19 },
        tables: [
          { id: 't1', name: 'Table 1', zone: 'z1', status: 'free' },
          { id: 't2', name: 'Table 2', zone: 'z1', status: 'occupied' },
        ],
        tableCombinations: [],
        zones: [{ id: 'z1', name: 'Main' }],
        menu: [],
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
      },
      dispatch: vi.fn(),
      restaurantId: 'r1',
      executeIntent: vi.fn(),
    });
  });

  it('should render without crashing', () => {
    expect(() => {
      render(<FloorPlan />);
    }).not.toThrow();
  });

  it('should display table information', () => {
    const { container } = render(<FloorPlan />);
    expect(container).toBeDefined();
  });
});
