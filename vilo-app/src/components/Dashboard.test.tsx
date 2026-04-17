import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Dashboard } from './Dashboard';
import { useApp } from '@/context/AppContext';

vi.mock('@/context/AppContext', () => ({
  useApp: vi.fn(),
}));

vi.mock('@/utils/supabase', () => ({
  isSupabaseAvailable: vi.fn(() => true),
}));

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useApp).mockReturnValue({
      state: {
        restaurant: { id: 'r1', name: 'Test', code: 'TEST', currency: 'EUR', taxRate: 19 },
        tables: [{ id: 't1', name: 'Table 1', zone: 'z1', status: 'free' }],
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
      render(<Dashboard />);
    }).not.toThrow();
  });

  it('should render with valid state', () => {
    const { container } = render(<Dashboard />);
    expect(container).toBeDefined();
  });
});
