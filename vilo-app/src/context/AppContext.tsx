import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { Table, OrderItem, TableSession, Intent, VoiceState, CommandHistoryItem, UndoableAction, Staff, MenuItem, Zone, Restaurant, GuestSource, ShiftHistoryRecord, TableServiceStatus } from '../types';
import { feedbackOrderAdded, feedbackOrderSent, feedbackError } from '../utils/feedback';

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
  | { type: 'UPDATE_CONFIG'; restaurant: Restaurant; zones: Zone[]; tables: Table[]; menu: MenuItem[]; staff: Staff[] }
  | { type: 'SET_GUEST_SOURCE'; tableId: string; source: GuestSource }
  | { type: 'SET_SERVICE_STATUS'; tableId: string; serviceStatus: TableServiceStatus }
  | { type: 'MOVE_TABLE_SESSION'; fromTableId: string; toTableId: string }
  | { type: 'BLOCK_TABLE'; tableId: string }
  | { type: 'UNBLOCK_TABLE'; tableId: string }
  | { type: 'SET_GUEST_COUNT'; tableId: string; guestCount: number }
  | { type: 'SET_GUEST_NAME'; tableId: string; guestName: string }
  | { type: 'CLEAR_SHIFT' }
  | { type: 'SYNC_STATE'; sessions: Record<string, TableSession>; closedTables: ClosedTableRecord[]; tipHistory: TipRecord[]; closedTableRevenue: number; shiftStart: number; shiftHistory: ShiftHistoryRecord[] }
  | { type: 'SYNC_CONFIG'; zones: Zone[]; tables: Table[]; menu: MenuItem[]; staff: Staff[] };

function createInitialState(config?: {
  restaurant: Restaurant;
  zones: Zone[];
  tables: Table[];
  menu: MenuItem[];
  staff: Staff[];
}): AppState {
  const defaultRestaurant: Restaurant = { id: 'default', name: 'Restaurant', code: '000000', currency: 'EUR', taxRate: 19 };
  return {
    restaurant: config?.restaurant || defaultRestaurant,
    tables: config?.tables || [],
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

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

const SHIFT_HISTORY_KEY = 'vilo_shift_history';

function loadShiftHistory(): ShiftHistoryRecord[] {
  try {
    const raw = localStorage.getItem(SHIFT_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ShiftHistoryRecord[];
  } catch {
    return [];
  }
}

function saveShiftHistory(history: ShiftHistoryRecord[]): void {
  // Keep last 60 records max
  const trimmed = history.slice(-60);
  localStorage.setItem(SHIFT_HISTORY_KEY, JSON.stringify(trimmed));
}

function getShiftNameFromHour(hour: number): string {
  if (hour < 11) return 'Fruehstueck';
  if (hour < 15) return 'Lunch';
  return 'Dinner';
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOGIN': {
      const user = state.staff.find(s => s.id === action.userId);
      return { ...state, currentUser: user || null };
    }
    case 'LOGOUT':
      return { ...state, currentUser: null, activeTableId: null, voiceState: 'idle' };

    case 'SET_ACTIVE_TABLE': {
      const table = state.tables.find(t => t.id === action.tableId);
      if (!table) return state;

      let newSessions = { ...state.sessions };
      let newTables = state.tables;

      if (table.status === 'free') {
        const sessionId = generateId();
        newSessions[action.tableId] = {
          id: sessionId,
          tableId: action.tableId,
          orders: [],
          notes: [],
          startTime: Date.now(),
        };
        newTables = state.tables.map(t =>
          t.id === action.tableId ? { ...t, status: 'occupied' as const, sessionId } : t
        );
      }

      return { ...state, activeTableId: action.tableId, tables: newTables, sessions: newSessions, showBilling: false };
    }

    case 'CLEAR_ACTIVE_TABLE':
      return { ...state, activeTableId: null, showBilling: false };

    case 'ADD_ORDER_ITEMS': {
      if (!state.activeTableId) return state;
      const session = state.sessions[state.activeTableId];
      if (!session) return state;

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [state.activeTableId]: {
            ...session,
            orders: [...session.orders, ...action.items],
          },
        },
      };
    }

    case 'SET_COURSE_LAST': {
      if (!state.activeTableId) return state;
      const session = state.sessions[state.activeTableId];
      if (!session || session.orders.length === 0) return state;

      const orders = [...session.orders];
      for (let i = orders.length - 1; i >= 0; i--) {
        if (!orders[i].course) {
          orders[i] = { ...orders[i], course: action.course };
        } else {
          break;
        }
      }

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [state.activeTableId]: { ...session, orders },
        },
      };
    }

    case 'ADD_NOTE': {
      if (!state.activeTableId) return state;
      const session = state.sessions[state.activeTableId];
      if (!session) return state;

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [state.activeTableId]: {
            ...session,
            notes: [...session.notes, action.note],
          },
        },
      };
    }

    case 'REMOVE_ORDER_ITEM': {
      if (!state.activeTableId) return state;
      const session = state.sessions[state.activeTableId];
      if (!session) return state;

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [state.activeTableId]: {
            ...session,
            orders: session.orders.filter(o => o.id !== action.orderId),
          },
        },
      };
    }

    case 'UPDATE_ORDER_QUANTITY': {
      if (!state.activeTableId) return state;
      const session = state.sessions[state.activeTableId];
      if (!session) return state;

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [state.activeTableId]: {
            ...session,
            orders: session.orders.map(o =>
              o.id === action.orderId ? { ...o, quantity: Math.max(1, action.quantity) } : o
            ),
          },
        },
      };
    }

    case 'UPDATE_ORDER_SEAT': {
      if (!state.activeTableId) return state;
      const session = state.sessions[state.activeTableId];
      if (!session) return state;

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [state.activeTableId]: {
            ...session,
            orders: session.orders.map(o =>
              o.id === action.orderId ? { ...o, seatId: action.seatId } : o
            ),
          },
        },
      };
    }

    case 'SEND_ORDERS': {
      if (!state.activeTableId) return state;
      const session = state.sessions[state.activeTableId];
      if (!session) return state;

      const orders = session.orders.map(order => {
        if (order.state === 'ordered') {
          if (action.station) {
            return { ...order, state: (action.station === 'bar' ? 'sent_to_bar' : 'sent_to_kitchen') as OrderItem['state'] };
          }
          return {
            ...order,
            state: (order.routing === 'bar' ? 'sent_to_bar' : 'sent_to_kitchen') as OrderItem['state'],
          };
        }
        return order;
      });

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [state.activeTableId]: { ...session, orders },
        },
      };
    }

    case 'UPDATE_ORDER_STATE': {
      // Search ALL sessions for the order (needed for kitchen/bar display)
      const updatedSessions = { ...state.sessions };
      let found = false;
      for (const tableId of Object.keys(updatedSessions)) {
        const sess = updatedSessions[tableId];
        const hasOrder = sess.orders.some(o => o.id === action.orderId);
        if (hasOrder) {
          updatedSessions[tableId] = {
            ...sess,
            orders: sess.orders.map(o =>
              o.id === action.orderId ? { ...o, state: action.state } : o
            ),
          };
          found = true;
          break;
        }
      }
      if (!found) return state;
      return { ...state, sessions: updatedSessions };
    }

    case 'SET_TABLE_STATUS': {
      return {
        ...state,
        tables: state.tables.map(t =>
          t.id === action.tableId ? { ...t, status: action.status } : t
        ),
      };
    }

    case 'CLOSE_TABLE': {
      const closingSession = state.sessions[action.tableId];
      const closedRevenue = closingSession
        ? closingSession.orders.reduce((sum, o) => sum + o.price * o.quantity, 0)
        : 0;
      const closedTable = state.tables.find(t => t.id === action.tableId);

      // Calculate tips for this table
      const tableTips = state.tipHistory
        .filter(t => t.tableId === action.tableId)
        .reduce((sum, t) => sum + t.amount, 0);

      // Determine payment method
      const tableTipRecords = state.tipHistory.filter(t => t.tableId === action.tableId);
      const methods = new Set(tableTipRecords.map(t => t.method));
      const paymentMethod: 'card' | 'cash' | 'mixed' = methods.size > 1 ? 'mixed' : (methods.values().next().value || 'cash');

      // Create closed table record
      const closedRecord: ClosedTableRecord | null = closingSession && closedTable ? {
        tableId: action.tableId,
        tableName: closedTable.name,
        orders: [...closingSession.orders],
        revenue: closedRevenue,
        tips: tableTips,
        guestCount: closingSession.guestCount || 1,
        guestSource: closingSession.guestSource || 'walk_in',
        startTime: closingSession.startTime,
        closedTime: Date.now(),
        paymentMethod,
      } : null;

      const newSessions = { ...state.sessions };
      delete newSessions[action.tableId];

      return {
        ...state,
        tables: state.tables.map(t =>
          t.id === action.tableId ? { ...t, status: 'free' as const, sessionId: undefined } : t
        ),
        sessions: newSessions,
        activeTableId: state.activeTableId === action.tableId ? null : state.activeTableId,
        showBilling: false,
        closedTableRevenue: state.closedTableRevenue + closedRevenue,
        closedTables: closedRecord ? [...state.closedTables, closedRecord] : state.closedTables,
      };
    }

    case 'SET_VOICE_STATE':
      return { ...state, voiceState: action.voiceState };

    case 'SET_LAST_COMMAND':
      return { ...state, lastCommand: action.command };

    case 'SET_LAST_CONFIRMATION':
      return { ...state, lastConfirmation: action.confirmation };

    case 'SHOW_BILLING':
      return { ...state, showBilling: true, billingMode: action.mode || null };

    case 'HIDE_BILLING':
      return { ...state, showBilling: false, billingMode: null };

    case 'UNDO': {
      if (state.commandHistory.length === 0) return state;
      const lastEntry = state.commandHistory[state.commandHistory.length - 1];
      const lastAction = lastEntry.action;

      if (lastAction.type === 'ADD_ORDER_ITEMS' && state.activeTableId) {
        const session = state.sessions[state.activeTableId];
        if (!session) return state;

        const itemsToRemove = lastAction.items.length;
        const orders = session.orders.slice(0, session.orders.length - itemsToRemove);

        return {
          ...state,
          sessions: {
            ...state.sessions,
            [state.activeTableId]: { ...session, orders },
          },
          commandHistory: state.commandHistory.slice(0, -1),
        };
      }

      if (lastAction.type === 'ADD_NOTE' && state.activeTableId) {
        const session = state.sessions[state.activeTableId];
        if (!session) return state;

        return {
          ...state,
          sessions: {
            ...state.sessions,
            [state.activeTableId]: {
              ...session,
              notes: session.notes.slice(0, -1),
            },
          },
          commandHistory: state.commandHistory.slice(0, -1),
        };
      }

      return { ...state, commandHistory: state.commandHistory.slice(0, -1) };
    }

    case 'PUSH_HISTORY':
      return {
        ...state,
        commandHistory: [...state.commandHistory, {
          command: action.command,
          action: action.action,
          timestamp: Date.now(),
        }],
      };

    case 'ADD_TIP':
      return {
        ...state,
        tipHistory: [...state.tipHistory, action.tip],
      };

    case 'ADD_CLOSED_REVENUE':
      return {
        ...state,
        closedTableRevenue: state.closedTableRevenue + action.amount,
      };

    case 'SET_GUEST_SOURCE': {
      const sess = state.sessions[action.tableId];
      if (!sess) return state;
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [action.tableId]: { ...sess, guestSource: action.source },
        },
      };
    }

    case 'SET_SERVICE_STATUS': {
      const sess2 = state.sessions[action.tableId];
      if (!sess2) return state;
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [action.tableId]: { ...sess2, serviceStatus: action.serviceStatus },
        },
      };
    }

    case 'MOVE_TABLE_SESSION': {
      const fromSession = state.sessions[action.fromTableId];
      if (!fromSession) return state;
      const toTable = state.tables.find(t => t.id === action.toTableId);
      if (!toTable) return state;
      const movedSession = { ...fromSession, tableId: action.toTableId };
      const newSess = { ...state.sessions };
      delete newSess[action.fromTableId];
      newSess[action.toTableId] = movedSession;
      return {
        ...state,
        tables: state.tables.map(t => {
          if (t.id === action.fromTableId) return { ...t, status: 'free' as const, sessionId: undefined };
          if (t.id === action.toTableId) return { ...t, status: 'occupied' as const, sessionId: movedSession.id };
          return t;
        }),
        sessions: newSess,
        activeTableId: state.activeTableId === action.fromTableId ? action.toTableId : state.activeTableId,
      };
    }

    case 'BLOCK_TABLE': {
      return {
        ...state,
        tables: state.tables.map(t =>
          t.id === action.tableId ? { ...t, status: 'blocked' as const } : t
        ),
      };
    }

    case 'UNBLOCK_TABLE': {
      return {
        ...state,
        tables: state.tables.map(t =>
          t.id === action.tableId ? { ...t, status: 'free' as const } : t
        ),
      };
    }

    case 'SET_GUEST_COUNT': {
      const gcSess = state.sessions[action.tableId];
      if (!gcSess) return state;
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [action.tableId]: { ...gcSess, guestCount: action.guestCount },
        },
      };
    }

    case 'SET_GUEST_NAME': {
      const namedSess = state.sessions[action.tableId];
      if (!namedSess) return state;
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [action.tableId]: { ...namedSess, guestName: action.guestName.trim() || undefined },
        },
      };
    }

    case 'CLEAR_SHIFT': {
      // Persist current shift as history record before clearing
      const shiftRevenue = state.closedTableRevenue;
      const shiftGuests = state.closedTables.reduce((sum, t) => sum + t.guestCount, 0);
      const shiftTips = state.tipHistory.reduce((sum, t) => sum + t.amount, 0);
      const shiftSources = { walk_in: 0, phone: 0, online: 0 };
      state.closedTables.forEach(t => {
        shiftSources[t.guestSource] = (shiftSources[t.guestSource] || 0) + t.guestCount;
      });
      const shiftHourly: Record<number, number> = {};
      state.closedTables.forEach(t => {
        const h = new Date(t.startTime).getHours();
        shiftHourly[h] = (shiftHourly[h] || 0) + t.guestCount;
      });
      const now = Date.now();
      const shiftDate = new Date(state.shiftStart);
      const record: ShiftHistoryRecord = {
        id: generateId(),
        date: shiftDate.toISOString().split('T')[0],
        dayOfWeek: shiftDate.getDay(),
        shiftName: getShiftNameFromHour(shiftDate.getHours()),
        revenue: shiftRevenue,
        guests: shiftGuests,
        tips: shiftTips,
        tablesServed: state.closedTables.length,
        guestSources: shiftSources,
        hourlyGuests: shiftHourly,
        startTime: state.shiftStart,
        endTime: now,
      };
      const updatedHistory = [...state.shiftHistory, record];
      saveShiftHistory(updatedHistory);
      return {
        ...state,
        tipHistory: [],
        closedTableRevenue: 0,
        closedTables: [],
        shiftStart: Date.now(),
        shiftHistory: updatedHistory,
      };
    }

    case 'SYNC_STATE': {
      // Merge remote state from WebSocket
      // Preserve local-only fields: activeTableId, currentUser, voiceState, etc.
      const remoteSessions = action.sessions as Record<string, TableSession>;
      const mergedSessions: Record<string, TableSession> = { ...remoteSessions };

      Object.entries(state.sessions).forEach(([tableId, localSession]) => {
        if (mergedSessions[tableId]) return;

        const table = state.tables.find(t => t.id === tableId);
        const hasEndedServiceStatus = !!(localSession.serviceStatus && ['abgeraeumt', 'beendet'].includes(localSession.serviceStatus));
        const shouldKeepLocalSession = !hasEndedServiceStatus && (
          table?.status === 'occupied' ||
          table?.status === 'billing' ||
          Boolean(localSession.serviceStatus)
        );

        if (shouldKeepLocalSession) {
          mergedSessions[tableId] = localSession;
        }
      });

      const syncedTables = state.tables.map(t => {
        // Update table status based on sessions
        const hasSession = mergedSessions[t.id] !== undefined;
        if (hasSession && t.status === 'free') {
          return { ...t, status: 'occupied' as const, sessionId: mergedSessions[t.id].id };
        }
        if (!hasSession && (t.status === 'occupied' || t.status === 'billing')) {
          return { ...t, status: 'free' as const, sessionId: undefined };
        }
        return t;
      });
      return {
        ...state,
        tables: syncedTables,
        sessions: mergedSessions,
        closedTables: action.closedTables as ClosedTableRecord[],
        tipHistory: action.tipHistory as TipRecord[],
        closedTableRevenue: action.closedTableRevenue,
        shiftStart: action.shiftStart,
        shiftHistory: action.shiftHistory as ShiftHistoryRecord[],
      };
    }

    case 'SYNC_CONFIG': {
      // Merge remote config update, preserving table status/sessions
      const mergedTables = action.tables.map((newT: Table) => {
        const existing = state.tables.find(t => t.id === newT.id);
        if (existing) {
          return { ...newT, status: existing.status, sessionId: existing.sessionId };
        }
        return newT;
      });
      return {
        ...state,
        zones: action.zones,
        tables: mergedTables,
        menu: action.menu,
        staff: action.staff,
      };
    }

    case 'UPDATE_CONFIG': {
      // Merge new config into state, preserving sessions, tips, etc.
      // For tables: keep existing status/sessionId for tables that still exist
      const updatedTables = action.tables.map(newT => {
        const existing = state.tables.find(t => t.id === newT.id);
        if (existing) {
          return { ...newT, status: existing.status, sessionId: existing.sessionId };
        }
        return newT;
      });
      return {
        ...state,
        restaurant: action.restaurant,
        zones: action.zones,
        tables: updatedTables,
        menu: action.menu,
        staff: action.staff,
      };
    }

    default:
      return state;
  }
}

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
    menu: MenuItem[];
    staff: Staff[];
  };
}

export function AppProvider({ children, config }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, config, (c) => createInitialState(c));

  // Expose restaurantId for sync layer
  const restaurantId = config?.restaurant?.id || state.restaurant?.id || '';

  const executeIntent = useCallback((intent: Intent, command: string): string => {
    switch (intent.type) {
      case 'SET_TABLE': {
        const table = state.tables.find(t => t.id === intent.tableId);
        if (!table) {
          return `Tisch "${intent.tableId}" nicht gefunden.`;
        }
        dispatch({ type: 'SET_ACTIVE_TABLE', tableId: intent.tableId });
        return `${table.name} ausgewählt.`;
      }

      case 'TABLE_ORDER': {
        // Combined: set table + add order in one command
        const tTable = state.tables.find(t => t.id === intent.tableId);
        if (!tTable) return `Tisch "${intent.tableId}" nicht gefunden.`;
        dispatch({ type: 'SET_ACTIVE_TABLE', tableId: intent.tableId });

        const tOrderItems: OrderItem[] = intent.items.map(item => ({
          id: generateId(),
          menuItemId: item.menuItemId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          modifiers: item.modifiers,
          state: 'ordered',
          routing: item.routing as 'bar' | 'kitchen',
          timestamp: Date.now(),
        }));

        // React useReducer processes dispatches sequentially - each dispatch sees the state
        // after the previous reducer ran. No setTimeout needed.
        const tUndoAction: UndoableAction = { type: 'ADD_ORDER_ITEMS', items: tOrderItems };
        dispatch(tUndoAction);
        dispatch({ type: 'PUSH_HISTORY', command, action: tUndoAction });

        feedbackOrderAdded();
        const tItemNames = intent.items.map(i => `${i.quantity}x ${i.name}`).join(', ');
        return `${tTable.name}: ${tItemNames} hinzugefügt.`;
      }

      case 'ADD_ORDER': {
        if (!state.activeTableId) return 'Bitte zuerst einen Tisch auswählen.';

        const orderItems: OrderItem[] = intent.items.map(item => ({
          id: generateId(),
          menuItemId: item.menuItemId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          modifiers: item.modifiers,
          state: 'ordered',
          routing: item.routing as 'bar' | 'kitchen',
          timestamp: Date.now(),
        }));

        const undoAction: UndoableAction = { type: 'ADD_ORDER_ITEMS', items: orderItems };
        dispatch(undoAction);
        dispatch({ type: 'PUSH_HISTORY', command, action: undoAction });

        feedbackOrderAdded();
        const itemNames = intent.items.map(i => `${i.quantity}x ${i.name}`).join(', ');
        return `${itemNames} hinzugefügt.`;
      }

      case 'SET_SEAT': {
        if (!state.activeTableId) return 'Bitte zuerst einen Tisch auswählen.';

        const orderItems: OrderItem[] = intent.items.map(item => ({
          id: generateId(),
          menuItemId: item.menuItemId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          modifiers: item.modifiers,
          state: 'ordered',
          routing: item.routing as 'bar' | 'kitchen',
          seatId: intent.seatId,
          timestamp: Date.now(),
        }));

        const undoAction: UndoableAction = { type: 'ADD_ORDER_ITEMS', items: orderItems };
        dispatch(undoAction);
        dispatch({ type: 'PUSH_HISTORY', command, action: undoAction });

        feedbackOrderAdded();
        const itemNames = intent.items.map(i => `${i.quantity}x ${i.name}`).join(', ');
        return `${itemNames} für Gast ${intent.seatId} hinzugefügt.`;
      }

      case 'SET_COURSE': {
        dispatch({ type: 'SET_COURSE_LAST', course: intent.course });
        const courseNames: Record<string, string> = { starter: 'Vorspeise', main: 'Hauptgang', dessert: 'Dessert' };
        return `Als ${courseNames[intent.course]} markiert.`;
      }

      case 'ADD_NOTE': {
        if (!state.activeTableId) return 'Bitte zuerst einen Tisch auswählen.';
        const undoAction: UndoableAction = { type: 'ADD_NOTE', note: intent.note };
        dispatch(undoAction);
        dispatch({ type: 'PUSH_HISTORY', command, action: undoAction });
        return `Notiz: ${intent.note}`;
      }

      case 'SEND_TO_STATION':
        dispatch({ type: 'SEND_ORDERS', station: intent.station });
        feedbackOrderSent();
        return `Bestellung an ${intent.station === 'bar' ? 'Bar' : 'Küche'} gesendet.`;

      case 'SHOW_BILL':
        dispatch({ type: 'SHOW_BILLING' });
        return 'Rechnung wird angezeigt.';

      case 'SPLIT_BILL':
        dispatch({ type: 'SHOW_BILLING', mode: 'split' });
        return 'Getrennte Rechnung wird angezeigt.';

      case 'COMBINED_BILL':
        dispatch({ type: 'SHOW_BILLING', mode: 'combined' });
        return 'Gesamtrechnung wird angezeigt.';

      case 'PAY_CARD':
        dispatch({ type: 'SHOW_BILLING', mode: 'combined' });
        return 'Kartenzahlung - Rechnung wird angezeigt.';

      case 'PAY_CASH':
        dispatch({ type: 'SHOW_BILLING', mode: 'combined' });
        return 'Barzahlung - Rechnung wird angezeigt.';

      case 'UNDO':
        dispatch({ type: 'UNDO' });
        return 'Letzte Aktion rückgängig gemacht.';

      case 'UNKNOWN':
        feedbackError();
        return `Befehl nicht erkannt: "${intent.text}"`;
    }
  }, [state.tables, state.activeTableId]);

  return (
    <AppContext.Provider value={{ state, dispatch, executeIntent, restaurantId }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
