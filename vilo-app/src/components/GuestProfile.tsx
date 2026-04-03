import { useState, useEffect } from 'react';
import { Guest, GuestTag, GuestNote, Reservation } from '../types';
import {
  loadGuests, addGuest, deleteGuest,
  toggleGuestTag, addGuestNote, removeGuestNote, loadReservations
} from '../utils/storage';
import {
  X, User, Phone, Mail, Tag, Star, UtensilsCrossed, Armchair,
  Lightbulb, History, Plus, Trash2, Edit3, ChevronLeft, Search,
  CalendarCheck, Users, Clock
} from 'lucide-react';

function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

const ALL_TAGS: { value: GuestTag; label: string; color: string }[] = [
  { value: 'vip', label: 'VIP', color: '#eab308' },
  { value: 'stammgast', label: 'Stammgast', color: '#22d3ee' },
  { value: 'allergiker', label: 'Allergiker', color: '#ef4444' },
  { value: 'vegetarier', label: 'Vegetarier', color: '#22c55e' },
  { value: 'vegan', label: 'Vegan', color: '#16a34a' },
  { value: 'kinderstuhl', label: 'Kinderstuhl', color: '#f97316' },
  { value: 'rollstuhl', label: 'Rollstuhl', color: '#8b5cf6' },
  { value: 'geburtstag', label: 'Geburtstag', color: '#ec4899' },
  { value: 'business', label: 'Business', color: '#6366f1' },
  { value: 'presse', label: 'Presse', color: '#a78bfa' },
];

const NOTE_CATEGORIES: { value: GuestNote['category']; label: string; icon: typeof Star }[] = [
  { value: 'general', label: 'Allgemein', icon: Edit3 },
  { value: 'status', label: 'Gaststatus', icon: Star },
  { value: 'food', label: 'Speisen & Getränke', icon: UtensilsCrossed },
  { value: 'seating', label: 'Sitzplaetze', icon: Armchair },
  { value: 'info', label: 'Gästeinformation', icon: Lightbulb },
  { value: 'history', label: 'Verlauf', icon: History },
];

interface GuestProfileProps {
  guest: Guest;
  onClose: () => void;
  onUpdated: () => void;
  onReserve?: (guestId: string) => void;
}

export function GuestProfile({ guest, onClose, onUpdated, onReserve }: GuestProfileProps) {
  const [activeNoteTab, setActiveNoteTab] = useState<GuestNote['category']>('general');
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [guestReservations, setGuestReservations] = useState<Reservation[]>([]);

  useEffect(() => {
    // Load reservations for this guest
    const allRes = loadReservations();
    const matching = allRes.filter(r =>
      r.guestName.toLowerCase() === guest.name.toLowerCase() ||
      (guest.phone && r.guestPhone && r.guestPhone.replace(/\s/g, '') === guest.phone.replace(/\s/g, ''))
    );
    setGuestReservations(matching);
  }, [guest]);

  const categoryNotes = guest.notes.filter(n => n.category === activeNoteTab);

  const handleToggleTag = (tag: GuestTag) => {
    toggleGuestTag(guest.id, tag);
    onUpdated();
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    const note: GuestNote = {
      id: generateId(),
      category: activeNoteTab,
      text: noteText.trim(),
      createdAt: Date.now(),
    };
    addGuestNote(guest.id, note);
    setNoteText('');
    setShowAddNote(false);
    onUpdated();
  };

  const handleRemoveNote = (noteId: string) => {
    removeGuestNote(guest.id, noteId);
    onUpdated();
  };

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return d + '.' + m + '.' + y;
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col" style={{ background: '#1a1a2e' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-[#333355]" style={{ background: '#1a1a2e' }}>
        <button onClick={onClose} className="p-1.5 rounded-lg text-[#b0b0cc] hover:text-[#e0e0f0] transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-white font-bold text-lg">Gast-Profil</h1>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Profile Card */}
        <div className="px-4 py-5 border-b border-slate-800" style={{ background: '#1a1a2e' }}>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-[#353558] flex items-center justify-center shrink-0">
              <User className="w-7 h-7 text-[#b0b0cc]" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-bold text-xl">{guest.name}</h2>
              {guest.phone && (
                <a href={'tel:' + guest.phone} className="flex items-center gap-1.5 text-cyan-400 text-sm mt-1">
                  <Phone className="w-3.5 h-3.5" /> {guest.phone}
                </a>
              )}
              {guest.email && (
                <p className="flex items-center gap-1.5 text-[#b0b0cc] text-sm mt-0.5">
                  <Mail className="w-3.5 h-3.5" /> {guest.email}
                </p>
              )}
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="rounded-lg bg-[#2a2a42]/50 p-2.5 text-center">
              <p className="text-white font-bold text-lg">{guest.totalVisits}</p>
              <p className="text-[#8888aa] text-[10px] uppercase tracking-wider">Besuche</p>
            </div>
            <div className="rounded-lg bg-[#2a2a42]/50 p-2.5 text-center">
              <p className="text-white font-bold text-lg">{guest.totalSpend.toFixed(0)}€</p>
              <p className="text-[#8888aa] text-[10px] uppercase tracking-wider">Gesamt-Umsatz</p>
            </div>
            <div className="rounded-lg bg-[#2a2a42]/50 p-2.5 text-center">
              <p className="text-white font-bold text-lg">{guest.totalVisits > 0 ? (guest.totalSpend / guest.totalVisits).toFixed(0) : '0'}€</p>
              <p className="text-[#8888aa] text-[10px] uppercase tracking-wider">Ø pro Besuch</p>
            </div>
            <div className="rounded-lg bg-[#2a2a42]/50 p-2.5 text-center">
              <p className="text-white font-bold text-lg">{guest.lastVisit ? formatDate(guest.lastVisit) : '-'}</p>
              <p className="text-[#8888aa] text-[10px] uppercase tracking-wider">Letzter Besuch</p>
            </div>
          </div>

          {/* Referral Sources for this guest */}
          {guestReservations.filter(r => r.referralSource).length > 0 && (
            <div className="mt-3 rounded-lg bg-[#2a2a42]/30 p-2.5">
              <p className="text-[#8888aa] text-[10px] uppercase tracking-wider mb-1.5">Empfehlungen</p>
              <div className="flex flex-wrap gap-1.5">
                {[...new Set(guestReservations.filter(r => r.referralSource).map(r => r.referralSource!))].map(src => (
                  <span key={src} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#a78bfa]/15 text-[#a78bfa] border border-[#a78bfa]/30">
                    {src}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tags Section */}
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-[#b0b0cc] text-xs font-medium">
              <Tag className="w-3.5 h-3.5" /> Etiketten
            </div>
            <button onClick={() => setShowTagPicker(!showTagPicker)}
              className="text-xs text-[#b1d9ff] hover:text-[#b1d9ff] transition-colors">
              {showTagPicker ? 'Fertig' : 'Bearbeiten'}
            </button>
          </div>
          {guest.tags.length === 0 && !showTagPicker && (
            <p className="text-[#777] text-xs italic">Keine Etiketten</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {showTagPicker ? (
              ALL_TAGS.map(t => {
                const active = guest.tags.includes(t.value);
                return (
                  <button key={t.value} onClick={() => handleToggleTag(t.value)}
                    className="px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                    style={{
                      borderColor: active ? t.color : '#475569',
                      background: active ? t.color + '22' : 'transparent',
                      color: active ? t.color : '#94a3b8',
                    }}>
                    {t.label}
                  </button>
                );
              })
            ) : (
              guest.tags.map(tag => {
                const info = ALL_TAGS.find(t => t.value === tag);
                return info ? (
                  <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: info.color + '22', color: info.color }}>
                    {info.label}
                  </span>
                ) : null;
              })
            )}
          </div>
        </div>

        {/* Note Category Tabs */}
        <div className="px-4 pt-3 border-b border-slate-800 overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {NOTE_CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isActive = activeNoteTab === cat.value;
              const count = guest.notes.filter(n => n.category === cat.value).length;
              return (
                <button key={cat.value} onClick={() => setActiveNoteTab(cat.value)}
                  className={'flex flex-col items-center px-3 py-2 text-xs transition-colors relative ' +
                    (isActive ? 'text-cyan-400' : 'text-[#8888aa] hover:text-[#c0c0dd]')}>
                  <Icon className="w-4.5 h-4.5 mb-0.5" style={{ width: 18, height: 18 }} />
                  {count > 0 && (
                    <span className="absolute top-0.5 right-1 w-3.5 h-3.5 rounded-full bg-cyan-500 text-white text-[8px] font-bold flex items-center justify-center">
                      {count}
                    </span>
                  )}
                  {isActive && (
                    <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-cyan-400 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes for active category */}
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[#b0b0cc] text-xs font-medium">
              {NOTE_CATEGORIES.find(c => c.value === activeNoteTab)?.label}
            </p>
            <button onClick={() => setShowAddNote(true)}
              className="flex items-center gap-1 text-xs text-[#b1d9ff] hover:text-[#b1d9ff] transition-colors">
              <Plus className="w-3.5 h-3.5" /> Hinzufuegen
            </button>
          </div>

          {showAddNote && (
            <div className="rounded-lg bg-[#2a2a42] p-3 space-y-2">
              <textarea value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Hinweis eingeben..."
                rows={2}
                className="w-full rounded-lg px-3 py-2 bg-[#1a1a2e] text-white border border-[#3d3d5c] focus:border-violet-500 focus:outline-none text-sm resize-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={handleAddNote} disabled={!noteText.trim()}
                  className="flex-1 py-1.5 rounded-lg bg-[#7bb7ef] text-white text-xs font-medium disabled:opacity-50">
                  Speichern
                </button>
                <button onClick={() => { setShowAddNote(false); setNoteText(''); }}
                  className="px-3 py-1.5 rounded-lg bg-[#353558] text-[#c0c0dd] text-xs">
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          {categoryNotes.length === 0 && !showAddNote && (
            <p className="text-[#777] text-xs italic py-2">
              {NOTE_CATEGORIES.find(c => c.value === activeNoteTab)?.label} hinzufuegen...
            </p>
          )}

          {categoryNotes.map(note => (
            <div key={note.id} className="rounded-lg bg-[#2a2a42]/50 p-3 flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[#ddd] text-sm">{note.text}</p>
                <p className="text-[#777] text-[10px] mt-1">
                  {new Date(note.createdAt).toLocaleDateString('de-DE')}
                </p>
              </div>
              <button onClick={() => handleRemoveNote(note.id)}
                className="p-1 text-[#777] hover:text-red-400 transition-colors shrink-0 ml-2">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Visit History */}
        {guest.visits.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-800">
            <p className="text-[#b0b0cc] text-xs font-medium mb-2 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" /> Besuchshistorie
            </p>
            <div className="space-y-1.5">
              {guest.visits.slice(-10).reverse().map((v, i) => (
                <div key={i} className="rounded-lg bg-[#2a2a42]/50 p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[#c0c0dd]">{formatDate(v.date)}</span>
                    <span className="text-[#8888aa]">{v.tableName}</span>
                    <span className="text-[#8888aa] flex items-center gap-0.5">
                      <Users className="w-3 h-3" />{v.partySize}
                    </span>
                  </div>
                  <span className="text-[#c0c0dd] text-xs font-medium">{v.revenue.toFixed(2)}€</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Reservations */}
        {guestReservations.filter(r => r.status === 'confirmed').length > 0 && (
          <div className="px-4 py-3 border-t border-slate-800">
            <p className="text-[#b0b0cc] text-xs font-medium mb-2 flex items-center gap-1.5">
              <CalendarCheck className="w-3.5 h-3.5" /> Reservierungen
            </p>
            <div className="space-y-1.5">
              {guestReservations.filter(r => r.status === 'confirmed').map(r => (
                <div key={r.id} className="rounded-lg bg-cyan-900/20 border border-cyan-800/30 p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-cyan-400">{formatDate(r.date)}</span>
                    <span className="text-cyan-400 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />{r.time}
                    </span>
                    <span className="text-cyan-500 flex items-center gap-0.5">
                      <Users className="w-3 h-3" />{r.partySize}
                    </span>
                  </div>
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-cyan-900/50 text-cyan-400">Bestaetigt</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action */}
      <div className="px-4 py-3 border-t border-[#333355]" style={{ background: '#1a1a2e', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <button onClick={() => onReserve?.(guest.id)}
          className="w-full py-3 rounded-xl bg-cyan-600 text-white font-semibold text-sm hover:bg-cyan-500 transition-colors">
          Reservieren
        </button>
      </div>
    </div>
  );
}

/* ========== Guest List Component ========== */

interface GuestListProps {
  onClose: () => void;
  onSelectGuest: (guest: Guest) => void;
  onCreateReservation?: (guestId: string) => void;
}

export function GuestList({ onClose, onSelectGuest }: GuestListProps) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTagFilter, setActiveTagFilter] = useState<GuestTag | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');

  const reload = () => setGuests(loadGuests());
  useEffect(() => { reload(); }, []);

  const filtered = guests.filter(g => {
    if (activeTagFilter && !g.tags.includes(activeTagFilter)) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return g.name.toLowerCase().includes(q) ||
      (g.phone && g.phone.includes(q)) ||
      (g.email && g.email.toLowerCase().includes(q)) ||
      g.tags.some(t => t.includes(q));
  });

  const totalVisitsAll = guests.reduce((s, g) => s + g.totalVisits, 0);
  const totalSpendAll = guests.reduce((s, g) => s + g.totalSpend, 0);
  const vipCount = guests.filter(g => g.tags.includes('vip')).length;
  const stammgastCount = guests.filter(g => g.tags.includes('stammgast')).length;

  const handleCreate = () => {
    if (!formName.trim()) return;
    const newGuest: Guest = {
      id: generateId(),
      name: formName.trim(),
      phone: formPhone.trim() || undefined,
      email: formEmail.trim() || undefined,
      tags: [],
      notes: [],
      visits: [],
      totalVisits: 0,
      totalSpend: 0,
      createdAt: Date.now(),
    };
    addGuest(newGuest);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setShowCreateForm(false);
    reload();
    onSelectGuest(newGuest);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteGuest(id);
    reload();
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col" style={{ background: '#1a1a2e' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-[#333355]" style={{ background: '#1a1a2e' }}>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#b0b0cc] hover:text-[#e0e0f0] transition-colors">
            <X className="w-5 h-5" />
          </button>
          <h1 className="text-white font-bold text-lg">Gäste</h1>
        </div>
        <button onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-1.5 bg-[#7bb7ef] text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-[#7bb7ef] transition-colors">
          <Plus className="w-4 h-4" /> Neuer Gast
        </button>
      </div>

      {/* Stats bar */}
      <div className="px-4 py-1.5 flex items-center gap-3 text-[10px] text-[#8888aa] border-b border-[#333355]" style={{ background: '#1a1a2e' }}>
        <span>{guests.length} Gäste</span>
        <span>{totalVisitsAll} Besuche</span>
        {totalSpendAll > 0 && <span>{totalSpendAll.toFixed(0)}€ Umsatz</span>}
        {vipCount > 0 && <span className="text-yellow-400">{vipCount} VIP</span>}
        {stammgastCount > 0 && <span className="text-cyan-400">{stammgastCount} Stammgäste</span>}
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-slate-800" style={{ background: '#1a1a2e' }}>
        <div className="flex items-center gap-2 rounded-lg bg-[#2a2a42] px-3 py-2">
          <Search className="w-4 h-4 text-[#8888aa]" />
          <input type="text" value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Name, Telefon, E-Mail oder Tag suchen..."
            className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-[#888]"
          />
        </div>
        {/* Tag filter chips */}
        <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1 no-scrollbar">
          {ALL_TAGS.map(t => (
            <button key={t.value}
              onClick={() => setActiveTagFilter(activeTagFilter === t.value ? null : t.value)}
              className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all"
              style={{
                background: activeTagFilter === t.value ? t.color : t.color + '18',
                color: activeTagFilter === t.value ? '#fff' : t.color,
                border: activeTagFilter === t.value ? `1px solid ${t.color}` : '1px solid transparent'
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Guest List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#8888aa]">
            <User className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm font-medium">{searchQuery ? 'Kein Gast gefunden' : 'Noch keine Gäste'}</p>
            <p className="text-xs mt-1">Gäste werden automatisch bei Reservierungen angelegt</p>
          </div>
        ) : (
          filtered.map(g => (
            <div key={g.id} onClick={() => onSelectGuest(g)}
              className="rounded-xl p-3 flex items-center gap-3 cursor-pointer active:bg-[#353558]/50 transition-colors"
              style={{ background: '#1a1a2e' }}>
              <div className="w-10 h-10 rounded-full bg-[#353558] flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-[#b0b0cc]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold text-sm truncate">{g.name}</span>
                  {g.tags.slice(0, 3).map(tag => {
                    const info = ALL_TAGS.find(t => t.value === tag);
                    return info ? (
                      <span key={tag} className="px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                        style={{ background: info.color + '22', color: info.color }}>
                        {info.label}
                      </span>
                    ) : null;
                  })}
                </div>
                <div className="flex items-center gap-3 text-xs text-[#8888aa] mt-0.5">
                  {g.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{g.phone}</span>}
                  <span>{g.totalVisits} Besuche</span>
                  {g.totalSpend > 0 && <span>{g.totalSpend.toFixed(0)}€</span>}
                </div>
              </div>
              <button onClick={(e) => handleDelete(e, g.id)}
                className="p-1.5 rounded-lg text-[#777] hover:text-red-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Create Guest Form */}
      {showCreateForm && (
        <div className="fixed inset-0 z-[75] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-lg rounded-t-2xl p-5" style={{ background: '#1a1a2e' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-lg">Neuer Gast</h2>
              <button onClick={() => setShowCreateForm(false)}
                className="p-1.5 text-[#b0b0cc] hover:text-[#e0e0f0] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#b0b0cc] font-medium mb-1 block">Name *</label>
                <input type="text" value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Gastname"
                  className="w-full rounded-lg px-3 py-2.5 bg-[#2a2a42] text-white border border-[#3d3d5c] focus:border-violet-500 focus:outline-none text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-[#b0b0cc] font-medium mb-1 block">Telefon</label>
                <input type="tel" value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+49..."
                  className="w-full rounded-lg px-3 py-2.5 bg-[#2a2a42] text-white border border-[#3d3d5c] focus:border-violet-500 focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[#b0b0cc] font-medium mb-1 block">E-Mail</label>
                <input type="email" value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="email@beispiel.de"
                  className="w-full rounded-lg px-3 py-2.5 bg-[#2a2a42] text-white border border-[#3d3d5c] focus:border-violet-500 focus:outline-none text-sm"
                />
              </div>
              <button onClick={handleCreate} disabled={!formName.trim()}
                className="w-full py-3 rounded-xl bg-[#7bb7ef] text-white font-semibold text-sm hover:bg-[#7bb7ef] disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2">
                Gast anlegen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
