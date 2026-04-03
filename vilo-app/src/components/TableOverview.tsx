import React from 'react';
import { useApp } from '../context/AppContext';
import { LogOut, Mic, MicOff, Users } from 'lucide-react';

interface TableOverviewProps {
  voiceMode: string;
  onStartVoice: () => void;
  onStopVoice: () => void;
}

export function TableOverview({ voiceMode, onStartVoice, onStopVoice }: TableOverviewProps) {
  const { state, dispatch } = useApp();
  const [activeZone, setActiveZone] = React.useState<string | null>(null);

  const filteredTables = activeZone
    ? state.tables.filter(t => t.zone === activeZone)
    : state.tables;

  const handleTableClick = (tableId: string) => {
    dispatch({ type: 'SET_ACTIVE_TABLE', tableId });
  };

  const getTableColor = (status: string) => {
    switch (status) {
      case 'free': return 'bg-emerald-900/40 border-emerald-700/50 hover:border-emerald-500';
      case 'occupied': return 'bg-amber-900/40 border-amber-700/50 hover:border-amber-500';
      case 'billing': return 'bg-red-900/40 border-red-700/50 hover:border-red-500';
      default: return 'bg-[#2a2a42] border-[#333355]';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'free': return 'bg-emerald-400';
      case 'occupied': return 'bg-amber-400';
      case 'billing': return 'bg-red-400';
      default: return 'bg-slate-400';
    }
  };

  const getOrderCount = (tableId: string) => {
    const session = state.sessions[tableId];
    if (!session) return 0;
    return session.orders.length;
  };

  return (
    <div className="h-full bg-[#1a1a2e] flex flex-col">
      {/* Header */}
      <header className="bg-[#2a2a42]/80 backdrop-blur border-b border-[#333355] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-white font-semibold text-xl leading-tight" style={{ fontFamily: 'Otista, sans-serif', letterSpacing: '0.032em' }}>vilo</h1>
            <span className="text-[#8888aa] text-xs">·</span>
            <p className="text-[#b0b0cc] text-xs">{state.restaurant.name} · {state.currentUser?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => voiceMode === 'idle' ? onStartVoice() : onStopVoice()}
              className={`p-2 rounded-lg transition-colors ${
                voiceMode !== 'idle'
                  ? 'bg-[#7bb7ef] text-white'
                  : 'bg-[#353558] text-[#c0c0dd] hover:bg-[#555]'
              }`}
            >
              {voiceMode !== 'idle' ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <button
              onClick={() => dispatch({ type: 'LOGOUT' })}
              className="p-2 rounded-lg bg-[#353558] text-[#c0c0dd] hover:bg-[#555] transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Zone Filter */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveZone(null)}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            activeZone === null
              ? 'bg-[#7bb7ef] text-white'
              : 'bg-[#2a2a42] text-[#c0c0dd] hover:bg-[#353558]'
          }`}
        >
          Alle ({state.tables.length})
        </button>
        {state.zones.map(zone => {
          const count = state.tables.filter(t => t.zone === zone.id).length;
          return (
            <button
              key={zone.id}
              onClick={() => setActiveZone(zone.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeZone === zone.id
                  ? 'bg-[#7bb7ef] text-white'
                  : 'bg-[#2a2a42] text-[#c0c0dd] hover:bg-[#353558]'
              }`}
            >
              {zone.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Table Grid */}
      <div className="flex-1 px-4 pb-4 overflow-y-auto">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {filteredTables.map(table => (
            <button
              key={table.id}
              onClick={() => handleTableClick(table.id)}
              className={`relative p-3 rounded-xl border-2 transition-all active:scale-95 ${getTableColor(table.status)}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className={`w-2.5 h-2.5 rounded-full ${getStatusDot(table.status)}`} />
                {getOrderCount(table.id) > 0 && (
                  <span className="text-xs bg-[#353558] text-[#c0c0dd] px-1.5 py-0.5 rounded-full">
                    {getOrderCount(table.id)}
                  </span>
                )}
              </div>
              <p className="text-white font-medium text-sm text-left">{table.name}</p>
              <p className="text-[#b0b0cc] text-xs text-left mt-0.5 capitalize">
                {table.status === 'free' ? 'Frei' : table.status === 'occupied' ? 'Besetzt' : 'Rechnung'}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-[#2a2a42]/90 backdrop-blur border-t border-[#333355] px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[#c0c0dd]">
                {state.tables.filter(t => t.status === 'free').length} frei
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-[#c0c0dd]">
                {state.tables.filter(t => t.status === 'occupied').length} besetzt
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[#b0b0cc]">
            <Users className="w-4 h-4" />
            <span>{Object.keys(state.sessions).length} aktiv</span>
          </div>
        </div>
      </div>
    </div>
  );
}
