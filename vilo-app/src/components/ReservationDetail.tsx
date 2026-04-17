import { useCallback, useState } from 'react';
import { IconCheck, IconCreditCard, IconEdit, IconMail, IconMessage, IconPhone, IconPlus, IconArmchair, IconTrash, IconX } from '@tabler/icons-react';

import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { Reservation, Table } from '../types';
import { updateReservation, deleteReservation, loadReservations } from '../utils/storage';
import { SurfaceCard, InfoRow, ActionButton, IconActionPair } from './ui';
import { formatDurationShort } from '../utils/common';

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
  const [showGuestCountOverlay, setShowGuestCountOverlay] = useState(false);
  const [showDurationOverlay, setShowDurationOverlay] = useState(false);
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;

  const r = reservation;
  const assignedIds = r.tableIds && r.tableIds.length > 0 ? r.tableIds : (r.tableId ? [r.tableId] : []);

  const isSeated = ['seated', 'partially_seated', 'appetizer', 'entree', 'dessert', 'cleared', 'check_dropped', 'paid', 'bussing_needed'].includes(r.status);

  const requestClose = useCallback(() => {
    onClose();
  }, [onClose]);

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
    const updated = updateReservation(r.id, { status: 'seated' });
    onUpdated(updated);

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

  allTables.forEach(t => {
    if (t.status === 'occupied' || t.status === 'billing') {
      if (!assignedIds.includes(t.id)) occupiedTableIds.add(t.id);
    }
  });

  const paymentStatus = r.paymentStatus || 'open';
  const guestInitial = (r.guestName || '?').trim().charAt(0).toUpperCase() || '?';

  const sectionLabelClass = 'mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f97b3]';
  const textInputClass = 'w-full bg-vilo-card px-4 py-3 text-[13px] text-white outline-none placeholder:text-vilo-text-muted';
  const getPickerButtonClass = (active: boolean) => (
    'flex min-h-[48px] items-center justify-center px-3 text-[13px] font-semibold transition-colors ' +
    (active
      ? 'bg-[#8b5cf6] text-white'
      : 'bg-vilo-card text-vilo-text-soft hover:bg-vilo-elevated')
  );
  const interactiveStatClass = 'w-full border border-vilo-border-strong bg-vilo-card px-3 py-3 text-left transition-colors hover:bg-vilo-surface active:bg-vilo-elevated';

  const applyReservationPartySize = (partySize: number) => {
    const updated = updateReservation(r.id, { partySize });
    onUpdated(updated);
    setShowGuestCountOverlay(false);
  };

  const applyReservationDuration = (duration: number) => {
    const updated = updateReservation(r.id, { duration });
    onUpdated(updated);
    setShowDurationOverlay(false);
  };

  const assignedTableNames = assignedIds
    .map(id => allTables.find(t => t.id === id))
    .filter(Boolean)
    .map(t => t!.name);

  const paymentStatusLabel: Record<typeof paymentStatus, string> = {
    open: 'Zahlung offen',
    partial: 'Anzahlung',
    paid: 'Bezahlt',
  };

  const panel = (
    <div
      className={
        inline
          ? 'vilo-no-motion relative h-full overflow-y-auto border-l'
          : 'vilo-no-motion h-full w-[320px] max-w-[92vw] overflow-y-auto shadow-2xl'
      }
      style={{
        background: '#1f1e33',
        borderLeft: inline ? '1px solid #2a2a42' : undefined,
        width: inline ? (isMobileViewport ? 'calc(100vw - 68px)' : 320) : 320,
        minWidth: inline ? (isMobileViewport ? 'calc(100vw - 68px)' : 320) : 320,
        maxWidth: inline ? (isMobileViewport ? 'calc(100vw - 68px)' : 320) : 320,
        marginLeft: inline ? 'auto' : undefined,
        flexShrink: 0,
      }}
      onClick={e => e.stopPropagation()}
    >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: '#2a2a42' }}>
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-bold text-white">Reservierung</h2>
          </div>
          <button onClick={requestClose} className="ml-3 p-1 text-vilo-text-secondary hover:text-vilo-text-primary shrink-0"><IconX className="w-5 h-5" /></button>
        </div>

        <div className="px-4 py-4 space-y-3">
          {/* Guest header */}
          <SurfaceCard className="flex items-center gap-4 px-4 py-4">
            <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center bg-vilo-accent text-[28px] font-bold text-white">
              {guestInitial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1 truncate text-[16px] font-bold text-white">{r.guestName}</div>
                {onEdit && (
                  <button
                    onClick={() => { onEdit(); onClose(); }}
                    className="shrink-0 p-1 text-vilo-accent-light hover:text-[#e9ddff] transition-colors"
                    aria-label="Reservierung bearbeiten"
                  >
                    <IconEdit className="w-4 h-4" />
                  </button>
                )}
              </div>
              {r.guestPhone && (
                <div className="mt-1 flex items-center gap-2 text-[12px] font-medium text-[#d8c7ff]">
                  <IconPhone className="w-4 h-4 shrink-0" />
                  <span className="truncate">{r.guestPhone}</span>
                </div>
              )}
            </div>
          </SurfaceCard>

          {/* Time / Party / Duration */}
          <div className="grid grid-cols-3 gap-3">
            <div className={`${interactiveStatClass} cursor-default`}>
              <div className="text-center text-[13px] font-bold text-white">{r.time}</div>
            </div>
            <button
              type="button"
              onClick={() => setShowGuestCountOverlay(true)}
              className={interactiveStatClass}
            >
              <div className="text-center text-[13px] font-bold text-white">{r.partySize} P.</div>
            </button>
            <button
              type="button"
              onClick={() => setShowDurationOverlay(true)}
              className={interactiveStatClass}
            >
              <div className="text-center text-[13px] font-bold text-white">{formatDurationShort(r.duration || 90)}</div>
            </button>
          </div>

          {/* Table assignment */}
          <SurfaceCard className="px-4 py-4">
            <InfoRow
              icon={<IconArmchair className="w-5 h-5" />}
              title={assignedTableNames.length > 0 ? assignedTableNames.join(', ') : 'Kein Tisch'}
              subtitle={assignedTableNames.length > 0 ? 'Zugewiesen' : 'Nicht zugewiesen'}
              chevron
            />
          </SurfaceCard>

          {/* Phone / SMS */}
          <SurfaceCard className="px-4 py-4">
            <InfoRow
              icon={<IconMessage className="w-5 h-5" />}
              title={r.guestPhone || 'Keine Telefonnummer'}
              badge={r.guestPhone ? 'SMS-Updates aktiv' : 'SMS-Updates deaktiviert'}
            />
          </SurfaceCard>

          {/* Mail / Credit Card */}
          <IconActionPair actions={[
            { icon: <IconMail className="h-6 w-6" />, label: 'E-Mail' },
            { icon: <IconCreditCard className="h-6 w-6" />, label: 'Kreditkarte' },
          ]} />

          {/* Payment status */}
          <SurfaceCard className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-4" style={{ borderColor: '#2a2a42' }}>
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
                      : 'text-vilo-text-soft bg-vilo-interactive hover:bg-vilo-interactive-hover')
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </SurfaceCard>

          {/* Referral */}
          <SurfaceCard className="px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[#eef1fb] text-[13px] font-semibold">Vermittler*in</div>
                <div className="mt-0.5 text-[11px] text-vilo-text-muted truncate">
                  {r.referralSource || 'Noch nicht zugewiesen'}
                </div>
              </div>
              {!r.referralSource && <IconPlus className="w-4 h-4 text-vilo-accent-light shrink-0" />}
            </div>
          </SurfaceCard>
        </div>

        {/* Actions */}
        <div className="px-4 py-4 space-y-2">
          {!isSeated && (
            <ActionButton variant="primary" icon={<IconCheck className="w-5 h-5" />} onClick={handleSeat}>
              Platzieren
            </ActionButton>
          )}
        </div>

        {/* Danger Zone */}
        <div className="px-4 py-4 pb-20 space-y-2">
          {r.status !== 'cancelled' && (
            <ActionButton variant="secondary" icon={<IconX className="w-5 h-5" />} onClick={handleCancel}>
              Stornieren
            </ActionButton>
          )}
          <ActionButton variant="danger" icon={<IconTrash className="w-5 h-5" />} onClick={handleDelete}>
            {confirmDelete ? 'Wirklich loeschen?' : 'Loeschen'}
          </ActionButton>
        </div>

        {showGuestCountOverlay && (
          <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/20" onClick={() => setShowGuestCountOverlay(false)}>
            <div className="border-t border-[#2a2a42] bg-[#1f1d33] px-4 py-4" onClick={e => e.stopPropagation()}>
              <p className={sectionLabelClass}>Anzahl Gäste</p>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <button key={n} onClick={() => applyReservationPartySize(n)} className={getPickerButtonClass(r.partySize === n)}>
                    {n}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                placeholder="Andere Anzahl..."
                className={`${textInputClass} mt-2`}
                value={r.partySize > 8 ? r.partySize : ''}
                onChange={e => {
                  const val = parseInt(e.target.value);
                  if (val > 0) {
                    const updated = updateReservation(r.id, { partySize: val });
                    onUpdated(updated);
                  }
                }}
                onBlur={e => {
                  const val = parseInt(e.target.value);
                  if (val > 0) {
                    applyReservationPartySize(val);
                  } else {
                    setShowGuestCountOverlay(false);
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const val = parseInt((e.target as HTMLInputElement).value);
                    if (val > 0) applyReservationPartySize(val);
                  }
                }}
              />
            </div>
          </div>
        )}

        {showDurationOverlay && (
          <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/20" onClick={() => setShowDurationOverlay(false)}>
            <div className="border-t border-[#2a2a42] bg-[#1f1d33] px-4 py-4" onClick={e => e.stopPropagation()}>
              <p className={sectionLabelClass}>Dauer</p>
              <div className="grid grid-cols-3 gap-2">
                {[60, 90, 120, 150, 180].map(duration => (
                  <button key={duration} onClick={() => applyReservationDuration(duration)} className={getPickerButtonClass((r.duration || 90) === duration)}>
                    {duration}m
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
  );

  if (inline) {
    return panel;
  }

  return createPortal(
    <div className="vilo-no-motion fixed inset-0 z-[60] flex justify-end" style={{ background: 'rgba(0,0,0,0.34)' }} onClick={requestClose}>
      {panel}
    </div>,
    document.body
  );
}
