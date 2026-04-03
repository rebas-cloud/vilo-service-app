import { useState, useEffect, useMemo } from 'react';
import { Reservation, Table } from '../types';
import { loadReservations, loadStorage } from '../utils/storage';
import {
  AlertTriangle, UserX, CalendarX, Users, Clock,
  ChevronDown, ChevronUp, XCircle
} from 'lucide-react';

interface ProblemReservationsProps {
  onSelectTable?: (tableId: string) => void;
}

type ProblemType = 'conflict' | 'no_show' | 'overbooking' | 'no_table' | 'cancelled';

interface Problem {
  type: ProblemType;
  severity: 'high' | 'medium' | 'low';
  reservation: Reservation;
  relatedReservation?: Reservation;
  message: string;
}

function getTodayStr(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const PROBLEM_CONFIG: Record<ProblemType, { label: string; color: string; Icon: typeof AlertTriangle }> = {
  conflict: { label: 'Konflikt', color: '#ef4444', Icon: AlertTriangle },
  no_show: { label: 'No-Show', color: '#f59e0b', Icon: UserX },
  overbooking: { label: 'Ueberbuchung', color: '#f97316', Icon: Users },
  no_table: { label: 'Kein Tisch', color: '#8b5cf6', Icon: CalendarX },
  cancelled: { label: 'Storniert', color: '#6b7280', Icon: XCircle },
};

export function ProblemReservations({ onSelectTable }: ProblemReservationsProps) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filterType, setFilterType] = useState<ProblemType | 'all'>('all');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setReservations(loadReservations());
    setTables(loadStorage().tables || []);
  }, [refreshKey]);

  useEffect(() => {
    const interval = setInterval(() => setRefreshKey(k => k + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const todayStr = getTodayStr();

  const problems = useMemo(() => {
    const result: Problem[] = [];
    const todayRes = reservations.filter(r => r.date === todayStr);

    // 1. No-Shows
    todayRes.filter(r => r.status === 'no_show').forEach(r => {
      result.push({
        type: 'no_show',
        severity: 'high',
        reservation: r,
        message: `${r.guestName} (${r.partySize}P, ${r.time}) - No-Show`,
      });
    });

    // 2. Cancelled
    todayRes.filter(r => r.status === 'cancelled').forEach(r => {
      result.push({
        type: 'cancelled',
        severity: 'low',
        reservation: r,
        message: `${r.guestName} (${r.partySize}P, ${r.time}) - Storniert`,
      });
    });

    // 3. No table assigned (confirmed but no tableId)
    todayRes.filter(r => r.status === 'confirmed' && !r.tableId).forEach(r => {
      result.push({
        type: 'no_table',
        severity: 'medium',
        reservation: r,
        message: `${r.guestName} (${r.partySize}P, ${r.time}) - Kein Tisch zugewiesen`,
      });
    });

    // 4. Time conflicts (same table, overlapping times)
    const activeRes = todayRes.filter(r => r.status === 'confirmed' || r.status === 'seated');
    for (let i = 0; i < activeRes.length; i++) {
      for (let j = i + 1; j < activeRes.length; j++) {
        const a = activeRes[i];
        const b = activeRes[j];
        if (!a.tableId || !b.tableId) continue;

        // Check if same table assigned
        const aTableIds = a.tableIds || (a.tableId ? [a.tableId] : []);
        const bTableIds = b.tableIds || (b.tableId ? [b.tableId] : []);
        const sharedTable = aTableIds.find(t => bTableIds.includes(t));
        if (!sharedTable) continue;

        // Check time overlap
        const [ah, am] = a.time.split(':').map(Number);
        const [bh, bm] = b.time.split(':').map(Number);
        const aStart = ah * 60 + am;
        const aEnd = aStart + (a.duration || 90);
        const bStart = bh * 60 + bm;
        const bEnd = bStart + (b.duration || 90);

        if (aStart < bEnd && bStart < aEnd) {
          result.push({
            type: 'conflict',
            severity: 'high',
            reservation: a,
            relatedReservation: b,
            message: `Tisch ${sharedTable.replace(/[^0-9]/g, '') || sharedTable}: ${a.guestName} (${a.time}) ueberschneidet ${b.guestName} (${b.time})`,
          });
        }
      }
    }

    // 5. Overbooking (more guests than table seats)
    activeRes.filter(r => r.tableId).forEach(r => {
      const table = tables.find(t => t.id === r.tableId);
      if (table && table.seats && r.partySize > table.seats) {
        result.push({
          type: 'overbooking',
          severity: 'medium',
          reservation: r,
          message: `${r.guestName} (${r.partySize}P) > Tisch ${table.name} (${table.seats} Plaetze)`,
        });
      }
    });

    // Sort: high first, then medium, then low
    const severityOrder = { high: 0, medium: 1, low: 2 };
    result.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return result;
  }, [reservations, tables, todayStr]);

  const filteredProblems = filterType === 'all' ? problems : problems.filter(p => p.type === filterType);

  const highCount = problems.filter(p => p.severity === 'high').length;
  const mediumCount = problems.filter(p => p.severity === 'medium').length;

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'transparent' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div>
          <h2 className="text-white font-bold text-[15px] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            Probleme
          </h2>
          <p className="text-[#8888aa] text-[10px]">
            {problems.length} Problem{problems.length !== 1 ? 'e' : ''}
            {highCount > 0 && <span className="text-red-400 ml-1">{highCount} kritisch</span>}
            {mediumCount > 0 && <span className="text-amber-400 ml-1">{mediumCount} mittel</span>}
          </p>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-0.5 text-[#8888aa] hover:text-white transition-colors"
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Filter chips */}
          <div className="px-3 pb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setFilterType('all')}
              className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all"
              style={{
                background: filterType === 'all' ? '#555577' : '#333',
                color: filterType === 'all' ? '#fff' : '#b0b0cc',
              }}>
              Alle ({problems.length})
            </button>
            {(Object.keys(PROBLEM_CONFIG) as ProblemType[]).map(type => {
              const config = PROBLEM_CONFIG[type];
              const count = problems.filter(p => p.type === type).length;
              if (count === 0) return null;
              return (
                <button key={type}
                  onClick={() => setFilterType(filterType === type ? 'all' : type)}
                  className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all"
                  style={{
                    background: filterType === type ? config.color : config.color + '18',
                    color: filterType === type ? '#fff' : config.color,
                  }}>
                  {config.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Problem cards */}
          <div className="px-2">
            {filteredProblems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#555577]">
                <AlertTriangle className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium text-[#777]">
                  {problems.length === 0 ? 'Keine Probleme gefunden' : 'Keine Probleme in dieser Kategorie'}
                </p>
              </div>
            ) : (
              filteredProblems.map((problem, idx) => {
                const config = PROBLEM_CONFIG[problem.type];
                const PIcon = config.Icon;
                const tableNumber = problem.reservation.tableId
                  ? problem.reservation.tableId.replace(/[^0-9]/g, '') || '?'
                  : null;

                return (
                  <div key={idx} style={{ marginBottom: '2px' }}>
                    <div
                      className="flex items-center rounded-[3px] hover:brightness-110 active:brightness-125 transition-all"
                      style={{ background: '#252540', minHeight: '52px' }}
                      onClick={() => problem.reservation.tableId && onSelectTable?.(problem.reservation.tableId)}
                    >
                      {/* Left severity bar */}
                      <div className="shrink-0 ml-[3px] rounded-[3px]"
                        style={{
                          background: problem.severity === 'high' ? '#ef4444' : problem.severity === 'medium' ? '#f59e0b' : '#6b7280',
                          width: '21px',
                          height: '45px'
                        }} />

                      {/* Content */}
                      <div className="flex-1 min-w-0 ml-[10px] py-1.5">
                        <div className="flex items-center gap-[6px]">
                          <PIcon className="w-3.5 h-3.5 shrink-0" style={{ color: config.color }} />
                          <span className="text-[10px] font-bold uppercase" style={{ color: config.color }}>
                            {config.label}
                          </span>
                          <span className="text-white font-normal text-[11px]">
                            {problem.reservation.time} Uhr
                          </span>
                        </div>
                        <div className="flex items-center gap-[4px] mt-[2px]">
                          <span className="text-white font-semibold text-[13px] truncate">
                            {problem.message}
                          </span>
                        </div>
                      </div>

                      {/* Right: table badge or icon */}
                      <div className="shrink-0 mr-[3px]">
                        {tableNumber ? (
                          <div className="flex flex-col items-center justify-center rounded-[4px]"
                            style={{ background: config.color + '33', width: '45px', height: '45px' }}>
                            <span className="font-bold text-[15px] leading-none" style={{ color: config.color }}>
                              {tableNumber}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center rounded-[4px]"
                            style={{ background: '#222238', width: '45px', height: '45px' }}>
                            <Clock className="w-5 h-5 text-[#555577]" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
