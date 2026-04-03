// Backend API client for VILO
// Now uses Supabase instead of FastAPI for real-time sync

export {
  supabase,
  supabaseRegister,
  supabaseGetRestaurant,
  supabaseSaveConfig,
  supabaseGetState,
  supabaseUpdateState,
  subscribeToState,
  unsubscribeChannel,
} from './supabase';

// Re-export types for backwards compatibility
export type { RealtimeCallback } from './supabase';
