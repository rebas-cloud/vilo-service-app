import { useState, useMemo, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, UserPlus, Ban, RotateCcw, ArrowRightLeft, CheckCircle2, UtensilsCrossed, CalendarCheck, AlertTriangle, Users, User, Check, Search } from 'lucide-react';
import { Table, Reservation, Guest } from '../types';
import { useApp } from '../context/AppContext';
import { loadReservations, addReservation, findGuestByPhone, addGuest, loadGuests } from '../utils/storage';

// Service status info for display
const SERVICE_STATUS_INFO: Record<string, { label: string; color: string }> = {
  teilweise_platziert: { label: 'Teilw. platziert', color: '#a78bfa' },
  platziert: { label: 'Platziert', color: '#c084fc' },
  getraenke: { label: 'Getränke', color: '#60a5fa' },
  vorspeise: { label: 'Vorspeise', color: '#34d399' },
  hauptgericht: { label: 'Hauptgericht', color: '#fbbf24' },
  dessert: { label: 'Dessert', color: '#f472b6' },
  gang_1: { label: '1.Gang', color: '#34d399' }, gang_2: { label: '2.Gang', color: '#34d399' },
  gang_3: { label: '3.Gang', color: '#fbbf24' }, gang_4: { label: '4.Gang', color: '#fbbf24' },
  gang_5: { label: '5.Gang', color: '#f472b6' }, gang_6: { label: '6.Gang', color: '#f472b6' },
  gang_7: { label: '7.Gang', color: '#a78bfa' }, gang_8: { label: '8.Gang', color: '#a78bfa' },
  gang_9: { label: '9.Gang', color: '#60a5fa' }, gang_10: { label: '10.Gang', color: '#60a5fa' },
  gang_11: { label: '11.Gang', color: '#818cf8' }, gang_12: { label: '12.Gang', color: '#818cf8' },
  digestif: { label: 'Digestif', color: '#c084fc' },
  flaschenservice: { label: 'Flasche', color: '#f59e0b' },
  rechnung_faellig: { label: 'Rechnung', color: '#ef4444' },
  bezahlt: { label: 'Bezahlt', color: '#22c55e' },
  restaurantleiter: { label: 'Manager!', color: '#ef4444' },
  abraeumen: { label: 'Abraeumen', color: '#f97316' },
  abgeraeumt: { label: 'Abgeraeumt', color: '#6b7280' },
  beendet: { label: 'Beendet', color: '#6b7280' },
};

interface TableManagementProps {
  table: Table;
  onClose: () => void;
  onOpenTableDetail: (tableId: string) => void;
  onReserve: (tableId: string) => void;
  allTables: Table[];
}

type SubView = 'main' | 'walkin_count' | 'move_picker' | 'reserve_confirm' | 'reserve_wizard';
type ReserveStep = 'guests' | 'guest_info';

function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

function getTodayStr(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function TableManagement({ table, onClose, onOpenTableDetail, onReserve: _onReserve, allTables }: TableManagementProps) {
  void _onReserve; // kept for interface compatibility
  const { state, dispatch } = useApp();
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [subView, setSubView] = useState<SubView>('main');
  const [walkinGuestName, setWalkinGuestName] = useState('');
  const [reservations, setReservations] = useState<Reservation[]>([]);

  // Reservation wizard state
  const [reserveStep, setReserveStep] = useState<ReserveStep>('guests');
  const [resFormData, setResFormData] = useState({
    guestName: '', guestPhone: '', partySize: 2, time: '19:00', duration: 90, notes: '', source: 'phone' as 'phone' | 'online' | 'walk_in', guestId: '',
  });
  const [resGuestSearch, setResGuestSearch] = useState('');
  const [resSearchResults, setResSearchResults] = useState<Guest[]>([]);
  const [resMatchedGuest, setResMatchedGuest] = useState<Guest | null>(null);
  const [resGuests, setResGuests] = useState<Guest[]>([]);

  // Load guests for wizard
  useEffect(() => {
    if (subView === 'reserve_wizard') {
      setResGuests(loadGuests());
    }
  }, [subView]);

  const handleResGuestSearch = (query: string) => {
    setResGuestSearch(query);
    if (query.length < 2) { setResSearchResults([]); return; }
    const q = query.toLowerCase().replace(/\s+/g, '');
    setResSearchResults(resGuests.filter(g => {
      const nm = g.name.toLowerCase().replace(/\s+/g, '').includes(q);
      const pm = g.phone ? g.phone.replace(/\s+/g, '').includes(q) : false;
      return nm || pm;
    }));
  };

  const handleResSelectGuest = (guest: Guest) => {
    setResMatchedGuest(guest);
    setResFormData(prev => ({ ...prev, guestName: guest.name, guestPhone: guest.phone || '', guestId: guest.id }));
    setResGuestSearch('');
    setResSearchResults([]);
  };

  const handleResPhoneChange = (phone: string) => {
    setResFormData(prev => ({ ...prev, guestPhone: phone }));
    if (phone.length >= 6) {
      const found = findGuestByPhone(phone);
      if (found) {
        setResMatchedGuest(found);
        setResFormData(prev => ({ ...prev, guestName: prev.guestName || found.name, guestId: found.id }));
      } else {
        setResMatchedGuest(null);
        setResFormData(prev => ({ ...prev, guestId: '' }));
      }
    } else {
      setResMatchedGuest(null);
      setResFormData(prev => ({ ...prev, guestId: '' }));
    }
  };

  const handleResSave = () => {
    if (!resFormData.guestName.trim()) return;
    let guestId = resFormData.guestId;
    if (!guestId && resFormData.guestPhone.trim()) {
      const existing = findGuestByPhone(resFormData.guestPhone.trim());
      if (existing) { guestId = existing.id; }
      else {
        const newGuest: Guest = { id: generateId(), name: resFormData.guestName.trim(), phone: resFormData.guestPhone.trim(), tags: [], notes: [], visits: [], totalVisits: 0, totalSpend: 0, createdAt: Date.now() };
        addGuest(newGuest);
        guestId = newGuest.id;
      }
    }
    const todayStr2 = getTodayStr();
    const newRes: Reservation = {
      id: generateId(), guestName: resFormData.guestName.trim(), guestPhone: resFormData.guestPhone.trim() || undefined,
      partySize: resFormData.partySize, date: todayStr2, time: resFormData.time, duration: resFormData.duration,
      tableId: table.id, notes: resFormData.notes.trim() || undefined, status: 'confirmed', source: resFormData.source, createdAt: Date.now(),
    };
    addReservation(newRes);
    onClose();
  };

  const resetResForm = () => {
    setResFormData({ guestName: '', guestPhone: '', partySize: 2, time: '19:00', duration: 90, notes: '', source: 'phone', guestId: '' });
    setReserveStep('guests');
    setResGuestSearch('');
    setResSearchResults([]);
    setResMatchedGuest(null);
  };

  const session = state.sessions[table.id];
  const isOccupied = table.status === 'occupied' || table.status === 'billing';
  const isBlocked = table.status === 'blocked';
  const isFree = table.status === 'free';

  // Load reservations
  useEffect(() => {
    setReservations(loadReservations());
  }, []);

  // Get today's reservations for this table
  const todayStr = useMemo(() => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }, []);

  const tableReservations = useMemo(() => {
    return reservations
      .filter(r => r.date === todayStr && (r.tableId === table.id || (r.tableIds && r.tableIds.includes(table.id))) && (r.status === 'confirmed' || r.status === 'seated'))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [reservations, todayStr, table.id]);

  // Find currently seated reservation for this table (any seated status)
  const seatedReservation = useMemo(() => {
    const seatedStatuses = ['seated', 'partially_seated', 'appetizer', 'entree', 'dessert', 'cleared', 'check_dropped', 'paid', 'bussing_needed'];
    return reservations.find(r =>
      r.date === todayStr &&
      (r.tableId === table.id || (r.tableIds && r.tableIds.includes(table.id))) &&
      seatedStatuses.includes(r.status)
    ) || null;
  }, [reservations, todayStr, table.id]);

  // Get seated duration from reservation time
  const getSeatedDuration = (r: Reservation): string => {
    const [rh, rm] = r.time.split(':').map(Number);
    const now = new Date();
    const seated = new Date(now);
    seated.setHours(rh, rm, 0, 0);
    const diffMs = now.getTime() - seated.getTime();
    if (diffMs < 0) return '';
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    return hours > 0 ? hours + 'h ' + mins + 'm' : mins + 'm';
  };

  // All today's reservations (for timeline)
  const allTodayReservations = useMemo(() => {
    return reservations
      .filter(r => r.date === todayStr && r.tableId === table.id && r.status !== 'cancelled')
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [reservations, todayStr, table.id]);

  // Next upcoming reservation
  const nextReservation = useMemo(() => {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return tableReservations.find(r => {
      const [h, m] = r.time.split(':').map(Number);
      return h * 60 + m > nowMin && r.status === 'confirmed';
    });
  }, [tableReservations]);

  // Check if there's a conflict (reservation exists for a free table being seated)
  const hasConflict = useMemo(() => {
    if (!isFree) return false;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return tableReservations.some(r => {
      const [h, m] = r.time.split(':').map(Number);
      const resMin = h * 60 + m;
      // Conflict if reservation is within next 60 minutes or past but not seated
      return r.status === 'confirmed' && Math.abs(resMin - nowMin) < 60;
    });
  }, [isFree, tableReservations]);

  const conflictReservation = useMemo(() => {
    if (!hasConflict) return null;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return tableReservations.find(r => {
      const [h, m] = r.time.split(':').map(Number);
      const resMin = h * 60 + m;
      return r.status === 'confirmed' && Math.abs(resMin - nowMin) < 60;
    }) || null;
  }, [hasConflict, tableReservations]);

  // Get elapsed time
  const getElapsedStr = () => {
    if (!session) return '';
    const diff = Date.now() - session.startTime;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '< 1Min.';
    if (mins < 60) return mins + 'Min.';
    return Math.floor(mins / 60) + 'Std. ' + (mins % 60) + 'Min.';
  };

  // Current hour for timeline
  const currentHour = new Date().getHours();

  // Timeline hours (show from current-2 to current+8)
  const timelineHours = useMemo(() => {
    const start = Math.max(0, currentHour - 2);
    const end = Math.min(24, currentHour + 8);
    const hours = [];
    for (let h = start; h <= end; h++) hours.push(h);
    return hours;
  }, [currentHour]);


  const handleSeatWalkIn = (guestCount: number) => {
    dispatch({ type: 'SET_ACTIVE_TABLE', tableId: table.id });
    dispatch({ type: 'SET_GUEST_SOURCE', tableId: table.id, source: 'walk_in' });
    dispatch({ type: 'SET_GUEST_COUNT', tableId: table.id, guestCount });
    dispatch({ type: 'SET_SERVICE_STATUS', tableId: table.id, serviceStatus: 'platziert' });
    onClose();
  };

  const handleUndoPlacement = () => {
    // Free the table and remove session
    dispatch({ type: 'CLOSE_TABLE', tableId: table.id });
    onClose();
  };

  const handleFinishAndSeatNew = () => {
    // Close current session and open walk-in picker
    dispatch({ type: 'CLOSE_TABLE', tableId: table.id });
    // Now seat new walk-in
    setSubView('walkin_count');
  };

  const handleMoveToTable = (toTableId: string) => {
    dispatch({ type: 'MOVE_TABLE_SESSION', fromTableId: table.id, toTableId });
    onClose();
  };

  const handleBlockTable = () => {
    dispatch({ type: 'BLOCK_TABLE', tableId: table.id });
    onClose();
  };

  const handleUnblockTable = () => {
    dispatch({ type: 'UNBLOCK_TABLE', tableId: table.id });
    onClose();
  };

  const handleCloseTable = () => {
    dispatch({ type: 'CLOSE_TABLE', tableId: table.id });
    onClose();
  };

  const handleOpenOrders = () => {
    dispatch({ type: 'SET_ACTIVE_TABLE', tableId: table.id });
    onOpenTableDetail(table.id);
    onClose();
  };

  // Free tables for move picker
  const freeTables = allTables.filter(t => t.id !== table.id && t.status === 'free');

  // Render timeline bar (compact)
  const renderCompactTimeline = () => {
    return (
      <div className="px-4 py-3" style={{ background: '#2a2a42' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-white tracking-wider">ZEITPLAN</span>
          <button onClick={() => setTimelineExpanded(!timelineExpanded)} className="text-[#b0b0cc] hover:text-[#e0e0f0] transition-colors">
            {timelineExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
        <div className="flex items-end gap-0 overflow-x-auto pb-1">
          {timelineHours.map(h => {
            const hourStr = String(h).padStart(2, '0');
            const hasRes = allTodayReservations.some(r => {
              const [rh] = r.time.split(':').map(Number);
              const endH = rh + Math.ceil((r.duration || 90) / 60);
              return h >= rh && h < endH;
            });
            const isCurrent = h === currentHour;
            const isOccupiedHour = isOccupied && session && h >= new Date(session.startTime).getHours() && h <= currentHour;
            return (
              <div key={h} className="flex flex-col items-center" style={{ minWidth: 32 }}>
                <div className="w-6 rounded-sm mb-1" style={{
                  height: 24,
                  background: isOccupiedHour ? '#7c3aed' : hasRes ? '#991b1b' : '#3d3d5c',
                  opacity: isCurrent ? 1 : 0.6,
                  border: isCurrent ? '2px solid #fff' : '1px solid #6b7280',
                }} />
                <span className={'text-[10px] font-bold ' + (isCurrent ? 'text-white' : 'text-[#8888aa]')}>{hourStr}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render expanded timeline (full day view with reservation blocks)
  const renderExpandedTimeline = () => {
    const hours: number[] = [];
    for (let h = 10; h <= 24; h++) hours.push(h >= 24 ? 0 : h);
    for (let h = 1; h <= 2; h++) hours.push(h);

    return (
      <div className="px-4 py-3" style={{ background: '#2a2a42' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-white tracking-wider">ZEITPLAN</span>
          <button onClick={() => setTimelineExpanded(false)} className="text-[#b0b0cc] hover:text-[#e0e0f0] transition-colors">
            <ChevronUp className="w-5 h-5" />
          </button>
        </div>
        <div className="relative" style={{ minHeight: hours.length * 48 }}>
          {hours.map((h, i) => (
            <div key={i} className="flex items-start" style={{ height: 48 }}>
              <span className="text-sm font-bold text-[#b0b0cc] w-8 shrink-0">{String(h).padStart(2, '0')}</span>
              <div className="flex-1 border-t border-[#3d3d5c] relative" style={{ height: 48 }}>
                {/* Half hour line */}
                <div className="absolute left-0 right-0 border-t border-[#333355]" style={{ top: 24 }} />
              </div>
            </div>
          ))}
          {/* Reservation blocks overlaid */}
          {allTodayReservations.map(r => {
            const [rh, rm] = r.time.split(':').map(Number);
            const startIdx = hours.indexOf(rh);
            if (startIdx === -1) return null;
            const topOffset = startIdx * 48 + (rm / 60) * 48;
            const durationPx = ((r.duration || 90) / 60) * 48;
            const isSeated = r.status === 'seated';
            return (
              <div key={r.id} className="absolute rounded-lg px-2 py-1 overflow-hidden" style={{
                left: 36, right: 8, top: topOffset, height: Math.max(32, durationPx),
                background: isSeated ? '#7c3aed' : '#991b1b',
                zIndex: 5,
              }}>
                <div className="flex items-center justify-between">
                  <span className="text-white text-xs font-bold truncate">{r.guestName.length > 8 ? r.guestName.substring(0, 8) + '...' : r.guestName}</span>
                  <span className="text-white text-xs font-bold ml-1">{r.partySize}</span>
                </div>
              </div>
            );
          })}
          {/* Current session block */}
          {isOccupied && session && (() => {
            const startH = new Date(session.startTime).getHours();
            const startM = new Date(session.startTime).getMinutes();
            const startIdx = hours.indexOf(startH);
            if (startIdx === -1) return null;
            const topOffset = startIdx * 48 + (startM / 60) * 48;
            const nowH = new Date().getHours();
            const nowM = new Date().getMinutes();
            const endIdx = hours.indexOf(nowH);
            const endOffset = endIdx !== -1 ? endIdx * 48 + (nowM / 60) * 48 : topOffset + 48;
            const heightPx = Math.max(32, endOffset - topOffset);
            return (
              <div className="absolute rounded-lg px-2 py-1 overflow-hidden" style={{
                left: 36, right: 60, top: topOffset, height: heightPx,
                background: '#7c3aed', opacity: 0.8, zIndex: 4,
              }}>
                <span className="text-white text-xs font-bold">
                  {session.guestSource === 'walk_in' ? 'Walk-In' : session.guestSource === 'phone' ? 'Tel.' : 'Online'}
                </span>
              </div>
            );
          })()}
        </div>
      </div>
    );
  };

  // Walk-In guest count picker sub-view
  if (subView === 'walkin_count') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
        <div className="mt-auto rounded-t-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto" style={{ background: '#1a1a2e' }} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#333355]">
            <h2 className="text-lg font-bold text-white">Walk-In · {table.name}</h2>
            <button onClick={() => setSubView('main')} className="p-1 text-[#b0b0cc] hover:text-[#e0e0f0]"><X className="w-6 h-6" /></button>
          </div>

          <div className="px-5 py-5 space-y-5">
            {/* Guest count - centered */}
            <div className="text-center">
              <p className="text-[#b0b0cc] text-xs font-semibold uppercase tracking-wider mb-3">Anzahl Gäste wählen</p>
              <div className="flex gap-2.5 justify-center flex-wrap">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <button key={n} onClick={() => handleSeatWalkIn(n)}
                    className="w-12 h-12 rounded-xl border-2 text-base font-bold transition-colors border-[#3d3d5c] text-[#c0c0dd] hover:border-[#7bb7ef] hover:bg-[#7bb7ef]/10 active:bg-[#7bb7ef] active:text-white">
                    {n}
                  </button>
                ))}
              </div>
              <input
                type="number"
                placeholder="Andere Anzahl..."
                min={1}
                className="w-full mt-3 border border-[#3d3d5c] rounded-xl py-2.5 px-4 text-center text-white outline-none focus:border-[#7bb7ef] bg-[#1e1e2e] placeholder:text-[#666688] text-sm"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const val = parseInt((e.target as HTMLInputElement).value);
                    if (val > 0) handleSeatWalkIn(val);
                  }
                }}
              />
            </div>

            {hasConflict && conflictReservation && (
              <p className="text-red-400 font-semibold text-sm text-center">
                {table.name} ist um {conflictReservation.time} anderen Gästen zugewiesen
              </p>
            )}

            {/* Name input - centered */}
            <div className="text-center">
              <p className="text-[#b0b0cc] text-xs font-semibold uppercase tracking-wider mb-2">Gastname (optional)</p>
              <input
                type="text"
                placeholder="Name eingeben..."
                value={walkinGuestName}
                onChange={e => setWalkinGuestName(e.target.value)}
                className="w-full border border-[#3d3d5c] rounded-xl py-3 px-4 text-center text-white text-base outline-none focus:border-[#7bb7ef] bg-[#1e1e2e] placeholder:text-[#666688]"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Reservation wizard sub-view (within bottom sheet)
  if (subView === 'reserve_wizard') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
        <div className="mt-auto rounded-t-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col" style={{ background: '#1a1a2e' }} onClick={e => e.stopPropagation()}>
          {/* Wizard Header - Teal bar */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#333355]">
            <button onClick={() => {
              if (reserveStep === 'guests') { resetResForm(); setSubView('main'); }
              else { setReserveStep('guests'); }
            }} className="p-1 text-[#b0b0cc] hover:text-[#e0e0f0]"><X className="w-5 h-5" /></button>

            <div className="flex-1 mx-3">
              <div className="flex items-center justify-center gap-2 px-4 py-2">
                {reserveStep === 'guests' && (
                  <><Users className="w-4 h-4 text-[#b0b0cc]" /><span className="text-white font-semibold text-sm">{resFormData.partySize} {resFormData.partySize === 1 ? 'Gast' : 'Gäste'} · {table.name}</span></>
                )}
                {reserveStep === 'guest_info' && (
                  <><User className="w-4 h-4 text-[#b0b0cc]" /><span className="text-white font-semibold text-sm truncate">{resFormData.guestName || 'Gast'}</span></>
                )}
              </div>
            </div>

            {/* Step dots */}
            <div className="flex items-center gap-1.5">
              {['guests', 'guest_info'].map((step, i) => (
                <div key={step} className={'w-2 h-2 rounded-full transition-colors ' +
                  (step === reserveStep ? 'bg-[#7bb7ef]' : i < ['guests', 'guest_info'].indexOf(reserveStep) ? 'bg-[#5d9edb]' : 'bg-[#555]')}
                />
              ))}
            </div>
          </div>

          {/* Wizard Content */}
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: '70vh' }}>
            {/* Step 1: Party size + Time */}
            {reserveStep === 'guests' && (
              <div className="p-4 space-y-4">
                <div className="text-center">
                  <p className="text-xs text-[#b0b0cc] mb-0.5">{table.name} · Heute</p>
                  <h3 className="text-base font-bold text-white">Wie viele Gäste?</h3>
                </div>
                <div>
                  <div className="flex gap-2 flex-wrap">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                      <button key={n} onClick={() => setResFormData(prev => ({ ...prev, partySize: n }))}
                        className={'w-12 h-12 rounded-xl border-2 text-base font-bold transition-colors ' +
                          (resFormData.partySize === n ? 'border-[#7bb7ef] bg-[#7bb7ef] text-white' : 'border-[#3d3d5c] text-[#c0c0dd] hover:border-[#7bb7ef]')}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <input type="number" min={1} placeholder="Andere Anzahl..."
                    value={resFormData.partySize > 8 ? resFormData.partySize : ''}
                    onChange={e => { const v = parseInt(e.target.value); if (v > 0) setResFormData(prev => ({ ...prev, partySize: v })); }}
                    className="w-full mt-2 border border-[#3d3d5c] rounded-xl py-2.5 px-4 text-center text-white outline-none focus:border-[#7bb7ef] bg-[#2a2a42] placeholder:text-[#8888aa] text-sm" />
                </div>

                {/* Time + Duration compact row */}
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-xs font-semibold text-[#b0b0cc] uppercase tracking-wider">Uhrzeit</h4>
                    <input type="time" value={resFormData.time}
                      onChange={e => setResFormData(prev => ({ ...prev, time: e.target.value }))}
                      className="border border-[#3d3d5c] rounded-lg py-1.5 px-3 text-center text-white outline-none focus:border-[#7bb7ef] text-xs bg-[#2a2a42] w-24" />
                  </div>
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'].map(t => (
                      <button key={t} onClick={() => setResFormData(prev => ({ ...prev, time: t }))}
                        className={'shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ' +
                          (resFormData.time === t ? 'border-[#7bb7ef] bg-[#7bb7ef]/20 text-[#7bb7ef]' : 'border-[#3d3d5c] text-[#b0b0cc] hover:bg-[#2a2a42]')}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <h4 className="text-xs font-semibold text-[#b0b0cc] uppercase tracking-wider shrink-0">Dauer</h4>
                  <div className="flex gap-1.5 flex-1">
                    {[60, 90, 120].map(d => (
                      <button key={d} onClick={() => setResFormData(prev => ({ ...prev, duration: d }))}
                        className={'flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ' +
                          (resFormData.duration === d ? 'border-[#7bb7ef] bg-[#7bb7ef]/20 text-[#7bb7ef]' : 'border-[#3d3d5c] text-[#b0b0cc] hover:bg-[#2a2a42]')}>
                        {d}m
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={() => setReserveStep('guest_info')}
                  className="w-full py-3 rounded-xl font-semibold text-white text-sm" style={{ background: '#7c3aed' }}>
                  Weiter
                </button>
              </div>
            )}

            {/* Step 2: Guest info */}
            {reserveStep === 'guest_info' && (
              <div className="pb-4">
                {/* Search */}
                <div className="px-4 py-3 border-b border-[#333355]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8888aa]" />
                    <input type="text" value={resGuestSearch}
                      onChange={e => handleResGuestSearch(e.target.value)}
                      placeholder="Nach Telefonnummer oder Namen suchen"
                      className="w-full pl-9 pr-3 py-2.5 border border-[#3d3d5c] rounded-lg text-sm text-white outline-none focus:border-[#7bb7ef] bg-[#2a2a42] placeholder:text-[#8888aa]" />
                  </div>
                  {resSearchResults.length > 0 && (
                    <div className="mt-1 border border-[#3d3d5c] rounded-lg overflow-hidden shadow-lg">
                      {resSearchResults.slice(0, 5).map(g => (
                        <button key={g.id} onClick={() => handleResSelectGuest(g)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#353558] text-left border-b border-[#333355] last:border-0 bg-[#2a2a42]">
                          <div className="w-8 h-8 rounded-full bg-purple-900/40 flex items-center justify-center">
                            <User className="w-4 h-4 text-[#7bb7ef]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{g.name}</p>
                            {g.phone && <p className="text-xs text-[#b0b0cc]">{g.phone}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Guest fields */}
                <div className="px-4 py-3 space-y-3">
                  {resMatchedGuest && (
                    <div className="rounded-lg bg-[#7bb7ef]/15 border border-purple-700/30 p-3 flex items-center gap-2">
                      <User className="w-4 h-4 text-[#7bb7ef] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#b1d9ff]">{resMatchedGuest.name}</p>
                        <p className="text-xs text-[#7bb7ef]">{resMatchedGuest.totalVisits || 0} Besuche</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-0 border border-[#3d3d5c] rounded-lg overflow-hidden">
                    <div className="flex items-center border-b border-[#3d3d5c] px-3 py-2.5 bg-[#2a2a42]">
                      <span className="text-sm text-[#b0b0cc] w-24 shrink-0">Vorname</span>
                      <input type="text" value={resFormData.guestName.split(' ')[0] || ''}
                        onChange={e => {
                          const ln = resFormData.guestName.split(' ').slice(1).join(' ');
                          setResFormData(prev => ({ ...prev, guestName: e.target.value + (ln ? ' ' + ln : '') }));
                        }}
                        placeholder="Vorname" className="flex-1 text-sm text-white outline-none bg-transparent placeholder:text-[#8888aa]" />
                    </div>
                    <div className="flex items-center border-b border-[#3d3d5c] px-3 py-2.5 bg-[#2a2a42]">
                      <span className="text-sm text-[#b0b0cc] w-24 shrink-0">Nachname</span>
                      <input type="text" value={resFormData.guestName.split(' ').slice(1).join(' ')}
                        onChange={e => {
                          const fn = resFormData.guestName.split(' ')[0] || '';
                          setResFormData(prev => ({ ...prev, guestName: fn + (e.target.value ? ' ' + e.target.value : '') }));
                        }}
                        placeholder="Nachname" className="flex-1 text-sm text-white outline-none bg-transparent placeholder:text-[#8888aa]" />
                    </div>
                    <div className="flex items-center px-3 py-2.5 bg-[#2a2a42]">
                      <span className="text-sm text-[#b0b0cc] w-24 shrink-0">Telefon</span>
                      <input type="tel" value={resFormData.guestPhone}
                        onChange={e => handleResPhoneChange(e.target.value)}
                        placeholder="Telefonnummer" className="flex-1 text-sm text-white outline-none bg-transparent placeholder:text-[#8888aa]" />
                    </div>
                  </div>

                  {/* Source selector */}
                  <div>
                    <p className="text-xs text-[#b0b0cc] font-semibold uppercase tracking-wider mb-2">QUELLE</p>
                    <div className="grid grid-cols-3 gap-2">
                      {([['phone', 'Telefon'], ['online', 'Online'], ['walk_in', 'Walk-In']] as const).map(([key, label]) => (
                        <button key={key} onClick={() => setResFormData(prev => ({ ...prev, source: key }))}
                          className={'py-2 rounded-lg text-sm font-medium border transition-colors ' +
                            (resFormData.source === key ? 'border-[#7bb7ef] bg-[#7bb7ef]/20 text-[#7bb7ef]' : 'border-[#3d3d5c] text-[#b0b0cc] hover:bg-[#2a2a42]')}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <textarea value={resFormData.notes}
                    onChange={e => setResFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="z.B. Allergien, Kinderstuhl, Geburtstag..."
                    rows={2}
                    className="w-full rounded-lg px-3 py-2.5 border border-[#3d3d5c] text-white text-sm outline-none focus:border-[#7bb7ef] resize-none bg-[#2a2a42] placeholder:text-[#8888aa]" />

                  {/* Save */}
                  <button onClick={handleResSave}
                    disabled={!resFormData.guestName.trim()}
                    className="w-full py-3 rounded-xl font-semibold text-white text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: '#7c3aed' }}>
                    <Check className="w-5 h-5" />
                    Reservieren
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Move to table picker sub-view
  if (subView === 'move_picker') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
        <div className="mt-auto rounded-t-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto" style={{ background: '#1a1a2e' }} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#333355]">
            <h2 className="text-xl font-bold text-white">Umsetzen - Tisch waehlen</h2>
            <button onClick={() => setSubView('main')} className="p-1 text-[#b0b0cc] hover:text-[#e0e0f0]"><X className="w-6 h-6" /></button>
          </div>

          <div className="px-5 py-4">
            {freeTables.length === 0 ? (
              <p className="text-[#8888aa] text-center py-8">Keine freien Tische verfuegbar</p>
            ) : (
              <div className="space-y-2">
                {freeTables.map(t => (
                  <button key={t.id} onClick={() => handleMoveToTable(t.id)}
                    className="w-full flex items-center justify-between py-3.5 px-4 rounded-xl border border-[#3d3d5c] hover:bg-[#2a2a42] active:bg-[#353558] transition-colors">
                    <span className="text-white text-base font-semibold">{t.name}</span>
                    <span className="text-sm text-[#b0b0cc]">{t.seats || 4} Plaetze</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-5 py-3 pb-20 border-t border-[#333355]">
            <button onClick={() => setSubView('main')} className="w-full py-2.5 text-sm text-[#b0b0cc] hover:text-[#e0e0f0]">
              Zurück
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main view
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="mt-auto rounded-t-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto" style={{ background: '#1a1a2e' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-2xl font-bold text-white">{table.name}</h2>
          <button onClick={onClose} className="p-1 text-[#b0b0cc] hover:text-[#e0e0f0]"><X className="w-6 h-6" /></button>
        </div>

        {/* Timeline */}
        {timelineExpanded ? renderExpandedTimeline() : renderCompactTimeline()}

        {/* Current Guest Info (if occupied) */}
        {isOccupied && session && (
          <div className="px-5 py-3">
            <p className="text-xs font-bold text-[#b0b0cc] tracking-wider mb-2">ZUR ZEIT PLATZIERT</p>
            <button onClick={handleOpenOrders} className="w-full flex items-center justify-between py-3 px-4 rounded-xl border border-[#3d3d5c] hover:bg-[#2a2a42] active:bg-[#353558] transition-colors">
              <div>
                <p className="text-base font-bold text-white">
                  {seatedReservation ? seatedReservation.guestName : (session.guestSource === 'walk_in' ? 'Walk-In' : session.guestSource === 'phone' ? 'Telefon' : 'Online') + ' ' + table.name.replace(/^[A-Za-z]+\s*/, '')}
                </p>
                <p className="text-sm text-[#b0b0cc]">{seatedReservation ? getSeatedDuration(seatedReservation) : getElapsedStr()}</p>
              </div>
              <span className="text-lg font-bold text-[#c0c0dd]">{seatedReservation ? seatedReservation.partySize : (session.guestCount || '?')}</span>
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="px-5 py-2 space-y-2 pb-20">
          {/* === OCCUPIED TABLE ACTIONS === */}
          {isOccupied && session && (
            <>
              {/* Status: Platziert (purple) */}
              <button onClick={handleOpenOrders}
                className="w-full flex items-center gap-3 py-4 px-4 rounded-xl text-white font-semibold text-base"
                style={{ background: SERVICE_STATUS_INFO[session.serviceStatus || 'platziert']?.color || '#c084fc' }}>
                <UtensilsCrossed className="w-5 h-5" />
                {SERVICE_STATUS_INFO[session.serviceStatus || 'platziert']?.label || 'Platziert'}
              </button>

              {/* Abraeumen erforderlich (orange) */}
              <button onClick={() => {
                dispatch({ type: 'SET_SERVICE_STATUS', tableId: table.id, serviceStatus: 'abraeumen' });
                onClose();
              }}
                className="w-full flex items-center gap-3 py-4 px-4 rounded-xl text-white font-semibold text-base"
                style={{ background: '#f97316' }}>
                <UtensilsCrossed className="w-5 h-5" />
                Abraeumen erforderlich
              </button>

              {/* Abschliessen */}
              <button onClick={handleCloseTable}
                className="w-full flex items-center gap-3 py-4 px-4 rounded-xl border border-[#3d3d5c] text-[#c0c0dd] font-medium text-base hover:bg-[#2a2a42] active:bg-[#353558]">
                <CheckCircle2 className="w-5 h-5 text-[#b0b0cc]" />
                Abschliessen
              </button>

              {/* Beenden & Walk-In platzieren */}
              <button onClick={handleFinishAndSeatNew}
                className="w-full flex items-center gap-3 py-4 px-4 rounded-xl border border-[#3d3d5c] text-[#c0c0dd] font-medium text-base hover:bg-[#2a2a42] active:bg-[#353558]">
                <CheckCircle2 className="w-5 h-5 text-[#7bb7ef]" />
                Beenden & Walk-In platzieren
              </button>

              {!showMoreOptions ? (
                <button onClick={() => setShowMoreOptions(true)}
                  className="w-full py-2 text-sm font-semibold text-[#7bb7ef] hover:text-[#b1d9ff]">
                  mehr Optionen
                </button>
              ) : (
                <>
                  {/* Umsetzen */}
                  <button onClick={() => setSubView('move_picker')}
                    className="w-full flex items-center gap-3 py-4 px-4 rounded-xl border border-[#3d3d5c] text-[#c0c0dd] font-medium text-base hover:bg-[#2a2a42] active:bg-[#353558]">
                    <ArrowRightLeft className="w-5 h-5 text-[#b0b0cc]" />
                    Umsetzen
                  </button>

                  {/* Platzierung rueckgaengig machen */}
                  <button onClick={handleUndoPlacement}
                    className="w-full flex items-center gap-3 py-4 px-4 rounded-xl border border-[#3d3d5c] text-[#c0c0dd] font-medium text-base hover:bg-[#2a2a42] active:bg-[#353558]">
                    <RotateCcw className="w-5 h-5 text-[#b0b0cc]" />
                    Platzierung rueckgaengig machen
                  </button>

                  {/* Reservieren */}
                  <button onClick={() => { resetResForm(); setSubView('reserve_wizard'); }}
                    className="w-full flex items-center gap-3 py-4 px-4 rounded-xl border border-[#3d3d5c] text-[#c0c0dd] font-medium text-base hover:bg-[#2a2a42] active:bg-[#353558]">
                    <CalendarCheck className="w-5 h-5 text-[#b0b0cc]" />
                    Reservieren
                  </button>

                  {/* Tisch sperren */}
                  <button onClick={handleBlockTable}
                    className="w-full flex items-center gap-3 py-4 px-4 rounded-xl border border-[#3d3d5c] text-[#c0c0dd] font-medium text-base hover:bg-[#2a2a42] active:bg-[#353558]">
                    <Ban className="w-5 h-5 text-[#b0b0cc]" />
                    Tisch sperren
                  </button>

                  <button onClick={() => setShowMoreOptions(false)}
                    className="w-full py-2 text-sm font-semibold text-[#7bb7ef] hover:text-[#b1d9ff]">
                    weniger Optionen
                  </button>
                </>
              )}
            </>
          )}

          {/* === FREE TABLE WITH CONFLICT (reservation assigned) === */}
          {isFree && hasConflict && conflictReservation && (
            <>
              {/* Warning */}
              <div className="flex items-center gap-2 py-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-sm font-semibold text-red-500">
                  {table.name} ist anderen Gästen zugewiesen
                </p>
              </div>

              {/* Walk-In dennoch platzieren (red) */}
              <button onClick={() => setSubView('walkin_count')}
                className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl text-white font-semibold text-base"
                style={{ background: '#dc2626' }}>
                Walk-In dennoch platzieren
              </button>

              {/* Walk-In teilweise platzieren (teal) */}
              <button onClick={() => setSubView('walkin_count')}
                className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl text-white font-semibold text-base"
                style={{ background: '#7c3aed' }}>
                Walk-In teilweise platzieren
              </button>

              {/* Reservieren */}
              <button onClick={() => { resetResForm(); setSubView('reserve_wizard'); }}
                className="w-full flex items-center gap-3 py-4 px-4 rounded-xl border border-[#3d3d5c] text-[#c0c0dd] font-medium text-base hover:bg-[#2a2a42] active:bg-[#353558]">
                <CalendarCheck className="w-5 h-5 text-[#b0b0cc]" />
                Reservieren
              </button>

              {/* Tisch sperren */}
              <button onClick={handleBlockTable}
                className="w-full flex items-center gap-3 py-4 px-4 rounded-xl border border-[#3d3d5c] text-[#c0c0dd] font-medium text-base hover:bg-[#2a2a42] active:bg-[#353558]">
                <Ban className="w-5 h-5 text-[#b0b0cc]" />
                Tisch sperren
              </button>
            </>
          )}

          {/* === FREE TABLE (no conflict) === */}
          {isFree && !hasConflict && (
            <>
              {/* Walk-In platzieren */}
              <button onClick={() => setSubView('walkin_count')}
                className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl text-white font-semibold text-base"
                style={{ background: '#7c3aed' }}>
                <UserPlus className="w-5 h-5" />
                Walk-In platzieren
              </button>

              {/* Reservieren */}
              <button onClick={() => { resetResForm(); setSubView('reserve_wizard'); }}
                className="w-full flex items-center gap-3 py-4 px-4 rounded-xl border border-[#3d3d5c] text-[#c0c0dd] font-medium text-base hover:bg-[#2a2a42] active:bg-[#353558]">
                <CalendarCheck className="w-5 h-5 text-[#b0b0cc]" />
                Reservieren
              </button>

              {/* Tisch sperren */}
              <button onClick={handleBlockTable}
                className="w-full flex items-center gap-3 py-4 px-4 rounded-xl border border-[#3d3d5c] text-[#c0c0dd] font-medium text-base hover:bg-[#2a2a42] active:bg-[#353558]">
                <Ban className="w-5 h-5 text-[#b0b0cc]" />
                Tisch sperren
              </button>
            </>
          )}

          {/* === BLOCKED TABLE === */}
          {isBlocked && (
            <>
              <div className="flex items-center gap-2 py-2">
                <Ban className="w-5 h-5 text-red-400" />
                <p className="text-base font-semibold text-red-400">Tisch ist gesperrt</p>
              </div>

              <button onClick={handleUnblockTable}
                className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl text-white font-semibold text-base"
                style={{ background: '#7c3aed' }}>
                Sperre aufheben
              </button>
            </>
          )}

          {/* === OCCUPIED TABLE WITHOUT SESSION (fallback) === */}
          {isOccupied && !session && (
            <>
              <button onClick={handleCloseTable}
                className="w-full flex items-center gap-3 py-4 px-4 rounded-xl border border-[#3d3d5c] text-[#c0c0dd] font-medium text-base hover:bg-[#2a2a42] active:bg-[#353558]">
                <CheckCircle2 className="w-5 h-5 text-[#b0b0cc]" />
                Tisch freigeben
              </button>

              <button onClick={() => setSubView('walkin_count')}
                className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl text-white font-semibold text-base"
                style={{ background: '#7c3aed' }}>
                <UserPlus className="w-5 h-5" />
                Walk-In platzieren
              </button>

              <button onClick={() => { resetResForm(); setSubView('reserve_wizard'); }}
                className="w-full flex items-center gap-3 py-4 px-4 rounded-xl border border-[#3d3d5c] text-[#c0c0dd] font-medium text-base hover:bg-[#2a2a42] active:bg-[#353558]">
                <CalendarCheck className="w-5 h-5 text-[#b0b0cc]" />
                Reservieren
              </button>

              <button onClick={handleBlockTable}
                className="w-full flex items-center gap-3 py-4 px-4 rounded-xl border border-[#3d3d5c] text-[#c0c0dd] font-medium text-base hover:bg-[#2a2a42] active:bg-[#353558]">
                <Ban className="w-5 h-5 text-[#b0b0cc]" />
                Tisch sperren
              </button>
            </>
          )}

          {/* === FALLBACK: no condition matched === */}
          {!isOccupied && !isFree && !isBlocked && (
            <>
              <button onClick={() => setSubView('walkin_count')}
                className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl text-white font-semibold text-base"
                style={{ background: '#7c3aed' }}>
                <UserPlus className="w-5 h-5" />
                Walk-In platzieren
              </button>

              <button onClick={() => { resetResForm(); setSubView('reserve_wizard'); }}
                className="w-full flex items-center gap-3 py-4 px-4 rounded-xl border border-[#3d3d5c] text-[#c0c0dd] font-medium text-base hover:bg-[#2a2a42] active:bg-[#353558]">
                <CalendarCheck className="w-5 h-5 text-[#b0b0cc]" />
                Reservieren
              </button>

              <button onClick={handleBlockTable}
                className="w-full flex items-center gap-3 py-4 px-4 rounded-xl border border-[#3d3d5c] text-[#c0c0dd] font-medium text-base hover:bg-[#2a2a42] active:bg-[#353558]">
                <Ban className="w-5 h-5 text-[#b0b0cc]" />
                Tisch sperren
              </button>
            </>
          )}
        </div>

        {/* Next Reservation */}
        {nextReservation && (
          <div className="px-5 py-3 border-t border-[#333355]" style={{ background: '#1a1a2e' }}>
            <p className="text-xs font-bold text-[#b0b0cc] tracking-wider mb-2">NAECHSTE GRUPPE</p>
            <div className="flex items-center justify-between py-2 px-3 rounded-xl border border-[#3d3d5c] bg-[#2a2a42]">
              <div>
                <p className="text-base font-bold text-white">{nextReservation.guestName}</p>
                <p className="text-sm text-[#b0b0cc]">{nextReservation.time}</p>
              </div>
              <span className="text-lg font-bold text-[#c0c0dd]">{nextReservation.partySize}</span>
            </div>
          </div>
        )}

        {/* Safe area padding for bottom nav */}
        <div className="pb-20" />
      </div>
    </div>
  );
}
