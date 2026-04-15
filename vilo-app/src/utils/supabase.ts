// Supabase client for VILO POS
// Replaces the FastAPI backend - handles REST queries + Realtime subscriptions

import { createClient, RealtimeChannel } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : (null as unknown as ReturnType<typeof createClient>);

export function isSupabaseAvailable(): boolean {
  return isSupabaseConfigured;
}

// --- Restaurant Registration ---

export async function supabaseRegister(data: {
  owner_name: string;
  owner_email: string;
  password_hash: string;
  restaurant_name: string;
  restaurant_code: string;
}): Promise<{ restaurant: Record<string, unknown>; owner: Record<string, unknown> }> {
  const restaurantId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);
  const ownerId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);

  // Insert restaurant
  const { error: rErr } = await supabase.from('restaurants').insert({
    id: restaurantId,
    code: data.restaurant_code.toUpperCase(),
    name: data.restaurant_name,
    currency: 'EUR',
    tax_rate: 19,
    address: '',
  });
  if (rErr) throw new Error(rErr.message);

  // Insert owner
  const { error: oErr } = await supabase.from('owners').insert({
    id: ownerId,
    name: data.owner_name,
    email: data.owner_email,
    password_hash: data.password_hash,
    restaurant_id: restaurantId,
  });
  if (oErr) throw new Error(oErr.message);

  // Create empty restaurant_data row
  const { error: dErr } = await supabase.from('restaurant_data').insert({
    restaurant_id: restaurantId,
    zones_json: [],
    tables_json: [],
    menu_json: [],
    staff_json: [],
    setup_complete: false,
    onboarding_step: 0,
  });
  if (dErr) throw new Error(dErr.message);

  // Create empty shared_state row
  const { error: sErr } = await supabase.from('shared_state').insert({
    restaurant_id: restaurantId,
    sessions_json: {},
    closed_tables_json: [],
    tip_history_json: [],
    closed_table_revenue: 0,
    shift_start: Date.now(),
    shift_history_json: [],
    reservations_json: [],
    guests_json: [],
    waitlist_json: [],
  });
  if (sErr) throw new Error(sErr.message);

  return {
    restaurant: {
      id: restaurantId,
      name: data.restaurant_name,
      code: data.restaurant_code.toUpperCase(),
      currency: 'EUR',
      taxRate: 19,
    },
    owner: {
      id: ownerId,
      name: data.owner_name,
      email: data.owner_email,
      passwordHash: data.password_hash,
      restaurantId,
    },
  };
}

// --- Get Restaurant by Code ---

export async function supabaseGetRestaurant(code: string): Promise<Record<string, unknown> | null> {
  // Find restaurant by code
  const { data: restaurant, error: rErr } = await supabase
    .from('restaurants')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (rErr || !restaurant) return null;

  // Get restaurant_data
  const { data: config } = await supabase
    .from('restaurant_data')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .single();

  return {
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      code: restaurant.code,
      currency: restaurant.currency || 'EUR',
      taxRate: restaurant.tax_rate || 19,
    },
    zones: config?.zones_json || [],
    tables: config?.tables_json || [],
    tableCombinations: config?.table_combinations_json || [],
    menu: config?.menu_json || [],
    staff: config?.staff_json || [],
    setupComplete: config?.setup_complete || false,
    onboardingStep: config?.onboarding_step || 0,
  };
}

export async function supabaseRestaurantExists(restaurantId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !restaurantId) return false;

  const { data, error } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .maybeSingle();

  if (error) return false;
  return Boolean(data?.id);
}

// --- Save Config ---

export async function supabaseSaveConfig(data: {
  restaurant_id: string;
  zones: unknown[];
  tables: unknown[];
  tableCombinations?: unknown[];
  menu: unknown[];
  staff: unknown[];
  setup_complete?: boolean;
  onboarding_step?: number;
}): Promise<void> {
  const payload: Record<string, unknown> = {
    restaurant_id: data.restaurant_id,
    zones_json: data.zones,
    tables_json: data.tables,
    menu_json: data.menu,
    staff_json: data.staff,
    setup_complete: data.setup_complete ?? false,
    onboarding_step: data.onboarding_step ?? 0,
  };

  if (data.tableCombinations !== undefined) {
    payload.table_combinations_json = data.tableCombinations;
  }

  let { error } = await supabase
    .from('restaurant_data')
    .upsert(payload, { onConflict: 'restaurant_id' });

  // Backward compatibility for databases that do not yet have table_combinations_json.
  if (error && data.tableCombinations !== undefined) {
    delete payload.table_combinations_json;
    const retry = await supabase
      .from('restaurant_data')
      .upsert(payload, { onConflict: 'restaurant_id' });
    error = retry.error;
  }

  if (error) throw new Error(error.message);
}

// --- Get State ---

export async function supabaseGetState(restaurantId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from('shared_state')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .single();

  if (error || !data) {
    return {
      sessions: {},
      closedTables: [],
      tipHistory: [],
      closedTableRevenue: 0,
      shiftStart: Date.now(),
      shiftHistory: [],
      reservations: [],
      guests: [],
      waitlist: [],
    };
  }

  return {
    sessions: data.sessions_json || {},
    closedTables: data.closed_tables_json || [],
    tipHistory: data.tip_history_json || [],
    closedTableRevenue: data.closed_table_revenue || 0,
    shiftStart: data.shift_start || Date.now(),
    shiftHistory: data.shift_history_json || [],
    reservations: data.reservations_json || [],
    guests: data.guests_json || [],
    waitlist: data.waitlist_json || [],
  };
}

// --- Update State ---

export async function supabaseUpdateState(data: {
  restaurant_id: string;
  sessions?: Record<string, unknown>;
  closed_tables?: unknown[];
  tip_history?: unknown[];
  closed_table_revenue?: number;
  shift_start?: number;
  shift_history?: unknown[];
  reservations?: unknown[];
  guests?: unknown[];
  waitlist?: unknown[];
}): Promise<void> {
  const updateData: Record<string, unknown> = {
    restaurant_id: data.restaurant_id,
    updated_at: new Date().toISOString(),
  };

  if (data.sessions !== undefined) updateData.sessions_json = data.sessions;
  if (data.closed_tables !== undefined) updateData.closed_tables_json = data.closed_tables;
  if (data.tip_history !== undefined) updateData.tip_history_json = data.tip_history;
  if (data.closed_table_revenue !== undefined) updateData.closed_table_revenue = data.closed_table_revenue;
  if (data.shift_start !== undefined) updateData.shift_start = data.shift_start;
  if (data.shift_history !== undefined) updateData.shift_history_json = data.shift_history;
  if (data.reservations !== undefined) updateData.reservations_json = data.reservations;
  if (data.guests !== undefined) updateData.guests_json = data.guests;
  if (data.waitlist !== undefined) updateData.waitlist_json = data.waitlist;

  const { error } = await supabase.from('shared_state').upsert(updateData, { onConflict: 'restaurant_id' });
  if (error) throw new Error(error.message);
}

// --- Realtime Subscriptions ---

export type RealtimeCallback = (payload: {
  table: string;
  eventType: string;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}) => void;

export function subscribeToState(
  restaurantId: string,
  onStateChange: RealtimeCallback,
  onConfigChange: RealtimeCallback
): RealtimeChannel {
  const channel = supabase
    .channel(`vilo-sync-${restaurantId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'shared_state',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      (payload) => {
        onStateChange({
          table: 'shared_state',
          eventType: payload.eventType,
          new: (payload.new as Record<string, unknown>) || {},
          old: (payload.old as Record<string, unknown>) || {},
        });
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'restaurant_data',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      (payload) => {
        onConfigChange({
          table: 'restaurant_data',
          eventType: payload.eventType,
          new: (payload.new as Record<string, unknown>) || {},
          old: (payload.old as Record<string, unknown>) || {},
        });
      }
    )
    .subscribe();

  return channel;
}

export function unsubscribeChannel(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}
