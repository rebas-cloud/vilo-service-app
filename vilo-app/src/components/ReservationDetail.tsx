import { useCallback, useState } from 'react';
import { Check, ChevronRight, CreditCard, Edit3, Mail, MessageSquare, Phone, Plus, Sofa, Trash2, X } from 'lucide-react';

import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { Reservation, Table } from '../types';

import { updateReservation, deleteReservation, loadReservations } from '../utils/storage';

interface ReservationDetailProps {
  reservation: Reservation;
  allTables: Table[];
  onClose: () => void;
  onUpdated: (reservations: Reservation[]) => void;
  onEdit?: () => void;
  onSeat?: () => void;
  inline?: boolean;
}

export function ReservationDetail({ reservation, allTables, onClose, onUpdated, onEdit, onSeat, inline = false }: ReservationDetailProps) {
  const { state, dispatch } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const r = reservation;
  const assignedIds = r.tableIds && r.tableIds.length > 0 ? r.tableIds : (r.tableId ? [r.tableId] : []);

  const isSeated = ['seated', 'partially_seated', 'appetizer', 'entree', 'dessert', 'cleared', 'check_dropped', 'paid', 'bussing_needed'].includes(r.status);

  const requestClose = useCallback(() => {
    setIsClosing(true);
    window.setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 140);
  }, [onClose]);

  const handleToggleTable = (tableId: string) => {
    const currentIds = [...assignedIds];
    let newIds: string[];
    if (currentIds.includes(tableId)) {
      newIds = currentIds.filter(id => id !== tableId);
    } else {
      newIds = [...currentIds, tableId];
    }
    const updated = updateReservation(r.id, { tableId: newIds[0] || '', tableIds: newIds });
    onUpdated(updated);
  };

  const handlePaymentStatus = (status: 'open' | 'partial' | 'paid') => {
    const updated = updateReservation(r.id, { paymentStatus: status });
    onUpdated(updated);
  };

  const handleCancel = () => {
    const updated = updateReservation(r.id, { status: 'cancelled' });
    onUpdated(updated);
    onClose();
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const updated = deleteReservation(r.id);
    onUpdated(updated);
    onClose();
  };

  const handleSeat = () => {
    // Update reservation status to seated
    const updated = updateReservation(r.id, { status: 'seated' });
    onUpdated(updated);

    // Also seat the table(s) - set table status to occupied and create session
    const tableIds = r.tableIds && r.tableIds.length > 0 ? r.tableIds : (r.tableId ? [r.tableId] : []);
    tableIds.forEach(tid => {
      const table = state.tables.find(t => t.id === tid);
      if (table && table.status === 'free') {
        dispatch({ type: 'SET_ACTIVE_TABLE', tableId: tid });
        dispatch({ type: 'SET_GUEST_SOURCE', tableId: tid, source: r.source || 'phone' });
        dispatch({ type: 'SET_GUEST_COUNT', tableId: tid, guestCount: r.partySize });
        dispatch({ type: 'SET_SERVICE_STATUS', tableId: tid, serviceStatus: 'platziert' });
      }
    });

    if (onSeat) onSeat();
    onClose();
  };

  // Determine which tables are occupied by OTHER reservations
  const occupiedTableIds = new Set<string>();
  const allRes = loadReservations();
  const seatedStatuses = ['seated', 'partially_seated', 'appetizer', 'entree', 'dessert', 'cleared', 'check_dropped', 'paid', 'bussing_needed'];
  allRes.forEach(res => {
    if (res.id === r.id) return;
    if (!seatedStatuses.includes(res.status) && res.status !== 'confirmed') return;
    if (res.tableId) occupiedTableIds.add(res.tableId);
    if (res.tableIds) res.tableIds.forEach(id => occupiedTableIds.add(id));
  });

  // Also check table status
  allTables.forEach(t => {
    if (t.status === 'occupied' || t.status === 'billing') {
      if (!assignedIds.includes(t.id)) occupiedTableIds.add(t.id);
    }
  });

  const paymentStatus = r.paymentStatus || 'open';
  const guestInitial = (r.guestName || '?').trim().charAt(0).toUpperCase() || '?';

  // Format date for display
  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    return `${days[date.getDay()]}, ${d}. ${months[m - 1]} ${y}`;
  };

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}min` : `${h}h`) : `${m}min`;
  };

  // Assigned table names
  const assignedTableNames = assignedIds
    .map(id => allTables.find(t => t.id === id))
    .filter(Boolean)
    .map(t => t!.name);

  const paymentStatusLabel: Record<typeof paymentStatus, string> = {
    open: 'Zahlung offen',
    partial: 'Anzahlung',
    paid: 'Bezahlt',
  };
  const cardBg = '#2d2c48';
  const surfaceBg = '#26243f';

  const panel = (
    <div
      className={
        inline
          ? 'h-full w-[320px] max-w-[36vw] overflow-y-auto border-l border-white/[0.03]'
          : `h-full w-[320px] max-w-[92vw] overflow-y-auto shadow-2xl ${isClosing ? 'vilo-panel-exit' : 'vilo-panel-enter'}`
      }
      style={{ background: '#1f1e33', borderLeft: inline ? '1px solid rgba(255,255,255,0.03)' : undefined }}
      onClick={e => e.stopPropagation()}
    >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.03]">
          <h2 className="text-[16px] font-bold text-white">Reservierung</h2>
          <button onClick={requestClose} className="ml-3 p-1 text-[#b0b0cc] hover:text-[#e0e0f0] shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-4 py-4 space-y-3">
          <div className="flex items-center gap-4 px-4 py-4" style={{ background: surfaceBg }}>
            <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center bg-[#8b5cf6] text-[28px] font-bold text-white">
              {guestInitial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1 truncate text-[16px] font-bold text-white">{r.guestName}</div>
                {onEdit && (
                  <button
                    onClick={() => { onEdit(); onClose(); }}
                    className="shrink-0 p-1 text-[#c4b5fd] hover:text-[#e9ddff] transition-colors"
                    aria-label="Reservierung bearbeiten"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {r.guestPhone && (
                <div className="mt-1 flex items-center gap-2 text-[12px] font-medium text-[#d8c7ff]">
                  <Phone className="w-4 h-4 shrink-0" />
                  <span className="truncate">{r.guestPhone}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="px-3 py-2.5 text-center" style={{ background: surfaceBg }}>
              <div className="text-[12px] font-bold text-white">{r.time}</div>
            </div>
            <div className="px-3 py-2.5 text-center" style={{ background: surfaceBg }}>
              <div className="text-[12px] font-bold text-white">{r.partySize} P.</div>
            </div>
            <div className="px-3 py-2.5 text-center" style={{ background: surfaceBg }}>
              <div className="text-[12px] font-bold text-white">{formatDuration(r.duration || 90)}</div>
            </div>
          </div>

          <div className="px-4 py-4" style={{ background: surfaceBg }}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center text-[#b8c4db]">
                <Sofa className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold text-white">
                  {assignedTableNames.length > 0 ? assignedTableNames.join(', ') : 'Kein Tisch'}
                </div>
                <div className="mt-0.5 text-[11px] text-[#9aa4bd]">
                  {assignedTableNames.length > 0 ? 'Zugewiesen' : 'Nicht zugewiesen'}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#a9a4ca]" />
            </div>
          </div>

          <div className="px-4 py-4" style={{ background: surfaceBg }}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center text-[#b8c4db]">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold text-white">{r.guestPhone || 'Keine Telefonnummer'}</div>
                <div className="mt-1 inline-flex bg-[#4b3a83] px-2 py-1 text-[11px] font-medium text-[#d9c4ff]">
                  {r.guestPhone ? 'SMS-Updates aktiv' : 'SMS-Updates deaktiviert'}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button className="flex min-h-[68px] items-center justify-center bg-[#373454] text-[#b8c4db] transition-colors hover:bg-[#403d61]">
              <Mail className="h-6 w-6" />
            </button>
            <button className="flex min-h-[68px] items-center justify-center bg-[#373454] text-[#b8c4db] transition-colors hover:bg-[#403d61]">
              <CreditCard className="h-6 w-6" />
            </button>
          </div>

          <div className="overflow-hidden" style={{ background: surfaceBg }}>
            <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-white/[0.06]">
              <span className="text-[#eef1fb] text-[13px] font-semibold">Zahlungsstatus</span>
              <span className="text-[11px] text-[#b4afd2]">{paymentStatusLabel[paymentStatus]}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 p-2.5">
              {([
                { value: 'open', label: 'OFFEN' },
                { value: 'partial', label: 'ANZAHLUNG' },
                { value: 'paid', label: 'BEZAHLT' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handlePaymentStatus(opt.value)}
                  className={
                    'min-h-[44px] px-1.5 py-2 text-[10px] font-bold tracking-[0.08em] leading-none whitespace-nowrap transition-colors ' +
                    (paymentStatus === opt.value
                      ? 'text-white bg-[#d946ef]'
                      : 'text-[#c0c0dd] bg-[#373454] hover:bg-[#403d61]')
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 py-4" style={{ background: surfaceBg }}>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[#eef1fb] text-[13px] font-semibold">Vermittler*in</div>
                <div className="mt-0.5 text-[11px] text-[#8f97b3] truncate">
                  {r.referralSource || 'Noch nicht zugewiesen'}
                </div>
              </div>
              {!r.referralSource && <Plus className="w-4 h-4 text-[#c4b5fd] shrink-0" />}
            </div>
          </div>
        </div>

        {/* BLOCK 3: Aktionen */}
        <div className="px-4 py-4 space-y-2">
          {/* Platzieren */}
          {!isSeated && (
            <button onClick={handleSeat}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 text-white font-semibold text-[15px] transition-colors"
              style={{ background: '#8b5cf6' }}>
              <Check className="w-5 h-5" />
              Platzieren
            </button>
          )}
        </div>

        {/* Danger Zone */}
        <div className="px-4 py-4 pb-20 space-y-2">
          {r.status !== 'cancelled' && (
            <button onClick={handleCancel}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 text-[#f5d0fe] font-semibold text-[15px] transition-colors"
              style={{ background: '#2b2944' }}>
              <X className="w-5 h-5" />
              Stornieren
            </button>
          )}
          <button onClick={handleDelete}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 text-[#f5d0fe] font-semibold text-[15px] transition-colors"
            style={{ background: '#4a1733' }}>
            <Trash2 className="w-5 h-5" />
            {confirmDelete ? 'Wirklich loeschen?' : 'Loeschen'}
          </button>
        </div>
      </div>
  );

  if (inline) {
    return panel;
  }

  return createPortal(
    <div className={`fixed inset-0 z-[60] flex justify-end ${isClosing ? 'vilo-overlay-exit' : 'vilo-overlay-enter'}`} style={{ background: 'rgba(0,0,0,0.34)' }} onClick={requestClose}>
      {panel}
    </div>,
    document.body
  );
}
