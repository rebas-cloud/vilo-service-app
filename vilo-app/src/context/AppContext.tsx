import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { Table, TableCombination, OrderItem, TableSession, Intent, VoiceState, CommandHistoryItem, UndoableAction, Staff, MenuItem, Zone, Restaurant, GuestSource, ShiftHistoryRecord, TableServiceStatus } from '../types';
import { appReducer, loadShiftHistory } from './reducers/appReducer';
import { createIntentExecutor } from './executeIntent';

// --- Exported Types ---

export interface TipRecord {
  amount: number;
  tableId: string;
  tableName: string;
  method: 'card' | 'cash';
  timestamp: number;
}

export interface ClosedTableRecord {
  tableId: string;
  tableName: string;
  orders: OrderItem[];
  revenue: number;
  tips: number;
  guestCount: number;
  guestSource: GuestSource;
  startTime: number;
  closedTime: number;
  paymentMethod: 'card' | 'cash' | 'mixed';
}

export interface AppState {
  restaurant: Restaurant;
  tables: Table[];
  tableCombinations: TableCombination[];
  zones: Zone[];
  menu: MenuItem[];
  staff: Staff[];
  sessions: Record<string, TableSession>;
  activeTableId: string | null;
  currentUser: Staff | null;
  voiceState: VoiceState;
  lastCommand: string;
  lastConfirmation: string;
  commandHistory: CommandHistoryItem[];
  showBilling: boolean;
  billingMode: 'combined' | 'split' | null;
  tipHistory: TipRecord[];
  closedTableRevenue: number;
  closedTables: ClosedTableRecord[];
  shiftStart: number;
  shiftHistory: ShiftHistoryRecord[];
}

export type AppAction =
  | { type: 'LOGIN'; userId: string }
  | { type: 'LOGOUT' }
  | { type: 'SET_ACTIVE_TABLE'; tableId: string }
  | { type: 'CLEAR_ACTIVE_TABLE' }
  | { type: 'ADD_ORDER_ITEMS'; items: OrderItem[] }
  | { type: 'UPDATE_ORDER_QUANTITY'; orderId: string; quantity: number }
  | { type: 'SET_COURSE_LAST'; course: 'starter' | 'main' | 'dessert' }
  | { type: 'ADD_NOTE'; note: string }
  | { type: 'REMOVE_ORDER_ITEM'; orderId: string }
  | { type: 'UPDATE_ORDER_SEAT'; orderId: string; seatId: number }
  | { type: 'SEND_ORDERS'; station?: 'bar' | 'kitchen' }
  | { type: 'UPDATE_ORDER_STATE'; orderId: string; state: OrderItem['state']; tableId?: string }
  | { type: 'SET_TABLE_STATUS'; tableId: string; status: Table['status'] }
  | { type: 'CLOSE_TABLE'; tableId: string }
  | { type: 'SET_VOICE_STATE'; voiceState: VoiceState }
  | { type: 'SET_LAST_COMMAND'; command: string }
  | { type: 'SET_LAST_CONFIRMATION'; confirmation: string }
  | { type: 'SHOW_BILLING'; mode?: 'combined' | 'split' | null }
  | { type: 'HIDE_BILLING' }
  | { type: 'UNDO' }
  | { type: 'PUSH_HISTORY'; command: string; action: UndoableAction }
  | { type: 'ADD_TIP'; tip: TipRecord }
  | { type: 'ADD_CLOSED_REVENUE'; amount: number }
  | { type: 'UPDATE_CONFIG'; restaurant: Restaurant; zones: Zone[]; tables: Table[]; tableCombinations: TableCombination[]; menu: MenuItem[]; staff: Staff[] }
  | { type: 'SET_GUEST_SOURCE'; tableId: string; source: GuestSource }
  | { type: 'SET_SERVICE_STATUS'; tableId: string; serviceStatus: TableServiceStatus }
  | { type: 'MOVE_TABLE_SESSION'; fromTableId: string; toTableId: string }
  | { type: 'BLOCK_TABLE'; tableId: string }
  | { type: 'UNBLOCK_TABLE'; tableId: string }
  | { type: 'SET_GUEST_COUNT'; tableId: string; guestCount: number }
  | { type: 'SET_SESSION_DURATION'; tableId: string; duration: number }
  | { type: 'SET_GUEST_NAME'; tableId: string; guestName: string }
  | { type: 'ASSIGN_SEAT_GUEST'; tableId: string; seatNumber: number; guestId?: string; guestName?: string }
  | { type: 'CLEAR_SEAT_GUEST'; tableId: string; seatNumber: number }
  | { type: 'CLEAR_SHIFT' }
  | { type: 'SYNC_STATE'; sessions: Record<string, TableSession>; closedTables: ClosedTableRecord[]; tipHistory: TipRecord[]; closedTableRevenue: number; shiftStart: number; shiftHistory: ShiftHistoryRecord[] }
  | { type: 'SYNC_CONFIG'; zones: Zone[]; tables: Table[]; tableCombinations: TableCombination[]; menu: MenuItem[]; staff: Staff[] };

// --- Initial State ---

function createInitialState(config?: {
  restaurant: Restaurant;
  zones: Zone[];
  tables: Table[];
  tableCombinations?: TableCombination[];
  menu: MenuItem[];
  staff: Staff[];
}): AppState {
  const defaultRestaurant: Restaurant = { id: 'default', name: 'Restaurant', code: '000000', currency: 'EUR', taxRate: 19 };
  return {
    restaurant: config?.restaurant || defaultRestaurant,
    tables: config?.tables || [],
    tableCombinations: config?.tableCombinations || [],
    zones: config?.zones || [],
    menu: config?.menu || [],
    staff: config?.staff || [],
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
    shiftHistory: loadShiftHistory(),
  };
}

// --- Context ---

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  executeIntent: (intent: Intent, command: string) => string;
  restaurantId: string;
}

const AppContext = createContext<AppContextType | null>(null);

interface AppProviderProps {
  children: React.ReactNode;
  config?: {
    restaurant: Restaurant;
    zones: Zone[];
    tables: Table[];
    tableCombinations?: TableCombination[];
    menu: MenuItem[];
    staff: Staff[];
  };
}

export function AppProvider({ children, config }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, config, (c) => createInitialState(c));
  const restaurantId = config?.restaurant?.id || state.restaurant?.id || '';

  const executeIntent = useCallback(
    (intent: Intent, command: string): string => {
      return createIntentExecutor(state, dispatch)(intent, command);
    },
    [state.tables, state.activeTableId]
  );

  return (
    <AppContext.Provider value={{ state, dispatch, executeIntent, restaurantId }}>
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
