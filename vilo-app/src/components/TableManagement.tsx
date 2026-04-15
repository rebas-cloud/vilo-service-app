import { useState, useMemo, useEffect } from 'react';
import { IconAlertTriangle, IconArrowsRightLeft, IconBan, IconCheck, IconCircleCheck, IconChevronDown, IconChevronRight, IconChevronUp, IconRotate, IconSearch, IconUser, IconUserPlus, IconUsers, IconToolsKitchen, IconX } from '@tabler/icons-react';

import { Table, Reservation, Guest } from '../types';
import { useApp } from '../context/AppContext';
import { loadReservations, addReservation, findGuestByPhone, addGuest, loadGuests } from '../utils/storage';
import { ActionButton, StatGrid, SurfaceCard } from './ui';

const isBarSeat = (table: Pick<Table, 'placementType' | 'variant' | 'shape'>): boolean =>
  table.placementType === 'bar_seat' || table.variant === 'barstool-1' || table.shape === 'barstool';

const getTableLabelNumber = (name: string): string =>
  name.replace(/^(Tisch|Barplatz|Bar-Sitz|Bar|[A-Za-z])\s*/i, '').trim() || name;

const getTableDisplayLabel = (table: Pick<Table, 'name' | 'placementType' | 'variant' | 'shape'>): string =>
  isBarSeat(table) ? `Barplatz ${getTableLabelNumber(table.name)}` : table.name;

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
  onStartMoveSelection?: (fromTableId: string) => void;
  onCancelMoveSelection?: () => void;
  isMoveSelectionActive?: boolean;
  allTables: Table[];
  isSidebarExpanded?: boolean;
  inline?: boolean;
  initialSubView?: SubView;
  initialWalkInGuestName?: string;
  initialWalkInGuestCount?: number;
  onSeatFromWaitlist?: (tableId: string, guestName: string, guestCount: number) => void;
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

export function TableManagement({
  table,
  onClose,
  onOpenTableDetail,
  onReserve: _onReserve,
  onStartMoveSelection,
  onCancelMoveSelection,
  isMoveSelectionActive = false,
  allTables,
  isSidebarExpanded = true,
  inline = false,
  initialSubView = 'main',
  initialWalkInGuestName = '',
  initialWalkInGuestCount = 2,
  onSeatFromWaitlist,
}: TableManagementProps) {
  void _onReserve; // kept for interface compatibility
  const { state, dispatch } = useApp();
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showSessionGuestCountOverlay, setShowSessionGuestCountOverlay] = useState(false);
  const [showSessionDurationOverlay, setShowSessionDurationOverlay] = useState(false);
  const [subView, setSubView] = useState<SubView>(initialSubView);
  const [walkinGuestName, setWalkinGuestName] = useState(initialWalkInGuestName);
  const [walkinGuestCount, setWalkinGuestCount] = useState(initialWalkInGuestCount);
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

  useEffect(() => {
    setTimelineExpanded(false);
    setShowMoreOptions(false);
    setShowSessionGuestCountOverlay(false);
    setShowSessionDurationOverlay(false);
    setSubView(initialSubView);
    setWalkinGuestName(initialWalkInGuestName);
    setWalkinGuestCount(initialWalkInGuestCount);
  }, [table.id, initialSubView, initialWalkInGuestName, initialWalkInGuestCount]);

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
      confirmationStatus: 'pending',
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

  const sessionOwnerTableId = useMemo(() => {
    if (state.sessions[table.id]) return table.id;
    const owner = Object.values(state.sessions).find(activeSession => activeSession.combinedTableIds?.includes(table.id));
    return owner?.tableId || table.id;
  }, [state.sessions, table.id]);
  const session = state.sessions[sessionOwnerTableId];
  const isOccupied = table.status === 'occupied' || table.status === 'billing' || Boolean(session);
  const isBlocked = table.status === 'blocked';
  const isFree = table.status === 'free';
  const currentTableLabel = getTableDisplayLabel(table);
  const currentTableKindLabel = isBarSeat(table) ? 'Barplatz' : 'Tisch';

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
  const activeGuestCount = seatedReservation?.partySize || session?.guestCount || 2;
  const activePlannedDuration = session?.plannedDuration || seatedReservation?.duration || 90;

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

  const formatDurationShort = (minutes: number) => {
    const safeMinutes = Math.max(15, minutes || 0);
    const hours = Math.floor(safeMinutes / 60);
    const mins = safeMinutes % 60;
    if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    return `${safeMinutes}m`;
  };

  // Current hour for timeline
  const currentHour = new Date().getHours();

  const panelShellClass = 'vilo-no-motion pointer-events-auto relative h-full overflow-y-auto border-l border-[#2a2a42] bg-[#1f1d33] shadow-2xl';
  const panelHeaderClass = 'flex h-[61px] items-center justify-between border-b border-[#2a2a42] px-4';
  const panelSectionClass = 'border-b border-[#2c2947] px-4 py-3';
  const inlinePanelWidth = isMobileViewport && !isSidebarExpanded ? 'calc(100vw - 68px)' : 320;
  const panelShellStyle = {
    width: inline ? inlinePanelWidth : 320,
    minWidth: inline ? inlinePanelWidth : 320,
    maxWidth: inline ? inlinePanelWidth : 320,
    marginLeft: 'auto',
    flexShrink: 0,
  } as const;

  const renderPanelFrame = (content: React.ReactNode, extraClassName = '') => {
    const shell = (
      <div
        className={[panelShellClass, extraClassName].filter(Boolean).join(' ')}
        style={panelShellStyle}
        onClick={e => e.stopPropagation()}
      >
        {content}
      </div>
    );

    if (inline) {
      return shell;
    }

    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-transparent" onClick={onClose}>
        {shell}
      </div>
    );
  };

  const subviewContentClass = 'px-4 py-4 space-y-3';
  const sectionLabelClass = 'mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f97b3]';
  const textInputClass = 'w-full bg-vilo-card px-4 py-3 text-[13px] text-white outline-none placeholder:text-vilo-text-muted';
  const textAreaClass = 'w-full min-h-[84px] resize-none bg-vilo-card px-4 py-3 text-[13px] text-white outline-none placeholder:text-vilo-text-muted';

  const getPickerButtonClass = (active: boolean) => (
    'flex min-h-[48px] items-center justify-center px-3 text-[13px] font-semibold transition-colors ' +
    (active
      ? 'bg-[#8b5cf6] text-white'
      : 'bg-vilo-card text-vilo-text-soft hover:bg-vilo-elevated')
  );

  const renderSubviewHeader = (label: string, onHeaderClose: () => void) => (
    <div className={panelHeaderClass}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f97b3]">{label}</p>
      </div>
      <button onClick={onHeaderClose} className="p-1 text-vilo-text-secondary hover:text-vilo-text-primary">
        <IconX className="w-6 h-6" />
      </button>
    </div>
  );

  const primaryActionClass = 'w-full flex min-h-[52px] items-center justify-start gap-2.5 px-4 py-3 rounded-none bg-[#8b5cf6] text-left text-white font-semibold text-[12px] whitespace-nowrap hover:bg-[#7c3aed] transition-colors';
  const secondaryActionClass = 'w-full flex min-h-[52px] items-center justify-start gap-2.5 px-4 py-3 rounded-none bg-vilo-card text-left text-[#d7d3ea] font-semibold text-[12px] whitespace-nowrap hover:bg-[#312e52] active:bg-vilo-elevated transition-colors';
  const dangerActionClass = 'w-full flex min-h-[52px] items-center justify-start gap-2.5 px-4 py-3 rounded-none bg-[#d946ef] text-left text-white font-semibold text-[12px] whitespace-nowrap hover:bg-[#c026d3] transition-colors';
  const orangeActionClass = 'w-full flex min-h-[52px] items-center justify-start gap-2.5 px-4 py-3 rounded-none bg-[#ff7a18] text-left text-white font-semibold text-[12px] whitespace-nowrap hover:bg-[#ea6b0f] transition-colors';
  const interactiveStatClass = 'w-full border border-vilo-border-strong bg-vilo-card px-3 py-3 text-left transition-colors hover:bg-vilo-surface active:bg-vilo-elevated';

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
    dispatch({ type: 'SET_GUEST_NAME', tableId: table.id, guestName: walkinGuestName });
    dispatch({ type: 'SET_GUEST_SOURCE', tableId: table.id, source: 'walk_in' });
    dispatch({ type: 'SET_GUEST_COUNT', tableId: table.id, guestCount });
    dispatch({ type: 'SET_SERVICE_STATUS', tableId: table.id, serviceStatus: 'platziert' });
    onSeatFromWaitlist?.(table.id, walkinGuestName, guestCount);
    onClose();
  };

  const applySessionGuestCount = (guestCount: number) => {
    if (!session) return;
    dispatch({ type: 'SET_GUEST_COUNT', tableId: sessionOwnerTableId, guestCount });
    setShowSessionGuestCountOverlay(false);
  };

  const applySessionDuration = (duration: number) => {
    if (!session) return;
    dispatch({ type: 'SET_SESSION_DURATION', tableId: sessionOwnerTableId, duration });
    setShowSessionDurationOverlay(false);
  };

  const renderSessionFieldOverlays = () => {
    if (!isOccupied || !session) return null;

    return (
      <>
        {showSessionGuestCountOverlay && (
          <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/20" onClick={() => setShowSessionGuestCountOverlay(false)}>
            <div className="border-t border-[#2a2a42] bg-[#1f1d33] px-4 py-4" onClick={e => e.stopPropagation()}>
              <p className={sectionLabelClass}>Anzahl Gäste</p>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <button key={n} onClick={() => applySessionGuestCount(n)} className={getPickerButtonClass(activeGuestCount === n)}>
                    {n}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                placeholder="Andere Anzahl..."
                className={`${textInputClass} mt-2`}
                value={activeGuestCount > 8 ? activeGuestCount : ''}
                onChange={e => {
                  const val = parseInt(e.target.value);
                  if (val > 0) dispatch({ type: 'SET_GUEST_COUNT', tableId: sessionOwnerTableId, guestCount: val });
                }}
                onBlur={e => {
                  const val = parseInt(e.target.value);
                  if (val > 0) {
                    applySessionGuestCount(val);
                  } else {
                    setShowSessionGuestCountOverlay(false);
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const val = parseInt((e.target as HTMLInputElement).value);
                    if (val > 0) applySessionGuestCount(val);
                  }
                }}
              />
            </div>
          </div>
        )}

        {showSessionDurationOverlay && (
          <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/20" onClick={() => setShowSessionDurationOverlay(false)}>
            <div className="border-t border-[#2a2a42] bg-[#1f1d33] px-4 py-4" onClick={e => e.stopPropagation()}>
              <p className={sectionLabelClass}>Dauer</p>
              <div className="grid grid-cols-3 gap-2">
                {[60, 90, 120, 150, 180].map(duration => (
                  <button key={duration} onClick={() => applySessionDuration(duration)} className={getPickerButtonClass(activePlannedDuration === duration)}>
                    {duration}m
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </>
    );
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
      <div className="px-4 py-2.5" style={{ background: '#2a2a42' }}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-[0.16em] text-white">ZEITPLAN</span>
          <button onClick={() => setTimelineExpanded(!timelineExpanded)} className="text-vilo-text-secondary hover:text-vilo-text-primary transition-colors">
            {timelineExpanded ? <IconChevronUp className="w-4.5 h-4.5" /> : <IconChevronDown className="w-4.5 h-4.5" />}
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
              <div key={h} className="flex flex-col items-center" style={{ minWidth: 28 }}>
                <div className="mb-1 w-5 rounded-sm" style={{
                  height: 20,
                  background: isOccupiedHour ? '#7c3aed' : hasRes ? '#991b1b' : '#3d3d5c',
                  opacity: isCurrent ? 1 : 0.6,
                  border: isCurrent ? '2px solid var(--vilo-border-strong)' : '1px solid var(--vilo-border-subtle)',
                }} />
                <span className={'text-[9px] font-bold ' + (isCurrent ? 'text-white' : 'text-vilo-text-muted')}>{hourStr}</span>
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
      <div className="px-4 py-2.5" style={{ background: '#2a2a42' }}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-[0.16em] text-white">ZEITPLAN</span>
          <button onClick={() => setTimelineExpanded(false)} className="text-vilo-text-secondary hover:text-vilo-text-primary transition-colors">
            <IconChevronUp className="w-4.5 h-4.5" />
          </button>
        </div>
        <div className="relative" style={{ minHeight: hours.length * 48 }}>
          {hours.map((h, i) => (
            <div key={i} className="flex items-start" style={{ height: 48 }}>
              <span className="text-sm font-bold text-vilo-text-secondary w-8 shrink-0">{String(h).padStart(2, '0')}</span>
              <div className="flex-1 border-t border-vilo-border-strong relative" style={{ height: 48 }}>
                {/* Half hour line */}
                <div className="absolute left-0 right-0 border-t border-vilo-border-subtle" style={{ top: 24 }} />
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
    return renderPanelFrame(
      <>
          {renderSubviewHeader('Walk-In', () => setSubView('main'))}

          <div className={subviewContentClass}>
            <SurfaceCard className="px-4 py-4">
              <div className="text-[13px] font-semibold text-white">{currentTableLabel}</div>
              <div className="mt-0.5 text-[11px] text-vilo-text-muted">
                {hasConflict && conflictReservation
                  ? `${conflictReservation.time} bereits reserviert`
                  : `Freier ${currentTableKindLabel.toLowerCase()} für spontane Gäste`}
              </div>
            </SurfaceCard>

            <div>
              <p className={sectionLabelClass}>Gastname</p>
              <input
                type="text"
                placeholder="Name eingeben..."
                value={walkinGuestName}
                onChange={e => setWalkinGuestName(e.target.value)}
                className={textInputClass}
              />
            </div>

            <div>
              <p className={sectionLabelClass}>Anzahl Gäste</p>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <button key={n} onClick={() => setWalkinGuestCount(n)} className={getPickerButtonClass(walkinGuestCount === n)}>
                    {n}
                  </button>
                ))}
              </div>
              <input
                type="number"
                placeholder="Andere Anzahl..."
                min={1}
                className={`${textInputClass} mt-2`}
                value={walkinGuestCount > 8 ? walkinGuestCount : ''}
                onChange={e => {
                  const val = parseInt(e.target.value);
                  if (val > 0) setWalkinGuestCount(val);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const val = parseInt((e.target as HTMLInputElement).value);
                    if (val > 0) setWalkinGuestCount(val);
                  }
                }}
              />
            </div>

            {hasConflict && conflictReservation && (
              <SurfaceCard variant="alt" className="px-4 py-4">
                <div className="text-[13px] font-semibold text-white">Konflikt mit Reservierung</div>
                <div className="mt-0.5 text-[11px] text-[#c7b8ff]">
                  {currentTableLabel} ist um {conflictReservation.time} anderen Gästen zugewiesen
                </div>
              </SurfaceCard>
            )}

            <ActionButton variant="primary" icon={<IconUserPlus className="w-5 h-5" />} onClick={() => handleSeatWalkIn(walkinGuestCount)}>
              Walk-In platzieren
            </ActionButton>
          </div>
      </>
    );
  }

  // Reservation wizard sub-view (within bottom sheet)
  if (subView === 'reserve_wizard') {
    return renderPanelFrame(
      <>
          {renderSubviewHeader('Reservierung', () => {
            resetResForm();
            setSubView('main');
          })}

          <div className="flex-1 overflow-y-auto">
            {/* Step 1: Party size + Time */}
            {reserveStep === 'guests' && (
              <div className={subviewContentClass}>
                <SurfaceCard className="px-4 py-4">
                  <div className="text-[13px] font-semibold text-white">{currentTableLabel}</div>
                  <div className="mt-0.5 text-[11px] text-vilo-text-muted">Schritt 1 von 2 · Reservierung vorbereiten</div>
                </SurfaceCard>

                <StatGrid items={[
                  { value: `${resFormData.partySize} ${resFormData.partySize === 1 ? 'Gast' : 'Gäste'}` },
                  { value: resFormData.time },
                  { value: `${resFormData.duration}m` },
                ]} />

                <div>
                  <p className={sectionLabelClass}>Anzahl Gäste</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                      <button key={n} onClick={() => setResFormData(prev => ({ ...prev, partySize: n }))} className={getPickerButtonClass(resFormData.partySize === n)}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <input type="number" min={1} placeholder="Andere Anzahl..."
                    value={resFormData.partySize > 8 ? resFormData.partySize : ''}
                    onChange={e => { const v = parseInt(e.target.value); if (v > 0) setResFormData(prev => ({ ...prev, partySize: v })); }}
                    className={`${textInputClass} mt-2`} />
                </div>

                <div>
                  <p className={sectionLabelClass}>Uhrzeit</p>
                  <div className="mb-2">
                    <input type="time" value={resFormData.time}
                      onChange={e => setResFormData(prev => ({ ...prev, time: e.target.value }))}
                      className={`${textInputClass} max-w-[132px]`} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'].map(t => (
                      <button key={t} onClick={() => setResFormData(prev => ({ ...prev, time: t }))} className={getPickerButtonClass(resFormData.time === t)}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className={sectionLabelClass}>Dauer</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[60, 90, 120].map(d => (
                      <button key={d} onClick={() => setResFormData(prev => ({ ...prev, duration: d }))} className={getPickerButtonClass(resFormData.duration === d)}>
                        {d}m
                      </button>
                    ))}
                  </div>
                </div>

                <ActionButton variant="primary" icon={<IconUsers className="w-5 h-5" />} onClick={() => setReserveStep('guest_info')}>
                  Weiter
                </ActionButton>
              </div>
            )}

            {/* Step 2: Guest info */}
            {reserveStep === 'guest_info' && (
              <div className={subviewContentClass}>
                <SurfaceCard className="px-4 py-4">
                  <div className="text-[13px] font-semibold text-white">Gastdetails</div>
                  <div className="mt-0.5 text-[11px] text-vilo-text-muted">Schritt 2 von 2 · {currentTableLabel}</div>
                </SurfaceCard>

                <StatGrid items={[
                  { value: `${resFormData.partySize} P.` },
                  { value: resFormData.time },
                  { value: `${resFormData.duration}m` },
                ]} />

                <div>
                  <p className={sectionLabelClass}>Gast suchen</p>
                  <div className="relative">
                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vilo-text-muted" />
                    <input type="text" value={resGuestSearch}
                      onChange={e => handleResGuestSearch(e.target.value)}
                      placeholder="Nach Telefonnummer oder Namen suchen"
                      className={`pl-9 ${textInputClass}`} />
                  </div>
                  {resSearchResults.length > 0 && (
                    <SurfaceCard className="mt-2 overflow-hidden">
                      {resSearchResults.slice(0, 5).map(g => (
                        <button key={g.id} onClick={() => handleResSelectGuest(g)}
                          className="w-full flex items-center gap-3 border-b border-vilo-border-subtle bg-vilo-card px-3 py-3 text-left hover:bg-vilo-elevated last:border-0">
                          <div className="flex h-8 w-8 items-center justify-center bg-[#8b5cf6]/15">
                            <IconUser className="w-4 h-4 text-[#7bb7ef]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{g.name}</p>
                            {g.phone && <p className="text-xs text-vilo-text-secondary">{g.phone}</p>}
                          </div>
                        </button>
                      ))}
                    </SurfaceCard>
                  )}
                </div>

                {resMatchedGuest && (
                  <SurfaceCard variant="alt" className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <IconUser className="w-4 h-4 text-[#7bb7ef] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{resMatchedGuest.name}</p>
                        <p className="text-xs text-[#b4afd2]">{resMatchedGuest.totalVisits || 0} Besuche</p>
                      </div>
                    </div>
                  </SurfaceCard>
                )}

                <div>
                  <p className={sectionLabelClass}>Vorname</p>
                  <input type="text" value={resFormData.guestName.split(' ')[0] || ''}
                    onChange={e => {
                      const ln = resFormData.guestName.split(' ').slice(1).join(' ');
                      setResFormData(prev => ({ ...prev, guestName: e.target.value + (ln ? ' ' + ln : '') }));
                    }}
                    placeholder="Vorname"
                    className={textInputClass}
                  />
                </div>

                <div>
                  <p className={sectionLabelClass}>Nachname</p>
                  <input type="text" value={resFormData.guestName.split(' ').slice(1).join(' ')}
                    onChange={e => {
                      const fn = resFormData.guestName.split(' ')[0] || '';
                      setResFormData(prev => ({ ...prev, guestName: fn + (e.target.value ? ' ' + e.target.value : '') }));
                    }}
                    placeholder="Nachname"
                    className={textInputClass}
                  />
                </div>

                <div>
                  <p className={sectionLabelClass}>Telefon</p>
                  <input type="tel" value={resFormData.guestPhone}
                    onChange={e => handleResPhoneChange(e.target.value)}
                    placeholder="Telefonnummer"
                    className={textInputClass}
                  />
                </div>

                <div>
                  <p className={sectionLabelClass}>Quelle</p>
                  <div className="grid grid-cols-3 gap-2">
                    {([['phone', 'Telefon'], ['online', 'Online'], ['walk_in', 'Walk-In']] as const).map(([key, label]) => (
                      <button key={key} onClick={() => setResFormData(prev => ({ ...prev, source: key }))} className={getPickerButtonClass(resFormData.source === key)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className={sectionLabelClass}>Notiz</p>
                  <textarea value={resFormData.notes}
                    onChange={e => setResFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="z.B. Allergien, Kinderstuhl, Geburtstag..."
                    rows={3}
                    className={textAreaClass}
                  />
                </div>

                <ActionButton variant="primary" icon={<IconCheck className="w-5 h-5" />} onClick={handleResSave} disabled={!resFormData.guestName.trim()}>
                  Reservieren
                </ActionButton>

                <ActionButton variant="secondary" className="text-[#d7d3ea]" onClick={() => setReserveStep('guests')}>
                  Zurück
                </ActionButton>
              </div>
            )}
          </div>
      </>,
      'flex flex-col'
    );
  }

  // Move to table picker sub-view
  if (subView === 'move_picker') {
    return renderPanelFrame(
      <>
          {renderSubviewHeader('Platz wählen', () => {
            onCancelMoveSelection?.();
            setSubView('main');
          })}

          <div className={subviewContentClass}>
            <SurfaceCard className="px-4 py-4">
              <div className="text-[13px] font-semibold text-white">Gast umsetzen</div>
              <div className="mt-0.5 text-[11px] text-vilo-text-muted">
                {freeTables.length === 0 ? 'Keine freien Plätze verfügbar' : `${freeTables.length} freie Plätze verfügbar`}
              </div>
            </SurfaceCard>

            <SurfaceCard className="px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold text-white">
                    {freeTables.length === 0
                      ? 'Keine freien Plätze verfügbar'
                      : 'Wähle jetzt direkt einen freien Platz im Floor'}
                  </div>
                  <div className="mt-0.5 text-[11px] text-vilo-text-muted">
                    {freeTables.length === 0
                      ? 'Belegte oder gesperrte Plätze sind nicht auswählbar.'
                      : `${freeTables.length} freie ${freeTables.length === 1 ? 'Option' : 'Optionen'} markiert`}
                  </div>
                </div>
                <IconArrowsRightLeft className={'mt-0.5 h-4 w-4 shrink-0 ' + (isMoveSelectionActive ? 'text-[#c9b6ff]' : 'text-[#7d789c]')} />
              </div>
            </SurfaceCard>

            <ActionButton variant="secondary" className="text-[#d7d3ea]" onClick={() => {
              onCancelMoveSelection?.();
              setSubView('main');
            }}>
              Abbrechen
            </ActionButton>
          </div>
      </>
    );
  }

  // Main view
  const statusLabel = isBlocked
    ? 'Gesperrt'
    : isFree
      ? 'Frei'
      : SERVICE_STATUS_INFO[session?.serviceStatus || 'platziert']?.label || 'Platziert';

  const statusBackground = isBlocked
    ? '#ef4444'
    : isFree
      ? '#8b5cf6'
      : '#8b5cf6';

  return renderPanelFrame(
    <>
        {/* Header */}
        <div className={panelHeaderClass}>
          <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f97b3]">
            {currentTableKindLabel} {getTableLabelNumber(table.name)}
          </p>
          </div>
          <button onClick={onClose} className="p-1 text-vilo-text-secondary hover:text-vilo-text-primary"><IconX className="w-6 h-6" /></button>
        </div>

        <div className="flex items-center px-4 py-3 text-white" style={{ background: statusBackground }}>
          <div className="flex items-center gap-2.5">
            <IconCheck className="h-4.5 w-4.5" />
            <span className="text-[16px] font-semibold">{statusLabel}</span>
          </div>
        </div>

        {/* Timeline */}
        <div className={panelSectionClass + ' !px-0 !py-0'}>{timelineExpanded ? renderExpandedTimeline() : renderCompactTimeline()}</div>

        {isOccupied && session && (
          <div className={panelSectionClass}>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSessionDurationOverlay(false);
                  setShowSessionGuestCountOverlay(true);
                }}
                className={interactiveStatClass}
              >
                <div className="text-[17px] font-bold text-white">{activeGuestCount} P.</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-vilo-text-muted">Gäste</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSessionGuestCountOverlay(false);
                  setShowSessionDurationOverlay(true);
                }}
                className={interactiveStatClass}
              >
                <div className="text-[17px] font-bold text-white">{formatDurationShort(activePlannedDuration)}</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-vilo-text-muted">Dauer</div>
              </button>
            </div>
          </div>
        )}

        {/* Current Guest Info (if occupied) */}
        {isOccupied && session && (
          <div className={panelSectionClass}>
            <p className="mb-2 text-[11px] font-bold tracking-[0.16em] text-vilo-text-secondary">ZUR ZEIT PLATZIERT</p>
            <button onClick={handleOpenOrders} className="w-full flex items-center justify-between border border-vilo-border-strong bg-vilo-card px-3 py-3 text-left hover:bg-vilo-surface active:bg-vilo-elevated transition-colors">
              <div>
                <p className="text-[13px] font-bold text-white">
                  {seatedReservation?.guestName
                    || session.guestName?.trim()
                    || (session.guestSource === 'walk_in' ? 'Walk-In' : session.guestSource === 'phone' ? 'Telefon' : 'Online')}
                </p>
                <p className="text-[11px] text-vilo-text-secondary">{seatedReservation ? getSeatedDuration(seatedReservation) : getElapsedStr()}</p>
              </div>
              <div className="flex items-center gap-2 text-vilo-text-soft">
                <IconChevronRight className="h-4 w-4 shrink-0 text-[#a9a4ca]" />
              </div>
            </button>
          </div>
        )}

        {isFree && conflictReservation && (
          <div className={panelSectionClass}>
            <div className="border border-dashed border-[#7a6aab] px-3 py-3">
              <p className="text-[13px] font-semibold text-white">{conflictReservation.guestName}</p>
              <p className="mt-1 text-[11px] text-[#c7b8ff]">
                {conflictReservation.time} · {conflictReservation.partySize} Gäste
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="px-4 py-3 space-y-2">
          {/* === OCCUPIED TABLE ACTIONS === */}
          {isOccupied && session && (
            <>
              {/* Abraeumen erforderlich (orange) */}
              <button onClick={() => {
                dispatch({ type: 'SET_SERVICE_STATUS', tableId: table.id, serviceStatus: 'abraeumen' });
                onClose();
              }}
                className={orangeActionClass}>
                <IconToolsKitchen className="w-5 h-5" />
                Abräumen
              </button>

              {/* Abschliessen */}
              <button onClick={handleCloseTable}
                className={secondaryActionClass}>
                <IconCircleCheck className="w-5 h-5 text-[#cfc5ff]" />
                Abschließen
              </button>

              {/* Beenden & Walk-In platzieren */}
              <button onClick={handleFinishAndSeatNew}
                className={secondaryActionClass}>
                <IconCircleCheck className="w-5 h-5 text-[#d946ef]" />
                Neu platzieren
              </button>

              {!showMoreOptions ? (
                <button onClick={() => setShowMoreOptions(true)}
                  className="w-full py-2 text-sm font-semibold text-[#d946ef] hover:text-[#f0abfc]">
                  mehr Optionen
                </button>
              ) : (
                <>
                  {/* Umsetzen */}
                  <button onClick={() => {
                    onStartMoveSelection?.(table.id);
                    setSubView('move_picker');
                  }}
                    className={secondaryActionClass}>
                    <IconArrowsRightLeft className="w-5 h-5 text-[#cfc5ff]" />
                    Umsetzen
                  </button>

                  {/* Platzierung rueckgaengig machen */}
                  <button onClick={handleUndoPlacement}
                    className={secondaryActionClass}>
                    <IconRotate className="w-5 h-5 text-[#cfc5ff]" />
                    Platzierung rueckgaengig machen
                  </button>

                  {/* Tisch sperren */}
                  <button onClick={handleBlockTable}
                    className={secondaryActionClass}>
                    <IconBan className="w-5 h-5 text-[#cfc5ff]" />
                    {currentTableKindLabel} sperren
                  </button>

                  <button onClick={() => setShowMoreOptions(false)}
                    className="w-full py-2 text-sm font-semibold text-[#d946ef] hover:text-[#f0abfc]">
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
              <div className="flex items-center gap-2 py-1">
                <IconAlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-[12px] font-semibold text-red-500">
                  {currentTableLabel} ist anderen Gästen zugewiesen
                </p>
              </div>

              {/* Walk-In dennoch platzieren (red) */}
              <button onClick={() => setSubView('walkin_count')}
                className={dangerActionClass}>
                Trotzdem platzieren
              </button>

              {/* Walk-In teilweise platzieren (teal) */}
              <button onClick={() => setSubView('walkin_count')}
                className={primaryActionClass}>
                Teilweise platzieren
              </button>

              {/* Tisch sperren */}
              <button onClick={handleBlockTable}
                className={secondaryActionClass}>
                <IconBan className="w-5 h-5 text-[#cfc5ff]" />
                {currentTableKindLabel} sperren
              </button>
            </>
          )}

          {/* === FREE TABLE (no conflict) === */}
          {isFree && !hasConflict && (
            <>
              {/* Walk-In platzieren */}
              <button onClick={() => setSubView('walkin_count')}
                className={primaryActionClass}>
                <IconUserPlus className="w-5 h-5" />
                Walk-In platzieren
              </button>

              {/* Tisch sperren */}
              <button onClick={handleBlockTable}
                className={secondaryActionClass}>
                <IconBan className="w-5 h-5 text-[#cfc5ff]" />
                {currentTableKindLabel} sperren
              </button>
            </>
          )}

          {/* === BLOCKED TABLE === */}
          {isBlocked && (
            <>
              <div className="flex items-center gap-2 py-1">
                <IconBan className="w-4.5 h-4.5 text-red-400" />
                <p className="text-[12px] font-semibold text-red-400">{currentTableKindLabel} ist gesperrt</p>
              </div>

              <button onClick={handleUnblockTable}
                className={primaryActionClass}>
                Sperre aufheben
              </button>
            </>
          )}

          {/* === OCCUPIED TABLE WITHOUT SESSION (fallback) === */}
          {isOccupied && !session && (
            <>
              <button onClick={handleCloseTable}
                className={secondaryActionClass}>
                <IconCircleCheck className="w-5 h-5 text-[#cfc5ff]" />
                {currentTableKindLabel} freigeben
              </button>

              <button onClick={() => setSubView('walkin_count')}
                className={primaryActionClass}>
                <IconUserPlus className="w-5 h-5" />
                Walk-In platzieren
              </button>

              <button onClick={handleBlockTable}
                className={secondaryActionClass}>
                <IconBan className="w-5 h-5 text-[#cfc5ff]" />
                {currentTableKindLabel} sperren
              </button>
            </>
          )}

          {/* === FALLBACK: no condition matched === */}
          {!isOccupied && !isFree && !isBlocked && (
            <>
              <button onClick={() => setSubView('walkin_count')}
                className={primaryActionClass}>
                <IconUserPlus className="w-5 h-5" />
                Walk-In platzieren
              </button>

              <button onClick={handleBlockTable}
                className={secondaryActionClass}>
                <IconBan className="w-5 h-5 text-[#cfc5ff]" />
                {currentTableKindLabel} sperren
              </button>
            </>
          )}
        </div>

        {/* Next Reservation */}
        {nextReservation && (
          <div className={panelSectionClass}>
            <p className="text-xs font-bold text-vilo-text-secondary tracking-wider mb-2">NAECHSTE GRUPPE</p>
            <div className="flex items-center justify-between border border-vilo-border-strong bg-vilo-card px-4 py-3">
              <div>
                <p className="text-base font-bold text-white">{nextReservation.guestName}</p>
                <p className="text-sm text-vilo-text-secondary">{nextReservation.time}</p>
              </div>
              <span className="text-lg font-bold text-vilo-text-soft">{nextReservation.partySize}</span>
            </div>
          </div>
        )}

        <div className="h-6" />
        {renderSessionFieldOverlays()}
    </>
  );
}
