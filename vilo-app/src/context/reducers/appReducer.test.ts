import { describe, it, expect } from 'vitest';
import { appReducer } from './appReducer';
import type { AppState } from '../AppContext';

function createTestState(overrides: Partial<AppState> = {}): AppState {
  return {
    restaurant: { id: 'r1', name: 'Test Restaurant', code: 'TEST42', currency: 'EUR', taxRate: 19 },
    tables: [
      { id: 't1', name: 'Tisch 1', zone: 'z1', status: 'free' },
      { id: 't2', name: 'Tisch 2', zone: 'z1', status: 'free' },
      { id: 't3', name: 'Tisch 3', zone: 'z1', status: 'occupied' },
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

describe('appReducer', () => {
  describe('LOGIN / LOGOUT', () => {
    it('should login a staff member', () => {
      const state = createTestState();
      const next = appReducer(state, { type: 'LOGIN', userId: 's1' });
      expect(next.currentUser).toEqual({ id: 's1', name: 'Max', pin: '1234', role: 'waiter' });
    });

    it('should return null for unknown user', () => {
      const state = createTestState();
      const next = appReducer(state, { type: 'LOGIN', userId: 'unknown' });
      expect(next.currentUser).toBeNull();
    });

    it('should logout and clear active table', () => {
      const state = createTestState({
        currentUser: { id: 's1', name: 'Max', pin: '1234', role: 'waiter' },
        activeTableId: 't1',
      });
      const next = appReducer(state, { type: 'LOGOUT' });
      expect(next.currentUser).toBeNull();
      expect(next.activeTableId).toBeNull();
      expect(next.voiceState).toBe('idle');
    });
  });

  describe('SET_ACTIVE_TABLE', () => {
    it('should set active table and create session for free table', () => {
      const state = createTestState({
        currentUser: { id: 's1', name: 'Max', pin: '1234', role: 'waiter' },
      });
      const next = appReducer(state, { type: 'SET_ACTIVE_TABLE', tableId: 't1' });
      expect(next.activeTableId).toBe('t1');
      expect(next.sessions['t1']).toBeDefined();
      expect(next.sessions['t1'].orders).toEqual([]);
      expect(next.tables.find(t => t.id === 't1')?.status).toBe('occupied');
    });

    it('should not set active table for unknown table', () => {
      const state = createTestState();
      const next = appReducer(state, { type: 'SET_ACTIVE_TABLE', tableId: 'unknown' });
      expect(next.activeTableId).toBeNull();
    });
  });

  describe('ADD_ORDER_ITEMS', () => {
    it('should add order items to active session', () => {
      const state = createTestState({
        activeTableId: 't1',
        sessions: {
          t1: { id: 'sess1', tableId: 't1', orders: [], notes: [], startTime: Date.now() },
        },
      });
      const items = [{
        id: 'o1', menuItemId: 'm1', name: 'Cola', quantity: 2,
        price: 3.5, modifiers: [], state: 'ordered' as const,
        routing: 'bar' as const, timestamp: Date.now(),
      }];
      const next = appReducer(state, { type: 'ADD_ORDER_ITEMS', items });
      expect(next.sessions['t1'].orders).toHaveLength(1);
      expect(next.sessions['t1'].orders[0].name).toBe('Cola');
    });

    it('should not add items without active table', () => {
      const state = createTestState();
      const next = appReducer(state, { type: 'ADD_ORDER_ITEMS', items: [] });
      expect(next).toBe(state);
    });
  });

  describe('SEND_ORDERS', () => {
    it('should route orders to kitchen/bar based on routing field', () => {
      const state = createTestState({
        activeTableId: 't1',
        sessions: {
          t1: {
            id: 'sess1', tableId: 't1', notes: [], startTime: Date.now(),
            orders: [
              { id: 'o1', menuItemId: 'm1', name: 'Cola', quantity: 1, price: 3.5, modifiers: [], state: 'ordered', routing: 'bar', timestamp: Date.now() },
              { id: 'o2', menuItemId: 'm2', name: 'Schnitzel', quantity: 1, price: 14.9, modifiers: [], state: 'ordered', routing: 'kitchen', timestamp: Date.now() },
            ],
          },
        },
      });
      const next = appReducer(state, { type: 'SEND_ORDERS' });
      expect(next.sessions['t1'].orders[0].state).toBe('sent_to_bar');
      expect(next.sessions['t1'].orders[1].state).toBe('sent_to_kitchen');
    });
  });

  describe('CLOSE_TABLE', () => {
    it('should close table, free it, and track revenue', () => {
      const state = createTestState({
        activeTableId: 't1',
        tables: [
          { id: 't1', name: 'Tisch 1', zone: 'z1', status: 'occupied' },
          { id: 't2', name: 'Tisch 2', zone: 'z1', status: 'free' },
        ],
        sessions: {
          t1: {
            id: 'sess1', tableId: 't1', notes: [], startTime: Date.now(),
            orders: [
              { id: 'o1', menuItemId: 'm2', name: 'Schnitzel', quantity: 2, price: 14.9, modifiers: [], state: 'served', routing: 'kitchen', timestamp: Date.now() },
            ],
          },
        },
      });
      const next = appReducer(state, { type: 'CLOSE_TABLE', tableId: 't1' });
      expect(next.tables.find(t => t.id === 't1')?.status).toBe('free');
      expect(next.sessions['t1']).toBeUndefined();
      expect(next.closedTableRevenue).toBe(29.8); // 2 * 14.9
      expect(next.closedTables).toHaveLength(1);
      expect(next.activeTableId).toBeNull();
    });
  });

  describe('BLOCK_TABLE / UNBLOCK_TABLE', () => {
    it('should block a table', () => {
      const state = createTestState();
      const next = appReducer(state, { type: 'BLOCK_TABLE', tableId: 't1' });
      expect(next.tables.find(t => t.id === 't1')?.status).toBe('blocked');
    });

    it('should unblock a table', () => {
      const state = createTestState({
        tables: [{ id: 't1', name: 'Tisch 1', zone: 'z1', status: 'blocked' }],
      });
      const next = appReducer(state, { type: 'UNBLOCK_TABLE', tableId: 't1' });
      expect(next.tables.find(t => t.id === 't1')?.status).toBe('free');
    });
  });

  describe('BILLING', () => {
    it('should show billing modal', () => {
      const state = createTestState();
      const next = appReducer(state, { type: 'SHOW_BILLING', mode: 'split' });
      expect(next.showBilling).toBe(true);
      expect(next.billingMode).toBe('split');
    });

    it('should hide billing modal', () => {
      const state = createTestState({ showBilling: true, billingMode: 'combined' });
      const next = appReducer(state, { type: 'HIDE_BILLING' });
      expect(next.showBilling).toBe(false);
      expect(next.billingMode).toBeNull();
    });

    it('should add tip', () => {
      const state = createTestState();
      const tip = { amount: 5, tableId: 't1', tableName: 'Tisch 1', method: 'card' as const, timestamp: Date.now() };
      const next = appReducer(state, { type: 'ADD_TIP', tip });
      expect(next.tipHistory).toHaveLength(1);
      expect(next.tipHistory[0].amount).toBe(5);
    });
  });

  describe('MOVE_TABLE_SESSION', () => {
    it('should move session from one table to another', () => {
      const state = createTestState({
        activeTableId: 't1',
        tables: [
          { id: 't1', name: 'Tisch 1', zone: 'z1', status: 'occupied' },
          { id: 't2', name: 'Tisch 2', zone: 'z1', status: 'free' },
        ],
        sessions: {
          t1: { id: 'sess1', tableId: 't1', orders: [], notes: [], startTime: Date.now() },
        },
      });
      const next = appReducer(state, { type: 'MOVE_TABLE_SESSION', fromTableId: 't1', toTableId: 't2' });
      expect(next.sessions['t1']).toBeUndefined();
      expect(next.sessions['t2']).toBeDefined();
      expect(next.tables.find(t => t.id === 't1')?.status).toBe('free');
      expect(next.tables.find(t => t.id === 't2')?.status).toBe('occupied');
      expect(next.activeTableId).toBe('t2');
    });
  });
});
