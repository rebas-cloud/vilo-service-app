import type { Intent, OrderItem, UndoableAction } from '../types';
import type { AppState, AppAction } from './AppContext';
import { feedbackOrderAdded, feedbackOrderSent, feedbackError } from '../utils/feedback';
import { generateId } from '../utils/common';

export function createIntentExecutor(
  state: AppState,
  dispatch: React.Dispatch<AppAction>,
) {
  return function executeIntent(intent: Intent, command: string): string {
    switch (intent.type) {
      case 'SET_TABLE': {
        const table = state.tables.find(t => t.id === intent.tableId);
        if (!table) return `Tisch "${intent.tableId}" nicht gefunden.`;
        dispatch({ type: 'SET_ACTIVE_TABLE', tableId: intent.tableId });
        return `${table.name} ausgewählt.`;
      }

      case 'TABLE_ORDER': {
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

      case 'SET_TABLE_STATUS': {
        const statusTable = state.tables.find(t => t.id === intent.tableId);
        if (!statusTable) return `Tisch "${intent.tableId}" nicht gefunden.`;
        dispatch({ type: 'SET_TABLE_STATUS', tableId: intent.tableId, status: intent.status });
        const statusLabel = intent.status === 'free' ? 'frei' : 'bei Rechnung';
        return `${statusTable.name} ist jetzt ${statusLabel}.`;
      }

      case 'MAKE_RESERVATION': {
        // Reservation creation via voice — currently navigates to reservation tab
        // and stores a pending intent in lastConfirmation for the UI to pick up.
        // A full deep-link into the reservation form requires the UI layer; we
        // return a guidance string here so speech synthesis reads it aloud.
        const guestPart = intent.guestName ? ` für ${intent.guestName}` : '';
        return `Reservierung${guestPart}: ${intent.partySize} Personen um ${intent.time} Uhr. Bitte im Reservierungsformular bestätigen.`;
      }

      case 'UNKNOWN':
        feedbackError();
        return `Befehl nicht erkannt: "${intent.text}"`;
    }
  };
}
