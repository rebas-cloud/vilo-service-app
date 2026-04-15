import { useState } from 'react';
import { IconArrowLeft, IconCash, IconCheck, IconChevronRight, IconCreditCard, IconDivide, IconUserCheck, IconUsers, IconX } from '@tabler/icons-react';

import { useApp } from '../context/AppContext';

import { addGuestVisit, loadReservations, findGuestByPhone } from '../utils/storage';
import { GuestVisit } from '../types';

type SplitMode = 'combined' | 'split' | 'equal';

interface PaidGuest {
  method: 'card' | 'cash';
  amount: number;
  tip: number;
}

type TipContext =
  | { type: 'combined' }
  | { type: 'split'; guestKey: string }
  | { type: 'equal'; index: number };

interface TipScreen {
  baseAmount: number;
  method: 'card' | 'cash';
  context: TipContext;
}

export function BillingModal() {
  const { state, dispatch } = useApp();
  const [billingMode, setBillingMode] = useState<SplitMode>(state.billingMode === 'split' ? 'split' : 'combined');
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | null>(null);
  const [paidGuests, setPaidGuests] = useState<Record<string, PaidGuest>>({});
  const [equalSplitCount, setEqualSplitCount] = useState(2);
  const [paidEqualGuests, setPaidEqualGuests] = useState<Record<number, PaidGuest>>({});
  const [assigningItems, setAssigningItems] = useState(false);
  const [tipScreen, setTipScreen] = useState<TipScreen | null>(null);
  const [tipAmount, setTipAmount] = useState(0);
  const [customTipValue, setCustomTipValue] = useState('');
  const [cashReceivedValue, setCashReceivedValue] = useState('');
  const [totalTipCollected, setTotalTipCollected] = useState(0);

  const session = state.activeTableId ? state.sessions[state.activeTableId] : null;
  const table = state.tables.find(t => t.id === state.activeTableId);

  if (!session || !table) return null;

  const total = session.orders.reduce((sum, o) => sum + o.price * o.quantity, 0);
  const tax = total * (state.restaurant.taxRate / 100);

  // Group by seat for split billing
  const ordersBySeat: Record<string, typeof session.orders> = {};
  session.orders.forEach(order => {
    const key = order.seatId ? `Gast ${order.seatId}` : 'Allgemein';
    if (!ordersBySeat[key]) ordersBySeat[key] = [];
    ordersBySeat[key].push(order);
  });

  const seatKeys = Object.keys(ordersBySeat);
  const guestKeys = seatKeys.filter(k => k !== 'Allgemein');
  const allGuestsPaid = billingMode === 'split' && guestKeys.length > 0 && guestKeys.every(k => paidGuests[k])
    && (!ordersBySeat['Allgemein'] || ordersBySeat['Allgemein'].length === 0);
  const allEqualPaid = billingMode === 'equal' && Object.keys(paidEqualGuests).length >= equalSplitCount;

  const openTipScreen = (baseAmount: number, method: 'card' | 'cash', context: TipContext) => {
    setTipScreen({ baseAmount, method, context });
    setTipAmount(0);
    setCustomTipValue('');
    setCashReceivedValue('');
  };

  const handleSelectTipPercent = (percent: number) => {
    if (!tipScreen) return;
    setTipAmount(Math.round(tipScreen.baseAmount * percent) / 100);
  };

  const handleRoundUp = () => {
    if (!tipScreen) return;
    const rounded = Math.ceil(tipScreen.baseAmount);
    setTipAmount(rounded - tipScreen.baseAmount);
  };

  const handleCustomTip = () => {
    const val = parseFloat(customTipValue.replace(',', '.'));
    if (!isNaN(val) && val >= 0) {
      setTipAmount(val);
    }
  };

  const handleConfirmTipPayment = () => {
    if (!tipScreen) return;
    const ctx = tipScreen.context;
    const tip = tipAmount;

    // Persist tip to global state
    if (tip > 0 && table) {
      dispatch({
        type: 'ADD_TIP',
        tip: {
          amount: tip,
          tableId: table.id,
          tableName: table.name,
          method: tipScreen.method,
          timestamp: Date.now(),
        },
      });
    }

    if (ctx.type === 'combined') {
      setPaymentMethod(tipScreen.method);
      setTotalTipCollected(prev => prev + tip);
      setTimeout(() => {
        setPaymentComplete(true);
      }, 800);
    } else if (ctx.type === 'split') {
      const guestOrders = ordersBySeat[ctx.guestKey] || [];
      const guestTotal = guestOrders.reduce((sum, o) => sum + o.price * o.quantity, 0);
      setPaidGuests(prev => ({ ...prev, [ctx.guestKey]: { method: tipScreen.method, amount: guestTotal, tip } }));
      setTotalTipCollected(prev => prev + tip);
    } else if (ctx.type === 'equal') {
      const perPerson = total / equalSplitCount;
      setPaidEqualGuests(prev => ({ ...prev, [ctx.index]: { method: tipScreen.method, amount: perPerson, tip } }));
      setTotalTipCollected(prev => prev + tip);
    }

    setTipScreen(null);
  };

  const handleCombinedPayment = (method: 'card' | 'cash') => {
    openTipScreen(total, method, { type: 'combined' });
  };

  const handleGuestPayment = (guestKey: string, method: 'card' | 'cash') => {
    const guestOrders = ordersBySeat[guestKey] || [];
    const guestTotal = guestOrders.reduce((sum, o) => sum + o.price * o.quantity, 0);
    openTipScreen(guestTotal, method, { type: 'split', guestKey });
  };

  const handleEqualPayment = (guestIndex: number, method: 'card' | 'cash') => {
    const perPerson = total / equalSplitCount;
    openTipScreen(perPerson, method, { type: 'equal', index: guestIndex });
  };

  const handleAssignToGuest = (orderId: string, targetSeatId: number) => {
    dispatch({ type: 'UPDATE_ORDER_SEAT', orderId, seatId: targetSeatId });
  };

  // Track guest visit when closing table
  const trackGuestVisit = () => {
    if (!session || !table) return;
    const revenue = session.orders.reduce((sum, o) => sum + o.price * o.quantity, 0);
    const topItems = [...new Set(session.orders.map(o => o.name))].slice(0, 5);
    const today = new Date();
    const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    const visit: GuestVisit = {
      date: dateStr,
      tableName: table.name,
      partySize: session.guestCount || 1,
      revenue,
      items: topItems,
    };

    // Strategy 1: Find guest via today's reservation for this table
    const reservations = loadReservations();
    const tableReservation = reservations.find(r =>
      r.tableId === table.id &&
      r.date === dateStr &&
      r.status === 'seated' &&
      r.guestPhone
    );
    if (tableReservation && tableReservation.guestPhone) {
      const guest = findGuestByPhone(tableReservation.guestPhone);
      if (guest) {
        addGuestVisit(guest.id, visit);
        return;
      }
    }

    // Strategy 2: Find any confirmed/seated reservation for this table today
    const anyReservation = reservations.find(r =>
      r.tableId === table.id &&
      r.date === dateStr &&
      (r.status === 'seated' || r.status === 'confirmed') &&
      r.guestPhone
    );
    if (anyReservation && anyReservation.guestPhone) {
      const guest = findGuestByPhone(anyReservation.guestPhone);
      if (guest) {
        addGuestVisit(guest.id, visit);
        return;
      }
    }
  };

  const handleCloseAfterSplit = () => {
    trackGuestVisit();
    dispatch({ type: 'CLOSE_TABLE', tableId: table.id });
    dispatch({ type: 'HIDE_BILLING' });
  };

  const handleClose = () => {
    if (paymentComplete) {
      trackGuestVisit();
      dispatch({ type: 'CLOSE_TABLE', tableId: table.id });
    }
    dispatch({ type: 'HIDE_BILLING' });
  };

  // === TIP SCREEN OVERLAY ===
  if (tipScreen) {
    const base = tipScreen.baseAmount;
    const grandTotal = base + tipAmount;
    const roundUpAmount = Math.ceil(base) - base;
    const cashReceived = parseFloat(cashReceivedValue.replace(',', '.')) || 0;
    const changeAmount = tipScreen.method === 'cash' && cashReceived > 0 ? cashReceived - grandTotal : 0;

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
        <div className="bg-vilo-surface rounded-t-2xl sm:rounded-2xl border border-vilo-border-subtle w-full max-w-md max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-vilo-border-subtle">
            <button
              onClick={() => setTipScreen(null)}
              className="p-2 rounded-lg border border-vilo-border-subtle bg-vilo-card text-vilo-text-soft hover:bg-[#332d4e] transition-colors"
            >
              <IconArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-white font-semibold text-lg">Trinkgeld</h2>
            <div className="w-9" />
          </div>

          <div className="p-4">
            {/* Bill amount */}
            <div className="text-center mb-5">
              <p className="text-vilo-text-secondary text-xs mb-1">Rechnungsbetrag</p>
              <p className="text-white text-2xl font-bold">{base.toFixed(2)} EUR</p>
            </div>

            {/* Percentage buttons */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[5, 10, 15].map(pct => {
                const pctAmount = Math.round(base * pct) / 100;
                const isSelected = Math.abs(tipAmount - pctAmount) < 0.005;
                return (
                  <button
                    key={pct}
                    onClick={() => handleSelectTipPercent(pct)}
                    className={`py-3 rounded-xl text-center transition-colors ${
                      isSelected
                        ? 'border border-[#9b7cff] bg-[#8b5cf6] text-white'
                        : 'border border-vilo-border-subtle bg-vilo-card text-vilo-text-soft hover:bg-[#332d4e]'
                    }`}
                  >
                    <p className="text-sm font-bold">{pct}%</p>
                    <p className="text-xs mt-0.5 opacity-70">{pctAmount.toFixed(2)} EUR</p>
                  </button>
                );
              })}
            </div>

            {/* Round up + No tip */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={handleRoundUp}
                className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  roundUpAmount > 0 && Math.abs(tipAmount - roundUpAmount) < 0.005
                    ? 'border border-[#9b7cff] bg-[#8b5cf6] text-white'
                    : 'border border-vilo-border-subtle bg-vilo-card text-vilo-text-soft hover:bg-[#332d4e]'
                }`}
              >
                Aufrunden ({Math.ceil(base).toFixed(2)} EUR)
              </button>
              <button
                onClick={() => setTipAmount(0)}
                className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  tipAmount === 0
                    ? 'border border-[#9b7cff] bg-[#8b5cf6] text-white'
                    : 'border border-vilo-border-subtle bg-vilo-card text-vilo-text-soft hover:bg-[#332d4e]'
                }`}
              >
                Kein Trinkgeld
              </button>
            </div>

            {/* Custom tip input */}
            <div className="flex gap-2 mb-5">
              <input
                type="text"
                inputMode="decimal"
                placeholder="Eigener Betrag"
                value={customTipValue}
                onChange={e => setCustomTipValue(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-xl bg-vilo-card text-white text-sm placeholder:text-vilo-text-muted outline-none focus:ring-2 focus:ring-[#8b5cf6]"
              />
              <button
                onClick={handleCustomTip}
                className="px-4 py-2.5 rounded-xl border border-[#9b7cff] bg-[#8b5cf6] text-white text-sm font-medium hover:bg-[#7c3aed] transition-colors"
              >
                OK
              </button>
            </div>

            {/* Cash: received amount */}
            {tipScreen.method === 'cash' && (
              <div className="mb-5 rounded-xl border border-vilo-border-subtle bg-vilo-elevated/40 p-3">
                <p className="text-vilo-text-secondary text-xs mb-2">Erhalten vom Gast (optional)</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={grandTotal.toFixed(2)}
                    value={cashReceivedValue}
                    onChange={e => setCashReceivedValue(e.target.value)}
                    className="flex-1 px-3 py-2.5 rounded-xl bg-vilo-card text-white text-sm placeholder:text-vilo-text-muted outline-none focus:ring-2 focus:ring-[#8b5cf6]"
                  />
                  <span className="flex items-center text-vilo-text-secondary text-sm">EUR</span>
                </div>
                {cashReceived > 0 && (
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-vilo-text-secondary">Rückgeld</span>
                    <span className={changeAmount >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                      {changeAmount >= 0 ? changeAmount.toFixed(2) : '—'} EUR
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Summary */}
            <div className="mb-4 rounded-xl border border-vilo-border-subtle bg-vilo-card/90 p-4">
              <div className="flex justify-between text-sm text-vilo-text-secondary mb-1">
                <span>Rechnung</span>
                <span>{base.toFixed(2)} EUR</span>
              </div>
              {tipAmount > 0 && (
                <div className="flex justify-between text-sm text-[#d8c7ff] mb-1">
                  <span>Trinkgeld</span>
                  <span>+{tipAmount.toFixed(2)} EUR</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-vilo-border-strong mt-2">
                <span>Gesamt</span>
                <span>{grandTotal.toFixed(2)} EUR</span>
              </div>
            </div>

            {/* Confirm button */}
            <button
              onClick={handleConfirmTipPayment}
              className={`w-full py-3.5 rounded-xl text-white font-medium transition-colors flex items-center justify-center gap-2 ${
                tipScreen.method === 'card'
                  ? 'border border-[#9b7cff] bg-[#8b5cf6] hover:bg-[#7c3aed] active:bg-[#6d28d9]'
                  : 'border border-[#7f67c9] bg-[#5b4d91] hover:bg-[#6959a6] active:bg-[#4f437f]'
              }`}
            >
              {tipScreen.method === 'card' ? <IconCreditCard className="w-5 h-5" /> : <IconCash className="w-5 h-5" />}
              {tipScreen.method === 'card' ? 'Kartenzahlung' : 'Barzahlung'} — {grandTotal.toFixed(2)} EUR
            </button>
          </div>
        </div>
      </div>
    );
  }

  // All guests paid screen (split or equal)
  if (allGuestsPaid || allEqualPaid) {
    const totalPaid = allGuestsPaid
      ? Object.values(paidGuests).reduce((s, g) => s + g.amount, 0)
      : Object.values(paidEqualGuests).reduce((s, g) => s + g.amount, 0);
    const totalTips = allGuestsPaid
      ? Object.values(paidGuests).reduce((s, g) => s + g.tip, 0)
      : Object.values(paidEqualGuests).reduce((s, g) => s + g.tip, 0);
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
        <div className="bg-vilo-surface rounded-2xl border border-vilo-border-subtle w-full max-w-md p-8 text-center animate-fade-in">
          <div className="w-16 h-16 bg-[#8b5cf6] rounded-full flex items-center justify-center mx-auto mb-4">
            <IconCheck className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Alle bezahlt</h2>
          <p className="text-vilo-text-secondary text-sm mb-1">Gesamt: {totalPaid.toFixed(2)} EUR</p>
          {totalTips > 0 && (
            <p className="text-[#d8c7ff] text-sm mb-1">Trinkgeld: {totalTips.toFixed(2)} EUR</p>
          )}
          <p className="text-vilo-text-muted text-xs mb-6">{table.name} wird geschlossen</p>
          <button
            onClick={handleCloseAfterSplit}
            className="w-full py-3 rounded-xl border border-[#9b7cff] bg-[#8b5cf6] text-white font-medium hover:bg-[#7c3aed] transition-colors"
          >
            Fertig
          </button>
        </div>
      </div>
    );
  }

  // Combined payment complete
  if (paymentComplete) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
        <div className="bg-vilo-surface rounded-2xl border border-vilo-border-subtle w-full max-w-md p-8 text-center animate-fade-in">
          <div className="w-16 h-16 bg-[#8b5cf6] rounded-full flex items-center justify-center mx-auto mb-4">
            <IconCheck className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Zahlung abgeschlossen</h2>
          <p className="text-vilo-text-secondary text-sm mb-1">
            {paymentMethod === 'card' ? 'Kartenzahlung' : 'Barzahlung'} {total.toFixed(2)} EUR
          </p>
          {totalTipCollected > 0 && (
            <p className="text-[#d8c7ff] text-sm mb-1">Trinkgeld: {totalTipCollected.toFixed(2)} EUR</p>
          )}
          <p className="text-vilo-text-muted text-xs mb-6">{table.name} wird geschlossen</p>
          <button
            onClick={handleClose}
            className="w-full py-3 rounded-xl border border-[#9b7cff] bg-[#8b5cf6] text-white font-medium hover:bg-[#7c3aed] transition-colors"
          >
            Fertig
          </button>
        </div>
      </div>
    );
  }

  // Assign unassigned items overlay
  if (assigningItems) {
    const unassignedOrders = ordersBySeat['Allgemein'] || [];
    const existingSeats = guestKeys.map(k => {
      const match = k.match(/Gast (\d+)/);
      return match ? parseInt(match[1]) : 0;
    }).filter(n => n > 0);

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
        <div className="bg-vilo-surface rounded-t-2xl sm:rounded-2xl border border-vilo-border-subtle w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-vilo-border-subtle">
            <h2 className="text-white font-semibold">Items zuweisen</h2>
            <button onClick={() => setAssigningItems(false)} className="p-2 rounded-lg border border-vilo-border-subtle bg-vilo-card text-vilo-text-soft hover:bg-[#332d4e] transition-colors">
              <IconX className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 space-y-2">
            <p className="text-vilo-text-secondary text-xs mb-3">Weise jedes Item einem Gast zu:</p>
            {unassignedOrders.map(order => (
              <div key={order.id} className="rounded-lg border border-vilo-border-subtle bg-vilo-elevated/40 p-3">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-white text-sm">{order.quantity > 1 ? `${order.quantity}x ` : ''}{order.name}</p>
                  <span className="text-vilo-text-soft text-sm">{(order.price * order.quantity).toFixed(2)} EUR</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {existingSeats.map(seatId => (
                    <button
                      key={seatId}
                      onClick={() => handleAssignToGuest(order.id, seatId)}
                      className="px-3 py-1.5 rounded-lg border border-[#9b7cff] bg-[#8b5cf6]/18 text-[#d8c7ff] text-xs hover:bg-[#8b5cf6]/28 transition-colors"
                    >
                      Gast {seatId}
                    </button>
                  ))}
                  <button
                    onClick={() => handleAssignToGuest(order.id, (existingSeats.length > 0 ? Math.max(...existingSeats) : 0) + 1)}
                    className="px-3 py-1.5 rounded-lg border border-vilo-border-subtle bg-vilo-card text-vilo-text-soft text-xs hover:bg-[#332d4e] transition-colors"
                  >
                    + Neuer Gast
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-vilo-surface rounded-t-2xl sm:rounded-2xl border border-vilo-border-subtle w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-vilo-border-subtle">
          <div>
            <h2 className="text-white font-semibold text-lg">Rechnung</h2>
            <p className="text-vilo-text-secondary text-xs">{table.name}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg border border-vilo-border-subtle bg-vilo-card text-vilo-text-soft hover:bg-[#332d4e] transition-colors"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {/* Billing Mode Toggle */}
          <div className="mb-5 grid grid-cols-3 gap-2 rounded-2xl border border-vilo-border-subtle bg-vilo-elevated/30 p-1">
            <button
              onClick={() => setBillingMode('combined')}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                billingMode === 'combined'
                  ? 'border border-[#9b7cff] bg-[#8b5cf6] text-white shadow-[0_0_0_1px_rgba(155,124,255,0.15)]'
                  : 'border border-transparent bg-transparent text-vilo-text-soft hover:bg-[#332d4e]'
              }`}
            >
              <IconUserCheck className="w-3.5 h-3.5" />
              Zusammen
            </button>
            <button
              onClick={() => setBillingMode('split')}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                billingMode === 'split'
                  ? 'border border-[#9b7cff] bg-[#8b5cf6] text-white shadow-[0_0_0_1px_rgba(155,124,255,0.15)]'
                  : 'border border-transparent bg-transparent text-vilo-text-soft hover:bg-[#332d4e]'
              }`}
            >
              <IconUsers className="w-3.5 h-3.5" />
              Getrennt
            </button>
            <button
              onClick={() => setBillingMode('equal')}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                billingMode === 'equal'
                  ? 'border border-[#9b7cff] bg-[#8b5cf6] text-white shadow-[0_0_0_1px_rgba(155,124,255,0.15)]'
                  : 'border border-transparent bg-transparent text-vilo-text-soft hover:bg-[#332d4e]'
              }`}
            >
              <IconDivide className="w-3.5 h-3.5" />
              Teilen
            </button>
          </div>

          {/* === COMBINED MODE === */}
          {billingMode === 'combined' && (
            <>
              <div className="space-y-1.5 border-t border-vilo-border-subtle pt-4">
                {session.orders.map(order => (
                  <div key={order.id} className="flex items-center justify-between rounded-lg border border-vilo-border-subtle bg-vilo-elevated/40 px-3 py-2.5">
                    <div>
                      <p className="text-white text-sm">
                        {order.quantity > 1 ? `${order.quantity}x ` : ''}{order.name}
                      </p>
                      {order.modifiers.length > 0 && (
                        <p className="text-amber-400 text-xs">{order.modifiers.join(', ')}</p>
                      )}
                    </div>
                    <span className="text-vilo-text-soft text-sm">{(order.price * order.quantity).toFixed(2)} EUR</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="mt-4 border-t border-vilo-border-subtle pt-4">
                <div className="flex justify-between text-sm text-vilo-text-secondary mb-1">
                  <span>Netto</span>
                  <span>{(total - tax).toFixed(2)} EUR</span>
                </div>
                <div className="flex justify-between text-sm text-vilo-text-secondary mb-2">
                  <span>MwSt. ({state.restaurant.taxRate}%)</span>
                  <span>{tax.toFixed(2)} EUR</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-white">
                  <span>Gesamt</span>
                  <span>{total.toFixed(2)} EUR</span>
                </div>
              </div>

              {/* Payment Buttons */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleCombinedPayment('card')}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#9b7cff] bg-[#8b5cf6] py-3.5 font-medium text-white hover:bg-[#7c3aed] active:bg-[#6d28d9] transition-colors"
                >
                  <IconCreditCard className="w-5 h-5" />
                  Karte
                </button>
                <button
                  onClick={() => handleCombinedPayment('cash')}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#7f67c9] bg-[#5b4d91] py-3.5 font-medium text-white hover:bg-[#6959a6] active:bg-[#4f437f] transition-colors"
                >
                  <IconCash className="w-5 h-5" />
                  Bar
                </button>
              </div>
            </>
          )}

          {/* === SPLIT MODE (Guest-by-Guest) === */}
          {billingMode === 'split' && (
            <>
              {/* Unassigned items hint */}
              {ordersBySeat['Allgemein'] && ordersBySeat['Allgemein'].length > 0 && (
                <button
                  onClick={() => setAssigningItems(true)}
                  className="mb-4 flex w-full items-center justify-between rounded-lg border border-[#6b5aa3] bg-[#2f2949] p-3 text-sm text-[#e4d8ff] hover:bg-[#3a3357] transition-colors"
                >
                  <span>{ordersBySeat['Allgemein'].length} Item(s) ohne Gastzuordnung</span>
                  <IconChevronRight className="w-4 h-4" />
                </button>
              )}

              <div className="space-y-3 border-t border-vilo-border-subtle pt-4">
                {guestKeys.map(guestKey => {
                  const guestOrders = ordersBySeat[guestKey];
                  const guestTotal = guestOrders.reduce((sum, o) => sum + o.price * o.quantity, 0);
                  const guestTax = guestTotal * (state.restaurant.taxRate / 100);
                  const isPaid = !!paidGuests[guestKey];

                  return (
                    <div key={guestKey} className={`overflow-hidden rounded-xl border ${isPaid ? 'border-[#6b5aa3] bg-[#2c2745]' : 'border-vilo-border-subtle bg-vilo-elevated/30'}`}>
                      {/* Guest header */}
                      <div className="flex items-center justify-between p-3 border-b border-vilo-border-subtle/50">
                        <div className="flex items-center gap-2">
                          {isPaid && (
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#8b5cf6]">
                              <IconCheck className="w-3 h-3 text-white" />
                            </div>
                          )}
                          <p className="text-sm font-semibold text-[#d8c7ff]">{guestKey}</p>
                        </div>
                        <p className={`text-sm font-bold ${isPaid ? 'text-[#f1eaff]' : 'text-white'}`}>{guestTotal.toFixed(2)} EUR</p>
                      </div>

                      {/* Guest items */}
                      <div className="p-3 space-y-1">
                        {guestOrders.map(order => (
                          <div key={order.id} className="flex items-center justify-between py-1">
                            <p className={`text-sm ${isPaid ? 'text-[#bbaee4]' : 'text-vilo-text-soft'}`}>
                              {order.quantity > 1 ? `${order.quantity}x ` : ''}{order.name}
                            </p>
                            <span className={`text-sm ${isPaid ? 'text-[#bbaee4]' : 'text-vilo-text-secondary'}`}>{(order.price * order.quantity).toFixed(2)} EUR</span>
                          </div>
                        ))}
                      </div>

                      {/* Guest tax line */}
                      {!isPaid && (
                        <div className="px-3 pb-2">
                          <div className="flex justify-between text-xs text-vilo-text-muted">
                            <span>inkl. MwSt.</span>
                            <span>{guestTax.toFixed(2)} EUR</span>
                          </div>
                        </div>
                      )}

                      {/* Guest payment buttons */}
                      {isPaid ? (
                        <div className="px-3 pb-3">
                          <p className="text-[#d8c7ff] text-xs text-center">
                            {paidGuests[guestKey].method === 'card' ? 'Karte' : 'Bar'} bezahlt
                          </p>
                        </div>
                      ) : (
                        <div className="p-3 pt-0 grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleGuestPayment(guestKey, 'card')}
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-[#9b7cff] bg-[#8b5cf6] py-2.5 text-xs font-medium text-white hover:bg-[#7c3aed] transition-colors"
                          >
                            <IconCreditCard className="w-3.5 h-3.5" />
                            Karte
                          </button>
                          <button
                            onClick={() => handleGuestPayment(guestKey, 'cash')}
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-[#7f67c9] bg-[#5b4d91] py-2.5 text-xs font-medium text-white hover:bg-[#6959a6] transition-colors"
                          >
                            <IconCash className="w-3.5 h-3.5" />
                            Bar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* If no guests assigned at all, show info */}
                {guestKeys.length === 0 && ordersBySeat['Allgemein'] && (
                  <div className="rounded-xl border border-vilo-border-subtle bg-vilo-elevated/30 p-6 text-center">
                    <p className="text-vilo-text-secondary text-sm mb-2">Keine Gäste zugewiesen</p>
                    <p className="text-vilo-text-muted text-xs">Tippe oben um Items einem Gast zuzuweisen</p>
                  </div>
                )}
              </div>

              {/* Split totals summary */}
              {Object.keys(paidGuests).length > 0 && (
                <div className="mt-4 border-t border-vilo-border-subtle pt-4">
                  <div className="flex justify-between text-sm text-vilo-text-secondary mb-1">
                    <span>Bezahlt</span>
                    <span>{Object.values(paidGuests).reduce((s, g) => s + g.amount, 0).toFixed(2)} EUR</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-white">
                    <span>Offen</span>
                    <span>{(total - Object.values(paidGuests).reduce((s, g) => s + g.amount, 0)).toFixed(2)} EUR</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* === EQUAL SPLIT MODE === */}
          {billingMode === 'equal' && (
            <>
              {/* Person count selector */}
              <div className="mb-4 flex items-center justify-center gap-4 border-t border-vilo-border-subtle pt-4">
                <button
                  onClick={() => setEqualSplitCount(Math.max(2, equalSplitCount - 1))}
                  className="h-10 w-10 rounded-full border border-vilo-border-subtle bg-vilo-card text-lg font-bold text-white hover:bg-[#332d4e] transition-colors"
                >
                  -
                </button>
                <div className="text-center">
                  <p className="text-white text-2xl font-bold">{equalSplitCount}</p>
                  <p className="text-vilo-text-secondary text-xs">Personen</p>
                </div>
                <button
                  onClick={() => setEqualSplitCount(equalSplitCount + 1)}
                  className="h-10 w-10 rounded-full border border-vilo-border-subtle bg-vilo-card text-lg font-bold text-white hover:bg-[#332d4e] transition-colors"
                >
                  +
                </button>
              </div>

              {/* Per person amount */}
              <div className="mb-4 rounded-xl border border-vilo-border-subtle bg-vilo-elevated/40 p-4 text-center">
                <p className="text-vilo-text-secondary text-xs mb-1">Pro Person</p>
                <p className="text-white text-2xl font-bold">{(total / equalSplitCount).toFixed(2)} EUR</p>
                <p className="text-vilo-text-muted text-xs mt-1">Gesamt: {total.toFixed(2)} EUR</p>
              </div>

              {/* Per person payment cards */}
              <div className="space-y-2">
                {Array.from({ length: equalSplitCount }, (_, i) => {
                  const isPaid = !!paidEqualGuests[i];
                  return (
                    <div key={i} className={`rounded-xl border p-3 ${isPaid ? 'border-[#6b5aa3] bg-[#2c2745]' : 'border-vilo-border-subtle bg-vilo-elevated/30'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isPaid && (
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#8b5cf6]">
                              <IconCheck className="w-3 h-3 text-white" />
                            </div>
                          )}
                          <p className={`text-sm font-medium ${isPaid ? 'text-[#f1eaff]' : 'text-white'}`}>
                            Person {i + 1}
                          </p>
                        </div>
                        {isPaid ? (
                          <p className="text-[#d8c7ff] text-xs">
                            {paidEqualGuests[i].method === 'card' ? 'Karte' : 'Bar'} bezahlt
                          </p>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEqualPayment(i, 'card')}
                              className="flex items-center gap-1 rounded-lg border border-[#9b7cff] bg-[#8b5cf6] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#7c3aed] transition-colors"
                            >
                              <IconCreditCard className="w-3 h-3" />
                              Karte
                            </button>
                            <button
                              onClick={() => handleEqualPayment(i, 'cash')}
                              className="flex items-center gap-1 rounded-lg border border-[#7f67c9] bg-[#5b4d91] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#6959a6] transition-colors"
                            >
                              <IconCash className="w-3 h-3" />
                              Bar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Equal split totals */}
              {Object.keys(paidEqualGuests).length > 0 && (
                <div className="mt-4 pt-4 border-t border-vilo-border-subtle">
                  <div className="flex justify-between text-sm text-vilo-text-secondary mb-1">
                    <span>Bezahlt ({Object.keys(paidEqualGuests).length}/{equalSplitCount})</span>
                    <span>{Object.values(paidEqualGuests).reduce((s, g) => s + g.amount, 0).toFixed(2)} EUR</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-white">
                    <span>Offen</span>
                    <span>{(total - Object.values(paidEqualGuests).reduce((s, g) => s + g.amount, 0)).toFixed(2)} EUR</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
