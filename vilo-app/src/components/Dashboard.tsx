import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { IconAlertTriangle, IconArrowDownRight, IconArrowUpRight, IconCalendar, IconChevronLeft, IconChevronRight, IconCircleDot, IconClock, IconCoffee, IconListNumbers, IconMoon, IconPencil, IconAdjustments, IconSparkles, IconSun, IconHourglass, IconTrendingUp, IconTrophy, IconUsers, IconToolsKitchen2, IconToolsKitchen, IconX } from '@tabler/icons-react';

import { useApp } from '../context/AppContext';
import { ShiftHistoryRecord } from '../types';
import { loadWaitlist, loadReservations } from '../utils/storage';

interface Alert {
  id: string;
  type: 'warning' | 'upsell' | 'info' | 'allergy';
  icon: React.ReactNode;
  title: string;
  description: string;
  tableId: string;
  tableName: string;
  priority: number;
  timestamp: number;
}

type DashboardTab = 'statistiken' | 'uebersicht';
type DrillDown = null | 'einnahmen' | 'schichtstatistiken' | 'schichtfluss' | 'warteliste';
type ShiftFilter = 'alle' | 'Fruehstueck' | 'Lunch' | 'Dinner';
type TimeRangeFilter = 'heute' | '7tage' | '30tage' | 'alle';
type SourceFilter = 'alle' | 'walk_in' | 'phone' | 'online';
type SortMode = 'umsatz' | 'gaeste' | 'zeit';

interface StatFilters {
  shift: ShiftFilter;
  timeRange: TimeRangeFilter;
  source: SourceFilter;
  sort: SortMode;
}

interface DashboardProps {
  onSelectTable: (tableId: string) => void;
  initialTab?: DashboardTab;
}

function useComparisonData(shiftHistory: ShiftHistoryRecord[], shiftName: string, filters: StatFilters, weightByDay: boolean = true) {
  return useMemo(() => {
    // Apply time range filter to history
    let filtered = [...shiftHistory];
    const now = Date.now();
    if (filters.timeRange === '7tage') {
      filtered = filtered.filter(r => now - r.endTime < 7 * 24 * 60 * 60 * 1000);
    } else if (filters.timeRange === '30tage') {
      filtered = filtered.filter(r => now - r.endTime < 30 * 24 * 60 * 60 * 1000);
    } else if (filters.timeRange === 'heute') {
      const todayStr = new Date().toISOString().split('T')[0];
      filtered = filtered.filter(r => r.date === todayStr);
    }
    // Apply shift filter
    const shiftToMatch = filters.shift === 'alle' ? shiftName : filters.shift;
    let matching = filtered
      .filter(r => r.shiftName === shiftToMatch)
      .slice(-10);

    // Weight by same day of week if enough data
    const todayDow = new Date().getDay();
    if (weightByDay && matching.length >= 4) {
      const sameDayRecords = matching.filter(r => r.dayOfWeek === todayDow);
      if (sameDayRecords.length >= 2) {
        matching = sameDayRecords;
      }
    }

    if (matching.length === 0) {
      return {
        avgRevenue: 0,
        avgGuests: 0,
        avgTips: 0,
        avgSources: { walk_in: 0, phone: 0, online: 0 },
        count: 0,
        comparisonLabel: 'Keine historischen Daten',
      };
    }

    const avgRevenue = matching.reduce((s, r) => s + r.revenue, 0) / matching.length;
    const avgGuests = Math.round(matching.reduce((s, r) => s + r.guests, 0) / matching.length);
    const avgTips = matching.reduce((s, r) => s + r.tips, 0) / matching.length;
    const avgSources = {
      walk_in: Math.round(matching.reduce((s, r) => s + r.guestSources.walk_in, 0) / matching.length),
      phone: Math.round(matching.reduce((s, r) => s + r.guestSources.phone, 0) / matching.length),
      online: Math.round(matching.reduce((s, r) => s + r.guestSources.online, 0) / matching.length),
    };

    const shiftLabel = filters.shift === 'alle' ? shiftName : filters.shift;
    const timeLabel = filters.timeRange === 'heute' ? ' (heute)' : filters.timeRange === '7tage' ? ' (7 Tage)' : filters.timeRange === '30tage' ? ' (30 Tage)' : '';

    return {
      avgRevenue,
      avgGuests,
      avgTips,
      avgSources,
      count: matching.length,
      comparisonLabel: `letzten ${matching.length} ${shiftLabel}-Schichten${timeLabel}`,
    };
  }, [shiftHistory, shiftName, filters, weightByDay]);
}

// Date display is handled by App header now

function getShiftName(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Fruehstueck';
  if (h < 15) return 'Lunch';
  return 'Dinner';
}

function ComparisonBar({ current, comparison, color, currentLabel, compLabel }: { current: number; comparison: number; color: string; currentLabel?: string; compLabel?: string }) {
  const max = Math.max(current, comparison, 1);
  const currentPct = (current / max) * 100;
  const compPct = (comparison / max) * 100;
  return (
    <div className="space-y-1 mt-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: `${color}30`, width: `${currentPct}%`, minWidth: '8px' }}>
          <div className="h-full rounded-full" style={{ backgroundColor: color, width: '100%' }} />
        </div>
        {currentLabel && <span className="text-vilo-text-secondary text-[10px] whitespace-nowrap">{currentLabel}</span>}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-3 rounded-full overflow-hidden bg-[#555]/40" style={{ width: `${compPct}%`, minWidth: '8px' }}>
          <div className="h-full rounded-full bg-slate-500/60" style={{ width: '100%' }} />
        </div>
        {compLabel && <span className="text-vilo-text-secondary text-[10px] whitespace-nowrap">{compLabel}</span>}
      </div>
    </div>
  );
}

function HourlyBarChart({ data, accentColor }: { data: { hour: string; count: number; isCurrent: boolean }[]; accentColor: string }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-40 mt-4">
      {data.map((d, i) => {
        const heightPct = (d.count / maxCount) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex flex-col justify-end" style={{ height: '120px' }}>
              {d.count > 0 && (
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{
                    height: `${heightPct}%`,
                    minHeight: d.count > 0 ? '4px' : '0',
                    backgroundColor: d.isCurrent ? accentColor : '#64748b80',
                    opacity: d.isCurrent ? 0.8 : 0.5,
                  }}
                />
              )}
            </div>
            <span className="text-vilo-text-muted text-[9px]">{d.hour}</span>
          </div>
        );
      })}
    </div>
  );
}

const OCCASION_LABELS: Record<string, string> = {
  date: 'Date',
  geschaeftsessen: 'Geschäftsessen',
  geburtstag: 'Geburtstag',
  jahrestag: 'Jahrestag',
  besonderer_anlass: 'Besonderer Anlass',
  schulabschluss: 'Schulabschluss',
  theater_kino: 'Theater/Kino',
  gratis_extra: 'Gratis Extra',
};

interface ShiftNote {
  id: string;
  text: string;
  author: string;
  timestamp: number;
}

const SEAT_LABELS: Record<string, string> = {
  aussicht: 'Aussicht',
  fensterplatz: 'Fensterplatz erbeten',
  nischenplatz: 'Nischenplatz',
  raucherplatz: 'Raucherplatz',
  rollstuhlgerecht: 'Rollstuhlgerecht / Barrierefrei',
  ruhiger_tisch: 'Ruhiger Tisch',
  terrasse: 'Terrasse',
  hochstuhl: 'Hochstuhl',
};

const OCCASION_COLORS: Record<string, string> = {
  date: '#ef4444',
  geschaeftsessen: '#94a3b8',
  geburtstag: '#a78bfa',
  jahrestag: '#22c55e',
  besonderer_anlass: '#f59e0b',
  schulabschluss: '#3b82f6',
  theater_kino: '#ec4899',
  gratis_extra: '#2dd4bf',
};

const SEATED_STATUSES = ['seated', 'partially_seated', 'appetizer', 'entree', 'dessert', 'cleared', 'check_dropped', 'paid', 'bussing_needed'];

function UebersichtTab(_props: {
  occupiedTables: unknown[];
  freeTables: unknown[];
  totalRevenue: number;
  totalPendingItems: number;
}) {
  const { state } = useApp();
  const [refreshKey, setRefreshKey] = useState(0);
  const [newNote, setNewNote] = useState('');
  const [shiftNotes, setShiftNotes] = useState<ShiftNote[]>(() => {
    try {
      const saved = localStorage.getItem('vilo_shift_notes');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const todayReservations = useMemo(() => {
    void refreshKey;
    const reservations = loadReservations();
    const todayStr = new Date().toISOString().split('T')[0];
    return reservations
      .filter(r => r.date === todayStr && r.status !== 'cancelled')
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [refreshKey]);

  const waitlist = useMemo(() => {
    void refreshKey;
    return loadWaitlist().filter(w => w.status === 'waiting' || w.status === 'notified');
  }, [refreshKey]);

  useEffect(() => {
    const interval = setInterval(() => setRefreshKey(k => k + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Stats
  const totalGroups = todayReservations.length;
  const totalGuests = useMemo(() => todayReservations.reduce((sum, r) => sum + r.partySize, 0), [todayReservations]);
  const seatedCount = useMemo(() => todayReservations.filter(r => SEATED_STATUSES.includes(r.status)).length, [todayReservations]);
  const walkInCount = useMemo(() => todayReservations.filter(r => r.source === 'walk_in').length, [todayReservations]);

  // Source breakdown
  const phoneCount = useMemo(() => todayReservations.filter(r => r.source === 'phone').length, [todayReservations]);
  const onlineCount = useMemo(() => todayReservations.filter(r => r.source === 'online').length, [todayReservations]);

  // Categories
  const bigGroups = useMemo(() => todayReservations.filter(r => r.partySize >= 6), [todayReservations]);
  const specialEvents = useMemo(() => todayReservations.filter(r => r.occasionLabels && r.occasionLabels.length > 0), [todayReservations]);
  const seatRequests = useMemo(() => todayReservations.filter(r => r.seatLabels && r.seatLabels.length > 0), [todayReservations]);
  const paidCount = useMemo(() => todayReservations.filter(r => r.paymentStatus === 'paid').length, [todayReservations]);
  const partialCount = useMemo(() => todayReservations.filter(r => r.paymentStatus === 'partial').length, [todayReservations]);

  const authorName = state.currentUser?.name || 'Team';

  const addShiftNote = () => {
    if (!newNote.trim()) return;
    const note: ShiftNote = { id: Date.now().toString(), text: newNote.trim(), author: authorName, timestamp: Date.now() };
    const updated = [...shiftNotes, note];
    setShiftNotes(updated);
    localStorage.setItem('vilo_shift_notes', JSON.stringify(updated));
    setNewNote('');
  };

  const removeShiftNote = (id: string) => {
    const updated = shiftNotes.filter(n => n.id !== id);
    setShiftNotes(updated);
    localStorage.setItem('vilo_shift_notes', JSON.stringify(updated));
  };

  return (
    <div className="p-2 md:p-4 animate-fadeIn overflow-y-auto h-full">
      {/* Top stats row - 4 big cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 md:gap-3 mb-2.5 md:mb-4">
        {[
          { value: totalGroups, label: 'GRUPPEN' },
          { value: totalGuests, label: 'GÄSTE' },
          { value: seatedCount, label: 'PLATZIERT' },
          { value: walkInCount, label: 'WALK-INS' },
        ].map(stat => (
          <div key={stat.label} className="rounded-none px-2.5 md:px-3 py-2.5 md:py-3 text-center border border-vilo-border-subtle" style={{ background: '#26243f' }}>
            <p className="text-white text-[26px] md:text-[28px] font-bold leading-none">{stat.value}</p>
            <p className="text-[#9f9aba] text-[10px] md:text-[11px] font-semibold tracking-[0.18em] mt-1.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Source breakdown */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-3 px-0.5 md:px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-[#9f9aba] text-[13px]">Telefon {phoneCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-pink-400" />
          <span className="text-[#9f9aba] text-[13px]">Online {onlineCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-[#9f9aba] text-[13px]">Walk-in {walkInCount}</span>
        </div>
      </div>

      {/* Bottom 2-column grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 md:gap-3">
        {/* Left: GROSSE GRUPPEN */}
        <div className="rounded-none overflow-hidden" style={{ background: '#252540' }}>
          <div className="flex items-center justify-between px-2.5 md:px-4 pt-2.5 md:pt-3 pb-2">
            <div className="flex items-center gap-2">
              <IconUsers className="w-4 h-4 text-vilo-text-muted" />
              <span className="text-[#9f9aba] text-[11px] font-semibold uppercase tracking-[0.18em]">Grosse Gruppen</span>
            </div>
            <span className="min-w-6 h-6 px-1 bg-[#312e52] text-white text-[11px] font-bold flex items-center justify-center">{bigGroups.length}</span>
          </div>
          <div className="px-2.5 md:px-4 pb-2.5 md:pb-3">
            {bigGroups.length === 0 ? (
              <p className="text-[#64748b] text-[13px] py-3">Keine großen Gruppen heute</p>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {bigGroups.map(r => (
                  <div key={r.id} className="flex items-center justify-between py-2 gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-vilo-text-muted text-[12px] shrink-0">{r.time}</span>
                      <span className="text-white text-[14px] font-semibold truncate">{r.guestName}</span>
                    </div>
                    <span className="text-[#cf8cff] text-[13px] font-bold shrink-0">{r.partySize} Pers.</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-2.5 md:space-y-3">
          {/* BESONDERE ANLÄSSE */}
          <div className="rounded-none overflow-hidden" style={{ background: '#252540' }}>
            <div className="flex items-center justify-between px-2.5 md:px-4 pt-2.5 md:pt-3 pb-2">
              <div className="flex items-center gap-2">
                <IconSparkles className="w-4 h-4 text-vilo-text-muted" />
                <span className="text-[#9f9aba] text-[11px] font-semibold uppercase tracking-[0.18em]">Besondere Anlässe</span>
              </div>
              <span className="min-w-6 h-6 px-1 bg-[#312e52] text-white text-[11px] font-bold flex items-center justify-center">{specialEvents.length}</span>
            </div>
            <div className="px-2.5 md:px-4 pb-2.5 md:pb-3">
              {specialEvents.length === 0 ? (
                <p className="text-[#64748b] text-[13px] py-2">Keine besonderen Anlässe</p>
              ) : (
                <div className="space-y-2.5">
                  {specialEvents.map(r => (
                    <div key={r.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-3">
                          <span className="text-vilo-text-muted text-[12px] shrink-0">{r.time}</span>
                          <span className="text-white text-[14px] font-semibold truncate">{r.guestName}</span>
                        </div>
                        <span className="text-[#cf8cff] text-[13px] font-bold shrink-0">{r.partySize} Pers.</span>
                      </div>
                      {r.occasionLabels && r.occasionLabels.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {r.occasionLabels.map(l => (
                            <span key={l} className="px-2 py-1 text-[11px] font-medium"
                              style={{ color: OCCASION_COLORS[l] || '#94a3b8', background: (OCCASION_COLORS[l] || '#94a3b8') + '1a' }}>
                              {OCCASION_LABELS[l] || l}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SITZPLATZWÜNSCHE */}
          <div className="rounded-none overflow-hidden" style={{ background: '#252540' }}>
            <div className="flex items-center justify-between px-2.5 md:px-4 pt-2.5 md:pt-3 pb-2">
              <div className="flex items-center gap-2">
                <IconCalendar className="w-4 h-4 text-vilo-text-muted" />
                <span className="text-[#9f9aba] text-[11px] font-semibold uppercase tracking-[0.18em]">Sitzplatzwünsche</span>
              </div>
              <span className="min-w-6 h-6 px-1 bg-[#312e52] text-white text-[11px] font-bold flex items-center justify-center">{seatRequests.length}</span>
            </div>
            <div className="px-2.5 md:px-4 pb-2.5 md:pb-3">
              {seatRequests.length === 0 ? (
                <p className="text-[#64748b] text-[13px] py-2">Keine Sitzplatzwünsche</p>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {seatRequests.map(r => (
                    <div key={r.id} className="flex items-center justify-between py-2 gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-vilo-text-muted text-[12px] shrink-0">{r.time}</span>
                        <span className="text-white text-[14px] font-semibold truncate">{r.guestName}</span>
                      </div>
                      <span className="text-[#9f9aba] text-[11px] text-right max-w-[48%]">
                        {r.seatLabels?.map(l => SEAT_LABELS[l] || l.replace(/_/g, ' ')).join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment status pills */}
      {(paidCount > 0 || partialCount > 0) && (
        <div className="flex flex-wrap gap-2 mt-2.5 md:mt-3">
          {paidCount > 0 && (
            <span className="px-3 py-1.5 text-[12px] font-semibold bg-vilo-card text-amber-400">
              {paidCount}× Bezahlt
            </span>
          )}
          {partialCount > 0 && (
            <span className="px-3 py-1.5 text-[12px] font-semibold bg-vilo-card text-amber-500">
              {partialCount}× Anzahlung
            </span>
          )}
        </div>
      )}

      {/* WARTELISTE */}
      {waitlist.length > 0 && (
        <div className="rounded-none overflow-hidden mt-3 md:mt-4" style={{ background: '#252540' }}>
          <div className="flex items-center justify-between px-2.5 md:px-4 pt-2.5 md:pt-3 pb-2">
            <div className="flex items-center gap-2">
              <IconClock className="w-4 h-4 text-vilo-text-muted" />
              <span className="text-[#9f9aba] text-[11px] font-semibold uppercase tracking-[0.18em]">Warteliste</span>
            </div>
            <span className="min-w-6 h-6 px-1 bg-[#312e52] text-white text-[11px] font-bold flex items-center justify-center">{waitlist.length}</span>
          </div>
          <div className="px-2.5 md:px-4 pb-2.5 md:pb-3">
            <div className="divide-y divide-white/[0.06]">
              {waitlist.map(w => (
                <div key={w.id} className="flex items-center justify-between py-2 gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-vilo-text-muted text-[12px] shrink-0">#{w.position}</span>
                    <div className="min-w-0">
                      <p className="text-white text-[14px] font-semibold truncate">{w.guestName}</p>
                      {w.seatPreference && <p className="text-[#64748b] text-[11px] truncate">{w.seatPreference}</p>}
                    </div>
                  </div>
                  <span className="text-[#cf8cff] text-[13px] font-bold shrink-0">{w.partySize} Pers.</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SCHICHTNOTIZEN */}
      <div className="rounded-none overflow-hidden mt-3 md:mt-4" style={{ background: '#252540' }}>
        <div className="flex items-center justify-between px-2.5 md:px-4 pt-2.5 md:pt-3 pb-2">
          <div className="flex items-center gap-2">
            <IconPencil className="w-4 h-4 text-vilo-text-muted" />
            <span className="text-[#9f9aba] text-[11px] font-semibold uppercase tracking-[0.18em]">Schichtnotizen</span>
          </div>
          <span className="min-w-6 h-6 px-1 bg-[#312e52] text-white text-[11px] font-bold flex items-center justify-center">{shiftNotes.length}</span>
        </div>
        <div className="px-2.5 md:px-4 pb-2.5 md:pb-3">
          {/* Add note input */}
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addShiftNote()}
              placeholder="Notiz für die Schicht..."
              className="flex-1 bg-[#1a1a2e] px-3 py-2.5 text-white text-[13px] placeholder:text-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#cf45f3]"
            />
            <button
              onClick={addShiftNote}
              className="h-10 w-10 shrink-0 flex items-center justify-center bg-vilo-card text-white text-sm font-medium hover:bg-[#312e52] transition-all"
            >
              <IconPencil className="w-4 h-4" />
            </button>
          </div>
          {shiftNotes.length === 0 ? (
            <p className="text-[#64748b] text-[13px] py-2">Noch keine Schichtnotizen</p>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {shiftNotes.map(note => (
                <div key={note.id} className="flex items-start justify-between py-2.5 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[13px]">{note.text}</p>
                    <p className="text-[#64748b] text-[11px] mt-0.5">{note.author} &middot; {new Date(note.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <button onClick={() => removeShiftNote(note.id)} className="p-1 hover:bg-white/5 transition-colors shrink-0">
                    <IconX className="w-3.5 h-3.5 text-[#64748b]" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Dashboard({ onSelectTable: _onSelectTable, initialTab }: DashboardProps) {
  const { state } = useApp();
  const [now, setNow] = useState(Date.now());
  const [dismissedAlerts] = useState<Set<string>>(new Set());
  const activeTab: DashboardTab = initialTab || 'statistiken';
  const [drillDown, setDrillDown] = useState<DrillDown>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [statFilters, setStatFilters] = useState<StatFilters>({
    shift: 'alle',
    timeRange: 'heute',
    source: 'alle',
    sort: 'umsatz',
  });
  const activeFilterCount = (
    (statFilters.shift !== 'alle' ? 1 : 0) +
    (statFilters.timeRange !== 'heute' ? 1 : 0) +
    (statFilters.source !== 'alle' ? 1 : 0) +
    (statFilters.sort !== 'umsatz' ? 1 : 0)
  );

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  // formatDuration - kept for future use
  void now;

  // Pull-to-refresh state
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop === 0) {
      const dy = e.touches[0].clientY - touchStartY.current;
      if (dy > 0 && dy < 120) setPullY(dy);
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (pullY > 60) {
      setIsRefreshing(true);
      setNow(Date.now());
      setTimeout(() => { setIsRefreshing(false); setPullY(0); }, 600);
    } else {
      setPullY(0);
    }
  }, [pullY]);

  const tableData = useMemo(() => state.tables.map(table => {
    const session = state.sessions[table.id];
    const orders = session?.orders || [];
    const orderTotal = orders.reduce((sum, o) => sum + o.price * o.quantity, 0);
    const orderedCount = orders.filter(o => o.state === 'ordered').length;
    const sentCount = orders.filter(o => o.state === 'sent_to_kitchen' || o.state === 'sent_to_bar').length;
    const readyCount = orders.filter(o => o.state === 'ready').length;
    const servedCount = orders.filter(o => o.state === 'served').length;
    const notes = session?.notes || [];
    const startTime = session?.startTime || 0;
    const duration = startTime ? Math.floor((now - startTime) / 60000) : 0;

    let displayStatus: 'free' | 'waiting_order' | 'waiting_food' | 'food_ready' | 'eating' | 'billing' = 'free';
    if (table.status === 'billing') {
      displayStatus = 'billing';
    } else if (table.status === 'occupied') {
      if (readyCount > 0) displayStatus = 'food_ready';
      else if (sentCount > 0) displayStatus = 'waiting_food';
      else if (orderedCount > 0) displayStatus = 'waiting_order';
      else if (servedCount > 0) displayStatus = 'eating';
      else displayStatus = 'waiting_order';
    }

    return { ...table, session, orders, orderTotal, orderedCount, sentCount, readyCount, servedCount, notes, startTime, duration, displayStatus };
  }), [state.tables, state.sessions, now]);

  const occupiedTables = useMemo(() => tableData.filter(t => t.status !== 'free'), [tableData]);
  const freeTables = useMemo(() => tableData.filter(t => t.status === 'free'), [tableData]);

  const activeRevenue = occupiedTables.reduce((sum, t) => sum + t.orderTotal, 0);
  const totalRevenue = activeRevenue + state.closedTableRevenue;
  const totalReadyItems = occupiedTables.reduce((sum, t) => sum + t.readyCount, 0);
  const totalPendingItems = occupiedTables.reduce((sum, t) => sum + t.sentCount, 0);

  void Object.values(state.sessions);
  const tablesServed = occupiedTables.length;
  const totalTablesServed = tablesServed + state.closedTables.length;
  const avgPerTable = totalTablesServed > 0 ? totalRevenue / totalTablesServed : 0;
  const realTips = state.tipHistory.reduce((sum, t) => sum + t.amount, 0);
  const tipCount = state.tipHistory.length;

  const activeGuests = occupiedTables.reduce((sum, t) => sum + (t.session?.guestCount || 1), 0);
  const closedGuests = state.closedTables.reduce((sum, t) => sum + t.guestCount, 0);
  const totalGuests = activeGuests + closedGuests;
  const avgPerGuest = totalGuests > 0 ? totalRevenue / totalGuests : 0;
  // avgPerGroup: average revenue per group based on average group size
  const avgGroupSize = totalTablesServed > 0 ? totalGuests / totalTablesServed : 1;
  const avgPerGroup = avgGroupSize > 0 ? avgPerGuest * avgGroupSize : 0;

  // Average table duration (Durchschnittliche Tischzeit)
  const avgTableDuration = useMemo(() => {
    const closedDurations = state.closedTables.map(t => t.closedTime - t.startTime).filter(d => d > 0);
    const activeDurations = occupiedTables.filter(t => t.startTime > 0).map(t => now - t.startTime);
    const allDurations = [...closedDurations, ...activeDurations];
    if (allDurations.length === 0) return 0;
    return Math.round(allDurations.reduce((s, d) => s + d, 0) / allDurations.length / 60000);
  }, [state.closedTables, occupiedTables, now]);

  // Table performance ranking (€/Stunde)
  const tablePerformance = useMemo(() => {
    return occupiedTables
      .filter(t => t.startTime > 0 && t.orderTotal > 0)
      .map(t => {
        const hours = Math.max((now - t.startTime) / 3600000, 0.1);
        return { id: t.id, name: t.name, euroPerHour: t.orderTotal / hours, orderTotal: t.orderTotal, duration: t.duration };
      })
      .sort((a, b) => b.euroPerHour - a.euroPerHour);
  }, [occupiedTables, now]);

  const currentShiftName = getShiftName();
  const comp = useComparisonData(state.shiftHistory, currentShiftName, statFilters);

  const hourlyData = useMemo(() => {
    const hours: Record<number, number> = {};
    const currentHour = new Date(now).getHours();
    state.closedTables.forEach(t => {
      const h = new Date(t.startTime).getHours();
      hours[h] = (hours[h] || 0) + t.guestCount;
    });
    Object.values(state.sessions).forEach(s => {
      const h = new Date(s.startTime).getHours();
      hours[h] = (hours[h] || 0) + (s.guestCount || 1);
    });
    const startHour = new Date(state.shiftStart).getHours();
    const endHour = Math.min(currentHour + 2, 23);
    const result: { hour: string; count: number; isCurrent: boolean }[] = [];
    for (let h = startHour; h <= endHour; h++) {
      result.push({ hour: `${h}:00`, count: hours[h] || 0, isCurrent: h === currentHour });
    }
    if (result.length === 0) {
      // Use shift-appropriate fallback hours
      const fallbackStart = currentHour < 11 ? 7 : currentHour < 15 ? 11 : 17;
      const fallbackEnd = currentHour < 11 ? 11 : currentHour < 15 ? 15 : 23;
      for (let h = fallbackStart; h <= fallbackEnd; h++) {
        result.push({ hour: `${h}:00`, count: hours[h] || 0, isCurrent: h === currentHour });
      }
    }
    return result;
  }, [state.closedTables, state.sessions, state.shiftStart, now]);

  const currentHourGuests = hourlyData.find(d => d.isCurrent)?.count || 0;
  const currentHourTime = `${new Date().getHours()}:${new Date().getMinutes().toString().padStart(2, '0')}`;

  // Real guest sources from closed tables + active sessions
  const closedSourceWalkIn = state.closedTables.filter(t => t.guestSource === 'walk_in').reduce((s, t) => s + t.guestCount, 0);
  const closedSourcePhone = state.closedTables.filter(t => t.guestSource === 'phone').reduce((s, t) => s + t.guestCount, 0);
  const closedSourceOnline = state.closedTables.filter(t => t.guestSource === 'online').reduce((s, t) => s + t.guestCount, 0);
  // Only count sessions with explicitly set guestSource; unset sessions are 'unbekannt'
  const activeSourceWalkIn = Object.values(state.sessions).filter(s => s.guestSource === 'walk_in').reduce((sum, s) => sum + (s.guestCount || 1), 0);
  // Track unknown sources (no explicit guestSource set) for future use
  void Object.values(state.sessions).filter(s => !s.guestSource).length;
  const activeSourcePhone = Object.values(state.sessions).filter(s => s.guestSource === 'phone').reduce((sum, s) => sum + (s.guestCount || 1), 0);
  const activeSourceOnline = Object.values(state.sessions).filter(s => s.guestSource === 'online').reduce((sum, s) => sum + (s.guestCount || 1), 0);
  const sourcePhone = closedSourcePhone + activeSourcePhone;
  const sourceWalkIn = closedSourceWalkIn + activeSourceWalkIn;
  const sourceOnline = closedSourceOnline + activeSourceOnline;
  // Revenue by source (for filtered revenue)
  const closedRevenueBySource = (src: string) => state.closedTables.filter(t => t.guestSource === src).reduce((s, t) => s + t.revenue, 0);
  const activeRevenueBySource = (src: string) => Object.entries(state.sessions).filter(([, s]) => s.guestSource === src).reduce((sum, [tid]) => {
    const tbl = tableData.find(t => t.id === tid);
    return sum + (tbl?.orderTotal || 0);
  }, 0);
  const revenueWalkIn = closedRevenueBySource('walk_in') + activeRevenueBySource('walk_in');
  const revenuePhone = closedRevenueBySource('phone') + activeRevenueBySource('phone');
  const revenueOnline = closedRevenueBySource('online') + activeRevenueBySource('online');
  const filteredRevenue = statFilters.source === 'alle' ? totalRevenue :
    statFilters.source === 'walk_in' ? revenueWalkIn :
    statFilters.source === 'phone' ? revenuePhone : revenueOnline;

  // Apply source filter to guest data
  const filteredSourcePhone = statFilters.source === 'alle' || statFilters.source === 'phone' ? sourcePhone : 0;
  const filteredSourceWalkIn = statFilters.source === 'alle' || statFilters.source === 'walk_in' ? sourceWalkIn : 0;
  const filteredSourceOnline = statFilters.source === 'alle' || statFilters.source === 'online' ? sourceOnline : 0;
  const filteredTotalGuests = filteredSourcePhone + filteredSourceWalkIn + filteredSourceOnline;

  // === Trend Detection ===
  const trendInfo = useMemo(() => {
    if (comp.count < 2) return null;
    const revDiff = comp.avgRevenue > 0 ? ((totalRevenue - comp.avgRevenue) / comp.avgRevenue) * 100 : 0;
    const guestDiff = comp.avgGuests > 0 ? ((totalGuests - comp.avgGuests) / comp.avgGuests) * 100 : 0;
    return { revDiff: Math.round(revDiff), guestDiff: Math.round(guestDiff) };
  }, [comp, totalRevenue, totalGuests]);

  // === AI Alerts ===
  const alerts: Alert[] = useMemo(() => {
  const _alerts: Alert[] = [];
  occupiedTables.forEach(t => {
    if (t.sentCount > 0) {
      const sentOrders = t.orders.filter(o => o.state === 'sent_to_kitchen' || o.state === 'sent_to_bar');
      const oldestSent = Math.min(...sentOrders.map(o => o.timestamp));
      const waitMins = Math.floor((now - oldestSent) / 60000);
      if (waitMins >= 20) {
        _alerts.push({ id: `wait-food-${t.id}`, type: 'warning', icon: <IconClock className="w-4 h-4" />, title: `Wartet seit ${waitMins} Min auf Essen`, description: `${t.sentCount} Bestellung(en) in Zubereitung`, tableId: t.id, tableName: t.name, priority: waitMins, timestamp: oldestSent });
      }
    }
    if (t.readyCount > 0) {
      const readyOrders = t.orders.filter(o => o.state === 'ready');
      const oldestReady = Math.min(...readyOrders.map(o => o.timestamp));
      const readyMins = Math.floor((now - oldestReady) / 60000);
      if (readyMins >= 5) {
        _alerts.push({ id: `ready-pickup-${t.id}`, type: 'warning', icon: <IconToolsKitchen className="w-4 h-4" />, title: `Essen fertig seit ${readyMins} Min`, description: `${t.readyCount} Gericht(e) warten auf Abholung`, tableId: t.id, tableName: t.name, priority: readyMins + 50, timestamp: oldestReady });
      }
    }
    if (t.orders.length === 0 && t.duration >= 10) {
      _alerts.push({ id: `no-order-${t.id}`, type: 'info', icon: <IconCircleDot className="w-4 h-4" />, title: `Seit ${t.duration} Min ohne Bestellung`, description: 'Vergessen? Gast fragen ob er bestellen möchte', tableId: t.id, tableName: t.name, priority: t.duration, timestamp: t.startTime });
    }
    if (t.servedCount > 0 && t.orderedCount === 0 && t.sentCount === 0 && t.readyCount === 0) {
      const lastOrderTime = Math.max(...t.orders.map(o => o.timestamp));
      const sinceLast = Math.floor((now - lastOrderTime) / 60000);
      const hasDessert = t.orders.some(o => o.course === 'dessert');
      const hasDrinkRecently = t.orders.some(o => o.routing === 'bar' && (now - o.timestamp) < 15 * 60000);
      if (sinceLast >= 15 && !hasDessert) {
        _alerts.push({ id: `upsell-dessert-${t.id}`, type: 'upsell', icon: <IconCoffee className="w-4 h-4" />, title: 'Dessert oder Getränk anbieten?', description: `Letzte Bestellung vor ${sinceLast} Min`, tableId: t.id, tableName: t.name, priority: 10, timestamp: lastOrderTime });
      }
      if (sinceLast >= 25 && !hasDrinkRecently) {
        _alerts.push({ id: `upsell-drink-${t.id}`, type: 'upsell', icon: <IconCoffee className="w-4 h-4" />, title: 'Nachgetränk anbieten?', description: `Seit ${sinceLast} Min kein neues Getränk`, tableId: t.id, tableName: t.name, priority: 5, timestamp: lastOrderTime });
      }
    }
    // Drink reorder timer: if all drinks served and last drink order > 20 min ago
    const drinkOrders = t.orders.filter(o => o.routing === 'bar' && o.state === 'served');
    if (drinkOrders.length > 0) {
      const lastDrinkTime = Math.max(...drinkOrders.map(o => o.timestamp));
      const sinceDrink = Math.floor((now - lastDrinkTime) / 60000);
      const hasPendingDrink = t.orders.some(o => o.routing === 'bar' && (o.state === 'ordered' || o.state === 'sent_to_bar' || o.state === 'ready'));
      if (sinceDrink >= 20 && !hasPendingDrink && t.status !== 'free') {
        _alerts.push({ id: `drink-reorder-${t.id}`, type: 'upsell', icon: <IconHourglass className="w-4 h-4" />, title: 'Getränke-Nachbestellung?', description: `Letztes Getränk vor ${sinceDrink} Min serviert`, tableId: t.id, tableName: t.name, priority: 8, timestamp: lastDrinkTime });
      }
    }
    const allergyPattern = /allergi|nuss|nuess|laktose|gluten|vegan|vegetar|unvertraeglich|intoleran/i;
    const allergyNotes = t.notes.filter(n => allergyPattern.test(n));
    const allergyOrderNotes = t.orders.filter(o => o.notes && allergyPattern.test(o.notes)).map(o => o.notes!);
    const allAllergyHints = [...allergyNotes, ...allergyOrderNotes];
    if (allAllergyHints.length > 0) {
      _alerts.push({ id: `allergy-${t.id}`, type: 'allergy', icon: <IconAlertTriangle className="w-4 h-4" />, title: 'Allergie-Hinweis', description: allAllergyHints.join(', '), tableId: t.id, tableName: t.name, priority: 100, timestamp: t.startTime });
    }
  });

  const totalSentKitchen = Object.values(state.sessions).reduce((sum, session) => sum + session.orders.filter(o => o.state === 'sent_to_kitchen').length, 0);
  const totalSentBar = Object.values(state.sessions).reduce((sum, session) => sum + session.orders.filter(o => o.state === 'sent_to_bar').length, 0);
  if (totalSentKitchen >= 8) {
    _alerts.push({ id: 'kitchen-overload', type: 'warning', icon: <IconTrendingUp className="w-4 h-4" />, title: 'Küche unter Druck', description: `${totalSentKitchen} offene Bestellungen in der Küche`, tableId: '', tableName: 'Küche', priority: 80, timestamp: now });
  }
  if (totalSentBar >= 6) {
    _alerts.push({ id: 'bar-overload', type: 'warning', icon: <IconTrendingUp className="w-4 h-4" />, title: 'Bar unter Druck', description: `${totalSentBar} offene Bestellungen an der Bar`, tableId: '', tableName: 'Bar', priority: 75, timestamp: now });
  }
  return _alerts;
  }, [occupiedTables, now, state.sessions]);

  // Waitlist stats
  const waitlistEntries = loadWaitlist();
  const waitlistWaiting = waitlistEntries.filter(e => e.status === 'waiting' || e.status === 'notified').length;
  const waitlistAvgWait = waitlistWaiting > 0 ? Math.round(waitlistEntries.filter(e => e.status === 'waiting' || e.status === 'notified').reduce((s, e) => s + e.estimatedWaitMinutes, 0) / waitlistWaiting) : 0;

  // OpenTable-style reservation stats
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allReservations = useMemo(() => loadReservations(), [now]); // now triggers periodic refresh
  const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
  const todayReservationsAll = useMemo(() => allReservations.filter(r => r.date === todayStr), [allReservations, todayStr]);
  const cancelledCovers = useMemo(() => todayReservationsAll.filter(r => r.status === 'cancelled').reduce((s, r) => s + r.partySize, 0), [todayReservationsAll]);
  const cancelledCount = useMemo(() => todayReservationsAll.filter(r => r.status === 'cancelled').length, [todayReservationsAll]);
  const noShowCovers = useMemo(() => todayReservationsAll.filter(r => r.status === 'no_show').reduce((s, r) => s + r.partySize, 0), [todayReservationsAll]);
  const noShowCount = useMemo(() => todayReservationsAll.filter(r => r.status === 'no_show').length, [todayReservationsAll]);
  const shortNoticeCovers = useMemo(() => {
    return todayReservationsAll.filter(r => {
      if (!r.createdAt) return false;
      const [rh, rm] = r.time.split(':').map(Number);
      const resDate = new Date(r.date + 'T' + rh.toString().padStart(2, '0') + ':' + rm.toString().padStart(2, '0') + ':00');
      const created = new Date(r.createdAt);
      const diffHours = (resDate.getTime() - created.getTime()) / 3600000;
      return diffHours < 3 && diffHours >= 0;
    }).reduce((s, r) => s + r.partySize, 0);
  }, [todayReservationsAll]);
  const totalReservationCovers = useMemo(() => todayReservationsAll.filter(r => r.status !== 'cancelled').reduce((s, r) => s + r.partySize, 0), [todayReservationsAll]);
  const totalReservationParties = useMemo(() => todayReservationsAll.filter(r => r.status !== 'cancelled').length, [todayReservationsAll]);

  void alerts; void dismissedAlerts;

  void trendInfo; void tablesServed; void avgPerTable; void totalReadyItems; void realTips; void tipCount;

  const shiftOptions: { value: ShiftFilter; label: string; icon: React.ReactNode }[] = [
    { value: 'alle', label: 'Alle Schichten', icon: <IconClock className="w-4 h-4" /> },
    { value: 'Fruehstueck', label: 'Frühstück', icon: <IconSun className="w-4 h-4" /> },
    { value: 'Lunch', label: 'Lunch', icon: <IconToolsKitchen2 className="w-4 h-4" /> },
    { value: 'Dinner', label: 'Dinner', icon: <IconMoon className="w-4 h-4" /> },
  ];
  const timeOptions: { value: TimeRangeFilter; label: string }[] = [
    { value: 'heute', label: 'Heute' },
    { value: '7tage', label: 'Letzte 7 Tage' },
    { value: '30tage', label: 'Letzte 30 Tage' },
    { value: 'alle', label: 'Alle Daten' },
  ];
  const sourceOptions: { value: SourceFilter; label: string; color: string }[] = [
    { value: 'alle', label: 'Alle Quellen', color: 'text-vilo-text-soft' },
    { value: 'walk_in', label: 'Walk-In', color: 'text-amber-400' },
    { value: 'phone', label: 'Telefon / Im Haus', color: 'text-emerald-400' },
    { value: 'online', label: 'Online', color: 'text-blue-400' },
  ];
  const sortOptions: { value: SortMode; label: string }[] = [
    { value: 'umsatz', label: 'Nach Umsatz' },
    { value: 'gaeste', label: 'Nach Gästen' },
    { value: 'zeit', label: 'Nach Zeit' },
  ];

  // === DRILL DOWN: Einnahmen ===
  if (drillDown === 'einnahmen') {
    return (
      <div className="absolute inset-0 z-40 bg-[#1a1a2e] flex flex-col">
        <header className="bg-[#1f1d33] border-b border-[#2c2947] px-4 py-2.5">
          <button onClick={() => setDrillDown(null)} className="flex items-center gap-2 text-[#d8c7ff] hover:text-white transition-colors">
            <IconChevronLeft className="w-4 h-4" />
                    <span className="text-[13px] font-medium">Zurück</span>
                  </button>
                </header>
                <div className="flex-1 overflow-y-auto px-4 py-6">
                  <h1 className="text-white text-3xl font-bold mb-6">Einnahmen</h1>
          <p className="text-white text-2xl font-bold">{totalRevenue.toFixed(2)} <span className="text-vilo-text-secondary text-lg font-normal">&euro; Diese Schicht</span></p>
          <ComparisonBar current={totalRevenue} comparison={comp.avgRevenue} color="#8b5cf6" currentLabel="Aktuell" compLabel="Vergleich" />
          <p className="text-vilo-text-secondary text-sm mt-3"><span className="text-white font-bold">{comp.avgRevenue.toFixed(2)} &euro;</span> in den {comp.comparisonLabel}</p>

          <div className="border-t border-vilo-border-subtle my-6" />
          <h2 className="text-white text-2xl font-bold mb-4">Durchschnitt</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-vilo-card border border-vilo-border-subtle px-4 py-3">
              <p className="text-white text-[28px] font-bold leading-none">{avgPerGuest.toFixed(2)} &euro;</p>
              <p className="text-[#9f9aba] text-[13px] mt-2">pro Gast</p>
            </div>
            <div className="bg-vilo-card border border-vilo-border-subtle px-4 py-3">
              <p className="text-white text-[28px] font-bold leading-none">{avgPerGroup.toFixed(2)} &euro;</p>
              <p className="text-[#9f9aba] text-[13px] mt-2">pro Gruppe</p>
            </div>
          </div>

          <div className="border-t border-vilo-border-subtle my-6" />
          <h2 className="text-white text-2xl font-bold mb-4">Trinkgeld</h2>
          <div className="bg-vilo-card border border-vilo-border-subtle px-4 py-3">
            <p className="text-white text-[28px] font-bold leading-none">{realTips.toFixed(2)} &euro;</p>
            <p className="text-[#9f9aba] text-[13px] mt-2">{tipCount} Zahlung{tipCount !== 1 ? 'en' : ''} &middot; {tipCount > 0 ? (realTips / tipCount).toFixed(2) : '0.00'} &euro; pro Zahlung</p>
          </div>

          <div className="border-t border-vilo-border-subtle my-6" />
          <h2 className="text-white text-2xl font-bold mb-4">Aufschlüsselung</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-vilo-text-secondary">Aktive Tische</span>
              <span className="text-white font-medium">{activeRevenue.toFixed(2)} &euro;</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-vilo-text-secondary">Abgeschlossene Tische</span>
              <span className="text-white font-medium">{state.closedTableRevenue.toFixed(2)} &euro;</span>
            </div>
            <div className="border-t border-vilo-border-subtle pt-3 flex justify-between items-center">
              <span className="text-vilo-text-soft font-medium">Gesamt</span>
              <span className="text-white font-bold">{totalRevenue.toFixed(2)} &euro;</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === DRILL DOWN: Schichtstatistiken ===
  if (drillDown === 'schichtstatistiken') {
    return (
      <div className="absolute inset-0 z-40 bg-[#1a1a2e] flex flex-col">
        <header className="bg-[#1f1d33] border-b border-[#2c2947] px-4 py-2.5">
          <button onClick={() => setDrillDown(null)} className="flex items-center gap-2 text-[#d8c7ff] hover:text-white transition-colors">
            <IconChevronLeft className="w-4 h-4" />
                    <span className="text-[13px] font-medium">Zurück</span>
                  </button>
                </header>
                <div className="flex-1 overflow-y-auto px-4 py-6">
                  <h1 className="text-white text-[32px] leading-none font-bold mb-5">Schichtstatistiken</h1>
          {activeFilterCount > 0 && <p className="text-[#b1d9ff] text-xs mb-2">{activeFilterCount} Filter aktiv</p>}
          <p className="text-white text-2xl font-bold">{filteredTotalGuests} <span className="text-vilo-text-secondary text-lg font-normal">          Gäste{statFilters.source !== 'alle' ? ` (${sourceOptions.find(s => s.value === statFilters.source)?.label})` : ''}</span></p>
                    <ComparisonBar current={filteredTotalGuests} comparison={comp.avgGuests} color="#8b5cf6" currentLabel="Aktuell" compLabel="Vergleich" />
                    <p className="text-vilo-text-secondary text-sm mt-3"><span className="text-white font-bold">{comp.avgGuests}</span> platzierte Gäste an den {comp.comparisonLabel}</p>

                    <div className="border-t border-vilo-border-subtle my-6" />
                    <h2 className="text-white text-xl font-bold mb-4">Platzierte Gäste nach Quelle</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="text-vilo-text-soft flex-1">Telefon/Im Haus</span>
              <span className="text-white font-bold">{sourcePhone}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="text-vilo-text-soft flex-1">Walk-In</span>
              <span className="text-white font-bold">{sourceWalkIn}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-400" />
              <span className="text-vilo-text-soft flex-1">Online</span>
              <span className="text-white font-bold">{sourceOnline}</span>
            </div>
          </div>
          {totalGuests > 0 && (
            <div className="flex h-4 rounded-full overflow-hidden mt-4">
              <div className="bg-emerald-400" style={{ width: `${(sourcePhone / totalGuests) * 100}%` }} />
              <div className="bg-amber-400" style={{ width: `${(sourceWalkIn / totalGuests) * 100}%` }} />
              <div className="bg-blue-400" style={{ width: `${(sourceOnline / totalGuests) * 100}%` }} />
            </div>
          )}

          <div className="border-t border-vilo-border-subtle my-6" />
          <h2 className="text-white text-xl font-bold mb-4">Tisch-Übersicht</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-vilo-card border border-vilo-border-subtle px-4 py-3 text-center">
              <p className="text-white text-[28px] font-bold leading-none">{totalTablesServed}</p>
              <p className="text-[#9f9aba] text-[12px] mt-2">Tische gesamt</p>
            </div>
            <div className="bg-vilo-card border border-vilo-border-subtle px-4 py-3 text-center">
              <p className="text-[#cf45f3] text-[28px] font-bold leading-none">{freeTables.length}</p>
              <p className="text-[#9f9aba] text-[12px] mt-2">Frei</p>
            </div>
            <div className="bg-vilo-card border border-vilo-border-subtle px-4 py-3 text-center">
              <p className="text-[#d8c7ff] text-[28px] font-bold leading-none">{occupiedTables.length}</p>
              <p className="text-[#9f9aba] text-[12px] mt-2">Besetzt</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === DRILL DOWN: Schichtfluss ===
  if (drillDown === 'schichtfluss') {
    const peakHour = hourlyData.reduce((max, d) => d.count > max.count ? d : max, hourlyData[0]);
    const totalGroups = state.closedTables.length + occupiedTables.length;
    const bigGroups = state.closedTables.filter(t => t.guestCount >= 8).length;
    return (
      <div className="absolute inset-0 z-40 bg-[#1a1a2e] flex flex-col">
        <header className="bg-[#1f1d33] border-b border-[#2c2947] px-4 py-2.5">
          <button onClick={() => setDrillDown(null)} className="flex items-center gap-2 text-[#d8c7ff] hover:text-white transition-colors">
            <IconChevronLeft className="w-4 h-4" />
                    <span className="text-[13px] font-medium">Zurück</span>
                  </button>
                </header>
                <div className="flex-1 overflow-y-auto px-4 py-6">
                  <h1 className="text-white text-3xl font-bold mb-6">Schichtfluss</h1>
          <div className="flex justify-between items-start mb-2">
            <p className="text-vilo-text-secondary text-sm"><span className="text-white font-bold">{currentHourGuests}</span>             platzierte Gäste um {currentHourTime}</p>
                        <p className="text-white font-bold text-sm">{totalGroups} <span className="text-vilo-text-secondary font-normal">Gruppen ({bigGroups} groß)</span></p>
          </div>
          <HourlyBarChart data={hourlyData} accentColor="#8b5cf6" />

          <div className="border-t border-vilo-border-subtle my-6" />
          <h2 className="text-white text-[22px] font-bold mb-3">Gäste-Anzahlbericht</h2>
          <div className="space-y-3">
            {peakHour && (
              <div className="bg-vilo-card border border-vilo-border-subtle px-4 py-3">
                <p className="text-[#9f9aba] text-[12px]">Spitzenzeit</p>
                <p className="text-white font-bold text-[24px] mt-2 leading-none">{peakHour.hour} &middot; {peakHour.count} Gäste</p>
              </div>
            )}
            <div className="bg-vilo-card border border-vilo-border-subtle px-4 py-3">
              <p className="text-[#9f9aba] text-[12px]">Durchschnitt pro Stunde</p>
              <p className="text-white font-bold text-[24px] mt-2 leading-none">{hourlyData.length > 0 ? (totalGuests / hourlyData.length).toFixed(1) : '0'} Gäste</p>
            </div>
          </div>
          <div className="border-t border-vilo-border-subtle my-6" />
          <p className="text-vilo-text-muted text-xs text-center">{bigGroups} große Gruppen in dieser Schicht</p>
        </div>
      </div>
    );
  }

  // === FILTER MODAL ===
  if (showFilter) {
    return (
      <div className="absolute inset-0 z-40 bg-[#1a1a2e] flex flex-col">
        <header className="bg-[#1f1d33] border-b border-[#2c2947] px-4 py-2.5 flex items-center justify-between">
          <button onClick={() => setShowFilter(false)} className="flex items-center gap-2 text-[#d8c7ff] hover:text-white transition-colors">
            <IconChevronLeft className="w-4 h-4" />
                      <span className="text-[13px] font-medium">Zurück</span>
                    </button>
                    <h1 className="text-white font-semibold">Filter</h1>
                    <button onClick={() => { setStatFilters({ shift: 'alle', timeRange: 'heute', source: 'alle', sort: 'umsatz' }); }} className="text-[#d8c7ff] text-[13px] font-medium hover:text-white transition-colors">Zurücksetzen</button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* Schicht */}
          <div>
            <h3 className="text-vilo-text-secondary text-xs font-semibold uppercase tracking-wider mb-3">Schicht</h3>
            <div className="grid grid-cols-2 gap-2">
              {shiftOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatFilters(prev => ({ ...prev, shift: opt.value }))}
                  className={`flex items-center gap-2 px-3 py-3 rounded-xl border transition-all ${
                    statFilters.shift === opt.value
                      ? 'bg-[#7bb7ef]/20 border-violet-500/50 text-[#b1d9ff]'
                      : 'bg-vilo-surface/60 border-vilo-border-subtle text-vilo-text-secondary'
                  }`}
                >
                  {opt.icon}
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Zeitraum */}
          <div>
            <h3 className="text-vilo-text-secondary text-xs font-semibold uppercase tracking-wider mb-3">Zeitraum</h3>
            <div className="grid grid-cols-2 gap-2">
              {timeOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatFilters(prev => ({ ...prev, timeRange: opt.value }))}
                  className={`flex items-center gap-2 px-3 py-3 rounded-xl border transition-all ${
                    statFilters.timeRange === opt.value
                      ? 'bg-[#7bb7ef]/20 border-violet-500/50 text-[#b1d9ff]'
                      : 'bg-vilo-surface/60 border-vilo-border-subtle text-vilo-text-secondary'
                  }`}
                >
                  <IconCalendar className="w-4 h-4" />
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

                    {/* Gäste-Quelle */}
                    <div>
                      <h3 className="text-vilo-text-secondary text-xs font-semibold uppercase tracking-wider mb-3">Gäste-Quelle</h3>
            <div className="grid grid-cols-2 gap-2">
              {sourceOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatFilters(prev => ({ ...prev, source: opt.value }))}
                  className={`flex items-center gap-2 px-3 py-3 rounded-xl border transition-all ${
                    statFilters.source === opt.value
                      ? 'bg-[#7bb7ef]/20 border-violet-500/50 text-[#b1d9ff]'
                      : 'bg-vilo-surface/60 border-vilo-border-subtle text-vilo-text-secondary'
                  }`}
                >
                  <IconUsers className="w-4 h-4" />
                  <span className={`text-sm font-medium ${statFilters.source === opt.value ? '' : opt.color}`}>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sortierung */}
          <div>
            <h3 className="text-vilo-text-secondary text-xs font-semibold uppercase tracking-wider mb-3">Sortierung</h3>
            <div className="grid grid-cols-3 gap-2">
              {sortOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatFilters(prev => ({ ...prev, sort: opt.value }))}
                  className={`px-3 py-3 rounded-xl border transition-all text-center ${
                    statFilters.sort === opt.value
                      ? 'bg-[#7bb7ef]/20 border-violet-500/50 text-[#b1d9ff]'
                      : 'bg-vilo-surface/60 border-vilo-border-subtle text-vilo-text-secondary'
                  }`}
                >
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Apply Button */}
        <div className="px-4 py-4 border-t border-vilo-border-subtle">
          <button
            onClick={() => setShowFilter(false)}
            className="w-full py-3 rounded-xl bg-[#7bb7ef] text-white font-semibold transition-all active:bg-violet-700"
          >
            Filter anwenden {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
        </div>
      </div>
    );
  }

  // === DRILL DOWN: Warteliste ===
  if (drillDown === 'warteliste') {
    const wEntries = loadWaitlist().filter(e => e.status === 'waiting' || e.status === 'notified');
    const seatedEntries = loadWaitlist().filter(e => e.status === 'seated');
    const waitByHour: Record<number, { count: number; totalWait: number }> = {};
    [...wEntries, ...seatedEntries].forEach(e => {
      const h = new Date(e.addedAt).getHours();
      if (!waitByHour[h]) waitByHour[h] = { count: 0, totalWait: 0 };
      waitByHour[h].count++;
      waitByHour[h].totalWait += e.estimatedWaitMinutes;
    });
    return (
      <div className="absolute inset-0 z-40 bg-[#1a1a2e] flex flex-col">
        <header className="bg-[#1f1d33] border-b border-[#2c2947] px-4 py-2.5">
          <button onClick={() => setDrillDown(null)} className="flex items-center gap-2 text-[#d8c7ff] hover:text-white transition-colors">
            <IconChevronLeft className="w-4 h-4" />
                    <span className="text-[13px] font-medium">Zurück</span>
                  </button>
                </header>
                <div className="flex-1 overflow-y-auto px-4 py-6">
                  <h1 className="text-white text-[32px] leading-none font-bold mb-5">Warteliste</h1>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-vilo-card border border-vilo-border-subtle px-4 py-3">
              <p className="text-[#9f9aba] text-[12px] mb-1">Aktuell wartend</p>
              <p className="text-white text-[24px] font-bold leading-none">{wEntries.length}</p>
            </div>
            <div className="bg-vilo-card border border-vilo-border-subtle px-4 py-3">
              <p className="text-[#9f9aba] text-[12px] mb-1">⌀ Wartezeit</p>
              <p className="text-white text-[24px] font-bold leading-none">{wEntries.length > 0 ? Math.round(wEntries.reduce((s, e) => s + e.estimatedWaitMinutes, 0) / wEntries.length) : 0} Min</p>
            </div>
          </div>
          {Object.keys(waitByHour).length > 0 && (
            <>
              <h2 className="text-white text-[18px] font-bold mb-2">Wartezeiten nach Uhrzeit</h2>
              <div className="space-y-2 mb-5">
                {Object.entries(waitByHour).sort(([a], [b]) => Number(a) - Number(b)).map(([hour, data]) => (
                  <div key={hour} className="flex items-center gap-3">
                    <span className="text-[#9f9aba] text-[12px] w-12">{hour}:00</span>
                    <div className="flex-1 bg-vilo-card h-6 overflow-hidden">
                      <div className="bg-gradient-to-r from-[#8d53ff] to-[#cf45f3] h-full flex items-center px-2" style={{ width: `${Math.min((data.count / Math.max(...Object.values(waitByHour).map(d => d.count))) * 100, 100)}%` }}>
                        <span className="text-white text-xs font-medium">{data.count} Gäste</span>
                      </div>
                    </div>
                    <span className="text-[#9f9aba] text-[11px] w-16 text-right">{Math.round(data.totalWait / data.count)} Min</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {wEntries.length > 0 && (
            <>
              <h2 className="text-white text-[18px] font-bold mb-2">Aktuelle Warteliste</h2>
              <div className="space-y-2">
                {wEntries.map(e => {
                  const waitMins = Math.floor((Date.now() - e.addedAt) / 60000);
                  return (
                    <div key={e.id} className="bg-vilo-card border border-vilo-border-subtle px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-white text-[15px] font-semibold leading-none">{e.guestName}</p>
                        <p className="text-[#9f9aba] text-[12px] mt-1">{e.partySize} Pers. {e.seatPreference ? `· ${e.seatPreference}` : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-[15px] font-bold leading-none ${waitMins > e.estimatedWaitMinutes ? 'text-[#ff6b7d]' : 'text-[#cf45f3]'}`}>{waitMins} Min</p>
                        <p className="text-[#8d87a8] text-[11px] mt-1">gesch. {e.estimatedWaitMinutes} Min</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // === MAIN DASHBOARD ===
  return (
    <div className="h-full bg-[#1a1a2e] flex flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {/* Pull-to-refresh indicator */}
        {pullY > 0 && (
          <div className="flex justify-center py-2 transition-all" style={{ height: pullY > 60 ? 48 : pullY * 0.6 }}>
            <div className={`text-[#b1d9ff] text-xs font-medium ${isRefreshing ? 'animate-spin' : ''}`}>
              {isRefreshing ? '⟳' : pullY > 60 ? '↑ Loslassen zum Aktualisieren' : '↓ Ziehen zum Aktualisieren'}
            </div>
          </div>
        )}
        {/* STATISTIKEN TAB */}
        {activeTab === 'statistiken' && (
          <div className="py-3 animate-fadeIn">
            {/* Active filter chips */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <button onClick={() => setShowFilter(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-vilo-surface/60 border border-vilo-border-subtle transition-all active:bg-vilo-elevated">
                <IconAdjustments className="w-4 h-4 text-vilo-text-secondary" />
                <span className="text-vilo-text-soft text-sm">Filter</span>
                {activeFilterCount > 0 && (
                  <span className="text-xs rounded-full bg-[#7bb7ef] text-white px-1.5 py-0.5 font-bold ml-1">{activeFilterCount}</span>
                )}
              </button>
              {statFilters.shift !== 'alle' && (
                <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#7bb7ef]/20 border border-violet-500/40 text-[#b1d9ff] text-xs font-medium">
                  {statFilters.shift}
                  <button onClick={() => setStatFilters(p => ({ ...p, shift: 'alle' }))} className="ml-0.5"><IconX className="w-3 h-3" /></button>
                </span>
              )}
              {statFilters.timeRange !== 'heute' && (
                <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#7bb7ef]/20 border border-violet-500/40 text-[#b1d9ff] text-xs font-medium">
                  {timeOptions.find(t => t.value === statFilters.timeRange)?.label}
                  <button onClick={() => setStatFilters(p => ({ ...p, timeRange: 'heute' }))} className="ml-0.5"><IconX className="w-3 h-3" /></button>
                </span>
              )}
              {statFilters.source !== 'alle' && (
                <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#7bb7ef]/20 border border-violet-500/40 text-[#b1d9ff] text-xs font-medium">
                  {sourceOptions.find(s => s.value === statFilters.source)?.label}
                  <button onClick={() => setStatFilters(p => ({ ...p, source: 'alle' }))} className="ml-0.5"><IconX className="w-3 h-3" /></button>
                </span>
              )}
            </div>

            {/* Einnahmen */}
            <button onClick={() => setDrillDown('einnahmen')} className="w-full text-left mb-6">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-white text-xl font-bold">Einnahmen</h2>
                {trendInfo && trendInfo.revDiff !== 0 && (
                  <span className={`flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${trendInfo.revDiff > 0 ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'}`}>
                    {trendInfo.revDiff > 0 ? <IconArrowUpRight className="w-3 h-3" /> : <IconArrowDownRight className="w-3 h-3" />}
                    {Math.abs(trendInfo.revDiff)}%
                  </span>
                )}
                <IconChevronRight className="w-5 h-5 text-vilo-text-muted" />
              </div>
              <div className="flex items-baseline gap-4 flex-wrap">
                <p className="text-white text-lg font-bold">{statFilters.source !== 'alle' ? filteredRevenue.toFixed(2) : totalRevenue.toFixed(2)} &euro; <span className="text-vilo-text-secondary text-sm font-normal">Diese Schicht{statFilters.source !== 'alle' ? ` (${sourceOptions.find(s => s.value === statFilters.source)?.label})` : ''}</span></p>
                <p className="text-vilo-text-secondary text-sm"><span className="font-bold text-white">{comp.avgRevenue.toFixed(2)} &euro;</span> in den {comp.comparisonLabel}</p>
              </div>
              <ComparisonBar current={statFilters.source !== 'alle' ? filteredRevenue : totalRevenue} comparison={comp.avgRevenue} color="#8b5cf6" currentLabel="Aktuell" compLabel="Vergleich" />
            </button>

            <div className="border-t border-vilo-border-subtle my-2" />

            {/* Schichtstatistiken */}
            <button onClick={() => setDrillDown('schichtstatistiken')} className="w-full text-left mb-6 mt-4">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-white text-xl font-bold">Schichtstatistiken</h2>
                {trendInfo && trendInfo.guestDiff !== 0 && (
                  <span className={`flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${trendInfo.guestDiff > 0 ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'}`}>
                    {trendInfo.guestDiff > 0 ? <IconArrowUpRight className="w-3 h-3" /> : <IconArrowDownRight className="w-3 h-3" />}
                    {Math.abs(trendInfo.guestDiff)}%
                  </span>
                )}
                <IconChevronRight className="w-5 h-5 text-vilo-text-muted" />
              </div>
              <div className="flex items-baseline gap-4 flex-wrap">
                <p className="text-white text-lg font-bold">{filteredTotalGuests} <span className="text-vilo-text-secondary text-sm font-normal">                Gäste{statFilters.source !== 'alle' ? ` (${sourceOptions.find(s => s.value === statFilters.source)?.label})` : ''}</span></p>
                                <p className="text-vilo-text-secondary text-sm"><span className="font-bold text-white">{comp.avgGuests}</span> platzierte Gäste an den {comp.comparisonLabel}</p>
              </div>
              <ComparisonBar current={filteredTotalGuests} comparison={comp.avgGuests} color="#8b5cf6" currentLabel="Aktuell" compLabel="Vergleich" />
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                {(statFilters.source === 'alle' || statFilters.source === 'phone') && (<><span className="text-emerald-400 font-bold text-sm">{sourcePhone}</span><span className="text-vilo-text-secondary text-xs">Telefon/Im Haus</span></>)}
                {(statFilters.source === 'alle' || statFilters.source === 'walk_in') && (<><span className="text-amber-400 font-bold text-sm">{sourceWalkIn}</span><span className="text-vilo-text-secondary text-xs">Walk-In</span></>)}
                {(statFilters.source === 'alle' || statFilters.source === 'online') && (<><span className="text-blue-400 font-bold text-sm">{sourceOnline}</span><span className="text-vilo-text-secondary text-xs">Online</span></>)}
              </div>
              {filteredTotalGuests > 0 && (
                <div className="flex h-3 rounded-full overflow-hidden mt-2">
                  {(statFilters.source === 'alle' || statFilters.source === 'phone') && <div className="bg-emerald-400" style={{ width: `${(filteredSourcePhone / filteredTotalGuests) * 100}%` }} />}
                  {(statFilters.source === 'alle' || statFilters.source === 'walk_in') && <div className="bg-amber-400" style={{ width: `${(filteredSourceWalkIn / filteredTotalGuests) * 100}%` }} />}
                  {(statFilters.source === 'alle' || statFilters.source === 'online') && <div className="bg-blue-400" style={{ width: `${(filteredSourceOnline / filteredTotalGuests) * 100}%` }} />}
                </div>
              )}
            </button>

            <div className="border-t border-vilo-border-subtle my-2" />

            {/* Schichtfluss */}
            <button onClick={() => setDrillDown('schichtfluss')} className="w-full text-left mb-6 mt-4">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-white text-xl font-bold">Schichtfluss</h2>
                <IconChevronRight className="w-5 h-5 text-vilo-text-muted" />
              </div>
              <div className="flex justify-between items-center mb-1">
                <p className="text-vilo-text-secondary text-sm"><span className="text-white font-bold">{currentHourGuests}</span>                 platzierte Gäste um {currentHourTime}</p>
                                <p className="text-white font-bold text-sm">{state.closedTables.length + occupiedTables.length} Gruppen</p>
              </div>
              <HourlyBarChart data={hourlyData} accentColor="#8b5cf6" />
            </button>

            <div className="border-t border-vilo-border-subtle my-2" />

            {/* Durchschnitt */}
            <div className="mt-4 mb-6">
              <h2 className="text-white text-xl font-bold mb-3">Durchschnitt</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-vilo-card border border-vilo-border-subtle px-4 py-3">
                  <p className="text-white text-[24px] font-bold leading-none">{avgPerGuest.toFixed(2)} &euro;</p>
                  <p className="text-[#9f9aba] text-[12px] mt-2">pro Gast</p>
                </div>
                <div className="bg-vilo-card border border-vilo-border-subtle px-4 py-3">
                  <p className="text-white text-[24px] font-bold leading-none">{avgPerGroup.toFixed(2)} &euro;</p>
                  <p className="text-[#9f9aba] text-[12px] mt-2">pro Gruppe</p>
                </div>
              </div>
              {avgTableDuration > 0 && (
                <div className="bg-vilo-card border border-vilo-border-subtle px-4 py-3 mt-3">
                  <div className="flex items-center gap-2">
                    <IconHourglass className="w-4 h-4 text-[#9f9aba]" />
                    <p className="text-white text-[24px] font-bold leading-none">{avgTableDuration} Min</p>
                  </div>
                  <p className="text-[#9f9aba] text-[12px] mt-2">⌀ Tischzeit</p>
                </div>
              )}
            </div>

            {/* Tisch-Performance Ranking */}
            {tablePerformance.length > 0 && (
              <>
                <div className="border-t border-vilo-border-subtle my-2" />
                <div className="mt-4 mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <IconTrophy className="w-5 h-5 text-amber-400" />
                    <h2 className="text-white text-xl font-bold">Tisch-Ranking</h2>
                  </div>
                  <div className="space-y-2">
                    {tablePerformance.slice(0, 5).map((tp, i) => (
                      <div key={tp.id} className="flex items-center justify-between bg-vilo-surface/60 rounded-xl border border-vilo-border-subtle p-3">
                        <div className="flex items-center gap-3">
                          <span className={`text-lg font-bold ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-vilo-text-soft' : i === 2 ? 'text-orange-400' : 'text-vilo-text-muted'}`}>#{i + 1}</span>
                          <div>
                            <p className="text-white text-sm font-semibold">{tp.name}</p>
                            <p className="text-vilo-text-secondary text-xs">{tp.orderTotal.toFixed(2)} &euro; &middot; {tp.duration}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-emerald-400 text-sm font-bold">{tp.euroPerHour.toFixed(0)} &euro;/h</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="border-t border-vilo-border-subtle my-2" />

            {/* Trinkgeld */}
            <div className="mt-3 mb-5">
              <h2 className="text-white text-[18px] font-bold mb-2">Trinkgeld</h2>
              <div className="bg-vilo-card border border-vilo-border-subtle px-4 py-2.5">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-white text-[20px] font-bold leading-none">{realTips.toFixed(2)} &euro;</p>
                    <p className="text-[#9f9aba] text-[11px] mt-1.5">{tipCount} Zahlung{tipCount !== 1 ? 'en' : ''} mit Trinkgeld</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-[20px] font-bold leading-none">{tipCount > 0 ? (realTips / tipCount).toFixed(2) : '0.00'} &euro;</p>
                    <p className="text-[#9f9aba] text-[11px] mt-1.5">pro Zahlung</p>
                  </div>
                </div>
              </div>
            </div>

            {/* OpenTable-Style: Shift Overview Kennzahlen */}
            <div className="border-t border-vilo-border-subtle my-2" />
            <div className="mt-3 mb-5">
              <h2 className="text-white text-[18px] font-bold mb-2">Shift Overview</h2>
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-vilo-card border border-vilo-border-subtle px-4 py-2.5">
                  <p className="text-white text-[20px] font-bold leading-none">{totalReservationParties}</p>
                  <p className="text-[#9f9aba] text-[11px] mt-1.5">Gruppen</p>
                </div>
                <div className="bg-vilo-card border border-vilo-border-subtle px-4 py-2.5">
                  <p className="text-white text-[20px] font-bold leading-none">{totalReservationCovers}</p>
                  <p className="text-[#9f9aba] text-[11px] mt-1.5">Gäste</p>
                </div>
                <div className="bg-vilo-card border border-vilo-border-subtle px-4 py-2.5">
                  <p className="text-white text-[20px] font-bold leading-none">{shortNoticeCovers}</p>
                  <p className="text-[#9f9aba] text-[11px] mt-1.5">Kurzfristig (&lt;3h)</p>
                </div>
                <div className="bg-vilo-card border border-vilo-border-subtle px-4 py-2.5">
                  <p className="text-white text-[20px] font-bold leading-none">{sourceWalkIn}</p>
                  <p className="text-[#9f9aba] text-[11px] mt-1.5">Walk-Ins</p>
                </div>
                <div className="bg-vilo-card border border-vilo-border-subtle px-4 py-2.5">
                  <p className="text-white text-[20px] font-bold leading-none">{avgPerGuest > 0 ? avgPerGuest.toFixed(0) + '\u20AC' : '\u2013'}</p>
                  <p className="text-[#9f9aba] text-[11px] mt-1.5">\u2300 pro Gast</p>
                </div>
                <div className="bg-vilo-card border border-vilo-border-subtle px-4 py-2.5">
                  <p className="text-white text-[20px] font-bold leading-none">{totalRevenue > 0 ? totalRevenue.toFixed(0) + '\u20AC' : '\u2013'}</p>
                  <p className="text-[#9f9aba] text-[11px] mt-1.5">Gesamt-Umsatz</p>
                </div>
              </div>
              {/* Cancelled + No-Shows row */}
              {(cancelledCount > 0 || noShowCount > 0) && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="bg-red-900/20 rounded-xl border border-red-800/30 p-3">
                    <p className="text-red-400 text-lg font-bold">{cancelledCovers}</p>
                    <p className="text-red-400/60 text-[10px]">Storniert ({cancelledCount}x)</p>
                  </div>
                  <div className="bg-amber-900/20 rounded-xl border border-amber-800/30 p-3">
                    <p className="text-amber-400 text-lg font-bold">{noShowCovers}</p>
                    <p className="text-amber-400/60 text-[10px]">No-Shows ({noShowCount}x)</p>
                  </div>
                </div>
              )}
            </div>

            {/* Warteliste */}
            {waitlistWaiting > 0 && (
              <>
                <div className="border-t border-vilo-border-subtle my-2" />
                <button onClick={() => setDrillDown('warteliste')} className="w-full text-left mt-3 mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-white text-[18px] font-bold">Warteliste</h2>
                    <IconChevronRight className="w-5 h-5 text-vilo-text-muted" />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-vilo-card border border-vilo-border-subtle px-4 py-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <IconListNumbers className="w-4 h-4 text-[#cf45f3]" />
                        <p className="text-[#d8c7ff] text-[11px]">Wartend</p>
                      </div>
                      <p className="text-white text-[20px] font-bold leading-none">{waitlistWaiting}</p>
                    </div>
                    <div className="bg-vilo-card border border-vilo-border-subtle px-4 py-2.5">
                      <p className="text-[#9f9aba] text-[11px] mb-1">&empty; Wartezeit</p>
                      <p className="text-white text-[20px] font-bold leading-none">{waitlistAvgWait} Min</p>
                    </div>
                  </div>
                </button>
              </>
            )}
          </div>
        )}

        {/* UEBERSICHT TAB - resmio style */}
        {activeTab === 'uebersicht' && (
          <UebersichtTab
            occupiedTables={occupiedTables}
            freeTables={freeTables}
            totalRevenue={totalRevenue}
            totalPendingItems={totalPendingItems}
          />
        )}
      </div>
    </div>
  );
}
