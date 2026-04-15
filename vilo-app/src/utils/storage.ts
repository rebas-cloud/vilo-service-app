import { ViloStorage, OwnerAccount, Restaurant, Zone, Table, TableCombination, MenuItem, Staff, OnboardingStep, Reservation, Guest, GuestNote, GuestTag, GuestVisit, WaitlistEntry } from '../types';
import { supabaseRegister, supabaseGetRestaurant, supabaseSaveConfig } from './supabase';

const STORAGE_KEY = 'vilo_data';

const defaultStorage: ViloStorage = {
  owner: null,
  restaurant: null,
  zones: [],
  tables: [],
  tableCombinations: [],
  menu: [],
  staff: [],
  onboardingStep: 0,
  setupComplete: false,
};

export function loadStorage(): ViloStorage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultStorage };
    const parsed = JSON.parse(raw) as ViloStorage;
    return { ...defaultStorage, ...parsed };
  } catch {
    return { ...defaultStorage };
  }
}

export function saveStorage(data: Partial<ViloStorage>): ViloStorage {
  const current = loadStorage();
  const updated = { ...current, ...data };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function generateRestaurantCode(): string {
  // Generate 6-digit alphanumeric code (uppercase, easy to read)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0/O/1/I confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function hashPassword(password: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;

  if (subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.warn('[VILO] WebCrypto hashing failed, using fallback hash:', error);
    }
  }

  // Fallback for insecure contexts like local iPad testing over LAN HTTP,
  // where Web Crypto's subtle API may be unavailable.
  let hash = 2166136261;
  for (let i = 0; i < password.length; i++) {
    hash ^= password.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fallback_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

// Check if a restaurant exists in storage
export function hasRestaurant(): boolean {
  const data = loadStorage();
  return data.restaurant !== null;
}

// Check if onboarding is complete
export function isSetupComplete(): boolean {
  const data = loadStorage();
  return data.setupComplete;
}

// Save owner registration
export function saveOwner(owner: OwnerAccount): void {
  saveStorage({ owner });
}

// Save restaurant config
export function saveRestaurant(restaurant: Restaurant): void {
  saveStorage({ restaurant });
}

// Save onboarding step
export function saveOnboardingStep(step: OnboardingStep): void {
  saveStorage({ onboardingStep: step });
}

// Save zones
export function saveZones(zones: Zone[]): void {
  saveStorage({ zones });
}

// Save tables
export function saveTables(tables: Table[]): void {
  saveStorage({ tables });
}

export function saveTableCombinations(tableCombinations: TableCombination[]): void {
  saveStorage({ tableCombinations });
}

// Save menu
export function saveMenu(menu: MenuItem[]): void {
  saveStorage({ menu });
}

// Save staff
export function saveStaff(staff: Staff[]): void {
  saveStorage({ staff });
}

// Mark setup as complete
export function completeSetup(): void {
  saveStorage({ setupComplete: true, onboardingStep: 4 as OnboardingStep });
}

// Find restaurant by code (for waiter login)
// Checks Supabase first, falls back to localStorage
export async function findRestaurantByCode(code: string): Promise<ViloStorage | null> {
  try {
    const data = await supabaseGetRestaurant(code);
    if (data && data.restaurant) {
      return {
        owner: null,
        restaurant: data.restaurant as Restaurant,
        zones: data.zones as Zone[],
        tables: data.tables as Table[],
        tableCombinations: (data as unknown as ViloStorage).tableCombinations || [],
        menu: data.menu as MenuItem[],
        staff: data.staff as Staff[],
        onboardingStep: (data.onboardingStep || 0) as OnboardingStep,
        setupComplete: (data.setupComplete as boolean) || false,
      };
    }
  } catch (e) {
    console.warn('[VILO] Supabase lookup failed, checking localStorage:', e);
  }
  // Fallback to localStorage
  const local = loadStorage();
  if (local.restaurant && local.restaurant.code.toUpperCase() === code.toUpperCase()) {
    return local;
  }
  return null;
}

// Register restaurant via Supabase
export async function registerViaApi(name: string, email: string, passwordHash: string, restaurantName: string, restaurantCode: string): Promise<{ restaurant: Restaurant; owner: OwnerAccount }> {
  const result = await supabaseRegister({
    owner_name: name,
    owner_email: email,
    password_hash: passwordHash,
    restaurant_name: restaurantName,
    restaurant_code: restaurantCode,
  });
  return {
    restaurant: result.restaurant as unknown as Restaurant,
    owner: result.owner as unknown as OwnerAccount,
  };
}

// Save config to Supabase
export async function saveConfigToApi(restaurantId: string, zones: Zone[], tables: Table[], menu: MenuItem[], staff: Staff[], setupComplete: boolean, onboardingStep: number): Promise<void> {
  try {
    await supabaseSaveConfig({
      restaurant_id: restaurantId,
      zones,
      tables,
      menu,
      staff,
      setup_complete: setupComplete,
      onboarding_step: onboardingStep,
    });
  } catch (e) {
    console.warn('[VILO] Failed to save config to Supabase:', e);
  }
}

// Reservation storage
const RESERVATIONS_KEY = 'vilo_reservations';

export function loadReservations(): Reservation[] {
  try {
    const raw = localStorage.getItem(RESERVATIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Reservation[];
  } catch {
    return [];
  }
}

export function saveReservations(reservations: Reservation[]): void {
  localStorage.setItem(RESERVATIONS_KEY, JSON.stringify(reservations));
}

export function addReservation(reservation: Reservation): Reservation[] {
  const all = loadReservations();
  all.push(reservation);
  saveReservations(all);
  return all;
}

export function updateReservation(id: string, updates: Partial<Reservation>): Reservation[] {
  const all = loadReservations().map(r => r.id === id ? { ...r, ...updates } : r);
  saveReservations(all);
  return all;
}

export function deleteReservation(id: string): Reservation[] {
  const all = loadReservations().filter(r => r.id !== id);
  saveReservations(all);
  return all;
}

// Guest CRM storage
const GUESTS_KEY = 'vilo_guests';

export function loadGuests(): Guest[] {
  try {
    const raw = localStorage.getItem(GUESTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Guest[];
  } catch {
    return [];
  }
}

export function saveGuests(guests: Guest[]): void {
  localStorage.setItem(GUESTS_KEY, JSON.stringify(guests));
}

export function addGuest(guest: Guest): Guest[] {
  const all = loadGuests();
  all.push(guest);
  saveGuests(all);
  return all;
}

export function updateGuest(id: string, updates: Partial<Guest>): Guest[] {
  const all = loadGuests().map(g => g.id === id ? { ...g, ...updates } : g);
  saveGuests(all);
  return all;
}

export function deleteGuest(id: string): Guest[] {
  const all = loadGuests().filter(g => g.id !== id);
  saveGuests(all);
  return all;
}

export function findGuestByPhone(phone: string): Guest | undefined {
  if (!phone.trim()) return undefined;
  const normalized = phone.replace(/\s+/g, '').replace(/^(\+49|0049)/, '0');
  return loadGuests().find(g => {
    if (!g.phone) return false;
    const gNorm = g.phone.replace(/\s+/g, '').replace(/^(\+49|0049)/, '0');
    return gNorm === normalized;
  });
}

export function addGuestVisit(guestId: string, visit: GuestVisit): Guest[] {
  const all = loadGuests().map(g => {
    if (g.id !== guestId) return g;
    return {
      ...g,
      visits: [...g.visits, visit],
      totalVisits: g.totalVisits + 1,
      totalSpend: g.totalSpend + visit.revenue,
      lastVisit: visit.date,
    };
  });
  saveGuests(all);
  return all;
}

export function addGuestNote(guestId: string, note: GuestNote): Guest[] {
  const all = loadGuests().map(g => {
    if (g.id !== guestId) return g;
    return { ...g, notes: [...g.notes, note] };
  });
  saveGuests(all);
  return all;
}

export function removeGuestNote(guestId: string, noteId: string): Guest[] {
  const all = loadGuests().map(g => {
    if (g.id !== guestId) return g;
    return { ...g, notes: g.notes.filter(n => n.id !== noteId) };
  });
  saveGuests(all);
  return all;
}

export function toggleGuestTag(guestId: string, tag: GuestTag): Guest[] {
  const all = loadGuests().map(g => {
    if (g.id !== guestId) return g;
    const hasTag = g.tags.includes(tag);
    return { ...g, tags: hasTag ? g.tags.filter(t => t !== tag) : [...g.tags, tag] };
  });
  saveGuests(all);
  return all;
}

// Waitlist storage
const WAITLIST_KEY = 'vilo_waitlist';

export function loadWaitlist(): WaitlistEntry[] {
  try {
    const raw = localStorage.getItem(WAITLIST_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WaitlistEntry[];
  } catch {
    return [];
  }
}

export function saveWaitlist(entries: WaitlistEntry[]): void {
  localStorage.setItem(WAITLIST_KEY, JSON.stringify(entries));
}

export function addWaitlistEntry(entry: WaitlistEntry): WaitlistEntry[] {
  const all = loadWaitlist();
  all.push(entry);
  saveWaitlist(all);
  return all;
}

export function updateWaitlistEntry(id: string, updates: Partial<WaitlistEntry>): WaitlistEntry[] {
  const all = loadWaitlist().map(e => e.id === id ? { ...e, ...updates } : e);
  saveWaitlist(all);
  return all;
}

export function removeWaitlistEntry(id: string): WaitlistEntry[] {
  const all = loadWaitlist().filter(e => e.id !== id);
  saveWaitlist(all);
  return all;
}
