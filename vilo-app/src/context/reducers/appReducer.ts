import type { Table, OrderItem, TableSession, TableCombination, SeatAssignment, ShiftHistoryRecord } from '../../types';
import type { AppState, AppAction, ClosedTableRecord, TipRecord } from '../AppContext';

// --- Helpers ---

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function getCombinationByTableId(combinations: TableCombination[], tableId: string): TableCombination | null {
  return combinations.find(combination => combination.tableIds.includes(tableId)) || null;
}

function getSessionOwnerTableId(state: AppState, tableId: string): string | null {
  if (state.sessions[tableId]) return tableId;
  const owner = Object.values(state.sessions).find(session => session.combinedTableIds?.includes(tableId));
  return owner?.tableId || null;
}

const SHIFT_HISTORY_KEY = 'vilo_shift_history';

export function loadShiftHistory(): ShiftHistoryRecord[] {
  try {
    const raw = localStorage.getItem(SHIFT_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ShiftHistoryRecord[];
  } catch {
    return [];
  }
}

function saveShiftHistory(history: ShiftHistoryRecord[]): void {
  const trimmed = history.slice(-60);
  localStorage.setItem(SHIFT_HISTORY_KEY, JSON.stringify(trimmed));
}

function getShiftNameFromHour(hour: number): string {
  if (hour < 11) return 'Fruehstueck';
  if (hour < 15) return 'Lunch';
  return 'Dinner';
}

function pruneSeatAssignments(assignments: SeatAssignment[] | undefined, guestCount: number | undefined): SeatAssignment[] | undefined {
  if (!assignments || assignments.length === 0) return undefined;
  const limit = Math.max(0, guestCount || 0);
  const nextAssignments = assignments.filter(assignment => assignment.seatNumber <= limit);
  return nextAssignments.length > 0 ? nextAssignments : undefined;
}

function collapseSeatAssignments(assignments: SeatAssignment[] | undefined, removedSeatNumber: number, nextGuestCount: number): SeatAssignment[] | undefined {
  if (!assignments || assignments.length === 0) return undefined;

  const nextAssignments = assignments
    .filter(assignment => assignment.seatNumber !== removedSeatNumber)
    .map(assignment => (
      assignment.seatNumber > removedSeatNumber
        ? { ...assignment, seatNumber: assignment.seatNumber - 1 }
        : assignment
    ))
    .filter(assignment => assignment.seatNumber <= nextGuestCount)
    .sort((a, b) => a.seatNumber - b.seatNumber);

  return nextAssignments.length > 0 ? nextAssignments : undefined;
}

// --- Main Reducer ---

export function appReducer(state: AppState, action: AppAction): AppState {
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

      const existingOwnerId = getSessionOwnerTableId(state, action.tableId);
      if (existingOwnerId) {
        const existingSession = state.sessions[existingOwnerId];
        if (existingSession && !existingSession.servedByName && state.currentUser) {
          return {
            ...state,
            activeTableId: existingOwnerId,
            showBilling: false,
            sessions: {
              ...state.sessions,
              [existingOwnerId]: {
                ...existingSession,
                servedById: state.currentUser.id,
                servedByName: state.currentUser.name,
              },
            },
          };
        }
        return { ...state, activeTableId: existingOwnerId, showBilling: false };
      }

      let newSessions = { ...state.sessions };
      let newTables = state.tables;

      if (table.status === 'free') {
        const sessionId = generateId();
        const combination = getCombinationByTableId(state.tableCombinations, action.tableId);
        const combinedTableIds = combination
          ? combination.tableIds.filter(id => id !== action.tableId)
          : undefined;
        newSessions[action.tableId] = {
          id: sessionId,
          tableId: action.tableId,
          combinedTableIds,
          orders: [],
          notes: [],
          startTime: Date.now(),
          servedById: state.currentUser?.id,
          servedByName: state.currentUser?.name,
          seatAssignments: [],
        };
        newTables = state.tables.map(t =>
          t.id === action.tableId || combinedTableIds?.includes(t.id)
            ? { ...t, status: 'occupied' as const, sessionId }
            : t
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
          [state.activeTableId]: { ...session, orders: [...session.orders, ...action.items] },
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
        sessions: { ...state.sessions, [state.activeTableId]: { ...session, orders } },
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
          [state.activeTableId]: { ...session, notes: [...session.notes, action.note] },
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
          [state.activeTableId]: { ...session, orders: session.orders.filter(o => o.id !== action.orderId) },
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
          return { ...order, state: (order.routing === 'bar' ? 'sent_to_bar' : 'sent_to_kitchen') as OrderItem['state'] };
        }
        return order;
      });
      return {
        ...state,
        sessions: { ...state.sessions, [state.activeTableId]: { ...session, orders } },
      };
    }

    case 'UPDATE_ORDER_STATE': {
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

    case 'SET_TABLE_STATUS':
      return {
        ...state,
        tables: state.tables.map(t =>
          t.id === action.tableId ? { ...t, status: action.status } : t
        ),
      };

    case 'CLOSE_TABLE': {
      const ownerTableId = getSessionOwnerTableId(state, action.tableId) || action.tableId;
      const closingSession = state.sessions[ownerTableId];
      const closedRevenue = closingSession
        ? closingSession.orders.reduce((sum, o) => sum + o.price * o.quantity, 0)
        : 0;
      const closedTable = state.tables.find(t => t.id === ownerTableId);

      const tableTips = state.tipHistory
        .filter(t => t.tableId === ownerTableId)
        .reduce((sum, t) => sum + t.amount, 0);

      const tableTipRecords = state.tipHistory.filter(t => t.tableId === ownerTableId);
      const methods = new Set(tableTipRecords.map(t => t.method));
      const paymentMethod: 'card' | 'cash' | 'mixed' = methods.size > 1 ? 'mixed' : (methods.values().next().value || 'cash');

      const closedRecord: ClosedTableRecord | null = closingSession && closedTable ? {
        tableId: ownerTableId,
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
      delete newSessions[ownerTableId];
      const combinedTableIds = closingSession?.combinedTableIds || [];

      return {
        ...state,
        tables: state.tables.map(t =>
          t.id === ownerTableId || combinedTableIds.includes(t.id)
            ? { ...t, status: 'free' as const, sessionId: undefined }
            : t
        ),
        sessions: newSessions,
        activeTableId: state.activeTableId === ownerTableId ? null : state.activeTableId,
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
          sessions: { ...state.sessions, [state.activeTableId]: { ...session, orders } },
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
            [state.activeTableId]: { ...session, notes: session.notes.slice(0, -1) },
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
      return { ...state, tipHistory: [...state.tipHistory, action.tip] };

    case 'ADD_CLOSED_REVENUE':
      return { ...state, closedTableRevenue: state.closedTableRevenue + action.amount };

    case 'SET_GUEST_SOURCE': {
      const sess = state.sessions[action.tableId];
      if (!sess) return state;
      return {
        ...state,
        sessions: { ...state.sessions, [action.tableId]: { ...sess, guestSource: action.source } },
      };
    }

    case 'SET_SERVICE_STATUS': {
      const sess2 = state.sessions[action.tableId];
      if (!sess2) return state;
      return {
        ...state,
        sessions: { ...state.sessions, [action.tableId]: { ...sess2, serviceStatus: action.serviceStatus } },
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

    case 'BLOCK_TABLE':
      return {
        ...state,
        tables: state.tables.map(t =>
          t.id === action.tableId ? { ...t, status: 'blocked' as const } : t
        ),
      };

    case 'UNBLOCK_TABLE':
      return {
        ...state,
        tables: state.tables.map(t =>
          t.id === action.tableId ? { ...t, status: 'free' as const } : t
        ),
      };

    case 'SET_GUEST_COUNT': {
      const ownerTableId = getSessionOwnerTableId(state, action.tableId);
      if (!ownerTableId) return state;
      const gcSess = state.sessions[ownerTableId];
      if (!gcSess) return state;
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [ownerTableId]: {
            ...gcSess,
            guestCount: action.guestCount,
            seatAssignments: pruneSeatAssignments(gcSess.seatAssignments, action.guestCount),
          },
        },
      };
    }

    case 'SET_SESSION_DURATION': {
      const ownerTableId = getSessionOwnerTableId(state, action.tableId);
      if (!ownerTableId) return state;
      const durationSess = state.sessions[ownerTableId];
      if (!durationSess) return state;
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [ownerTableId]: { ...durationSess, plannedDuration: Math.max(15, action.duration) },
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

    case 'ASSIGN_SEAT_GUEST': {
      const session = state.sessions[action.tableId];
      if (!session) return state;
      const maxActiveSeats = Math.max(0, session.guestCount || 0);
      if (action.seatNumber < 1 || action.seatNumber > maxActiveSeats) return state;
      const currentAssignments = session.seatAssignments || [];
      const nextAssignments = [
        ...currentAssignments.filter(a => a.seatNumber !== action.seatNumber),
        { seatNumber: action.seatNumber, guestId: action.guestId, guestName: action.guestName },
      ].sort((a, b) => a.seatNumber - b.seatNumber);
      return {
        ...state,
        sessions: { ...state.sessions, [action.tableId]: { ...session, seatAssignments: nextAssignments } },
      };
    }

    case 'CLEAR_SEAT_GUEST': {
      const session = state.sessions[action.tableId];
      if (!session) return state;
      const currentGuestCount = Math.max(0, session.guestCount || 0);
      if (action.seatNumber < 1 || action.seatNumber > currentGuestCount) return state;
      const nextGuestCount = Math.max(0, currentGuestCount - 1);
      const nextAssignments = collapseSeatAssignments(session.seatAssignments, action.seatNumber, nextGuestCount);
      const nextOrders = session.orders.map(order => {
        if (order.seatId === action.seatNumber) return { ...order, seatId: undefined };
        if (order.seatId && order.seatId > action.seatNumber) return { ...order, seatId: order.seatId - 1 };
        return order;
      });
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [action.tableId]: { ...session, guestCount: nextGuestCount, seatAssignments: nextAssignments, orders: nextOrders },
        },
      };
    }

    case 'CLEAR_SHIFT': {
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
        tableCombinations: action.tableCombinations || [],
        menu: action.menu,
        staff: action.staff,
      };
    }

    case 'UPDATE_CONFIG': {
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
        tableCombinations: action.tableCombinations,
        menu: action.menu,
        staff: action.staff,
      };
    }

    default:
      return state;
  }
}
