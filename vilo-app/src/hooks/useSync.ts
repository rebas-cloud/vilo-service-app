import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  isSupabaseAvailable,
  subscribeToState,
  unsubscribeChannel,
  supabaseRestaurantExists,
  supabaseUpdateState,
  supabaseSaveConfig,
} from '../utils/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { AppState } from '../context/AppContext';

/**
 * useSync hook - connects to Supabase Realtime and syncs state changes to/from database.
 * 
 * - On mount: subscribes to shared_state + restaurant_data changes via Supabase Realtime
 * - On incoming state change: dispatches SYNC_STATE
 * - On incoming config change: dispatches SYNC_CONFIG
 * - On local state change: pushes update to Supabase (debounced)
 */
export function useSync() {
  const { state, dispatch, restaurantId } = useApp();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const prevStateRef = useRef<AppState | null>(null);
  const latestConfigRef = useRef({ tableCombinations: state.tableCombinations });
  const isRemoteUpdate = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canSyncRef = useRef(false);

  useEffect(() => {
    latestConfigRef.current = { tableCombinations: state.tableCombinations };
  }, [state.tableCombinations]);

  // Subscribe to Supabase Realtime on mount
  useEffect(() => {
    if (!restaurantId || !isSupabaseAvailable()) {
      canSyncRef.current = false;
      return;
    }

    let isCancelled = false;

    void (async () => {
      const exists = await supabaseRestaurantExists(restaurantId);
      if (isCancelled || !exists) {
        canSyncRef.current = false;
        return;
      }

      canSyncRef.current = true;

      const channel = subscribeToState(
        restaurantId,
        // State change handler
        (payload) => {
          isRemoteUpdate.current = true;

          const row = payload.new;
          if (row && Object.keys(row).length > 0) {
            dispatch({
              type: 'SYNC_STATE',
              sessions: (row.sessions_json as Record<string, unknown>) || {},
              closedTables: (row.closed_tables_json as unknown[]) || [],
              tipHistory: (row.tip_history_json as unknown[]) || [],
              closedTableRevenue: (row.closed_table_revenue as number) || 0,
              shiftStart: (row.shift_start as number) || Date.now(),
              shiftHistory: (row.shift_history_json as unknown[]) || [],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
          }

          setTimeout(() => { isRemoteUpdate.current = false; }, 50);
        },
        // Config change handler
        (payload) => {
          isRemoteUpdate.current = true;

          const row = payload.new;
          if (row && Object.keys(row).length > 0) {
            dispatch({
              type: 'SYNC_CONFIG',
              zones: (row.zones_json as unknown[]) || [],
              tables: (row.tables_json as unknown[]) || [],
              tableCombinations: Array.isArray((row as Record<string, unknown>).table_combinations_json)
                ? ((row as Record<string, unknown>).table_combinations_json as unknown[])
                : latestConfigRef.current.tableCombinations,
              menu: (row.menu_json as unknown[]) || [],
              staff: (row.staff_json as unknown[]) || [],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
          }

          setTimeout(() => { isRemoteUpdate.current = false; }, 50);
        }
      );

      channelRef.current = channel;
    })();

    return () => {
      isCancelled = true;
      canSyncRef.current = false;
      if (channelRef.current) {
        unsubscribeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [restaurantId, dispatch]);

  // Push local state changes to Supabase (debounced)
  useEffect(() => {
    if (isRemoteUpdate.current) {
      prevStateRef.current = state;
      return;
    }

    const prev = prevStateRef.current;
    prevStateRef.current = state;

    if (!prev) return;

    const syncFieldsChanged =
      prev.sessions !== state.sessions ||
      prev.closedTables !== state.closedTables ||
      prev.tipHistory !== state.tipHistory ||
      prev.closedTableRevenue !== state.closedTableRevenue ||
      prev.shiftStart !== state.shiftStart ||
      prev.shiftHistory !== state.shiftHistory;

    if (!syncFieldsChanged) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      if (!restaurantId || !canSyncRef.current) return;

      supabaseUpdateState({
        restaurant_id: restaurantId,
        sessions: state.sessions,
        closed_tables: state.closedTables,
        tip_history: state.tipHistory,
        closed_table_revenue: state.closedTableRevenue,
        shift_start: state.shiftStart,
        shift_history: state.shiftHistory,
      }).catch(err => console.warn('[VILO SYNC] Failed to push state:', err));
    }, 300);
  }, [state, restaurantId]);

  // Also push config changes (zones, tables, menu, staff) automatically
  const configDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevConfigRef = useRef<{ zones: unknown; tables: unknown; tableCombinations: unknown; menu: unknown; staff: unknown } | null>(null);

  useEffect(() => {
    if (isRemoteUpdate.current) {
      prevConfigRef.current = { zones: state.zones, tables: state.tables, tableCombinations: state.tableCombinations, menu: state.menu, staff: state.staff };
      return;
    }

    const prev = prevConfigRef.current;
    prevConfigRef.current = { zones: state.zones, tables: state.tables, tableCombinations: state.tableCombinations, menu: state.menu, staff: state.staff };

    if (!prev) return;

    const configChanged =
      prev.zones !== state.zones ||
      prev.tables !== state.tables ||
      prev.tableCombinations !== state.tableCombinations ||
      prev.menu !== state.menu ||
      prev.staff !== state.staff;

    if (!configChanged) return;

    if (configDebounceTimer.current) clearTimeout(configDebounceTimer.current);
    configDebounceTimer.current = setTimeout(() => {
      if (!restaurantId || !canSyncRef.current) return;

      supabaseSaveConfig({
        restaurant_id: restaurantId,
        zones: state.zones,
        tables: state.tables,
        tableCombinations: state.tableCombinations,
        menu: state.menu,
        staff: state.staff,
      }).catch(err => console.warn('[VILO SYNC] Failed to push config:', err));
    }, 500);
  }, [state.zones, state.tables, state.tableCombinations, state.menu, state.staff, restaurantId]);
}
