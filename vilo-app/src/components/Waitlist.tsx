import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { IconAlertTriangle, IconBell, IconCheck, IconChevronDown, IconChevronLeft, IconChevronUp, IconMessage, IconPhone, IconTrash, IconUserCheck, IconUsers, IconX, IconCircleX } from '@tabler/icons-react';

import { WaitlistEntry, Table } from '../types';
import { loadWaitlist, saveWaitlist, addWaitlistEntry, updateWaitlistEntry, removeWaitlistEntry } from '../utils/storage';

interface WaitlistPanelProps {
  onClose: () => void;
  onSeatGuest: (tableId: string) => void;
  tables: Table[];
  embedded?: boolean;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

function getElapsed(timestamp: number): string {
  const mins = Math.floor((Date.now() - timestamp) / 60000);
  if (mins < 1) return 'Gerade eben';
  if (mins < 60) return `${mins} Min.`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function getWaitColor(minutes: number): string {
  if (minutes <= 10) return '#c4b5fd';
  if (minutes <= 20) return '#a78bfa';
  if (minutes <= 30) return '#d8b4fe';
  return '#f0abfc';
}

const SEAT_PREFERENCES = [
  { value: '', label: 'Keine Praeferenz' },
  { value: 'innen', label: 'Innen' },
  { value: 'terrasse', label: 'Terrasse' },
  { value: 'bar', label: 'Bar' },
  { value: 'fenster', label: 'Fensterplatz' },
  { value: 'ruhig', label: 'Ruhiger Tisch' },
];

function SeatedWaitlistRow({
  entry,
  tableLabel,
  elapsedLabel,
  onDelete,
}: {
  entry: WaitlistEntry;
  tableLabel: string;
  elapsedLabel: string;
  onDelete: () => void;
}) {
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
    const clamped = Math.min(0, Math.max(-120, diff));
    currentXRef.current = clamped;
    setOffsetX(clamped);
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
    if (currentXRef.current <= DELETE_THRESHOLD) {
      setIsRemoving(true);
      setOffsetX(-320);
      setTimeout(() => onDelete(), 220);
    } else {
      setOffsetX(0);
    }
  }, [onDelete]);

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
      if (currentXRef.current <= DELETE_THRESHOLD) {
        setIsRemoving(true);
        setOffsetX(-320);
        setTimeout(() => onDelete(), 220);
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
    <div className={`relative overflow-hidden ${isRemoving ? 'h-0 opacity-0' : ''}`}
      style={{ transition: isRemoving ? 'height 0.22s ease, opacity 0.22s ease, margin 0.22s ease' : undefined }}>
      {offsetX < 0 && (
        <div className="absolute inset-0 flex items-center justify-end pr-5" style={{ background: '#4a1733' }}>
          <IconTrash className="w-5 h-5 text-[#fdf2f8]" />
        </div>
      )}
      <div
        className="px-4 py-3 border-b border-white/[0.03] flex items-center gap-3 select-none"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDraggingRef.current ? 'none' : 'transform 0.22s ease',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        <div className="w-9 h-9 rounded-full bg-[#8b5cf6] flex items-center justify-center shrink-0">
          <IconCheck className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-[#eef1fb] truncate">{entry.guestName}</p>
          <p className="text-[12px] text-vilo-text-muted">{entry.partySize} Pers. · {tableLabel}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[12px] text-[#d8c7ff] font-medium">Platziert</p>
          <p className="text-[11px] text-vilo-text-secondary">{elapsedLabel}</p>
        </div>
      </div>
    </div>
  );
}

export function WaitlistPanel({ onClose, onSeatGuest, tables, embedded = false }: WaitlistPanelProps) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [seatPickerId, setSeatPickerId] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  // Add form state
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPartySize, setNewPartySize] = useState(2);
  const [newNotes, setNewNotes] = useState('');
  const [newPreference, setNewPreference] = useState('');
  const [newWaitMinutes, setNewWaitMinutes] = useState(15);

  useEffect(() => {
    setEntries(loadWaitlist());
  }, []);

  // Auto-refresh elapsed times every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      setEntries(loadWaitlist());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const activeEntries = useMemo(() =>
    entries.filter(e => e.status === 'waiting' || e.status === 'notified')
      .sort((a, b) => a.position - b.position),
    [entries]
  );

  const seatedEntries = useMemo(() =>
    entries.filter(e => e.status === 'seated')
      .sort((a, b) => (b.seatedAt || 0) - (a.seatedAt || 0))
      .slice(0, 5),
    [entries]
  );

  const freeTables = useMemo(() =>
    tables.filter(t => t.status === 'free'),
    [tables]
  );

  const requestClose = useCallback(() => {
    setIsClosing(true);
    window.setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 140);
  }, [onClose]);

  // Estimate wait time based on queue position and average table turnover
  const estimateWait = (partySize: number): number => {
    const freeCount = freeTables.length;
    if (freeCount > 0) return 5; // tables available, short wait
    const waitingAhead = activeEntries.length;
    // Rough estimate: 15-20 min per table turnover, adjusted by queue
    const baseWait = Math.max(10, waitingAhead * 12);
    const sizeMultiplier = partySize > 4 ? 1.5 : partySize > 2 ? 1.2 : 1;
    return Math.round(Math.min(90, baseWait * sizeMultiplier));
  };

  const handleAddEntry = () => {
    if (!newName.trim()) return;
    const position = activeEntries.length + 1;
    const entry: WaitlistEntry = {
      id: generateId(),
      guestName: newName.trim(),
      guestPhone: newPhone.trim() || undefined,
      partySize: newPartySize,
      estimatedWaitMinutes: newWaitMinutes,
      notes: newNotes.trim() || undefined,
      seatPreference: newPreference || undefined,
      status: 'waiting',
      position,
      addedAt: Date.now(),
    };
    const updated = addWaitlistEntry(entry);
    setEntries(updated);
    setShowAddForm(false);
    setNewName('');
    setNewPhone('');
    setNewPartySize(2);
    setNewNotes('');
    setNewPreference('');
    setNewWaitMinutes(15);
  };

  const handleNotify = (id: string) => {
    const updated = updateWaitlistEntry(id, { status: 'notified', notifiedAt: Date.now() });
    setEntries(updated);
  };

  const handleSeat = (entryId: string, tableId: string) => {
    const updated = updateWaitlistEntry(entryId, {
      status: 'seated',
      seatedAt: Date.now(),
      assignedTableId: tableId,
    });
    setEntries(updated);
    setSeatPickerId(null);
    onSeatGuest(tableId);
  };

  const handleCancel = (id: string) => {
    const updated = updateWaitlistEntry(id, { status: 'cancelled' });
    setEntries(updated);
  };

  const handleNoShow = (id: string) => {
    const updated = updateWaitlistEntry(id, { status: 'no_show' });
    setEntries(updated);
  };

  const handleRemove = (id: string) => {
    const updated = removeWaitlistEntry(id);
    setEntries(updated);
  };

  const handleMoveUp = (id: string) => {
    const idx = activeEntries.findIndex(e => e.id === id);
    if (idx <= 0) return;
    const all = loadWaitlist();
    const entry = all.find(e => e.id === id);
    const prev = all.find(e => e.id === activeEntries[idx - 1].id);
    if (entry && prev) {
      const tmpPos = entry.position;
      entry.position = prev.position;
      prev.position = tmpPos;
      saveWaitlist(all);
      setEntries([...all]);
    }
  };

  const handleMoveDown = (id: string) => {
    const idx = activeEntries.findIndex(e => e.id === id);
    if (idx < 0 || idx >= activeEntries.length - 1) return;
    const all = loadWaitlist();
    const entry = all.find(e => e.id === id);
    const next = all.find(e => e.id === activeEntries[idx + 1].id);
    if (entry && next) {
      const tmpPos = entry.position;
      entry.position = next.position;
      next.position = tmpPos;
      saveWaitlist(all);
      setEntries([...all]);
    }
  };

  // Table picker sub-view
  if (seatPickerId) {
    const entry = entries.find(e => e.id === seatPickerId);
    return (
      <div
        className={embedded ? 'absolute inset-0 z-20 flex flex-col' : 'fixed inset-0 z-50 flex flex-col'}
        style={{ background: embedded ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.5)' }}
        onClick={embedded ? () => setSeatPickerId(null) : onClose}
      >
        <div
          className={embedded ? 'm-4 overflow-hidden shadow-2xl max-h-[calc(100%-2rem)] overflow-y-auto' : 'mt-auto rounded-t-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto'}
          style={{ background: '#1a1a2e' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-vilo-border-subtle">
            <h2 className="text-lg font-bold text-white">Tisch zuweisen</h2>
            <button onClick={() => setSeatPickerId(null)} className="p-1 text-vilo-text-secondary hover:text-vilo-text-primary">
              <IconX className="w-6 h-6" />
            </button>
          </div>

          {entry && (
            <div className="px-5 py-3 border-b border-vilo-border-subtle" style={{ background: '#1a1a2e' }}>
              <p className="text-base font-bold text-white">{entry.guestName}</p>
              <p className="text-sm text-vilo-text-secondary">{entry.partySize} {entry.partySize === 1 ? 'Person' : 'Personen'}{entry.seatPreference ? ` · ${entry.seatPreference}` : ''}</p>
            </div>
          )}

          <div className="px-5 py-4">
            {freeTables.length === 0 ? (
              <div className="text-center py-8">
                <IconAlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-vilo-text-secondary font-medium">Keine freien Tische verfuegbar</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {freeTables.map(t => (
                  <button key={t.id} onClick={() => handleSeat(seatPickerId, t.id)}
                    className="flex flex-col items-center justify-center py-4 px-3 rounded-xl border-2 border-vilo-border-strong hover:border-[#7bb7ef] hover:bg-[#7bb7ef]/20 active:bg-purple-900/50 transition-colors">
                    <span className="text-base font-bold text-white">{t.name}</span>
                    <span className="text-xs text-vilo-text-secondary">{t.seats || 4} Plaetze</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Add form sub-view
  if (showAddForm) {
    return (
      <div
        className={embedded ? 'h-full min-h-0 flex flex-col' : 'fixed inset-0 z-50 flex flex-col'}
        style={{ background: embedded ? '#1f1e33' : 'rgba(0,0,0,0.5)' }}
        onClick={embedded ? undefined : requestClose}
      >
        <div
          className={
            (embedded ? 'h-full min-h-0 overflow-y-auto ' : 'mt-auto rounded-t-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto ') +
            (isClosing ? 'vilo-panel-exit' : 'vilo-panel-enter')
          }
          style={{ background: '#1a1a2e' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.03]">
            <button onClick={() => setShowAddForm(false)} className="p-1 text-vilo-text-secondary hover:text-vilo-text-primary transition-colors">
              <IconChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-white">Warteliste</h2>
            <button onClick={() => setShowAddForm(false)} className="p-1 text-vilo-text-secondary hover:text-vilo-text-primary transition-colors">
              <IconX className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 py-4 space-y-5">
            {/* Name */}
            <div>
              <label className="text-xs font-bold text-vilo-text-secondary uppercase tracking-[0.18em] mb-2 block">Gastname *</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Name eingeben"
                className="w-full border border-transparent rounded-xl px-4 py-4 text-white text-base outline-none focus:border-[#8b5cf6] bg-vilo-card placeholder:text-vilo-text-muted"
                autoFocus />
            </div>

            {/* Phone */}
            <div>
              <label className="text-xs font-bold text-vilo-text-secondary uppercase tracking-[0.18em] mb-2 block">Telefon (für Benachrichtigung)</label>
              <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)}
                placeholder="+49 ..."
                className="w-full border border-transparent rounded-xl px-4 py-4 text-white text-base outline-none focus:border-[#8b5cf6] bg-vilo-card placeholder:text-vilo-text-muted" />
            </div>

            {/* Party Size */}
            <div>
              <label className="text-xs font-bold text-vilo-text-secondary uppercase tracking-[0.18em] mb-2 block">Personenzahl</label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <button key={n} onClick={() => {
                    setNewPartySize(n);
                    setNewWaitMinutes(estimateWait(n));
                  }}
                    className={'aspect-square w-full text-[18px] font-bold transition-colors ' +
                      (newPartySize === n
                        ? 'bg-[#d946ef] text-white'
                        : 'bg-[#2d2b48] text-vilo-text-soft hover:bg-[#353253]')}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Estimated Wait */}
            <div>
              <label className="text-xs font-bold text-vilo-text-secondary uppercase tracking-[0.18em] mb-2 block">Geschaetzte Wartezeit</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setNewWaitMinutes(Math.max(5, newWaitMinutes - 5))}
                  className="w-14 h-14 bg-[#2d2b48] text-vilo-text-soft font-bold text-[28px] hover:bg-[#353253]">−</button>
                <span className="text-[18px] font-bold text-white w-24 text-center">{newWaitMinutes}<span className="text-sm text-vilo-text-secondary ml-1">Min.</span></span>
                <button onClick={() => setNewWaitMinutes(Math.min(120, newWaitMinutes + 5))}
                  className="w-14 h-14 bg-[#2d2b48] text-vilo-text-soft font-bold text-[28px] hover:bg-[#353253]">+</button>
              </div>
              {freeTables.length > 0 && (
                <p className="text-sm text-[#d8c7ff] mt-2">
                  {freeTables.length} {freeTables.length === 1 ? 'Tisch' : 'Tische'} frei – kurze Wartezeit
                </p>
              )}
            </div>

            {/* Seat Preference */}
            <div>
              <label className="text-xs font-bold text-vilo-text-secondary uppercase tracking-[0.18em] mb-2 block">Sitzplatz-Praeferenz</label>
              <div className="grid grid-cols-2 gap-2">
                {SEAT_PREFERENCES.map(p => (
                  <button key={p.value} onClick={() => setNewPreference(p.value)}
                    className={'px-3 py-3 rounded-xl text-sm font-medium transition-colors ' +
                      (newPreference === p.value
                        ? 'bg-[#8b5cf6] text-white'
                        : 'bg-[#2d2b48] text-vilo-text-secondary hover:bg-[#353253]')}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-bold text-vilo-text-secondary uppercase tracking-[0.18em] mb-2 block">Notizen</label>
              <input type="text" value={newNotes} onChange={e => setNewNotes(e.target.value)}
                placeholder="z.B. Allergien, Kinderstuhl, VIP..."
                className="w-full border border-transparent rounded-xl px-4 py-4 text-white text-base outline-none focus:border-[#8b5cf6] bg-vilo-card placeholder:text-vilo-text-muted" />
            </div>

            {/* Submit */}
            <button onClick={handleAddEntry} disabled={!newName.trim()}
              className={'w-full py-4 text-white font-bold text-base transition-colors ' +
                (newName.trim() ? 'bg-[#8b5cf6] hover:brightness-110 active:bg-[#7c3aed]' : 'bg-vilo-elevated cursor-not-allowed')}>
              Warteliste
            </button>
          </div>

          <div className="pb-20" />
        </div>
      </div>
    );
  }

  // Main waitlist view
  return (
    <div
      className={embedded ? 'h-full min-h-0 flex flex-col' : 'fixed inset-0 z-50 flex flex-col'}
      style={{ background: embedded ? '#1f1e33' : 'rgba(0,0,0,0.5)' }}
      onClick={embedded ? undefined : requestClose}
    >
      <div
        className={
          (embedded ? 'h-full min-h-0 flex flex-col overflow-hidden ' : 'mt-auto rounded-t-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col ') +
          (isClosing ? 'vilo-panel-exit' : 'vilo-panel-enter')
        }
        style={{ background: '#1a1a2e' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.03] shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white">Warteliste</h2>
            {activeEntries.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold text-white" style={{ background: '#d946ef' }}>
                {activeEntries.length}
              </span>
            )}
          </div>
          <button onClick={requestClose} className="p-1 text-vilo-text-secondary hover:text-vilo-text-primary transition-colors">
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Summary bar */}
        <div className="px-4 py-2 border-b border-white/[0.03] flex items-center justify-between gap-3" style={{ background: '#1a1a2e' }}>
          <div className="min-w-0 flex-1">
            <span className="block whitespace-nowrap text-[12px] font-medium text-vilo-text-secondary">{activeEntries.length} wartend</span>
          </div>
          <div className="min-w-0 flex-1 text-center">
            <span className="block whitespace-nowrap text-[12px] font-medium text-vilo-text-secondary">
              ~{activeEntries.length > 0
                ? Math.round(activeEntries.reduce((sum, e) => sum + e.estimatedWaitMinutes, 0) / activeEntries.length)
                : 0} Min. Ø
            </span>
          </div>
          <div className="min-w-0 flex-1 text-right">
            <span className="block whitespace-nowrap text-[12px] font-medium text-vilo-text-secondary">{freeTables.length} Tische frei</span>
          </div>
        </div>

        {/* Entries list */}
        <div className="flex-1 overflow-y-auto">
          {activeEntries.length === 0 && seatedEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-5">
                <IconUsers className="w-12 h-12 text-[#777] mb-3" />
                <p className="text-lg font-semibold text-vilo-text-muted">Warteliste ist leer</p>
                <p className="text-sm text-vilo-text-muted mt-1 text-center">
                  Tippe auf "Hinzufügen" um Gäste auf die Warteliste zu setzen
                </p>
            </div>
          ) : (
            <>
              {/* Active entries */}
              {activeEntries.map((entry, idx) => {
                const elapsed = Math.floor((Date.now() - entry.addedAt) / 60000);
                const isOverdue = elapsed > entry.estimatedWaitMinutes;
                const isExpanded = expandedId === entry.id;
                const waitColor = getWaitColor(elapsed);

                return (
                  <div key={entry.id} className={'border-b border-white/[0.03] ' + (isOverdue ? 'bg-[#32153a]' : '')}>
                    <button className="w-full px-4 py-3 flex items-center gap-3 text-left"
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}>
                      {/* Position */}
                      <div className="w-9 h-9 flex items-center justify-center shrink-0 text-sm font-bold text-white"
                        style={{ background: entry.status === 'notified' ? '#d946ef' : '#8b5cf6' }}>
                        {idx + 1}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white text-[15px] truncate">{entry.guestName}</p>
                          {entry.status === 'notified' && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#5b216f] text-[#f5d0fe]">BENACHRICHTIGT</span>
                          )}
                          {isOverdue && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#4a1733] text-[#f9a8d4]">UEBERFAELLIG</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[13px] text-vilo-text-secondary">{entry.partySize} Pers.</span>
                          {entry.seatPreference && (
                            <span className="text-[13px] text-vilo-text-secondary">· {entry.seatPreference}</span>
                          )}
                          {entry.guestPhone && (
                            <IconPhone className="w-3 h-3 text-vilo-text-secondary" />
                          )}
                        </div>
                      </div>

                      {/* Wait time */}
                      <div className="text-right shrink-0">
                        <p className="text-[15px] font-bold" style={{ color: waitColor }}>{getElapsed(entry.addedAt)}</p>
                        <p className="text-[11px] text-vilo-text-secondary">~{entry.estimatedWaitMinutes} Min.</p>
                      </div>
                    </button>

                    {/* Expanded actions */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-2">
                        {entry.notes && (
                          <div className="flex items-start gap-2 py-2 px-3 bg-vilo-surface">
                            <IconMessage className="w-4 h-4 text-vilo-text-muted shrink-0 mt-0.5" />
                            <p className="text-sm text-vilo-text-secondary">{entry.notes}</p>
                          </div>
                        )}

                        <div className="flex gap-2 flex-wrap">
                          {/* Seat button */}
                          <button onClick={() => setSeatPickerId(entry.id)}
                            className="flex-1 flex items-center justify-center gap-2 py-3 px-3 text-white font-semibold text-sm"
                            style={{ background: '#8b5cf6' }}>
                            <IconUserCheck className="w-4 h-4" />
                            Platzieren
                          </button>

                          {/* Notify button */}
                          {entry.status === 'waiting' && entry.guestPhone && (
                            <button onClick={() => handleNotify(entry.id)}
                              className="flex items-center justify-center gap-2 py-3 px-4 bg-[#2b2944] text-[#d8c7ff] font-semibold text-sm hover:bg-[#353253]">
                              <IconBell className="w-4 h-4" />
                              Benachrichtigen
                            </button>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {/* Move up/down */}
                          {idx > 0 && (
                            <button onClick={() => handleMoveUp(entry.id)}
                              className="flex items-center gap-1 py-2 px-3 rounded-lg border border-vilo-border-strong text-vilo-text-secondary text-sm hover:bg-vilo-surface">
                              <IconChevronUp className="w-4 h-4" /> Hoch
                            </button>
                          )}
                          {idx < activeEntries.length - 1 && (
                            <button onClick={() => handleMoveDown(entry.id)}
                              className="flex items-center gap-1 py-2 px-3 rounded-lg border border-vilo-border-strong text-vilo-text-secondary text-sm hover:bg-vilo-surface">
                              <IconChevronDown className="w-4 h-4" /> Runter
                            </button>
                          )}

                          <div className="flex-1" />

                          {/* No Show */}
                          <button onClick={() => handleNoShow(entry.id)}
                            className="flex items-center gap-1 py-2 px-3 bg-[#2b2944] text-[#f5d0fe] text-sm hover:bg-[#353253]">
                            <IconAlertTriangle className="w-3.5 h-3.5" /> No-Show
                          </button>

                          {/* Cancel */}
                          <button onClick={() => handleCancel(entry.id)}
                            className="flex items-center gap-1 py-2 px-3 bg-[#2b2944] text-[#f5d0fe] text-sm hover:bg-[#353253]">
                            <IconCircleX className="w-3.5 h-3.5" /> Stornieren
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Recently seated section */}
              {seatedEntries.length > 0 && (
                <>
                  <div className="px-5 py-2.5 border-t border-white/[0.03]" style={{ background: '#1a1a2e' }}>
                    <p className="text-xs font-bold text-vilo-text-muted uppercase tracking-wider">Kuerzlich platziert</p>
                  </div>
                  {seatedEntries.map(entry => {
                    const table = tables.find(t => t.id === entry.assignedTableId);
                    return (
                      <SeatedWaitlistRow
                        key={entry.id}
                        entry={entry}
                        tableLabel={table?.name || 'Tisch'}
                        elapsedLabel={entry.seatedAt ? getElapsed(entry.seatedAt) : ''}
                        onDelete={() => handleRemove(entry.id)}
                      />
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-white/[0.03] p-3" style={{ background: '#1d1c31' }}>
          <button
            onClick={() => {
              setNewWaitMinutes(estimateWait(2));
              setShowAddForm(true);
            }}
            className="w-full py-3 text-[14px] font-semibold text-white transition-colors hover:brightness-110"
            style={{ background: '#d946ef' }}
          >
            Warteliste hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}
