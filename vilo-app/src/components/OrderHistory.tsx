import { useState } from 'react';
import { IconAlertTriangle, IconCash, IconCheck, IconChevronDown, IconChevronUp, IconClock, IconCreditCard, IconCurrencyEuro, IconFileDownload, IconCoins, IconReceipt, IconRotate, IconArrowsShuffle, IconTrendingUp, IconUsers } from '@tabler/icons-react';

import { useApp } from '../context/AppContext';

interface OrderHistoryProps {
  onSelectTable: (tableId: string) => void;
}

export function OrderHistory({ onSelectTable: _onSelectTable }: OrderHistoryProps) {
  const { state, dispatch } = useApp();
  const [expandedTable, setExpandedTable] = useState<number | null>(null);
  const [showTagesabschluss, setShowTagesabschluss] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // === Shift data ===
  const closedTables = state.closedTables;
  const totalClosedRevenue = closedTables.reduce((sum, t) => sum + t.revenue, 0);
  const totalTips = state.tipHistory.reduce((sum, t) => sum + t.amount, 0);
  const totalOrders = closedTables.reduce((sum, t) => sum + t.orders.length, 0);

  // Active tables revenue
  const activeRevenue = Object.values(state.sessions).reduce((sum, s) =>
    sum + s.orders.reduce((os, o) => os + o.price * o.quantity, 0), 0
  );
  const activeTables = Object.keys(state.sessions).length;
  const totalRevenue = totalClosedRevenue + activeRevenue;

  // Payment method breakdown
  const cardRevenue = closedTables
    .filter(t => t.paymentMethod === 'card')
    .reduce((sum, t) => sum + t.revenue, 0);
  const cashRevenue = closedTables
    .filter(t => t.paymentMethod === 'cash')
    .reduce((sum, t) => sum + t.revenue, 0);
  const mixedRevenue = closedTables
    .filter(t => t.paymentMethod === 'mixed')
    .reduce((sum, t) => sum + t.revenue, 0);

  // Shift duration
  const shiftDuration = Date.now() - state.shiftStart;
  const shiftHours = Math.floor(shiftDuration / 3600000);
  const shiftMinutes = Math.floor((shiftDuration % 3600000) / 60000);

  // Avg per table
  const avgPerTable = closedTables.length > 0 ? totalClosedRevenue / closedTables.length : 0;

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (start: number, end: number) => {
    const diff = end - start;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} Min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  const paymentIcon = (method: 'card' | 'cash' | 'mixed') => {
    if (method === 'card') return <IconCreditCard className="w-3.5 h-3.5 text-blue-400" />;
    if (method === 'cash') return <IconCash className="w-3.5 h-3.5 text-emerald-400" />;
    return <IconArrowsShuffle className="w-3.5 h-3.5 text-amber-400" />;
  };

  const handleClearShift = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    dispatch({ type: 'CLEAR_SHIFT' });
    setShowTagesabschluss(false);
    setConfirmClear(false);
  };

  // === Tagesabschluss Modal ===
  if (showTagesabschluss) {
    const taxRate = state.restaurant.taxRate;
    const netRevenue = totalClosedRevenue / (1 + taxRate / 100);
    const taxAmount = totalClosedRevenue - netRevenue;

    return (
      <div className="h-full bg-[#1a1a2e] flex flex-col">
        <header className="bg-vilo-surface/80 backdrop-blur border-b border-vilo-border-subtle px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IconFileDownload className="w-5 h-5 text-[#b1d9ff]" />
              <h1 className="text-white font-semibold text-lg">Tagesabschluss</h1>
            </div>
            <button
              onClick={() => { setShowTagesabschluss(false); setConfirmClear(false); }}
              className="px-3 py-1.5 rounded-lg bg-vilo-elevated text-vilo-text-soft text-sm hover:bg-[#3a365c] transition-colors"
            >
              Zurück
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Shift summary */}
          <div className="bg-vilo-surface/60 rounded-xl border border-vilo-border-subtle/50 p-4">
            <h2 className="text-white font-semibold mb-1">Schicht-Zusammenfassung</h2>
            <p className="text-vilo-text-muted text-xs mb-4">
              {formatTime(state.shiftStart)} - {formatTime(Date.now())} ({shiftHours}h {shiftMinutes}m)
            </p>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-vilo-text-secondary text-sm">Tische bedient</span>
                <span className="text-white font-medium">{closedTables.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-vilo-text-secondary text-sm">Positionen gesamt</span>
                <span className="text-white font-medium">{totalOrders}</span>
              </div>
              <div className="border-t border-vilo-border-subtle/50 pt-3 flex justify-between items-center">
                <span className="text-vilo-text-secondary text-sm">Brutto-Umsatz</span>
                <span className="text-white font-bold text-lg">{totalClosedRevenue.toFixed(2)} {state.restaurant.currency}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-vilo-text-secondary text-sm">Netto</span>
                <span className="text-vilo-text-soft text-sm">{netRevenue.toFixed(2)} {state.restaurant.currency}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-vilo-text-secondary text-sm">MwSt. ({taxRate}%)</span>
                <span className="text-vilo-text-soft text-sm">{taxAmount.toFixed(2)} {state.restaurant.currency}</span>
              </div>
              <div className="border-t border-vilo-border-subtle/50 pt-3 flex justify-between items-center">
                <span className="text-vilo-text-secondary text-sm">Trinkgeld gesamt</span>
                <span className="text-emerald-400 font-bold">{totalTips.toFixed(2)} {state.restaurant.currency}</span>
              </div>
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="bg-vilo-surface/60 rounded-xl border border-vilo-border-subtle/50 p-4">
            <h3 className="text-white font-semibold mb-3">Zahlungsarten</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconCreditCard className="w-4 h-4 text-blue-400" />
                  <span className="text-vilo-text-soft text-sm">Karte</span>
                </div>
                <span className="text-white text-sm font-medium">{cardRevenue.toFixed(2)} {state.restaurant.currency}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconCash className="w-4 h-4 text-emerald-400" />
                  <span className="text-vilo-text-soft text-sm">Bar</span>
                </div>
                <span className="text-white text-sm font-medium">{cashRevenue.toFixed(2)} {state.restaurant.currency}</span>
              </div>
              {mixedRevenue > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconArrowsShuffle className="w-4 h-4 text-amber-400" />
                    <span className="text-vilo-text-soft text-sm">Gemischt</span>
                  </div>
                  <span className="text-white text-sm font-medium">{mixedRevenue.toFixed(2)} {state.restaurant.currency}</span>
                </div>
              )}
            </div>
          </div>

          {/* Avg stats */}
          <div className="bg-vilo-surface/60 rounded-xl border border-vilo-border-subtle/50 p-4">
            <h3 className="text-white font-semibold mb-3">Durchschnitte</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-vilo-elevated/30 rounded-lg p-3 text-center">
                <p className="text-vilo-text-secondary text-xs mb-1">Pro Tisch</p>
                <p className="text-white font-bold">{avgPerTable.toFixed(2)} {state.restaurant.currency}</p>
              </div>
              <div className="bg-vilo-elevated/30 rounded-lg p-3 text-center">
                <p className="text-vilo-text-secondary text-xs mb-1">Trinkgeld/Tisch</p>
                <p className="text-white font-bold">
                  {closedTables.length > 0 ? (totalTips / closedTables.length).toFixed(2) : '0.00'} {state.restaurant.currency}
                </p>
              </div>
            </div>
          </div>

          {/* Active tables warning */}
          {activeTables > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-900/20 border border-amber-700/30">
              <IconAlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-amber-300 text-sm font-medium">Offene Tische: {activeTables}</p>
                <p className="text-amber-400/60 text-xs">Diese Tische sind noch nicht abgerechnet</p>
              </div>
            </div>
          )}

          {/* Clear shift button */}
          <button
            onClick={handleClearShift}
            className={`w-full py-3.5 rounded-xl font-medium transition-colors ${
              confirmClear
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'bg-vilo-elevated text-vilo-text-soft hover:bg-[#3a365c]'
            }`}
          >
            {confirmClear ? (
              <span className="flex items-center justify-center gap-2">
                <IconCheck className="w-4 h-4" /> Bestaetigen: Schicht zuruecksetzen
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <IconRotate className="w-4 h-4" /> Schicht abschliessen & zuruecksetzen
              </span>
            )}
          </button>
          {confirmClear && (
            <p className="text-red-400/60 text-xs text-center">
              Alle Daten dieser Schicht werden geloescht. Diese Aktion kann nicht rueckgaengig gemacht werden.
            </p>
          )}
        </div>
      </div>
    );
  }

  // === Main History View ===
  return (
    <div className="h-full bg-[#1a1a2e] flex flex-col">
      <header className="bg-vilo-surface/80 backdrop-blur border-b border-vilo-border-subtle px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconReceipt className="w-5 h-5 text-[#b1d9ff]" />
            <div>
              <h1 className="text-white font-semibold text-lg">Bestellhistorie</h1>
              <p className="text-vilo-text-muted text-xs">Schicht seit {formatTime(state.shiftStart)}</p>
            </div>
          </div>
          <button
            onClick={() => setShowTagesabschluss(true)}
            className="px-3 py-1.5 rounded-lg bg-[#7bb7ef] text-white text-sm font-medium hover:bg-[#7bb7ef] transition-colors"
          >
            Tagesabschluss
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Quick stats */}
        <div className="px-4 py-3 grid grid-cols-4 gap-2">
          <div className="bg-vilo-surface/60 rounded-lg p-2.5 text-center border border-vilo-border-subtle/50">
            <div className="flex items-center justify-center gap-1 mb-1">
              <IconCurrencyEuro className="w-3 h-3 text-vilo-text-secondary" />
            </div>
            <p className="text-white text-sm font-bold">{totalRevenue.toFixed(0)}</p>
            <p className="text-vilo-text-muted text-[10px]">Umsatz</p>
          </div>
          <div className="bg-vilo-surface/60 rounded-lg p-2.5 text-center border border-vilo-border-subtle/50">
            <div className="flex items-center justify-center gap-1 mb-1">
              <IconCoins className="w-3 h-3 text-vilo-text-secondary" />
            </div>
            <p className="text-white text-sm font-bold">{totalTips.toFixed(2)}</p>
            <p className="text-vilo-text-muted text-[10px]">Trinkgeld</p>
          </div>
          <div className="bg-vilo-surface/60 rounded-lg p-2.5 text-center border border-vilo-border-subtle/50">
            <div className="flex items-center justify-center gap-1 mb-1">
              <IconUsers className="w-3 h-3 text-vilo-text-secondary" />
            </div>
            <p className="text-white text-sm font-bold">{closedTables.length}</p>
            <p className="text-vilo-text-muted text-[10px]">Tische</p>
          </div>
          <div className="bg-vilo-surface/60 rounded-lg p-2.5 text-center border border-vilo-border-subtle/50">
            <div className="flex items-center justify-center gap-1 mb-1">
              <IconClock className="w-3 h-3 text-vilo-text-secondary" />
            </div>
            <p className="text-white text-sm font-bold">{shiftHours}:{shiftMinutes.toString().padStart(2, '0')}</p>
            <p className="text-vilo-text-muted text-[10px]">Dauer</p>
          </div>
        </div>

        {/* Active tables hint */}
        {activeTables > 0 && (
          <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-900/20 border border-violet-700/30">
            <IconTrendingUp className="w-4 h-4 text-[#b1d9ff]" />
            <p className="text-[#b1d9ff] text-xs">
              {activeTables} aktive{activeTables > 1 ? ' Tische' : 'r Tisch'} &middot; {activeRevenue.toFixed(2)} {state.restaurant.currency} offen
            </p>
          </div>
        )}

        {/* Closed tables list */}
        <div className="px-4 space-y-2 pb-4">
          <h2 className="text-vilo-text-secondary text-xs font-medium uppercase tracking-wider mb-2">
            Abgeschlossene Tische ({closedTables.length})
          </h2>

          {closedTables.length === 0 ? (
            <div className="text-center py-12">
              <IconReceipt className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-vilo-text-muted text-sm">Noch keine abgeschlossenen Tische</p>
              <p className="text-[#777] text-xs mt-1">Tische erscheinen hier nach dem Bezahlen</p>
            </div>
          ) : (
            [...closedTables].reverse().map((table, idx) => {
              const realIdx = closedTables.length - 1 - idx;
              const isExpanded = expandedTable === realIdx;
              return (
                <div key={realIdx} className="rounded-xl bg-vilo-surface/60 border border-vilo-border-subtle/50 overflow-hidden">
                  {/* Table header */}
                  <button
                    onClick={() => setExpandedTable(isExpanded ? null : realIdx)}
                    className="w-full flex items-center justify-between p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-vilo-elevated flex items-center justify-center">
                        {paymentIcon(table.paymentMethod)}
                      </div>
                      <div className="text-left">
                        <p className="text-white text-sm font-medium">{table.tableName}</p>
                        <p className="text-vilo-text-muted text-xs">
                          {formatTime(table.startTime)} - {formatTime(table.closedTime)} &middot; {formatDuration(table.startTime, table.closedTime)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-white text-sm font-bold">{table.revenue.toFixed(2)} {state.restaurant.currency}</p>
                        {table.tips > 0 && (
                          <p className="text-emerald-400 text-xs">+{table.tips.toFixed(2)} Tip</p>
                        )}
                      </div>
                      {isExpanded ? <IconChevronUp className="w-4 h-4 text-vilo-text-secondary" /> : <IconChevronDown className="w-4 h-4 text-vilo-text-secondary" />}
                    </div>
                  </button>

                  {/* Expanded order details */}
                  {isExpanded && (
                    <div className="border-t border-vilo-border-subtle/50 p-3 space-y-1.5">
                      {table.orders.map((order, oi) => (
                        <div key={oi} className="flex items-center justify-between py-1 px-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[#b1d9ff] text-xs font-medium">{order.quantity}x</span>
                            <span className="text-vilo-text-soft text-sm">{order.name}</span>
                            {order.modifiers.length > 0 && (
                              <span className="text-amber-400/60 text-xs">({order.modifiers.join(', ')})</span>
                            )}
                          </div>
                          <span className="text-vilo-text-secondary text-sm">{(order.price * order.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="border-t border-vilo-border-subtle/30 pt-2 mt-2 flex justify-between px-2">
                        <span className="text-vilo-text-secondary text-xs">
                          {table.orders.length} Position{table.orders.length !== 1 ? 'en' : ''} &middot; {
                            table.paymentMethod === 'card' ? 'Karte' :
                            table.paymentMethod === 'cash' ? 'Bar' : 'Gemischt'
                          }
                        </span>
                        <span className="text-white text-xs font-bold">{table.revenue.toFixed(2)} {state.restaurant.currency}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
