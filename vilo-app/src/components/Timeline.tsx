import { useState, useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

import { useApp } from '../context/AppContext';
import { Reservation } from '../types';
import { loadReservations } from '../utils/storage';

interface TimelineProps {
  onSelectTable?: (tableId: string) => void;
}

const HOUR_WIDTH = 120; // px per hour
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 32;
const START_HOUR = 10; // 10:00
const END_HOUR = 24;   // 00:00 (midnight)
const TOTAL_HOURS = END_HOUR - START_HOUR;

function getTimePosition(time: string): number {
  const [h, m] = time.split(':').map(Number);
  const totalMin = (h - START_HOUR) * 60 + m;
  return (totalMin / 60) * HOUR_WIDTH;
}

function getBlockWidth(durationMin: number): number {
  return (durationMin / 60) * HOUR_WIDTH;
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: '#7bb7ef',
  seated: '#8b5cf6',
  finished: '#6b7280',
  cancelled: '#ef4444',
  no_show: '#f59e0b',
};

export function Timeline({ onSelectTable }: TimelineProps) {
  const { state } = useApp();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [collapsedZones, setCollapsedZones] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReservations(loadReservations());
  }, []);

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const currentHour = now.getHours() + now.getMinutes() / 60;
      const scrollX = Math.max(0, ((currentHour - START_HOUR) / TOTAL_HOURS) * (TOTAL_HOURS * HOUR_WIDTH) - 150);
      scrollRef.current.scrollLeft = scrollX;
    }
  }, []);

  const todayStr = useMemo(() => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }, []);

  const todayReservations = useMemo(() => {
    return reservations.filter(r => r.date === todayStr && r.status !== 'cancelled');
  }, [reservations, todayStr]);

  // Group tables by zone
  const zoneGroups = useMemo(() => {
    return state.zones.map(zone => {
      const tables = state.tables
        .filter(t => t.zone === zone.id)
        .sort((a, b) => {
          const numA = parseInt(a.name.replace(/\D/g, '')) || 0;
          const numB = parseInt(b.name.replace(/\D/g, '')) || 0;
          return numA - numB;
        });
      return { zone, tables };
    });
  }, [state.zones, state.tables]);

  // Get reservations for a specific table
  const getTableReservations = (tableId: string): Reservation[] => {
    return todayReservations.filter(r => r.tableId === tableId || (r.tableIds || []).includes(tableId));
  };

  // Current time marker position
  const now = new Date();
  const currentTimePos = getTimePosition(
    now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0')
  );

  // Time headers
  const timeHeaders = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    const label = (h % 24).toString().padStart(2, '0') + ':00';
    timeHeaders.push({ hour: h, label, x: (h - START_HOUR) * HOUR_WIDTH });
    // Half-hour mark
    timeHeaders.push({ hour: h + 0.5, label: '', x: (h - START_HOUR) * HOUR_WIDTH + HOUR_WIDTH / 2 });
  }

  const totalWidth = TOTAL_HOURS * HOUR_WIDTH;

  const toggleZone = (zoneId: string) => {
    setCollapsedZones(prev => {
      const next = new Set(prev);
      if (next.has(zoneId)) next.delete(zoneId);
      else next.add(zoneId);
      return next;
    });
  };

  // Summary stats
  const totalParties = todayReservations.length;
  const totalCovers = todayReservations.reduce((s, r) => s + r.partySize, 0);

  return (
    <div className="flex flex-col h-full" style={{ background: '#1a1a2e' }}>
      {/* Stats bar */}
      <div className="flex items-center gap-4 px-3 py-2 border-b border-[#2d2d50] shrink-0" style={{ background: '#1a1a2e' }}>
        <span className="text-white text-xs font-bold">{totalParties} Gruppen</span>
        <span className="text-[#b0b0cc] text-xs">{totalCovers} Gäste</span>
        {todayReservations.filter(r => r.status === 'no_show').length > 0 && (
          <span className="flex items-center gap-1 text-[#f59e0b] text-xs">
            <AlertTriangle className="w-3 h-3" />
            {todayReservations.filter(r => r.status === 'no_show').length} No-Shows
          </span>
        )}
      </div>

      {/* Scrollable timeline area */}
      <div className="flex-1 overflow-hidden flex">
        {/* Fixed left column: table names */}
        <div className="shrink-0 overflow-y-auto hide-scrollbar border-r border-[#2d2d50]" style={{ width: 80, background: '#1a1a2e' }}>
          {/* Header spacer */}
          <div className="sticky top-0 z-10 border-b border-[#2d2d50]" style={{ height: HEADER_HEIGHT, background: '#1a1a2e' }}>
            <div className="flex items-center justify-center h-full">
              <span className="text-[#8888aa] text-[9px] font-bold uppercase">Tbl</span>
              <span className="text-[#8888aa] text-[9px] font-bold uppercase ml-2">Max</span>
            </div>
          </div>
          {zoneGroups.map(({ zone, tables }) => (
            <div key={zone.id}>
              {/* Zone header */}
              <button
                onClick={() => toggleZone(zone.id)}
                className="w-full flex items-center gap-1 px-2 py-1.5 text-left hover:bg-[#2d2d50]/30 transition-colors border-b border-[#1e1e38]"
                style={{ background: '#1e1e35' }}
              >
                <span className="text-[#b0b0cc] text-[10px] font-bold truncate flex-1">{zone.name}</span>
                {collapsedZones.has(zone.id) ? (
                  <ChevronDown className="w-3 h-3 text-[#666688] shrink-0" />
                ) : (
                  <ChevronUp className="w-3 h-3 text-[#666688] shrink-0" />
                )}
              </button>
              {!collapsedZones.has(zone.id) && tables.map(table => (
                <div
                  key={table.id}
                  className="flex items-center px-2 border-b border-[#1e1e38] hover:bg-[#2d2d50]/20 cursor-pointer"
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => onSelectTable?.(table.id)}
                >
                  <span className="text-white text-[12px] font-bold flex-1">{table.name.replace(/^[A-Za-z]+\s*/, '')}</span>
                  <span className="text-[#666688] text-[10px]">{table.seats}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Scrollable timeline grid */}
        <div ref={scrollRef} className="flex-1 overflow-auto">
          <div style={{ width: totalWidth, minHeight: '100%', position: 'relative' }}>
            {/* Time header */}
            <div className="sticky top-0 z-10 border-b border-[#2d2d50]" style={{ height: HEADER_HEIGHT, background: '#1a1a2e' }}>
              {timeHeaders.map((th, i) => (
                <div
                  key={i}
                  className="absolute top-0 flex items-end pb-1"
                  style={{ left: th.x, height: HEADER_HEIGHT }}
                >
                  {th.label ? (
                    <span className="text-[#8888aa] text-[10px] font-medium" style={{ transform: 'translateX(-50%)' }}>{th.label}</span>
                  ) : (
                    <div className="w-px h-2" style={{ background: '#333' }} />
                  )}
                </div>
              ))}
            </div>

            {/* Table rows with reservations */}
            {zoneGroups.map(({ zone, tables }) => (
              <div key={zone.id}>
                {/* Zone header row */}
                <div style={{ height: 28, background: '#1e1e35' }} className="border-b border-[#1e1e38]" />
                {!collapsedZones.has(zone.id) && tables.map(table => {
                  const tableRes = getTableReservations(table.id);
                  return (
                    <div
                      key={table.id}
                      className="relative border-b border-[#1e1e38]"
                      style={{ height: ROW_HEIGHT }}
                    >
                      {/* Grid lines for each hour */}
                      {Array.from({ length: TOTAL_HOURS + 1 }).map((_, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0"
                          style={{ left: i * HOUR_WIDTH, width: 1, background: i % 1 === 0 ? '#222240' : '#222' }}
                        />
                      ))}
                      {/* Half-hour grid lines */}
                      {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
                        <div
                          key={'h' + i}
                          className="absolute top-0 bottom-0"
                          style={{ left: i * HOUR_WIDTH + HOUR_WIDTH / 2, width: 1, background: '#1f1f35' }}
                        />
                      ))}

                      {/* Reservation blocks */}
                      {tableRes.map(r => {
                        const left = getTimePosition(r.time);
                        const width = getBlockWidth(r.duration || 90);
                        const color = STATUS_COLORS[r.status] || '#6b7280';
                        const isSeated = r.status === 'seated';
                        return (
                          <div
                            key={r.id}
                            className="absolute top-[3px] rounded-[3px] flex items-center px-1.5 overflow-hidden cursor-pointer hover:brightness-110 transition-all"
                            style={{
                              left: Math.max(0, left),
                              width: Math.max(30, width),
                              height: ROW_HEIGHT - 6,
                              background: color,
                              opacity: r.status === 'finished' ? 0.5 : 1,
                              border: isSeated ? '1px solid #e9d5ff' : 'none',
                            }}
                            title={`${r.guestName} - ${r.partySize} Pers. - ${r.time} (${r.duration || 90}min)`}
                          >
                            <span className="text-white text-[10px] font-semibold truncate">{r.guestName}</span>
                            {r.partySize > 1 && (
                              <span className="text-white/70 text-[9px] ml-1 shrink-0">{r.partySize}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Current time indicator (red line) */}
            {currentTimePos > 0 && currentTimePos < totalWidth && (
              <div
                className="absolute top-0 bottom-0 z-20 pointer-events-none"
                style={{ left: currentTimePos, width: 2, background: '#ef4444' }}
              >
                <div className="w-2.5 h-2.5 rounded-full absolute -top-1 -left-[3px]" style={{ background: '#ef4444' }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
