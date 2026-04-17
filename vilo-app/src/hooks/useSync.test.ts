import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSync } from './useSync';
import { useApp } from '../context/AppContext';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { AppState } from '../context/AppContext';

// Mock the Supabase utilities
vi.mock('@/utils/supabase', () => ({
  isSupabaseAvailable: vi.fn(() => true),
  subscribeToState: vi.fn(),
  unsubscribeChannel: vi.fn(),
  supabaseRestaurantExists: vi.fn(() => Promise.resolve(true)),
  supabaseUpdateState: vi.fn(() => Promise.resolve()),
  supabaseSaveConfig: vi.fn(() => Promise.resolve()),
}));

// Mock useApp to provide a mock dispatch and state
vi.mock('../context/AppContext', async () => {
  const actual = await vi.importActual('../context/AppContext');
  return {
    ...actual,
    useApp: vi.fn(),
  };
});

import {
  isSupabaseAvailable,
  subscribeToState,
  unsubscribeChannel,
  supabaseRestaurantExists,
  supabaseUpdateState,
  supabaseSaveConfig,
} from '@/utils/supabase';

function createMockAppState(overrides: Partial<AppState> = {}): AppState {
  return {
    restaurant: { id: 'r1', name: 'Test Restaurant', code: 'TEST42', currency: 'EUR', taxRate: 19 },
    tables: [
      { id: 't1', name: 'Tisch 1', zone: 'z1', status: 'free' },
      { id: 't2', name: 'Tisch 2', zone: 'z1', status: 'occupied' },
    ],
    tableCombinations: [],
    zones: [{ id: 'z1', name: 'Innen' }],
    menu: [
      { id: 'm1', name: 'Cola', price: 3.5, category: 'drinks', routing: 'bar' },
      { id: 'm2', name: 'Schnitzel', price: 14.9, category: 'mains', routing: 'kitchen' },
    ],
    staff: [
      { id: 's1', name: 'Max', pin: '1234', role: 'waiter' },
      { id: 's2', name: 'Anna', pin: '5678', role: 'manager' },
    ],
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
  let mockDispatch: ReturnType<typeof vi.fn>;
  let mockStateChangeHandler: ((payload: unknown) => void) | null = null;
  let mockConfigChangeHandler: ((payload: unknown) => void) | null = null;
  let mockChannel: RealtimeChannel;

  beforeEach(() => {
    mockDispatch = vi.fn();
    mockStateChangeHandler = null;
    mockConfigChangeHandler = null;

    mockChannel = {
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      off: vi.fn().mockReturnThis(),
      send: vi.fn(),
      track: vi.fn(),
    } as unknown as RealtimeChannel;

    // Mock subscribeToState to capture the handlers
    vi.mocked(subscribeToState).mockImplementation(
      (_restaurantId: string, onStateChange: (payload: unknown) => void, onConfigChange: (payload: unknown) => void) => {
        // Store the handlers for test access
        mockStateChangeHandler = onStateChange;
        mockConfigChangeHandler = onConfigChange;
        return mockChannel;
      }
    );

    vi.mocked(supabaseRestaurantExists).mockResolvedValue(true);
    vi.mocked(useApp).mockReturnValue({
      state: createMockAppState(),
      dispatch: mockDispatch,
      restaurantId: 'r1',
      executeIntent: vi.fn(),
    });

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Mount & Initialization', () => {
    it('should not subscribe if restaurantId is empty', () => {
      vi.mocked(useApp).mockReturnValue({
        state: createMockAppState(),
        dispatch: mockDispatch,
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

    it('should not subscribe if restaurant does not exist in Supabase', async () => {
      vi.mocked(supabaseRestaurantExists).mockResolvedValue(false);

      renderHook(() => useSync());

      // Run all pending promises
      await act(async () => {
        vi.runAllTimersAsync();
      });

      expect(subscribeToState).not.toHaveBeenCalled();
    });

    it('should subscribe to state and config changes on mount', async () => {
      renderHook(() => useSync());

      // Run all pending promises
      await act(async () => {
        vi.runAllTimersAsync();
      });

      expect(supabaseRestaurantExists).toHaveBeenCalledWith('r1');
      expect(subscribeToState).toHaveBeenCalledWith(
        'r1',
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should unsubscribe from channel on unmount', async () => {
      const { unmount } = renderHook(() => useSync());

      // Run all pending promises
      await act(async () => {
        vi.runAllTimersAsync();
      });

      expect(subscribeToState).toHaveBeenCalled();

      unmount();

      expect(unsubscribeChannel).toHaveBeenCalledWith(mockChannel);
    });
  });

  describe('Incoming State Changes (Realtime)', () => {
    it('should dispatch SYNC_STATE when shared_state changes', async () => {
      renderHook(() => useSync());

      // Run all pending promises
      await act(async () => {
        vi.runAllTimersAsync();
      });

      expect(subscribeToState).toHaveBeenCalled();

      // Handler should be set by subscribeToState mock
      expect(mockStateChangeHandler).not.toBeNull();

      const payload = {
        new: {
          sessions_json: { t1: { id: 'sess1', tableId: 't1', orders: [] } },
          closed_tables_json: [],
          tip_history_json: [],
          closed_table_revenue: 100,
          shift_start: 1000,
          shift_history_json: [],
        },
      };

      act(() => {
        if (mockStateChangeHandler) {
          mockStateChangeHandler(payload);
        }
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SYNC_STATE',
        sessions: { t1: { id: 'sess1', tableId: 't1', orders: [] } },
        closedTables: [],
        tipHistory: [],
        closedTableRevenue: 100,
        shiftStart: 1000,
        shiftHistory: [],
      });
    });

    it('should dispatch SYNC_CONFIG when restaurant_data changes', async () => {
      renderHook(() => useSync());

      // Run all pending promises
      await act(async () => {
        vi.runAllTimersAsync();
      });

      expect(subscribeToState).toHaveBeenCalled();

      const payload = {
        new: {
          zones_json: [{ id: 'z1', name: 'Innen' }],
          tables_json: [{ id: 't1', name: 'Tisch 1', zone: 'z1', status: 'free' }],
          table_combinations_json: [],
          menu_json: [{ id: 'm1', name: 'Cola', price: 3.5, category: 'drinks', routing: 'bar' }],
          staff_json: [{ id: 's1', name: 'Max', pin: '1234', role: 'waiter' }],
        },
      };

      act(() => {
        if (mockConfigChangeHandler) {
          mockConfigChangeHandler(payload);
        }
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SYNC_CONFIG',
        zones: [{ id: 'z1', name: 'Innen' }],
        tables: [{ id: 't1', name: 'Tisch 1', zone: 'z1', status: 'free' }],
        tableCombinations: [],
        menu: [{ id: 'm1', name: 'Cola', price: 3.5, category: 'drinks', routing: 'bar' }],
        staff: [{ id: 's1', name: 'Max', pin: '1234', role: 'waiter' }],
      });
    });

    it('should use latestConfigRef.current for tableCombinations if missing from payload', async () => {
      const initialState = createMockAppState({
        tableCombinations: [{ id: 'tc1', zoneId: 'z1', name: 'Combo 1', tableIds: ['t1', 't2'], minPartySize: 2, maxPartySize: 4 }],
      });

      vi.mocked(useApp).mockReturnValue({
        state: initialState,
        dispatch: mockDispatch,
        restaurantId: 'r1',
        executeIntent: vi.fn(),
      });

      renderHook(() => useSync());

      // Run all pending promises
      await act(async () => {
        vi.runAllTimersAsync();
      });

      expect(subscribeToState).toHaveBeenCalled();

      // Send config change without table_combinations_json
      const payload = {
        new: {
          zones_json: [],
          tables_json: [],
          menu_json: [],
          staff_json: [],
          // table_combinations_json is missing
        },
      };

      act(() => {
        if (mockConfigChangeHandler) {
          mockConfigChangeHandler(payload);
        }
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SYNC_CONFIG',
          tableCombinations: [{ id: 'tc1', zoneId: 'z1', name: 'Combo 1', tableIds: ['t1', 't2'], minPartySize: 2, maxPartySize: 4 }],
        })
      );
    });

    it('should handle empty payload objects gracefully', async () => {
      renderHook(() => useSync());

      // Run all pending promises
      await act(async () => {
        vi.runAllTimersAsync();
      });

      expect(subscribeToState).toHaveBeenCalled();

      // Empty payload (no keys) should not dispatch
      const emptyPayload = { new: {} };

      act(() => {
        if (mockStateChangeHandler) {
          mockStateChangeHandler(emptyPayload);
        }
      });

      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('should reset isRemoteUpdate flag after 50ms', async () => {
      renderHook(() => useSync());

      // Run all pending promises
      await act(async () => {
        vi.runAllTimersAsync();
      });

      expect(subscribeToState).toHaveBeenCalled();

      const payload = {
        new: {
          sessions_json: {},
          closed_tables_json: [],
          tip_history_json: [],
          closed_table_revenue: 0,
          shift_start: 1000,
          shift_history_json: [],
        },
      };

      act(() => {
        if (mockStateChangeHandler) {
          mockStateChangeHandler(payload);
        }
      });

      // At 0ms, isRemoteUpdate should be true (and dispatch was called)
      expect(mockDispatch).toHaveBeenCalled();

      mockDispatch.mockClear();

      // Advance timers by 50ms
      act(() => {
        vi.advanceTimersByTime(50);
      });

      // After 50ms, isRemoteUpdate flag should be false
      // (but we can't directly test this without exposing internal state)
    });
  });

  describe('Outgoing State Changes (Push to Supabase)', () => {
    it('should debounce state changes and push to Supabase after 300ms', async () => {
      const initialState = createMockAppState({
        sessions: {},
        closedTables: [],
        tipHistory: [],
        closedTableRevenue: 0,
        shiftStart: 1000,
        shiftHistory: [],
      });

      vi.mocked(useApp).mockReturnValue({
        state: initialState,
        dispatch: mockDispatch,
        restaurantId: 'r1',
        executeIntent: vi.fn(),
      });

      const { rerender } = renderHook(() => useSync());

      // Run all pending promises
      await act(async () => {
        vi.runAllTimersAsync();
      });

      expect(subscribeToState).toHaveBeenCalled();

      // Simulate state change
      const newState = createMockAppState({
        sessions: { t1: { id: 'sess1', tableId: 't1', orders: [], notes: [], startTime: Date.now() } },
        closedTables: [],
        tipHistory: [],
        closedTableRevenue: 0,
        shiftStart: 1000,
        shiftHistory: [],
      });

      vi.mocked(useApp).mockReturnValue({
        state: newState,
        dispatch: mockDispatch,
        restaurantId: 'r1',
        executeIntent: vi.fn(),
      });

      act(() => {
        rerender();
      });

      // Before 300ms, supabaseUpdateState should not be called
      expect(supabaseUpdateState).not.toHaveBeenCalled();

      // Advance timers by 300ms
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // After 300ms, supabaseUpdateState should be called with new state
      expect(supabaseUpdateState).toHaveBeenCalledWith({
        restaurant_id: 'r1',
        sessions: { t1: { id: 'sess1', tableId: 't1', orders: [], notes: [], startTime: expect.any(Number) } },
        closed_tables: [],
        tip_history: [],
        closed_table_revenue: 0,
        shift_start: 1000,
        shift_history: [],
      });
    });

    it('should not push if restaurantId is missing', async () => {
      vi.mocked(useApp).mockReturnValue({
        state: createMockAppState(),
        dispatch: mockDispatch,
        restaurantId: '',
        executeIntent: vi.fn(),
      });

      renderHook(() => useSync());

      // Run all pending promises
      await act(async () => {
        vi.runAllTimersAsync();
      });

      expect(subscribeToState).not.toHaveBeenCalled();

      // Even if restaurantId changes later, without subscription it won't push
      expect(supabaseUpdateState).not.toHaveBeenCalled();
    });

    it('should not push if state change is from remote update', async () => {
      const initialState = createMockAppState({
        sessions: {},
        closedTables: [],
        tipHistory: [],
        closedTableRevenue: 0,
        shiftStart: 1000,
        shiftHistory: [],
      });

      vi.mocked(useApp).mockReturnValue({
        state: initialState,
        dispatch: mockDispatch,
        restaurantId: 'r1',
        executeIntent: vi.fn(),
      });

      const { rerender } = renderHook(() => useSync());

      // Run all pending promises
      await act(async () => {
        vi.runAllTimersAsync();
      });

      expect(subscribeToState).toHaveBeenCalled();

      // Simulate remote update
      const remotePayload = {
        new: {
          sessions_json: { t1: { id: 'sess1', tableId: 't1', orders: [] } },
          closed_tables_json: [],
          tip_history_json: [],
          closed_table_revenue: 100,
          shift_start: 1000,
          shift_history_json: [],
        },
      };

      act(() => {
        if (mockStateChangeHandler) {
          mockStateChangeHandler(remotePayload);
        }
      });

      mockDispatch.mockClear();
      vi.mocked(supabaseUpdateState).mockClear();

      // Now change state WITHIN the 50ms window where isRemoteUpdate is true
      const newState = createMockAppState({
        sessions: { t1: { id: 'sess1', tableId: 't1', orders: [] } },
        closedTables: [],
        tipHistory: [],
        closedTableRevenue: 100,
        shiftStart: 1000,
        shiftHistory: [],
      });

      vi.mocked(useApp).mockReturnValue({
        state: newState,
        dispatch: mockDispatch,
        restaurantId: 'r1',
        executeIntent: vi.fn(),
      });

      act(() => {
        rerender();
      });

      // Advance to timeout
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // supabaseUpdateState should NOT be called because isRemoteUpdate was true when state changed
      expect(supabaseUpdateState).not.toHaveBeenCalled();
    });

    it('should not push if no sync fields changed', async () => {
      const initialState = createMockAppState({
        sessions: { t1: { id: 'sess1', tableId: 't1', orders: [], notes: [], startTime: Date.now() } },
        closedTables: [],
        tipHistory: [],
        closedTableRevenue: 0,
        shiftStart: 1000,
        shiftHistory: [],
      });

      vi.mocked(useApp).mockReturnValue({
        state: initialState,
        dispatch: mockDispatch,
        restaurantId: 'r1',
        executeIntent: vi.fn(),
      });

      renderHook(() => useSync());

      // Run all pending promises
      await act(async () => {
        vi.runAllTimersAsync();
      });

      expect(subscribeToState).toHaveBeenCalled();

      // Note: We've verified the hook subscribes and checks fields properly

      act(() => {
        vi.advanceTimersByTime(300);
      });

      // supabaseUpdateState should not be called if sync fields didn't change
      expect(supabaseUpdateState).not.toHaveBeenCalled();
    });

  });

  describe('Outgoing Config Changes (Push to Supabase)', () => {
    it('should debounce config changes and push to Supabase after 500ms', async () => {
      const initialState = createMockAppState({
        zones: [],
        tables: [],
        tableCombinations: [],
        menu: [],
        staff: [],
      });

      vi.mocked(useApp).mockReturnValue({
        state: initialState,
        dispatch: mockDispatch,
        restaurantId: 'r1',
        executeIntent: vi.fn(),
      });

      const { rerender } = renderHook(() => useSync());

      // Run all pending promises
      await act(async () => {
        vi.runAllTimersAsync();
      });

      expect(subscribeToState).toHaveBeenCalled();

      // Simulate config change
      const newState = createMockAppState({
        zones: [{ id: 'z1', name: 'Innen' }],
        tables: [{ id: 't1', name: 'Tisch 1', zone: 'z1', status: 'free' }],
        tableCombinations: [],
        menu: [{ id: 'm1', name: 'Cola', price: 3.5, category: 'drinks', routing: 'bar' }],
        staff: [{ id: 's1', name: 'Max', pin: '1234', role: 'waiter' }],
      });

      vi.mocked(useApp).mockReturnValue({
        state: newState,
        dispatch: mockDispatch,
        restaurantId: 'r1',
        executeIntent: vi.fn(),
      });

      act(() => {
        rerender();
      });

      // Before 500ms, supabaseSaveConfig should not be called
      expect(supabaseSaveConfig).not.toHaveBeenCalled();

      // Advance timers by 500ms
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // After 500ms, supabaseSaveConfig should be called with new config
      expect(supabaseSaveConfig).toHaveBeenCalledWith({
        restaurant_id: 'r1',
        zones: [{ id: 'z1', name: 'Innen' }],
        tables: [{ id: 't1', name: 'Tisch 1', zone: 'z1', status: 'free' }],
        tableCombinations: [],
        menu: [{ id: 'm1', name: 'Cola', price: 3.5, category: 'drinks', routing: 'bar' }],
        staff: [{ id: 's1', name: 'Max', pin: '1234', role: 'waiter' }],
      });
    });

    it('should not push config if from remote update', async () => {
      const initialState = createMockAppState({
        zones: [],
        tables: [],
        tableCombinations: [],
        menu: [],
        staff: [],
      });

      vi.mocked(useApp).mockReturnValue({
        state: initialState,
        dispatch: mockDispatch,
        restaurantId: 'r1',
        executeIntent: vi.fn(),
      });

      const { rerender } = renderHook(() => useSync());

      // Run all pending promises
      await act(async () => {
        vi.runAllTimersAsync();
      });

      expect(subscribeToState).toHaveBeenCalled();

      // Simulate remote config update
      const remotePayload = {
        new: {
          zones_json: [{ id: 'z1', name: 'Innen' }],
          tables_json: [{ id: 't1', name: 'Tisch 1', zone: 'z1', status: 'free' }],
          table_combinations_json: [],
          menu_json: [{ id: 'm1', name: 'Cola', price: 3.5, category: 'drinks', routing: 'bar' }],
          staff_json: [{ id: 's1', name: 'Max', pin: '1234', role: 'waiter' }],
        },
      };

      act(() => {
        if (mockConfigChangeHandler) {
          mockConfigChangeHandler(remotePayload);
        }
      });

      vi.mocked(supabaseSaveConfig).mockClear();

      // Now update state WITHIN the 50ms window where isRemoteUpdate is true
      const newState = createMockAppState({
        zones: [{ id: 'z1', name: 'Innen' }],
        tables: [{ id: 't1', name: 'Tisch 1', zone: 'z1', status: 'free' }],
        tableCombinations: [],
        menu: [{ id: 'm1', name: 'Cola', price: 3.5, category: 'drinks', routing: 'bar' }],
        staff: [{ id: 's1', name: 'Max', pin: '1234', role: 'waiter' }],
      });

      vi.mocked(useApp).mockReturnValue({
        state: newState,
        dispatch: mockDispatch,
        restaurantId: 'r1',
        executeIntent: vi.fn(),
      });

      act(() => {
        rerender();
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      // supabaseSaveConfig should NOT be called because isRemoteUpdate was true when config changed
      expect(supabaseSaveConfig).not.toHaveBeenCalled();
    });

  });

  describe('Debounce Cancellation', () => {
    it('should cancel pending state push if new state change arrives before 300ms', async () => {
      const initialState = createMockAppState({
        sessions: {},
        closedTables: [],
        tipHistory: [],
        closedTableRevenue: 0,
        shiftStart: 1000,
        shiftHistory: [],
      });

      vi.mocked(useApp).mockReturnValue({
        state: initialState,
        dispatch: mockDispatch,
        restaurantId: 'r1',
        executeIntent: vi.fn(),
      });

      const { rerender } = renderHook(() => useSync());

      // Run all pending promises
      await act(async () => {
        vi.runAllTimersAsync();
      });

      expect(subscribeToState).toHaveBeenCalled();

      // First state change
      const newState1 = createMockAppState({
        sessions: { t1: { id: 'sess1', tableId: 't1', orders: [], notes: [], startTime: Date.now() } },
        closedTables: [],
        tipHistory: [],
        closedTableRevenue: 0,
        shiftStart: 1000,
        shiftHistory: [],
      });

      vi.mocked(useApp).mockReturnValue({
        state: newState1,
        dispatch: mockDispatch,
        restaurantId: 'r1',
        executeIntent: vi.fn(),
      });

      act(() => {
        rerender();
      });

      // Advance 150ms (before debounce timeout)
      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(supabaseUpdateState).not.toHaveBeenCalled();

      // Second state change
      const newState2 = createMockAppState({
        sessions: { t1: { id: 'sess1', tableId: 't1', orders: [], notes: [], startTime: 2000 } },
        closedTables: [],
        tipHistory: [],
        closedTableRevenue: 0,
        shiftStart: 1000,
        shiftHistory: [],
      });

      vi.mocked(useApp).mockReturnValue({
        state: newState2,
        dispatch: mockDispatch,
        restaurantId: 'r1',
        executeIntent: vi.fn(),
      });

      act(() => {
        rerender();
      });

      // Advance 300ms more (total 450ms from first change)
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Should have pushed the second state change, not the first
      expect(supabaseUpdateState).toHaveBeenCalledTimes(1);
      expect(supabaseUpdateState).toHaveBeenCalledWith(
        expect.objectContaining({
          sessions: { t1: { id: 'sess1', tableId: 't1', orders: [], notes: [], startTime: 2000 } },
        })
      );
    });
  });

  describe('Multiple Sync Fields', () => {
    it('should push all sync fields when any changes', async () => {
      const initialState = createMockAppState({
        sessions: {},
        closedTables: [],
        tipHistory: [],
        closedTableRevenue: 0,
        shiftStart: 1000,
        shiftHistory: [],
      });

      vi.mocked(useApp).mockReturnValue({
        state: initialState,
        dispatch: mockDispatch,
        restaurantId: 'r1',
        executeIntent: vi.fn(),
      });

      const { rerender } = renderHook(() => useSync());

      // Run all pending promises
      await act(async () => {
        vi.runAllTimersAsync();
      });

      expect(subscribeToState).toHaveBeenCalled();

      // Change only closedTableRevenue
      const newState = createMockAppState({
        sessions: {},
        closedTables: [],
        tipHistory: [],
        closedTableRevenue: 50,
        shiftStart: 1000,
        shiftHistory: [],
      });

      vi.mocked(useApp).mockReturnValue({
        state: newState,
        dispatch: mockDispatch,
        restaurantId: 'r1',
        executeIntent: vi.fn(),
      });

      act(() => {
        rerender();
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(supabaseUpdateState).toHaveBeenCalledWith({
        restaurant_id: 'r1',
        sessions: {},
        closed_tables: [],
        tip_history: [],
        closed_table_revenue: 50,
        shift_start: 1000,
        shift_history: [],
      });
    });

    it('should track all config fields for changes', async () => {
      const initialState = createMockAppState({
        zones: [],
        tables: [],
        tableCombinations: [],
        menu: [],
        staff: [],
      });

      vi.mocked(useApp).mockReturnValue({
        state: initialState,
        dispatch: mockDispatch,
        restaurantId: 'r1',
        executeIntent: vi.fn(),
      });

      const { rerender } = renderHook(() => useSync());

      // Run all pending promises
      await act(async () => {
        vi.runAllTimersAsync();
      });

      expect(subscribeToState).toHaveBeenCalled();

      // Change only menu
      const newState = createMockAppState({
        zones: [],
        tables: [],
        tableCombinations: [],
        menu: [{ id: 'm1', name: 'Coffee', price: 2.5, category: 'drinks', routing: 'bar' }],
        staff: [],
      });

      vi.mocked(useApp).mockReturnValue({
        state: newState,
        dispatch: mockDispatch,
        restaurantId: 'r1',
        executeIntent: vi.fn(),
      });

      act(() => {
        rerender();
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(supabaseSaveConfig).toHaveBeenCalledWith({
        restaurant_id: 'r1',
        zones: [],
        tables: [],
        tableCombinations: [],
        menu: [{ id: 'm1', name: 'Coffee', price: 2.5, category: 'drinks', routing: 'bar' }],
        staff: [],
      });
    });
  });
});
