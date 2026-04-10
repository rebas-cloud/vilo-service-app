import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, Clock3, Download, Phone, Printer, Users } from 'lucide-react';

import { useApp } from '../context/AppContext';
import { ReservationDetail } from './ReservationDetail';
import { Reservation } from '../types';
import { loadReservations } from '../utils/storage';

interface ReservationListProps {
  onSelectTable?: (tableId: string) => void;
}

function getTodayStr(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Figma source colors
const SOURCE_COLORS: Record<string, string> = {
  phone: '#8b5cf6',
  online: '#ec4899',
  walk_in: '#22c55e',
};

const SOURCE_ICONS: Record<string, typeof Phone> = {
  phone: Phone,
  online: Phone,
  walk_in: Phone,
};

// Figma occasion icon badges
export function ReservationList({ onSelectTable }: ReservationListProps) {
  const { state } = useApp();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);

  useEffect(() => {
    setReservations(loadReservations());
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
  const selectedReservation = todayReservations.find(r => r.id === selectedReservationId) || null;

  useEffect(() => {
    if (!selectedReservationId && todayReservations.length > 0) {
      setSelectedReservationId(todayReservations[0].id);
      return;
    }
    if (selectedReservationId && !todayReservations.some(r => r.id === selectedReservationId)) {
      setSelectedReservationId(todayReservations[0]?.id ?? null);
    }
  }, [todayReservations, selectedReservationId]);

  const getPaymentLabel = (r: Reservation): string => {
    if (r.paymentStatus === 'paid') return 'Bezahlt';
    if (r.paymentStatus === 'partial') return 'Angezahlt';
    return '-';
  };

  const getTableStatusLabel = (r: Reservation): string => {
    if (r.status === 'seated') return 'Platziert';
    if (r.status === 'finished') return 'Fertig';
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
    <div className="flex h-full min-h-0" style={{ background: 'transparent' }}>
      <div className="min-w-0 flex-1 overflow-y-auto">
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
              todayReservations.map((r) => {
                const sourceColor = SOURCE_COLORS[r.source] || '#8888aa';
                const tableNumber = r.tableId ? r.tableId.replace(/[^0-9]/g, '') || '?' : null;
                const SourceIcon = SOURCE_ICONS[r.source] || Users;
                const detailLabel = r.guestName;
                const isSelected = r.id === selectedReservationId;

                return (
                  <div key={r.id} className="px-2" style={{ marginBottom: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedReservationId(r.id)}
                      className="flex min-h-[60px] w-full items-stretch text-left hover:brightness-110 active:brightness-125 transition-all"
                      style={{
                        background: isSelected ? '#332f52' : '#2a2944',
                        boxShadow: isSelected ? 'inset 0 0 0 1px rgba(168, 85, 247, 0.45)' : 'none',
                      }}
                    >
                      <div className="flex shrink-0 flex-col items-center justify-center gap-[2px]" style={{ background: sourceColor, width: '26px' }}>
                        <span className="text-[10px] font-bold leading-none text-white">{r.partySize}</span>
                      </div>

                      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#d7d3e8]">
                            <SourceIcon className="h-3 w-3 shrink-0 text-[#a855f7]" />
                            <span>{r.time}</span>
                          </div>
                          <div className="mt-0.5">
                            <span className="truncate text-[13px] font-semibold text-white">{detailLabel}</span>
                          </div>
                        </div>

                        {tableNumber ? (
                          <div className="flex h-[38px] min-w-[38px] items-center justify-center bg-[#9333ea] px-2">
                            <span className="text-white font-bold text-[14px] leading-none">{tableNumber}</span>
                          </div>
                        ) : (
                          <div className="flex h-[38px] w-[38px] items-center justify-center bg-[#2f2d4a]">
                            <Clock3 className="h-4.5 w-4.5 text-[#76709a]" />
                          </div>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {selectedReservation && (
        <ReservationDetail
          inline
          reservation={selectedReservation}
          allTables={state.tables}
          onClose={() => setSelectedReservationId(null)}
          onUpdated={(updatedReservations) => setReservations(updatedReservations)}
          onSeat={() => {
            if (selectedReservation.tableId && onSelectTable) {
              onSelectTable(selectedReservation.tableId);
            }
          }}
        />
      )}
    </div>
  );
}
