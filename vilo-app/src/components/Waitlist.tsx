import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Users, Clock, Phone, MessageSquare, Check, ChevronDown, ChevronUp, AlertTriangle, UserCheck, XCircle, Bell } from 'lucide-react';
import { WaitlistEntry, Table } from '../types';
import { loadWaitlist, saveWaitlist, addWaitlistEntry, updateWaitlistEntry, removeWaitlistEntry } from '../utils/storage';

interface WaitlistPanelProps {
  onClose: () => void;
  onSeatGuest: (tableId: string) => void;
  tables: Table[];
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
  if (minutes <= 10) return '#10b981'; // green
  if (minutes <= 20) return '#f59e0b'; // amber
  if (minutes <= 30) return '#f97316'; // orange
  return '#ef4444'; // red
}

const SEAT_PREFERENCES = [
  { value: '', label: 'Keine Praeferenz' },
  { value: 'innen', label: 'Innen' },
  { value: 'terrasse', label: 'Terrasse' },
  { value: 'bar', label: 'Bar' },
  { value: 'fenster', label: 'Fensterplatz' },
  { value: 'ruhig', label: 'Ruhiger Tisch' },
];

export function WaitlistPanel({ onClose, onSeatGuest, tables }: WaitlistPanelProps) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [seatPickerId, setSeatPickerId] = useState<string | null>(null);

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
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
        <div className="mt-auto rounded-t-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto" style={{ background: '#1a1a2e' }} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#333355]">
            <h2 className="text-lg font-bold text-white">Tisch zuweisen</h2>
            <button onClick={() => setSeatPickerId(null)} className="p-1 text-[#b0b0cc] hover:text-[#e0e0f0]">
              <X className="w-6 h-6" />
            </button>
          </div>

          {entry && (
            <div className="px-5 py-3 border-b border-[#333355]" style={{ background: '#1a1a2e' }}>
              <p className="text-base font-bold text-white">{entry.guestName}</p>
              <p className="text-sm text-[#b0b0cc]">{entry.partySize} {entry.partySize === 1 ? 'Person' : 'Personen'}{entry.seatPreference ? ` · ${entry.seatPreference}` : ''}</p>
            </div>
          )}

          <div className="px-5 py-4">
            {freeTables.length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-[#b0b0cc] font-medium">Keine freien Tische verfuegbar</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {freeTables.map(t => (
                  <button key={t.id} onClick={() => handleSeat(seatPickerId, t.id)}
                    className="flex flex-col items-center justify-center py-4 px-3 rounded-xl border-2 border-[#3d3d5c] hover:border-[#7bb7ef] hover:bg-[#7bb7ef]/20 active:bg-purple-900/50 transition-colors">
                    <span className="text-base font-bold text-white">{t.name}</span>
                    <span className="text-xs text-[#b0b0cc]">{t.seats || 4} Plaetze</span>
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
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
        <div className="mt-auto rounded-t-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto" style={{ background: '#1a1a2e' }} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#333355]">
            <h2 className="text-lg font-bold text-white">Zur Warteliste hinzufuegen</h2>
            <button onClick={() => setShowAddForm(false)} className="p-1 text-[#b0b0cc] hover:text-[#e0e0f0]">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Name */}
            <div>
              <label className="text-xs font-bold text-[#b0b0cc] uppercase tracking-wider mb-1 block">Gastname *</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Name eingeben"
                className="w-full border border-[#3d3d5c] rounded-xl px-4 py-3 text-white text-base outline-none focus:border-[#7bb7ef] focus:ring-1 focus:ring-[#7bb7ef] bg-[#2a2a42] placeholder:text-[#8888aa]"
                autoFocus />
            </div>

            {/* Phone */}
            <div>
              <label className="text-xs font-bold text-[#b0b0cc] uppercase tracking-wider mb-1 block">Telefon (für Benachrichtigung)</label>
              <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)}
                placeholder="+49 ..."
                className="w-full border border-[#3d3d5c] rounded-xl px-4 py-3 text-white text-base outline-none focus:border-[#7bb7ef] focus:ring-1 focus:ring-[#7bb7ef] bg-[#2a2a42] placeholder:text-[#8888aa]" />
            </div>

            {/* Party Size */}
            <div>
              <label className="text-xs font-bold text-[#b0b0cc] uppercase tracking-wider mb-1 block">Personenzahl</label>
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <button key={n} onClick={() => {
                    setNewPartySize(n);
                    setNewWaitMinutes(estimateWait(n));
                  }}
                    className={'w-12 h-12 rounded-xl border-2 text-base font-bold transition-colors ' +
                      (newPartySize === n
                        ? 'border-[#7bb7ef] bg-[#7bb7ef] text-white'
                        : 'border-[#3d3d5c] text-[#c0c0dd] hover:border-[#7bb7ef]')}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Estimated Wait */}
            <div>
              <label className="text-xs font-bold text-[#b0b0cc] uppercase tracking-wider mb-1 block">Geschaetzte Wartezeit</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setNewWaitMinutes(Math.max(5, newWaitMinutes - 5))}
                  className="w-10 h-10 rounded-lg border border-[#3d3d5c] text-[#c0c0dd] font-bold text-lg hover:bg-[#2a2a42]">−</button>
                <span className="text-2xl font-bold text-white w-20 text-center">{newWaitMinutes}<span className="text-sm text-[#b0b0cc] ml-1">Min.</span></span>
                <button onClick={() => setNewWaitMinutes(Math.min(120, newWaitMinutes + 5))}
                  className="w-10 h-10 rounded-lg border border-[#3d3d5c] text-[#c0c0dd] font-bold text-lg hover:bg-[#2a2a42]">+</button>
              </div>
              {freeTables.length > 0 && (
                <p className="text-xs text-purple-400 mt-1">
                  {freeTables.length} {freeTables.length === 1 ? 'Tisch' : 'Tische'} frei – kurze Wartezeit
                </p>
              )}
            </div>

            {/* Seat Preference */}
            <div>
              <label className="text-xs font-bold text-[#b0b0cc] uppercase tracking-wider mb-1 block">Sitzplatz-Praeferenz</label>
              <div className="flex gap-2 flex-wrap">
                {SEAT_PREFERENCES.map(p => (
                  <button key={p.value} onClick={() => setNewPreference(p.value)}
                    className={'px-3 py-2 rounded-lg border text-sm font-medium transition-colors ' +
                      (newPreference === p.value
                        ? 'border-[#7bb7ef] bg-[#7bb7ef]/20 text-[#7bb7ef]'
                        : 'border-[#3d3d5c] text-[#b0b0cc] hover:border-[#5a5a5a]')}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-bold text-[#b0b0cc] uppercase tracking-wider mb-1 block">Notizen</label>
              <input type="text" value={newNotes} onChange={e => setNewNotes(e.target.value)}
                placeholder="z.B. Allergien, Kinderstuhl, VIP..."
                className="w-full border border-[#3d3d5c] rounded-xl px-4 py-3 text-white text-base outline-none focus:border-[#7bb7ef] focus:ring-1 focus:ring-[#7bb7ef] bg-[#2a2a42] placeholder:text-[#8888aa]" />
            </div>

            {/* Submit */}
            <button onClick={handleAddEntry} disabled={!newName.trim()}
              className={'w-full py-4 rounded-xl text-white font-bold text-base transition-colors ' +
                (newName.trim() ? 'bg-[#7bb7ef] hover:bg-[#5d9edb] active:bg-purple-700' : 'bg-[#353558] cursor-not-allowed')}>
              Zur Warteliste hinzufuegen
            </button>
          </div>

          <div className="pb-20" />
        </div>
      </div>
    );
  }

  // Main waitlist view
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="mt-auto rounded-t-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col" style={{ background: '#1a1a2e' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#333355] shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white">Warteliste</h2>
            {activeEntries.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: '#7c3aed' }}>
                {activeEntries.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => {
              setNewWaitMinutes(estimateWait(2));
              setShowAddForm(true);
            }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white font-semibold text-sm"
              style={{ background: '#7c3aed' }}>
              <Plus className="w-4 h-4" />
              Hinzufuegen
            </button>
            <button onClick={onClose} className="p-1 text-[#b0b0cc] hover:text-[#e0e0f0]">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Summary bar */}
        <div className="px-5 py-2.5 border-b border-[#333355] flex items-center gap-4" style={{ background: '#1a1a2e' }}>
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#8888aa]" />
            <span className="text-sm font-medium text-[#b0b0cc]">{activeEntries.length} wartend</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#8888aa]" />
            <span className="text-sm font-medium text-[#b0b0cc]">
              ~{activeEntries.length > 0
                ? Math.round(activeEntries.reduce((sum, e) => sum + e.estimatedWaitMinutes, 0) / activeEntries.length)
                : 0} Min. Ø
            </span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium text-[#b0b0cc]">{freeTables.length} Tische frei</span>
          </div>
        </div>

        {/* Entries list */}
        <div className="flex-1 overflow-y-auto">
          {activeEntries.length === 0 && seatedEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-5">
              <Users className="w-12 h-12 text-[#777] mb-3" />
              <p className="text-lg font-semibold text-[#8888aa]">Warteliste ist leer</p>
              <p className="text-sm text-[#8888aa] mt-1 text-center">
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
                  <div key={entry.id} className={'border-b border-[#333355]/50 ' + (isOverdue ? 'bg-red-900/20' : '')}>
                    <button className="w-full px-5 py-3.5 flex items-center gap-3 text-left"
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}>
                      {/* Position */}
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-white"
                        style={{ background: entry.status === 'notified' ? '#8b5cf6' : '#64748b' }}>
                        {idx + 1}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white text-base truncate">{entry.guestName}</p>
                          {entry.status === 'notified' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-900/40 text-[#b1d9ff]">BENACHRICHTIGT</span>
                          )}
                          {isOverdue && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-900/40 text-red-300">UEBERFAELLIG</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-sm text-[#b0b0cc]">{entry.partySize} Pers.</span>
                          {entry.seatPreference && (
                            <span className="text-sm text-[#b0b0cc]">· {entry.seatPreference}</span>
                          )}
                          {entry.guestPhone && (
                            <Phone className="w-3 h-3 text-[#b0b0cc]" />
                          )}
                        </div>
                      </div>

                      {/* Wait time */}
                      <div className="text-right shrink-0">
                        <p className="text-base font-bold" style={{ color: waitColor }}>{getElapsed(entry.addedAt)}</p>
                        <p className="text-xs text-[#b0b0cc]">~{entry.estimatedWaitMinutes} Min.</p>
                      </div>
                    </button>

                    {/* Expanded actions */}
                    {isExpanded && (
                      <div className="px-5 pb-4 space-y-2">
                        {entry.notes && (
                          <div className="flex items-start gap-2 py-2 px-3 rounded-lg bg-[#2a2a42]">
                            <MessageSquare className="w-4 h-4 text-[#8888aa] shrink-0 mt-0.5" />
                            <p className="text-sm text-[#b0b0cc]">{entry.notes}</p>
                          </div>
                        )}

                        <div className="flex gap-2 flex-wrap">
                          {/* Seat button */}
                          <button onClick={() => setSeatPickerId(entry.id)}
                            className="flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-white font-semibold text-sm"
                            style={{ background: '#7c3aed' }}>
                            <UserCheck className="w-4 h-4" />
                            Platzieren
                          </button>

                          {/* Notify button */}
                          {entry.status === 'waiting' && entry.guestPhone && (
                            <button onClick={() => handleNotify(entry.id)}
                              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-violet-500 text-[#b1d9ff] font-semibold text-sm hover:bg-violet-900/30">
                              <Bell className="w-4 h-4" />
                              Benachrichtigen
                            </button>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {/* Move up/down */}
                          {idx > 0 && (
                            <button onClick={() => handleMoveUp(entry.id)}
                              className="flex items-center gap-1 py-2 px-3 rounded-lg border border-[#3d3d5c] text-[#b0b0cc] text-sm hover:bg-[#2a2a42]">
                              <ChevronUp className="w-4 h-4" /> Hoch
                            </button>
                          )}
                          {idx < activeEntries.length - 1 && (
                            <button onClick={() => handleMoveDown(entry.id)}
                              className="flex items-center gap-1 py-2 px-3 rounded-lg border border-[#3d3d5c] text-[#b0b0cc] text-sm hover:bg-[#2a2a42]">
                              <ChevronDown className="w-4 h-4" /> Runter
                            </button>
                          )}

                          <div className="flex-1" />

                          {/* No Show */}
                          <button onClick={() => handleNoShow(entry.id)}
                            className="flex items-center gap-1 py-2 px-3 rounded-lg border border-amber-700 text-amber-400 text-sm hover:bg-amber-900/30">
                            <AlertTriangle className="w-3.5 h-3.5" /> No-Show
                          </button>

                          {/* Cancel */}
                          <button onClick={() => handleCancel(entry.id)}
                            className="flex items-center gap-1 py-2 px-3 rounded-lg border border-red-700 text-red-400 text-sm hover:bg-red-900/30">
                            <XCircle className="w-3.5 h-3.5" /> Stornieren
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
                  <div className="px-5 py-2.5" style={{ background: '#1a1a2e' }}>
                    <p className="text-xs font-bold text-[#8888aa] uppercase tracking-wider">Kuerzlich platziert</p>
                  </div>
                  {seatedEntries.map(entry => {
                    const table = tables.find(t => t.id === entry.assignedTableId);
                    return (
                      <div key={entry.id} className="px-5 py-3 border-b border-[#333355]/50 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-900/40 flex items-center justify-center shrink-0">
                          <Check className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#c0c0dd] truncate">{entry.guestName}</p>
                          <p className="text-xs text-[#8888aa]">{entry.partySize} Pers. · {table?.name || 'Tisch'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-emerald-400 font-medium">Platziert</p>
                          <p className="text-xs text-[#b0b0cc]">{entry.seatedAt ? getElapsed(entry.seatedAt) : ''}</p>
                        </div>
                        <button onClick={() => handleRemove(entry.id)} className="p-1 text-[#777] hover:text-[#b0b0cc]">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>

        {/* Safe area padding for bottom nav */}
        <div className="pb-20" />
      </div>
    </div>
  );
}
