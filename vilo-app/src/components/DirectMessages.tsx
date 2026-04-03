import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, SlidersHorizontal, Users, Clock, Bell, MessageSquare } from 'lucide-react';
import { Reservation, WaitlistEntry } from '../types';
import { loadReservations, loadWaitlist } from '../utils/storage';

interface DirectMessagesProps {
  onClose: () => void;
}

type DMTab = 'warteliste' | 'reservierung' | 'benachrichtigen';

function getElapsed(timestamp: number): string {
  const mins = Math.floor((Date.now() - timestamp) / 60000);
  if (mins < 1) return 'Gerade eben';
  if (mins < 60) return `vor ${mins} Min.`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `vor ${h} Stunden`;
  const d = Math.floor(h / 24);
  return `vor ${d} Tagen`;
}

function formatResDate(dateStr: string, time: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const months = ['Jan', 'Feb', 'März', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  return `${d}. ${months[dt.getMonth()]}, ${time}`;
}

export function DirectMessages({ onClose }: DirectMessagesProps) {
  const [activeTab, setActiveTab] = useState<DMTab>('reservierung');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);

  useEffect(() => {
    setReservations(loadReservations());
    setWaitlist(loadWaitlist());
  }, []);

  const sortedReservations = useMemo(() => {
    return [...reservations]
      .filter(r => r.status !== 'cancelled')
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [reservations]);

  const activeWaitlist = useMemo(() => {
    return waitlist
      .filter(e => e.status === 'waiting' || e.status === 'notified')
      .sort((a, b) => a.position - b.position);
  }, [waitlist]);

  const resCount = sortedReservations.length;

  const getResStatus = (r: Reservation): { label: string; color: string } => {
    if (r.status === 'seated') return { label: 'Platziert', color: '#8b5cf6' };
    if (r.status === 'no_show') return { label: 'No-Show', color: '#f59e0b' };
    // Check if it's been viewed/processed
    const ageMs = Date.now() - (r.createdAt || 0);
    if (ageMs < 86400000) return { label: 'Neu', color: '#475569' };
    return { label: 'In Bearbeitung', color: '#7c3aed' };
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col" style={{ background: '#1a1a2e' }}>
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <button onClick={onClose} className="p-1.5 text-[#b0b0cc] hover:text-[#e0e0f0] transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white font-bold text-lg">Direktnachrichten</h1>
        <button className="p-1.5 text-[#b0b0cc] hover:text-[#e0e0f0] transition-colors relative">
          <SlidersHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#333355] px-4">
        <button
          onClick={() => setActiveTab('warteliste')}
          className={`flex-1 py-3 text-sm font-semibold text-center transition-colors relative ${
            activeTab === 'warteliste' ? 'text-white' : 'text-[#8888aa]'
          }`}
        >
          Warteliste
          {activeTab === 'warteliste' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7bb7ef]" />}
        </button>
        <button
          onClick={() => setActiveTab('reservierung')}
          className={`flex-1 py-3 text-sm font-semibold text-center transition-colors relative ${
            activeTab === 'reservierung' ? 'text-[#7bb7ef]' : 'text-[#8888aa]'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            Reservierung
            {resCount > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white" style={{ background: '#7c3aed' }}>
                {resCount}
              </span>
            )}
          </span>
          {activeTab === 'reservierung' && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: '#7bb7ef' }} />}
        </button>
        <button
          onClick={() => setActiveTab('benachrichtigen')}
          className={`flex-1 py-3 text-sm font-semibold text-center transition-colors relative ${
            activeTab === 'benachrichtigen' ? 'text-white' : 'text-[#8888aa]'
          }`}
        >
          Benachrichtigen
          {activeTab === 'benachrichtigen' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7bb7ef]" />}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'reservierung' && (
          <div>
            <div className="px-4 py-2.5 text-sm font-semibold text-[#8888aa]">
              {sortedReservations.length} Nachrichten
            </div>
            {sortedReservations.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <MessageSquare className="w-10 h-10 text-[#777] mx-auto mb-3" />
                <p className="text-[#b0b0cc] font-medium">Keine Reservierungen</p>
                <p className="text-[#8888aa] text-sm mt-1">Neue Reservierungen erscheinen hier</p>
              </div>
            ) : (
              sortedReservations.map(r => {
                const status = getResStatus(r);
                return (
                  <div key={r.id} className="px-4 py-3.5 border-b border-[#333355]/50 active:bg-[#2a2a42] transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-white text-[15px]">{r.guestName}</span>
                          <span className="text-[#8888aa] text-xs">{r.createdAt ? getElapsed(r.createdAt) : ''}</span>
                        </div>
                        <p className="text-[#b0b0cc] text-sm">
                          {formatResDate(r.date, r.time)} &middot; {r.partySize} Gäste
                        </p>
                        {r.notes && (
                          <p className="text-[#8888aa] text-sm mt-0.5 truncate">{r.notes}</p>
                        )}
                      </div>
                      <span
                        className="px-2.5 py-1 rounded text-xs font-bold text-white ml-2 shrink-0"
                        style={{ background: status.color }}
                      >
                        {status.label}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'warteliste' && (
          <div>
            <div className="px-4 py-2.5 text-sm font-semibold text-[#8888aa]">
              {activeWaitlist.length} wartend
            </div>
            {activeWaitlist.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Users className="w-10 h-10 text-[#777] mx-auto mb-3" />
                <p className="text-[#b0b0cc] font-medium">Keine Gäste auf der Warteliste</p>
              </div>
            ) : (
              activeWaitlist.map(entry => (
                <div key={entry.id} className="px-4 py-3.5 border-b border-[#333355]/50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-white text-[15px]">{entry.guestName}</span>
                        <span className="text-[#8888aa] text-xs">{getElapsed(entry.addedAt)}</span>
                      </div>
                      <p className="text-[#b0b0cc] text-sm">
                        {entry.partySize} {entry.partySize === 1 ? 'Person' : 'Personen'}
                        {entry.seatPreference ? ` · ${entry.seatPreference}` : ''}
                      </p>
                      {entry.notes && (
                        <p className="text-[#8888aa] text-sm mt-0.5 truncate">{entry.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 ml-2">
                      <Clock className="w-4 h-4 text-[#8888aa]" />
                      <span className="text-sm font-medium text-[#b0b0cc]">~{entry.estimatedWaitMinutes} Min.</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'benachrichtigen' && (
          <div className="px-4 py-12 text-center">
            <Bell className="w-10 h-10 text-[#777] mx-auto mb-3" />
            <p className="text-[#b0b0cc] font-medium">Keine Benachrichtigungen</p>
            <p className="text-[#8888aa] text-sm mt-1">Push-Benachrichtigungen an Gäste werden hier angezeigt</p>
          </div>
        )}
      </div>
    </div>
  );
}
