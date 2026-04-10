import { useState, useEffect, useRef } from 'react';
import { IconAlertTriangle, IconBell, IconCircleCheck, IconChefHat, IconClock, IconGlass } from '@tabler/icons-react';

import { useApp } from '../context/AppContext';
import { OrderItem } from '../types';

type DisplayMode = 'kitchen' | 'bar';

interface OrderGroup {
  tableId: string;
  tableName: string;
  orders: OrderItem[];
  oldestTimestamp: number;
}

export function KitchenBarDisplay({ onBack: _onBack }: { onBack: () => void }) {
  const { state, dispatch } = useApp();
  const [mode, setMode] = useState<DisplayMode>('kitchen');
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const prevOrderCountRef = useRef(0);

  // Collect all orders across all sessions, grouped by table
  const getOrderGroups = (): OrderGroup[] => {
    const groups: OrderGroup[] = [];
    const targetStates: OrderItem['state'][] = mode === 'kitchen'
      ? ['sent_to_kitchen']
      : ['sent_to_bar'];

    for (const tableId of Object.keys(state.sessions)) {
      const session = state.sessions[tableId];
      const table = state.tables.find(t => t.id === tableId);
      if (!table) continue;

      const relevantOrders = session.orders.filter(o => targetStates.includes(o.state));
      if (relevantOrders.length === 0) continue;

      groups.push({
        tableId,
        tableName: table.name,
        orders: relevantOrders,
        oldestTimestamp: Math.min(...relevantOrders.map(o => o.timestamp)),
      });
    }

    // Sort by oldest order first (longest waiting)
    groups.sort((a, b) => a.oldestTimestamp - b.oldestTimestamp);
    return groups;
  };

  const orderGroups = getOrderGroups();
  const totalOrders = orderGroups.reduce((sum, g) => sum + g.orders.length, 0);

  // Sound alert when new orders arrive
  useEffect(() => {
    if (totalOrders > prevOrderCountRef.current && prevOrderCountRef.current > 0) {
      try {
        const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioCtxClass();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
        setTimeout(() => {
          const osc2 = audioCtx.createOscillator();
          const gain2 = audioCtx.createGain();
          osc2.connect(gain2);
          gain2.connect(audioCtx.destination);
          osc2.frequency.value = 1100;
          gain2.gain.value = 0.3;
          osc2.start();
          osc2.stop(audioCtx.currentTime + 0.2);
        }, 180);
      } catch (_e) { /* audio not available */ }

      if (navigator.vibrate) navigator.vibrate([100, 80, 100]);
    }
    prevOrderCountRef.current = totalOrders;
  }, [totalOrders]);

  const getWaitTime = (timestamp: number): string => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return diff + 's';
    return Math.floor(diff / 60) + 'm';
  };

  const getWaitColor = (timestamp: number): string => {
    const diff = (Date.now() - timestamp) / 1000 / 60;
    if (diff > 20) return 'text-red-400';
    if (diff > 10) return 'text-amber-400';
    return 'text-[#b0b0cc]';
  };

  const handleMarkReady = (orderId: string) => {
    dispatch({ type: 'UPDATE_ORDER_STATE', orderId, state: 'ready' });
    setCompletedIds(prev => new Set([...prev, orderId]));
    setTimeout(() => {
      setCompletedIds(prev => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }, 600);

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 523;
      osc.type = 'sine';
      gain.gain.value = 0.2;
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.frequency.value = 659;
        osc2.type = 'sine';
        gain2.gain.value = 0.2;
        osc2.start();
        osc2.stop(audioCtx.currentTime + 0.1);
        setTimeout(() => {
          const osc3 = audioCtx.createOscillator();
          const gain3 = audioCtx.createGain();
          osc3.connect(gain3);
          gain3.connect(audioCtx.destination);
          osc3.frequency.value = 784;
          osc3.type = 'sine';
          gain3.gain.value = 0.2;
          osc3.start();
          osc3.stop(audioCtx.currentTime + 0.15);
        }, 120);
      }, 120);
    } catch (_e) { /* audio not available */ }

    if (navigator.vibrate) navigator.vibrate(100);
  };

  const handleMarkProblem = (orderId: string) => {
    dispatch({ type: 'UPDATE_ORDER_STATE', orderId, state: 'problem' });
    if (navigator.vibrate) navigator.vibrate([80, 50, 80]);
  };

  const handleMarkAllReady = (_tableId: string, orders: OrderItem[]) => {
    orders.forEach(o => {
      dispatch({ type: 'UPDATE_ORDER_STATE', orderId: o.id, state: 'ready' });
      setCompletedIds(prev => new Set([...prev, o.id]));
    });
    setTimeout(() => {
      setCompletedIds(prev => {
        const next = new Set(prev);
        orders.forEach(o => next.delete(o.id));
        return next;
      });
    }, 600);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  };

  // Auto-refresh timer display
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  // Count ready orders across all sessions
  const readyOrders: { tableName: string; orders: OrderItem[] }[] = [];
  const problemOrders: { tableName: string; orders: OrderItem[] }[] = [];
  for (const tableId of Object.keys(state.sessions)) {
    const session = state.sessions[tableId];
    const table = state.tables.find(t => t.id === tableId);
    if (!table) continue;
    const ready = session.orders.filter(o => o.state === 'ready' && o.routing === mode);
    const problem = session.orders.filter(o => o.state === 'problem' && o.routing === mode);
    if (ready.length > 0) {
      readyOrders.push({ tableName: table.name, orders: ready });
    }
    if (problem.length > 0) {
      problemOrders.push({ tableName: table.name, orders: problem });
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#1a1a2e]">
      {/* Mode Toggle Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#333355]" style={{ background: '#1a1a2e' }}>
        <div className="flex items-center gap-2">
          {mode === 'kitchen' ? (
            <IconChefHat className="w-5 h-5 text-orange-400" />
          ) : (
            <IconGlass className="w-5 h-5 text-blue-400" />
          )}
          <span className="text-white font-bold">
            {mode === 'kitchen' ? 'Küche' : 'Bar'}
          </span>
          {totalOrders > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              mode === 'kitchen' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              {totalOrders}
            </span>
          )}
        </div>
        {/* Mode Toggle */}
        <div className="flex bg-[#353558]/60 rounded-lg p-0.5">
          <button
            onClick={() => setMode('kitchen')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
              mode === 'kitchen'
                ? 'bg-orange-500/20 text-orange-400'
                : 'text-[#b0b0cc] hover:text-[#ddd]'
            }`}
          >
            <IconChefHat className="w-3.5 h-3.5" />
            Küche
          </button>
          <button
            onClick={() => setMode('bar')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
              mode === 'bar'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-[#b0b0cc] hover:text-[#ddd]'
            }`}
          >
            <IconGlass className="w-3.5 h-3.5" />
            Bar
          </button>
        </div>
      </div>

      {/* Orders */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {orderGroups.length === 0 && readyOrders.length === 0 && problemOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#8888aa]">
            {mode === 'kitchen' ? (
              <IconChefHat className="w-16 h-16 mb-4 opacity-30" />
            ) : (
              <IconGlass className="w-16 h-16 mb-4 opacity-30" />
            )}
            <p className="text-lg font-medium">Keine offenen Bestellungen</p>
            <p className="text-sm mt-1">Neue Bestellungen erscheinen hier automatisch</p>
          </div>
        ) : (
          <>
            {/* Pending Orders */}
            {orderGroups.map(group => (
              <div
                key={group.tableId}
                className={`rounded-xl border overflow-hidden ${
                  mode === 'kitchen'
                    ? 'bg-[#2a2a42]/80 border-orange-500/30'
                    : 'bg-[#2a2a42]/80 border-blue-500/30'
                }`}
              >
                {/* Table Header */}
                <div className={`flex items-center justify-between px-4 py-2.5 ${
                  mode === 'kitchen' ? 'bg-orange-500/10' : 'bg-blue-500/10'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">{group.tableName}</span>
                    <span className={`text-xs ${getWaitColor(group.oldestTimestamp)}`}>
                      <IconClock className="w-3 h-3 inline mr-0.5" />
                      {getWaitTime(group.oldestTimestamp)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleMarkAllReady(group.tableId, group.orders)}
                    className="px-3 py-1 rounded-lg text-xs font-medium transition-colors bg-green-500/20 text-green-400 hover:bg-green-500/30 active:bg-green-500/40"
                  >
                    Alle fertig
                  </button>
                </div>

                {/* Order Items */}
                <div className="divide-y divide-[#3a3a3a]/50">
                  {group.orders.map(order => (
                    <div
                      key={order.id}
                      className={`flex items-center justify-between px-4 py-3 transition-all duration-300 ${
                        completedIds.has(order.id)
                          ? 'bg-green-500/10 opacity-50 scale-95'
                          : 'hover:bg-[#353558]/30'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${
                            mode === 'kitchen' ? 'text-orange-400' : 'text-blue-400'
                          }`}>
                            {order.quantity}x
                          </span>
                          <span className="text-white font-medium">{order.name}</span>
                        </div>
                        {order.modifiers && order.modifiers.length > 0 && (
                          <p className="text-xs text-amber-400 mt-0.5">
                            {order.modifiers.join(', ')}
                          </p>
                        )}
                        {order.notes && (
                          <p className="text-xs text-amber-400 mt-0.5">{order.notes}</p>
                        )}
                        {order.course && (
                          <span className="text-xs text-[#8888aa]">
                            {order.course === 'starter' ? 'Vorspeise' : order.course === 'main' ? 'Hauptgang' : 'Dessert'}
                          </span>
                        )}
                        {order.seatId && (
                          <span className="text-xs text-[#8888aa] ml-2">Gast {order.seatId}</span>
                        )}
                      </div>
                      <div className="ml-3 flex items-center gap-2">
                        <button
                          onClick={() => handleMarkProblem(order.id)}
                          className="p-2.5 rounded-xl bg-[#ec4899]/18 text-[#ec4899] hover:bg-[#ec4899]/28 active:bg-[#ec4899]/40 transition-colors"
                          title="Problem melden"
                        >
                          <IconAlertTriangle className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleMarkReady(order.id)}
                          className="p-2.5 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 active:bg-green-500/50 transition-colors"
                          title="Als fertig markieren"
                        >
                          <IconCircleCheck className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {problemOrders.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <IconAlertTriangle className="w-4 h-4 text-[#ec4899]" />
                  <h3 className="text-[#ec4899] text-sm font-bold">Problem gemeldet</h3>
                </div>
                {problemOrders.map((group, idx) => (
                  <div key={idx} className="rounded-xl bg-[#ec4899]/10 border border-[#ec4899]/30 mb-2 overflow-hidden">
                    <div className="px-4 py-2 bg-[#ec4899]/10">
                      <span className="text-[#f3b1d3] font-bold text-sm">{group.tableName}</span>
                    </div>
                    <div className="divide-y divide-[#ec4899]/20">
                      {group.orders.map(order => (
                        <div key={order.id} className="flex items-center justify-between gap-2 px-4 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <IconAlertTriangle className="w-4 h-4 text-[#ec4899] flex-shrink-0" />
                            <span className="text-[#ffd1ea] text-sm font-medium truncate">
                              {order.quantity}x {order.name}
                            </span>
                          </div>
                          <button
                            onClick={() => dispatch({
                              type: 'UPDATE_ORDER_STATE',
                              orderId: order.id,
                              state: mode === 'bar' ? 'sent_to_bar' : 'sent_to_kitchen',
                            })}
                            className="text-[11px] font-semibold text-[#ffd1ea] hover:text-white transition-colors"
                          >
                            Quittieren
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Ready Orders (recently completed) */}
            {readyOrders.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <IconBell className="w-4 h-4 text-green-400" />
                  <h3 className="text-green-400 text-sm font-bold">Fertig - Abholung</h3>
                </div>
                {readyOrders.map((group, idx) => (
                  <div key={idx} className="rounded-xl bg-green-500/10 border border-green-500/30 mb-2 overflow-hidden">
                    <div className="px-4 py-2 bg-green-500/10">
                      <span className="text-green-400 font-bold text-sm">{group.tableName}</span>
                    </div>
                    <div className="divide-y divide-green-500/20">
                      {group.orders.map(order => (
                        <div key={order.id} className="flex items-center gap-2 px-4 py-2">
                          <IconCircleCheck className="w-4 h-4 text-green-400 flex-shrink-0" />
                          <span className="text-green-300 text-sm font-medium">
                            {order.quantity}x {order.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Stats */}
      <div className="border-t border-[#333355] px-4 py-1.5" style={{ background: '#1a1a2e' }}>
        <div className="flex items-center justify-between text-xs text-[#8888aa]">
          <span>{totalOrders} offen</span>
          <span>{problemOrders.reduce((s, g) => s + g.orders.length, 0)} problem</span>
          <span>{readyOrders.reduce((s, g) => s + g.orders.length, 0)} fertig</span>
        </div>
      </div>
    </div>
  );
}
