import { useState, useEffect, useMemo } from 'react';
import { Reservation, Guest, OccasionLabel } from '../types';
import { loadReservations, loadGuests } from '../utils/storage';
import {
  Users, ChevronUp, ChevronDown, Armchair,
  Printer, Download
} from 'lucide-react';
import { IconConfetti, IconHeartFilled, IconGiftFilled, IconHeartHandshake, IconSparkles, IconSchool, IconMasksTheater, IconBriefcaseFilled, IconStarFilled } from '@tabler/icons-react';

interface ReservationListProps {
  onSelectTable?: (tableId: string) => void;
}

function getTodayStr(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Figma source colors
const SOURCE_COLORS: Record<string, string> = {
  phone: '#f59e0b',
  online: '#ec4899',
  walk_in: '#22c55e',
};

// Figma occasion icon badges
const OCCASION_ICONS: Record<string, { Icon: typeof IconConfetti; color: string }> = {
  geburtstag: { Icon: IconConfetti, color: '#22c55e' },
  jahrestag: { Icon: IconHeartFilled, color: '#22c55e' },
  besonderer_anlass: { Icon: IconSparkles, color: '#a855f7' },
  date: { Icon: IconHeartHandshake, color: '#ec4899' },
  geschaeftsessen: { Icon: IconBriefcaseFilled, color: '#a855f7' },
  gratis_extra: { Icon: IconGiftFilled, color: '#22c55e' },
  schulabschluss: { Icon: IconSchool, color: '#3b82f6' },
  theater_kino: { Icon: IconMasksTheater, color: '#f59e0b' },
};

const ALL_TAGS_MAP: Record<string, { label: string; color: string }> = {
  vip: { label: 'VIP', color: '#eab308' },
  stammgast: { label: 'Stammgast', color: '#22d3ee' },
  allergiker: { label: 'Allergiker', color: '#ef4444' },
  vegetarier: { label: 'Vegetarier', color: '#22c55e' },
  vegan: { label: 'Vegan', color: '#16a34a' },
  kinderstuhl: { label: 'Kinderstuhl', color: '#f97316' },
  rollstuhl: { label: 'Rollstuhl', color: '#8b5cf6' },
  geburtstag: { label: 'Geburtstag', color: '#ec4899' },
  business: { label: 'Business', color: '#6366f1' },
  presse: { label: 'Presse', color: '#a78bfa' },
};

export function ReservationList({ onSelectTable: _onSelectTable }: ReservationListProps) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setReservations(loadReservations());
    setGuests(loadGuests());
  }, [refreshKey]);

  useEffect(() => {
    const interval = setInterval(() => setRefreshKey(k => k + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const todayReservations = useMemo(() => {
    const today = getTodayStr();
    return reservations
      .filter(r => r.date === today && r.status !== 'cancelled')
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [reservations]);

  const totalGroups = todayReservations.length;
  const totalGuests = todayReservations.reduce((sum, r) => sum + r.partySize, 0);

  const getGuestForReservation = (r: Reservation): Guest | undefined => {
    if (!r.guestPhone) return undefined;
    return guests.find(g => g.phone === r.guestPhone);
  };

  const getPaymentLabel = (r: Reservation): string => {
    if (r.paymentStatus === 'paid') return 'Bezahlt';
    if (r.paymentStatus === 'partial') return 'Angezahlt';
    return '-';
  };

  const getTableStatusLabel = (r: Reservation): string => {
    if (r.status === 'seated') return 'Platziert';
    if (r.status === 'completed') return 'Fertig';
    if (r.status === 'confirmed' && r.tableId) return 'Zugewiesen';
    return '-';
  };

  const handleExportCSV = () => {
    const header = 'Zeit,Name,Personen,Telefon,Tisch,Quelle,Status,Zahlung,Tisch-Status,Erstellt,Notizen';
    const rows = todayReservations.map(r =>
      [r.time, r.guestName, r.partySize, r.guestPhone || '', r.tableId || '', r.source, r.status, getPaymentLabel(r), getTableStatusLabel(r), r.createdAt ? new Date(r.createdAt).toLocaleDateString('de-DE') : '', (r.notes || '').replace(/,/g, ';')].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reservierungen-${getTodayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // OpenTable-style stats for header
  const seatedCount = todayReservations.filter(r => r.status === 'seated').length;
  const confirmedCount = todayReservations.filter(r => r.status === 'confirmed').length;
  const walkInCount = todayReservations.filter(r => r.source === 'walk_in').length;
  const onlineCount = todayReservations.filter(r => r.source === 'online').length;
  const phoneCount = todayReservations.filter(r => r.source === 'phone').length;

  const handlePrint = () => {
    const today = getTodayStr();
    const d = new Date();
    const dateStr = d.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const html = `<html><head><title>Reservierungen ${today}</title><style>
      body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; color: #111; }
      h1 { font-size: 18px; margin-bottom: 4px; }
      .sub { color: #666; font-size: 12px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { text-align: left; padding: 5px 6px; border-bottom: 2px solid #333; font-weight: 600; font-size: 11px; }
      td { padding: 5px 6px; border-bottom: 1px solid #ddd; }
      .badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; color: white; }
      .paid { color: #16a34a; font-weight: 600; }
      .seated { color: #9333ea; font-weight: 600; }
      @media print { body { padding: 0; } }
    </style></head><body>
      <h1>Reservierungen</h1>
      <div class="sub">${dateStr} &middot; ${totalGuests} Covers &middot; ${totalGroups} Parties &middot; ${walkInCount} Walk-Ins &middot; ${onlineCount} Online &middot; ${phoneCount} Telefon</div>
      <table>
        <thead><tr><th>Zeit</th><th>Pers.</th><th>Gast</th><th>Tisch</th><th>Notizen &amp; Tags</th><th>Zahlung</th><th>Tisch-Status</th><th>Erstellt</th></tr></thead>
        <tbody>${todayReservations.map(r => {
          const st = r.status === 'confirmed' ? 'Best\u00e4tigt' : r.status === 'seated' ? '<span class="seated">Platziert</span>' : r.status === 'completed' ? 'Fertig' : r.status;
          const pay = r.paymentStatus === 'paid' ? '<span class="paid">Bezahlt</span>' : r.paymentStatus === 'partial' ? 'Angezahlt' : '-';
          const tblSt = r.status === 'seated' ? '<span class="seated">Platziert</span>' : r.tableId ? 'Zugewiesen' : '-';
          const created = r.createdAt ? new Date(r.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '-';
          const tags = (r.notes || '') + ((r.occasionLabels || []).length > 0 ? ' [' + (r.occasionLabels || []).join(', ') + ']' : '');
          return '<tr><td>' + r.time + '</td><td>' + r.partySize + '</td><td><strong>' + r.guestName + '</strong>' + (r.guestPhone ? '<br><small style="color:#888">' + r.guestPhone + '</small>' : '') + '</td><td>' + (r.tableId ? r.tableId.replace(/[^0-9]/g, '') || r.tableId : '-') + '</td><td>' + (tags || '-') + '</td><td>' + pay + '</td><td>' + tblSt + '</td><td>' + created + '</td></tr>';
        }).join('')}</tbody>
      </table>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'transparent' }}>
      {/* Section header - OpenTable style with stats */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div>
          <h2 className="text-white font-bold text-[15px]">Reservierungen</h2>
          <p className="text-[#8888aa] text-[10px]">{totalGuests} Covers &middot; {totalGroups} Parties &middot; {walkInCount} Walk-Ins &middot; {onlineCount} Online</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExportCSV} className="p-0.5 text-[#8888aa] hover:text-[#7bb7ef] transition-colors" title="CSV Export">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={handlePrint} className="p-0.5 text-[#8888aa] hover:text-[#7bb7ef] transition-colors" title="Drucken">
            <Printer className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-0.5 text-[#8888aa] hover:text-white transition-colors"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Figma-style reservation cards */}
      {!collapsed && (
        <div>
          {todayReservations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#555577]">
              <Users className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm font-medium text-[#777]">Keine Reservierungen für heute</p>
            </div>
          ) : (
            todayReservations.map((r, idx) => {
              const sourceColor = SOURCE_COLORS[r.source] || '#8888aa';
              const guestProfile = getGuestForReservation(r);
              const isVip = guestProfile?.tags.includes('vip') || guestProfile?.tags.includes('stammgast');
              const occasions = (r.occasionLabels || []) as OccasionLabel[];
              const guestTags = guestProfile?.tags || [];
              const tableNumber = r.tableId ? r.tableId.replace(/[^0-9]/g, '') || '?' : null;

              return (
                <div key={r.id} style={{ marginBottom: '2px' }}>
                  {/* Figma card: #2d333f bg, h-[52px] */}
                  <div
                    className="flex items-center h-[52px] rounded-[3px] hover:brightness-110 active:brightness-125 transition-all"
                    style={{ background: '#252540' }}
                  >
                    {/* Left color bar - Figma: w-[21px] h-[45px] rounded-[3px] */}
                    <div className="shrink-0 ml-[3px] rounded-[3px]" style={{ background: sourceColor, width: '21px', height: '45px' }} />

                    {/* Content area */}
                    <div className="flex-1 min-w-0 ml-[10px]">
                      {/* Line 1: party size + time + occasion icons */}
                      <div className="flex items-center gap-[6px]">
                        <span className="text-white font-black text-[13px]">{r.partySize}</span>
                        <span className="text-white font-normal text-[12px]">{r.time} Uhr</span>
                        {occasions.map(oc => {
                          const info = OCCASION_ICONS[oc];
                          if (!info) return null;
                          const OcIcon = info.Icon;
                          return (
                            <OcIcon key={oc} size={16} color={info.color} />
                          );
                        })}
                        {guestTags.filter(t => t !== 'vip' && t !== 'stammgast').map(tag => {
                          const info = ALL_TAGS_MAP[tag];
                          if (!info) return null;
                          return (
                            <span key={tag} className="px-1.5 py-[1px] rounded-[3px] text-[9px] font-bold uppercase leading-none text-white" style={{ background: info.color }}>
                              {info.label}
                            </span>
                          );
                        })}
                      </div>
                      {/* Line 2: star + guest name */}
                      <div className="flex items-center gap-[4px] mt-[1px]">
                        {isVip && <IconStarFilled size={15} color="#FFCC00" />}
                        <span className="text-white font-semibold text-[16px] truncate whitespace-nowrap">{r.guestName}</span>
                      </div>
                    </div>

                    {/* Right side - table badge (OpenTable-style lila) */}
                    <div className="shrink-0 mr-[3px]">
                      {tableNumber ? (
                        <div className="flex flex-col items-center justify-center rounded-[4px]"
                          style={{ background: '#9333ea', width: '45px', height: '45px' }}>
                          <span className="text-white font-bold text-[15px] leading-none">{tableNumber}</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center rounded-[4px]"
                          style={{ background: '#222238', width: '45px', height: '45px' }}>
                          <Armchair className="w-5 h-5 text-[#555577]" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
