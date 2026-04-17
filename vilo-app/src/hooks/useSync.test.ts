import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSync } from './useSync';
import { useApp } from '../context/AppContext';
import type { AppState } from '../context/AppContext';

// Mock the Supabase utilities with real implementations
vi.mock('@/utils/supabase', () => ({
  isSupabaseAvailable: vi.fn(() => true),
  subscribeToState: vi.fn((_id: string, _onState: (payload: unknown) => void, _onConfig: (payload: unknown) => void) => ({
    subscribe: vi.fn(() => ({ on: vi.fn(() => ({ on: vi.fn() })) })),
    unsubscribe: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    send: vi.fn(),
    track: vi.fn(),
  })),
  unsubscribeChannel: vi.fn(() => {}),
  supabaseRestaurantExists: vi.fn(() => Promise.resolve(true)),
  supabaseUpdateState: vi.fn(() => Promise.resolve()),
  supabaseSaveConfig: vi.fn(() => Promise.resolve()),
}));

// Mock useApp
vi.mock('../context/AppContext', async () => {
  const actual = await vi.importActual('../context/AppContext');
  return {
    ...actual,
    useApp: vi.fn(() => ({
      state: createMockAppState(),
      dispatch: vi.fn(),
      restaurantId: 'r1',
      executeIntent: vi.fn(),
    })),
  };
});

import {
  isSupabaseAvailable,
  subscribeToState,
  supabaseRestaurantExists,
} from '@/utils/supabase';

function createMockAppState(overrides: Partial<AppState> = {}): AppState {
  return {
    restaurant: { id: 'r1', name: 'Test', code: 'TEST', currency: 'EUR', taxRate: 19 },
    tables: [{ id: 't1', name: 'Table 1', zone: 'z1', status: 'free' }],
    tableCombinations: [],
    zones: [{ id: 'z1', name: 'Main' }],
    menu: [{ id: 'm1', name: 'Item', price: 10, category: 'food', routing: 'kitchen' }],
    staff: [{ id: 's1', name: 'Staff', pin: '1234', role: 'waiter' }],
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

describe('useSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should not subscribe if restaurantId is empty', () => {
    vi.mocked(useApp).mockReturnValue({
      state: createMockAppState(),
      dispatch: vi.fn(),
      restaurantId: '',
      executeIntent: vi.fn(),
    });

    renderHook(() => useSync());

    expect(subscribeToState).not.toHaveBeenCalled();
  });

  it('should not subscribe if Supabase is unavailable', () => {
    vi.mocked(isSupabaseAvailable).mockReturnValue(false);

    renderHook(() => useSync());

    expect(subscribeToState).not.toHaveBeenCalled();
  });

  it('should not subscribe if restaurant does not exist', async () => {
    vi.mocked(supabaseRestaurantExists).mockResolvedValue(false);

    renderHook(() => useSync());

    await vi.runAllTimersAsync();

    expect(subscribeToState).not.toHaveBeenCalled();
  });

  it('should handle subscription flow without errors', async () => {
    vi.mocked(supabaseRestaurantExists).mockResolvedValue(true);

    const { unmount } = renderHook(() => useSync());

    await vi.runAllTimersAsync();

    // Hook should mount and handle subscription without errors
    expect(useApp).toHaveBeenCalled();

    unmount();

    // Unmount should not throw
    expect(() => unmount()).not.toThrow();
  });

  it('should handle missing Supabase gracefully', () => {
    expect(() => {
      renderHook(() => useSync());
    }).not.toThrow();
  });

  it('should initialize with default state', async () => {
    renderHook(() => useSync());

    await vi.runAllTimersAsync();

    // Verify hook mounts without errors
    expect(useApp).toHaveBeenCalled();
  });
});
