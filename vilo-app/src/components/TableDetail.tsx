import React, { useState, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Send, ChevronRight, Clock, UtensilsCrossed, Wine, Coffee, Trash2, ChevronDown } from 'lucide-react';
import { feedbackOrderAdded, feedbackOrderSent, feedbackItemDeleted } from '../utils/feedback';
import { TableServiceStatus } from '../types';

const SERVICE_STATUS_OPTIONS: { key: TableServiceStatus; label: string; group: string; color: string }[] = [
  { key: 'teilweise_platziert', label: 'Teilw. platziert', group: 'sitzplatz', color: '#94a3b8' },
  { key: 'platziert', label: 'Platziert', group: 'sitzplatz', color: '#a78bfa' },
  { key: 'getraenke', label: 'Getränke', group: 'gang', color: '#38bdf8' },
  { key: 'vorspeise', label: 'Vorspeise', group: 'gang', color: '#34d399' },
  { key: 'hauptgericht', label: 'Hauptgericht', group: 'gang', color: '#fbbf24' },
  { key: 'dessert', label: 'Dessert', group: 'gang', color: '#f472b6' },
  { key: 'gang_1', label: '1. Gang', group: 'gang_num', color: '#6ee7b7' },
  { key: 'gang_2', label: '2. Gang', group: 'gang_num', color: '#6ee7b7' },
  { key: 'gang_3', label: '3. Gang', group: 'gang_num', color: '#6ee7b7' },
  { key: 'gang_4', label: '4. Gang', group: 'gang_num', color: '#6ee7b7' },
  { key: 'gang_5', label: '5. Gang', group: 'gang_num', color: '#6ee7b7' },
  { key: 'gang_6', label: '6. Gang', group: 'gang_num', color: '#6ee7b7' },
  { key: 'gang_7', label: '7. Gang', group: 'gang_num', color: '#6ee7b7' },
  { key: 'gang_8', label: '8. Gang', group: 'gang_num', color: '#6ee7b7' },
  { key: 'gang_9', label: '9. Gang', group: 'gang_num', color: '#6ee7b7' },
  { key: 'gang_10', label: '10. Gang', group: 'gang_num', color: '#6ee7b7' },
  { key: 'gang_11', label: '11. Gang', group: 'gang_num', color: '#6ee7b7' },
  { key: 'gang_12', label: '12. Gang', group: 'gang_num', color: '#6ee7b7' },
  { key: 'digestif', label: 'Digestif', group: 'service', color: '#c084fc' },
  { key: 'flaschenservice', label: 'Flaschenservice', group: 'service', color: '#c084fc' },
  { key: 'rechnung_faellig', label: 'Rechnung faellig', group: 'zahlung', color: '#fb923c' },
  { key: 'bezahlt', label: 'Bezahlt', group: 'zahlung', color: '#22c55e' },
  { key: 'restaurantleiter', label: 'Restaurantleiter', group: 'aktion', color: '#ef4444' },
  { key: 'abraeumen', label: 'Abraeumen', group: 'aktion', color: '#f97316' },
  { key: 'abgeraeumt', label: 'Abgeraeumt', group: 'aktion', color: '#64748b' },
  { key: 'beendet', label: 'Beendet', group: 'aktion', color: '#475569' },
];

function getServiceStatusInfo(status?: TableServiceStatus) {
  if (!status) return null;
  return SERVICE_STATUS_OPTIONS.find(s => s.key === status) || null;
}

interface TableDetailProps {
  onBack: () => void;
}

export function TableDetail({ onBack }: TableDetailProps) {
  const { state, dispatch } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const [menuCategory, setMenuCategory] = useState<string>('drinks');
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  const table = state.tables.find(t => t.id === state.activeTableId);
  const session = state.activeTableId ? state.sessions[state.activeTableId] : null;

  if (!table || !session) return null;

  const ordersByState = {
    ordered: session.orders.filter(o => o.state === 'ordered'),
    sent: session.orders.filter(o => o.state === 'sent_to_kitchen' || o.state === 'sent_to_bar'),
    ready: session.orders.filter(o => o.state === 'ready'),
    served: session.orders.filter(o => o.state === 'served'),
  };

  const total = session.orders.reduce((sum, o) => sum + o.price * o.quantity, 0);

  const handleSendOrders = () => {
    dispatch({ type: 'SEND_ORDERS' });
    feedbackOrderSent();
  };

  const handleAddItem = (itemId: string) => {
    const menuItem = state.menu.find(m => m.id === itemId);
    if (!menuItem) return;

    dispatch({
      type: 'ADD_ORDER_ITEMS',
      items: [{
        id: Math.random().toString(36).substring(2, 9),
        menuItemId: menuItem.id,
        name: menuItem.name,
        quantity: 1,
        price: menuItem.price,
        modifiers: [],
        state: 'ordered',
        routing: menuItem.routing,
        timestamp: Date.now(),
      }],
    });
    feedbackOrderAdded();
  };

  const handleMarkServed = (orderId: string) => {
    dispatch({ type: 'UPDATE_ORDER_STATE', orderId, state: 'served' });
  };

  const handleMarkReady = (orderId: string) => {
    dispatch({ type: 'UPDATE_ORDER_STATE', orderId, state: 'ready' });
  };

  const handleDeleteOrder = (orderId: string) => {
    dispatch({ type: 'REMOVE_ORDER_ITEM', orderId });
    feedbackItemDeleted();
  };

  const getStateIcon = (orderState: string) => {
    switch (orderState) {
      case 'ordered': return <Clock className="w-3.5 h-3.5 text-amber-400" />;
      case 'sent_to_kitchen': return <UtensilsCrossed className="w-3.5 h-3.5 text-blue-400" />;
      case 'sent_to_bar': return <Wine className="w-3.5 h-3.5 text-purple-400" />;
      case 'ready': return <Coffee className="w-3.5 h-3.5 text-emerald-400" />;
      case 'served': return <ChevronRight className="w-3.5 h-3.5 text-[#8888aa]" />;
      default: return null;
    }
  };

  const getStateLabel = (orderState: string) => {
    switch (orderState) {
      case 'ordered': return 'Bestellt';
      case 'sent_to_kitchen': return 'In Küche';
      case 'sent_to_bar': return 'An Bar';
      case 'ready': return 'Fertig';
      case 'served': return 'Serviert';
      default: return orderState;
    }
  };

  const getCourseLabel = (course?: string) => {
    switch (course) {
      case 'starter': return 'Vorspeise';
      case 'main': return 'Hauptgang';
      case 'dessert': return 'Dessert';
      default: return null;
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const categoryIcons: Record<string, string> = {
    drinks: '🍺',
    starters: '🥗',
    mains: '🍕',
    desserts: '🍰',
  };

  const categoryLabels: Record<string, string> = {
    drinks: 'Getränke',
    starters: 'Vorspeisen',
    mains: 'Hauptgerichte',
    desserts: 'Desserts',
  };

  return (
    <div className="h-full bg-[#1a1a2e] flex flex-col">
      {/* Header */}
      <header className="bg-[#2a2a42]/80 backdrop-blur border-b border-[#333355] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg bg-[#353558] text-[#c0c0dd] hover:bg-[#555] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-white font-semibold text-lg leading-tight">{table.name}</h2>
              <p className="text-[#b0b0cc] text-xs">
                Seit {formatTime(session.startTime)} · {session.orders.length} Positionen
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {ordersByState.ordered.length > 0 && (
              <button
                onClick={handleSendOrders}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#7bb7ef] text-white text-sm font-medium
                  hover:bg-[#7bb7ef] active:bg-violet-700 transition-colors"
              >
                <Send className="w-4 h-4" />
                Senden
              </button>
            )}
            <button
              onClick={() => dispatch({ type: 'SHOW_BILLING' })}
              className="px-3 py-2 rounded-lg bg-[#353558] text-[#c0c0dd] text-sm font-medium
                hover:bg-[#555] transition-colors"
            >
              Rechnung
            </button>
          </div>
        </div>
      </header>

      {/* Service Status Bar */}
      <div className="px-4 py-2 border-b border-[#333355]/50" style={{ background: '#1a1a2e' }}>
        <button
          onClick={() => setShowStatusPicker(!showStatusPicker)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#8888aa] font-semibold uppercase tracking-wider">Status:</span>
            {session.serviceStatus ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: (getServiceStatusInfo(session.serviceStatus)?.color || '#64748b') + '22', color: getServiceStatusInfo(session.serviceStatus)?.color || '#94a3b8' }}>
                {getServiceStatusInfo(session.serviceStatus)?.label || session.serviceStatus}
              </span>
            ) : (
              <span className="text-xs text-[#8888aa]">Kein Status</span>
            )}
          </div>
          <ChevronDown className={'w-4 h-4 text-[#8888aa] transition-transform ' + (showStatusPicker ? 'rotate-180' : '')} />
        </button>

        {showStatusPicker && (
          <div className="mt-2 space-y-2 pb-1">
            {/* Quick status groups */}
            {[
              { label: 'Sitzplatz', keys: SERVICE_STATUS_OPTIONS.filter(s => s.group === 'sitzplatz') },
              { label: 'Gang (Standard)', keys: SERVICE_STATUS_OPTIONS.filter(s => s.group === 'gang') },
              { label: 'Gang (Nummer)', keys: SERVICE_STATUS_OPTIONS.filter(s => s.group === 'gang_num') },
              { label: 'Service', keys: SERVICE_STATUS_OPTIONS.filter(s => s.group === 'service') },
              { label: 'Zahlung', keys: SERVICE_STATUS_OPTIONS.filter(s => s.group === 'zahlung') },
              { label: 'Aktion', keys: SERVICE_STATUS_OPTIONS.filter(s => s.group === 'aktion') },
            ].map(group => (
              <div key={group.label}>
                <p className="text-[9px] text-[#777] font-semibold uppercase tracking-wider mb-1">{group.label}</p>
                <div className="flex flex-wrap gap-1">
                  {group.keys.map(opt => {
                    const isActive = session.serviceStatus === opt.key;
                    return (
                      <button key={opt.key}
                        onClick={() => {
                          dispatch({ type: 'SET_SERVICE_STATUS', tableId: table.id, serviceStatus: opt.key });
                          setShowStatusPicker(false);
                        }}
                        className={'px-2 py-1 rounded-lg text-[10px] font-medium border transition-colors ' +
                          (isActive ? 'border-white/40 text-white' : 'border-[#333355] text-[#b0b0cc] hover:border-[#5a5a5a]')}
                        style={isActive ? { background: opt.color + '33', borderColor: opt.color } : {}}>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      {session.notes.length > 0 && (
        <div className="px-4 py-2 bg-amber-900/30 border-b border-amber-800/50">
          <div className="flex flex-wrap gap-2">
            {session.notes.map((note, i) => (
              <span key={i} className="px-2 py-0.5 bg-amber-800/50 text-amber-200 text-xs rounded-full">
                {note}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Orders */}
      <div className="flex-1 overflow-y-auto pb-4">
        {session.orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#8888aa]">
            <UtensilsCrossed className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">Noch keine Bestellungen</p>
            <p className="text-xs mt-1">Sage "Hey Vilo" und bestelle per Sprache</p>
          </div>
        ) : (
          <div className="px-4 py-3 space-y-2">
            {/* Pending orders */}
            {ordersByState.ordered.length > 0 && (
              <div>
                <p className="text-amber-400 text-xs font-medium uppercase tracking-wider mb-2">
                  Neu bestellt ({ordersByState.ordered.length})
                </p>
                {ordersByState.ordered.map(order => (
                  <OrderRow key={order.id} order={order} getStateIcon={getStateIcon} getStateLabel={getStateLabel} getCourseLabel={getCourseLabel} formatTime={formatTime} onDelete={() => handleDeleteOrder(order.id)} />
                ))}
              </div>
            )}

            {/* Sent orders */}
            {ordersByState.sent.length > 0 && (
              <div className="mt-4">
                <p className="text-blue-400 text-xs font-medium uppercase tracking-wider mb-2">
                  In Zubereitung ({ordersByState.sent.length})
                </p>
                {ordersByState.sent.map(order => (
                  <OrderRow key={order.id} order={order} getStateIcon={getStateIcon} getStateLabel={getStateLabel} getCourseLabel={getCourseLabel} formatTime={formatTime} onAction={() => handleMarkReady(order.id)} actionLabel="Fertig" onDelete={() => handleDeleteOrder(order.id)} />
                ))}
              </div>
            )}

            {/* Ready orders */}
            {ordersByState.ready.length > 0 && (
              <div className="mt-4">
                <p className="text-emerald-400 text-xs font-medium uppercase tracking-wider mb-2">
                  Fertig ({ordersByState.ready.length})
                </p>
                {ordersByState.ready.map(order => (
                  <OrderRow key={order.id} order={order} getStateIcon={getStateIcon} getStateLabel={getStateLabel} getCourseLabel={getCourseLabel} formatTime={formatTime} onAction={() => handleMarkServed(order.id)} actionLabel="Serviert" onDelete={() => handleDeleteOrder(order.id)} />
                ))}
              </div>
            )}

            {/* Served orders */}
            {ordersByState.served.length > 0 && (
              <div className="mt-4">
                <p className="text-[#8888aa] text-xs font-medium uppercase tracking-wider mb-2">
                  Serviert ({ordersByState.served.length})
                </p>
                {ordersByState.served.map(order => (
                  <OrderRow key={order.id} order={order} getStateIcon={getStateIcon} getStateLabel={getStateLabel} getCourseLabel={getCourseLabel} formatTime={formatTime} dimmed onDelete={() => handleDeleteOrder(order.id)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick Add Menu */}
        {showMenu && (
          <div className="px-4 py-3 border-t border-[#333355]">
            <div className="flex gap-2 mb-3 overflow-x-auto">
              {Object.entries(categoryLabels).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setMenuCategory(key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    menuCategory === key ? 'bg-[#7bb7ef] text-white' : 'bg-[#2a2a42] text-[#c0c0dd]'
                  }`}
                >
                  {categoryIcons[key]} {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {state.menu.filter(m => m.category === menuCategory).map(item => (
                <button
                  key={item.id}
                  onClick={() => handleAddItem(item.id)}
                  className="p-2.5 rounded-lg bg-[#2a2a42] border border-[#333355] text-left
                    hover:border-violet-600 active:bg-[#353558] transition-colors"
                >
                  <p className="text-white text-sm font-medium">{item.name}</p>
                  <p className="text-[#b0b0cc] text-xs">{item.price.toFixed(2)} €</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="bg-[#2a2a42]/90 backdrop-blur border-t border-[#333355]">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[#b0b0cc] text-xs">Gesamt</p>
            <p className="text-white text-lg font-bold">{total.toFixed(2)} €</p>
          </div>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showMenu ? 'bg-[#555] text-white' : 'bg-[#7bb7ef] text-white hover:bg-[#7bb7ef]'
            }`}
          >
            {showMenu ? 'Menü schließen' : '+ Manuell hinzufügen'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface OrderRowProps {
  order: {
    id: string;
    name: string;
    quantity: number;
    price: number;
    state: string;
    modifiers: string[];
    course?: string;
    seatId?: number;
    timestamp: number;
    routing: string;
  };
  getStateIcon: (state: string) => React.ReactNode;
  getStateLabel: (state: string) => string;
  getCourseLabel: (course?: string) => string | null;
  formatTime: (ts: number) => string;
  onAction?: () => void;
  actionLabel?: string;
  onDelete?: () => void;
  dimmed?: boolean;
}

function OrderRow({ order, getStateIcon, getStateLabel, getCourseLabel, formatTime, onAction, actionLabel, onDelete, dimmed }: OrderRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const [offsetX, setOffsetX] = useState(0);
  const [isRemoving, setIsRemoving] = useState(false);

  const DELETE_THRESHOLD = -80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = 0;
    isDraggingRef.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const diff = e.touches[0].clientX - startXRef.current;
    // Only allow left swipe
    const clamped = Math.min(0, Math.max(-120, diff));
    currentXRef.current = clamped;
    setOffsetX(clamped);
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
    if (currentXRef.current <= DELETE_THRESHOLD && onDelete) {
      setIsRemoving(true);
      setOffsetX(-400);
      setTimeout(() => onDelete(), 250);
    } else {
      setOffsetX(0);
    }
  }, [onDelete]);

  // Mouse support for desktop
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    startXRef.current = e.clientX;
    currentXRef.current = 0;
    isDraggingRef.current = true;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const diff = ev.clientX - startXRef.current;
      const clamped = Math.min(0, Math.max(-120, diff));
      currentXRef.current = clamped;
      setOffsetX(clamped);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      if (currentXRef.current <= DELETE_THRESHOLD && onDelete) {
        setIsRemoving(true);
        setOffsetX(-400);
        setTimeout(() => onDelete(), 250);
      } else {
        setOffsetX(0);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onDelete]);

  return (
    <div className={`relative overflow-hidden rounded-lg mb-1.5 ${isRemoving ? 'h-0 mb-0 opacity-0' : ''}`}
      style={{ transition: isRemoving ? 'height 0.25s ease, opacity 0.25s ease, margin 0.25s ease' : undefined }}
    >
      {/* Red delete background - only visible when swiping */}
      {offsetX < 0 && (
        <div className="absolute inset-0 bg-red-600 flex items-center justify-end pr-5 rounded-lg">
          <Trash2 className="w-5 h-5 text-white" />
        </div>
      )}

      {/* Swipeable content */}
      <div
        ref={rowRef}
        className={`relative flex items-center gap-3 p-3 bg-[#2a2a42]/60 ${dimmed ? 'opacity-50' : ''} select-none`}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDraggingRef.current ? 'none' : 'transform 0.25s ease',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        <div className="flex-shrink-0">
          {getStateIcon(order.state)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[#b1d9ff] text-sm font-bold min-w-6">{order.quantity}x</span>
            <p className="text-white text-sm font-medium">
              {order.name}
            </p>
            {order.seatId && (
              <span className="text-xs text-[#b1d9ff] bg-violet-900/50 px-1.5 py-0.5 rounded">
                Gast {order.seatId}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[#b0b0cc] text-xs">{formatTime(order.timestamp)}</span>
            <span className="text-[#777] text-xs">·</span>
            <span className="text-[#b0b0cc] text-xs">{getStateLabel(order.state)}</span>
            {getCourseLabel(order.course) && (
              <>
                <span className="text-[#777] text-xs">·</span>
                <span className="text-[#b0b0cc] text-xs">{getCourseLabel(order.course)}</span>
              </>
            )}
            {order.modifiers.length > 0 && (
              <>
                <span className="text-[#777] text-xs">·</span>
                <span className="text-amber-400 text-xs">{order.modifiers.join(', ')}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[#c0c0dd] text-sm">{(order.price * order.quantity).toFixed(2)} €</span>
          {onAction && (
            <button
              onClick={onAction}
              className="px-2 py-1 rounded bg-[#353558] text-xs text-[#c0c0dd] hover:bg-[#555] transition-colors"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
