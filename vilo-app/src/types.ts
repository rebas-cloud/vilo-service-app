export interface Restaurant {
  id: string;
  name: string;
  code: string; // 6-digit code for waiter login
  currency: string;
  taxRate: number;
  address?: string;
  pacingLimit?: number; // max reservations per 30-min slot (0 = unlimited)
}

export interface OwnerAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string; // simple hash for prototype
  restaurantId: string;
}

export type OnboardingStep = 0 | 1 | 2 | 3 | 4; // 0=not started, 1-4=wizard steps, 4=complete

export interface ViloStorage {
  owner: OwnerAccount | null;
  restaurant: Restaurant | null;
  zones: Zone[];
  tables: Table[];
  tableCombinations: TableCombination[];
  menu: MenuItem[];
  staff: Staff[];
  onboardingStep: OnboardingStep;
  setupComplete: boolean;
}

export interface Zone {
  id: string;
  name: string;
}

export type TableShape = 'round' | 'square' | 'rect' | 'diamond' | 'rect_v' | 'barstool';
export type TableRotation = 0 | 45 | 90 | 135 | 180 | 225 | 270 | 315;
export type TablePlacementType = 'table' | 'bar_seat';
export type TableVariant =
  | 'round-2'
  | 'rect-2-v-narrow'
  | 'rect-2-v-wide'
  | 'round-2-alt'
  | 'square-4'
  | 'square-4-wide'
  | 'round-4'
  | 'rect-6-h'
  | 'rect-8-h'
  | 'round-6'
  | 'round-8'
  | 'rect-10-h'
  | 'round-10'
  | 'barstool-1'
  | 'diamond-4';

export interface Table {
  id: string;
  name: string;
  zone: string;
  status: 'free' | 'occupied' | 'billing' | 'blocked';
  sessionId?: string;
  // Grid-based floor plan (orderbird-style)
  gridX?: number; // column position on grid (0-based)
  gridY?: number; // row position on grid (0-based)
  cells?: { x: number; y: number }[]; // multi-cell tables (L-shape, U-shape etc.)
  rounded?: boolean; // rounded corners toggle
  shape?: TableShape;
  variant?: TableVariant;
  seats?: number;
  minPartySize?: number;
  maxPartySize?: number;
  // Legacy free-position fields (kept for compat)
  x?: number;
  y?: number;
  rotation?: TableRotation;
  placementType?: TablePlacementType;
}

export interface TableCombination {
  id: string;
  zoneId: string;
  name: string;
  tableIds: string[];
  minPartySize: number;
  maxPartySize: number;
  active?: boolean;
}

export type MenuCategory = 'drinks' | 'starters' | 'mains' | 'desserts';

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: MenuCategory;
  routing: 'bar' | 'kitchen';
  modifiers?: string[];
  aliases?: string[];
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  modifiers: string[];
  state: 'ordered' | 'sent_to_kitchen' | 'sent_to_bar' | 'ready' | 'problem' | 'served';
  routing: 'bar' | 'kitchen';
  course?: 'starter' | 'main' | 'dessert';
  seatId?: number;
  timestamp: number;
  notes?: string;
}

export type GuestSource = 'walk_in' | 'phone' | 'online';

export type ReservationStatus = 'confirmed' | 'seated' | 'cancelled' | 'no_show'
  | 'running_late' | 'partially_arrived' | 'partially_seated'
  | 'appetizer' | 'entree' | 'dessert'
  | 'cleared' | 'check_dropped' | 'paid' | 'bussing_needed' | 'finished';

// Reservation labels (Etiketten)
export type SeatLabel = 'aussicht' | 'fensterplatz' | 'nischenplatz' | 'raucherplatz' | 'rollstuhlgerecht' | 'ruhiger_tisch' | 'terrasse' | 'hochstuhl';
export type OccasionLabel = 'besonderer_anlass' | 'date' | 'geschaeftsessen' | 'gratis_extra' | 'schulabschluss' | 'theater_kino' | 'geburtstag' | 'jahrestag';

// Table service status (Gang-basiert)
export type TableServiceStatus =
  | 'teilweise_platziert' | 'platziert'
  | 'getraenke' | 'vorspeise' | 'hauptgericht' | 'dessert'
  | 'gang_1' | 'gang_2' | 'gang_3' | 'gang_4' | 'gang_5' | 'gang_6'
  | 'gang_7' | 'gang_8' | 'gang_9' | 'gang_10' | 'gang_11' | 'gang_12'
  | 'digestif' | 'flaschenservice'
  | 'rechnung_faellig' | 'bezahlt'
  | 'restaurantleiter' | 'abraeumen' | 'abgeraeumt' | 'beendet';

export interface Reservation {
  id: string;
  guestName: string;
  guestPhone?: string;
  guestEmail?: string;
  confirmationStatus?: 'pending' | 'confirmed';
  partySize: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  duration: number; // minutes, default 90
  tableId?: string; // assigned table (single, legacy)
  tableIds?: string[]; // multi-table assignment
  zone?: string;
  notes?: string;
  status: ReservationStatus;
  source: 'phone' | 'online' | 'walk_in';
  seatLabels?: SeatLabel[];
  occasionLabels?: OccasionLabel[];
  paymentStatus?: 'open' | 'partial' | 'paid';
  paymentAmount?: number; // amount paid so far (for partial)
  referralSource?: string; // who referred (hotel, concierge, guest name, website, etc.)
  createdAt: number;
}

// Waitlist
export type WaitlistStatus = 'waiting' | 'notified' | 'seated' | 'cancelled' | 'no_show';

export interface WaitlistEntry {
  id: string;
  guestName: string;
  guestPhone?: string;
  partySize: number;
  estimatedWaitMinutes: number;
  notes?: string;
  seatPreference?: string; // e.g. 'terrasse', 'innen', 'bar'
  status: WaitlistStatus;
  position: number; // queue position
  addedAt: number; // timestamp
  notifiedAt?: number; // timestamp when SMS/notification sent
  seatedAt?: number; // timestamp when seated
  assignedTableId?: string;
}

export type GuestTag = 'vip' | 'stammgast' | 'allergiker' | 'vegetarier' | 'vegan' | 'kinderstuhl' | 'rollstuhl' | 'geburtstag' | 'business' | 'presse';

export interface GuestNote {
  id: string;
  category: 'general' | 'status' | 'food' | 'seating' | 'info' | 'history';
  text: string;
  createdAt: number;
}

export interface GuestVisit {
  date: string; // YYYY-MM-DD
  tableName: string;
  partySize: number;
  revenue: number;
  items: string[]; // top ordered items
}

export interface Guest {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  tags: GuestTag[];
  notes: GuestNote[];
  visits: GuestVisit[];
  totalVisits: number;
  totalSpend: number;
  lastVisit?: string; // YYYY-MM-DD
  createdAt: number;
}

export interface TableSession {
  id: string;
  tableId: string;
  combinedTableIds?: string[];
  orders: OrderItem[];
  notes: string[];
  startTime: number;
  servedById?: string;
  servedByName?: string;
  guestName?: string;
  guestCount?: number;
  plannedDuration?: number;
  guestSource?: GuestSource;
  serviceStatus?: TableServiceStatus;
  seatAssignments?: SeatAssignment[];
}

export interface SeatAssignment {
  seatNumber: number;
  guestId?: string;
  guestName?: string;
}

export interface ShiftHistoryRecord {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  shiftName: string; // 'Fruehstueck' | 'Lunch' | 'Dinner'
  revenue: number;
  guests: number;
  tips: number;
  tablesServed: number;
  guestSources: { walk_in: number; phone: number; online: number };
  hourlyGuests: Record<number, number>; // hour -> guest count
  startTime: number;
  endTime: number;
}

export interface Staff {
  id: string;
  name: string;
  pin: string;
  role: 'waiter' | 'manager';
}

export type VoiceState = 'idle' | 'listening_wake' | 'listening_command' | 'processing';

export interface CommandHistoryItem {
  command: string;
  action: UndoableAction;
  timestamp: number;
}

export type UndoableAction =
  | { type: 'ADD_ORDER_ITEMS'; items: OrderItem[] }
  | { type: 'ADD_NOTE'; note: string };

export type Intent =
  | { type: 'SET_TABLE'; tableId: string }
  | { type: 'TABLE_ORDER'; tableId: string; items: { menuItemId: string; name: string; quantity: number; modifiers: string[]; price: number; routing: string }[] }
  | { type: 'ADD_ORDER'; items: { menuItemId: string; name: string; quantity: number; modifiers: string[]; price: number; routing: string }[] }
  | { type: 'SET_COURSE'; course: 'starter' | 'main' | 'dessert' }
  | { type: 'SET_SEAT'; seatId: number; items: { menuItemId: string; name: string; quantity: number; modifiers: string[]; price: number; routing: string }[] }
  | { type: 'ADD_NOTE'; note: string }
  | { type: 'SEND_TO_STATION'; station: 'bar' | 'kitchen' }
  | { type: 'SHOW_BILL' }
  | { type: 'SPLIT_BILL' }
  | { type: 'COMBINED_BILL' }
  | { type: 'PAY_CARD' }
  | { type: 'PAY_CASH' }
  | { type: 'UNDO' }
  | { type: 'UNKNOWN'; text: string };
