import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { Reservation, Table } from '../types';
import { Check, Edit3, X, Trash2, Calendar, Clock, Users, Phone, Mail, MessageSquare, Tag } from 'lucide-react';
import { updateReservation, deleteReservation, loadReservations } from '../utils/storage';

interface ReservationDetailProps {
  reservation: Reservation;
  allTables: Table[];
  onClose: () => void;
  onUpdated: (reservations: Reservation[]) => void;
  onEdit?: () => void;
  onSeat?: () => void;
}

export function ReservationDetail({ reservation, allTables, onClose, onUpdated, onEdit, onSeat }: ReservationDetailProps) {
  const { state, dispatch } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const r = reservation;
  const assignedIds = r.tableIds && r.tableIds.length > 0 ? r.tableIds : (r.tableId ? [r.tableId] : []);

  const isSeated = ['seated', 'partially_seated', 'appetizer', 'entree', 'dessert', 'cleared', 'check_dropped', 'paid', 'bussing_needed'].includes(r.status);

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

  // Source labels
  const sourceLabels: Record<string, string> = { phone: 'Telefon', online: 'Online', walk_in: 'Walk-In' };
  const sourceColors: Record<string, string> = { phone: '#f59e0b', online: '#ec4899', walk_in: '#22c55e' };

  // Status labels
  const statusLabels: Record<string, string> = {
    confirmed: 'Bestätigt', seated: 'Platziert', partially_seated: 'Teilweise platziert',
    cancelled: 'Storniert', no_show: 'No-Show', appetizer: 'Vorspeise', entree: 'Hauptgang',
    dessert: 'Dessert', cleared: 'Abgeräumt', check_dropped: 'Rechnung', paid: 'Bezahlt', bussing_needed: 'Abräumen'
  };

  // Assigned table names
  const assignedTableNames = assignedIds
    .map(id => allTables.find(t => t.id === id))
    .filter(Boolean)
    .map(t => t!.name);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="mt-auto w-full rounded-t-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto" style={{ background: '#1a1a2e' }} onClick={e => e.stopPropagation()}>

        {/* Header - Guest Name + Status */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <div>
            <h2 className="text-2xl font-bold text-white">{r.guestName}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{
                background: r.status === 'cancelled' ? '#ef444433' : isSeated ? '#7c3aed33' : '#7bb7ef33',
                color: r.status === 'cancelled' ? '#ef4444' : isSeated ? '#7c3aed' : '#7bb7ef'
              }}>
                {statusLabels[r.status] || r.status}
              </span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{
                background: (sourceColors[r.source] || '#8888aa') + '22',
                color: sourceColors[r.source] || '#8888aa'
              }}>
                {sourceLabels[r.source] || r.source}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-[#b0b0cc] hover:text-[#e0e0f0]"><X className="w-6 h-6" /></button>
        </div>

        {/* BLOCK 1: Reservierungsdetails */}
        <div className="mx-5 mt-3 rounded-xl border border-[#333355]" style={{ background: '#1a1a2e' }}>
          <div className="grid grid-cols-2 gap-0">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-r border-[#333355]">
              <Calendar className="w-4 h-4 text-[#7bb7ef] shrink-0" />
              <span className="text-sm text-white">{formatDate(r.date)}</span>
            </div>
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#333355]">
              <Clock className="w-4 h-4 text-[#7bb7ef] shrink-0" />
              <span className="text-sm text-white">{r.time} Uhr</span>
              <span className="text-xs text-[#8888aa]">({formatDuration(r.duration || 90)})</span>
            </div>
            <div className="flex items-center gap-2.5 px-4 py-3 border-r border-[#333355]">
              <Users className="w-4 h-4 text-[#7bb7ef] shrink-0" />
              <span className="text-sm text-white">{r.partySize} {r.partySize === 1 ? 'Gast' : 'Gäste'}</span>
            </div>
            <div className="flex items-center gap-2.5 px-4 py-3">
              <Tag className="w-4 h-4 text-[#7bb7ef] shrink-0" />
              <span className="text-sm text-white truncate">
                {assignedTableNames.length > 0 ? assignedTableNames.join(', ') : 'Kein Tisch'}
              </span>
            </div>
          </div>
        </div>

        {/* BLOCK 2: Gästeprofil */}
        <div className="mx-5 mt-3 rounded-xl border border-[#333355]" style={{ background: '#1a1a2e' }}>
          {r.guestPhone && (
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#333355]">
              <Phone className="w-4 h-4 text-[#b0b0cc] shrink-0" />
              <span className="text-sm text-white">{r.guestPhone}</span>
            </div>
          )}
          {r.guestEmail && (
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#333355]">
              <Mail className="w-4 h-4 text-[#b0b0cc] shrink-0" />
              <span className="text-sm text-white">{r.guestEmail}</span>
            </div>
          )}
          {r.notes && (
            <div className="flex items-start gap-2.5 px-4 py-3 border-b border-[#333355]">
              <MessageSquare className="w-4 h-4 text-[#b0b0cc] shrink-0 mt-0.5" />
              <span className="text-sm text-[#c0c0dd]">{r.notes}</span>
            </div>
          )}
          {r.referralSource && (
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#333355]">
              <Tag className="w-4 h-4 text-[#a78bfa] shrink-0" />
              <span className="text-sm text-[#a78bfa]">via {r.referralSource}</span>
            </div>
          )}
          {!r.guestPhone && !r.guestEmail && !r.notes && !r.referralSource && (
            <div className="px-4 py-3 text-sm text-[#555577]">Keine Kontaktdaten hinterlegt</div>
          )}
        </div>

        {/* BLOCK 3: Aktionen */}
        <div className="px-5 py-3 space-y-2">
          {/* Platzieren */}
          {!isSeated && (
            <button onClick={handleSeat}
              className="w-full flex items-center gap-3 py-4 px-4 rounded-xl text-white font-semibold text-base transition-colors"
              style={{ background: '#7c3aed' }}>
              <Check className="w-5 h-5" />
              Platzieren
            </button>
          )}

          {/* Bearbeiten */}
          <button onClick={() => { if (onEdit) onEdit(); onClose(); }}
            className="w-full flex items-center gap-3 py-4 px-4 rounded-xl border border-[#3d3d5c] text-[#c0c0dd] font-medium text-base hover:bg-[#2a2a42] active:bg-[#353558] transition-colors">
            <Edit3 className="w-5 h-5 text-[#b0b0cc]" />
            Bearbeiten
          </button>
        </div>

        {/* Tische zuweisen */}
        <div className="px-5 py-3">
          <p className="text-sm font-bold text-[#b0b0cc] tracking-wider mb-3">Tische zuweisen</p>
          <div className="max-h-[160px] overflow-y-auto pr-1">
            <div className="flex flex-wrap gap-2">
              {allTables.map(table => {
                const isAssigned = assignedIds.includes(table.id);
                const isOccupied = occupiedTableIds.has(table.id);
                const isBlocked = table.status === 'blocked';
                const isDisabled = isOccupied || isBlocked;

                return (
                  <button key={table.id}
                    onClick={() => !isDisabled && handleToggleTable(table.id)}
                    className={'px-3 py-2 rounded-lg text-sm font-medium transition-all ' +
                      (isAssigned
                        ? 'border-2 border-[#7bb7ef] text-white bg-[#2a2a42]'
                        : isDisabled
                          ? 'border border-[#333355] text-[#555577] bg-[#222238] cursor-not-allowed'
                          : 'border border-[#3d3d5c] text-[#c0c0dd] bg-[#2d2d50] hover:bg-[#444] cursor-pointer')
                    }>
                    {table.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Zahlungsstatus */}
        <div className="px-5 py-3">
          <p className="text-sm font-bold text-[#b0b0cc] tracking-wider mb-3">Zahlungsstatus</p>
          <div className="flex gap-2">
            {([
              { value: 'open', label: 'OFFEN' },
              { value: 'partial', label: 'ANZAHLUNG' },
              { value: 'paid', label: 'BEZAHLT' },
            ] as const).map(opt => (
              <button key={opt.value}
                onClick={() => handlePaymentStatus(opt.value)}
                className={'px-4 py-2.5 rounded-lg text-sm font-bold tracking-wider transition-all ' +
                  (paymentStatus === opt.value
                    ? 'border-2 border-[#7bb7ef] text-white bg-[#2a2a42]'
                    : 'border border-[#3d3d5c] text-[#c0c0dd] bg-[#2d2d50] hover:bg-[#444]')
                }>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="px-5 py-3 pb-20 space-y-1">
          {r.status !== 'cancelled' && (
            <button onClick={handleCancel}
              className="w-full flex items-center gap-3 py-4 px-4 text-[#ef4444] font-semibold text-base hover:bg-[#3a1a1a] transition-colors rounded-xl">
              <X className="w-5 h-5" />
              Stornieren
            </button>
          )}
          <button onClick={handleDelete}
            className="w-full flex items-center gap-3 py-4 px-4 text-[#ef4444] font-semibold text-base hover:bg-[#3a1a1a] transition-colors rounded-xl">
            <Trash2 className="w-5 h-5" />
            {confirmDelete ? 'Wirklich loeschen?' : 'Loeschen'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
