import { useState, useEffect, useMemo } from 'react';
import { Reservation, ReservationStatus, Guest, SeatLabel, OccasionLabel } from '../types';
import { loadReservations, addReservation, updateReservation, deleteReservation, findGuestByPhone, addGuest, loadGuests } from '../utils/storage';
import { X, Plus, Users, Phone, Globe, UserPlus, Clock, Calendar, Trash2, Edit3, ChevronLeft, ChevronRight, User, Tag, Armchair, Search, MoreVertical, ChevronUp, ChevronDown, AlignJustify, BarChart3, MessageSquare } from 'lucide-react';
import { IconCircleCheckFilled, IconCoinFilled, IconAlertTriangleFilled, IconLeaf, IconPlant2, IconBabyCarriage, IconWheelchair, IconCake, IconBriefcaseFilled, IconNews, IconStarFilled, IconUserPlus, IconConfetti, IconHeartFilled, IconGiftFilled, IconHeartHandshake, IconSparkles, IconSchool, IconMasksTheater } from '@tabler/icons-react';
import { useApp } from '../context/AppContext';
import { GuestProfile, GuestList } from './GuestProfile';

interface ReservationPanelProps {
  onClose: () => void;
  onSeatReservation?: (tableId: string) => void;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

function getTodayStr(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const months = ['Jan', 'Feb', 'März', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  return days[dt.getDay()] + '. ' + d + '. ' + months[dt.getMonth()];
}

function getStatusLabel(status: ReservationStatus): string {
  const labels: Record<ReservationStatus, string> = {
    confirmed: 'Bestaetigt',
    seated: 'Platziert',
    cancelled: 'Storniert',
    no_show: 'No-Show',
  };
  return labels[status];
}

function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${minutes}m`;
}

function getStatusColor(status: ReservationStatus): string {
  const colors: Record<ReservationStatus, string> = {
    confirmed: '#7bb7ef',
    seated: '#b1d9ff',
    cancelled: '#ef4444',
    no_show: '#f59e0b',
  };
  return colors[status];
}

const SOURCE_ICONS = {
  phone: Phone,
  online: Globe,
  walk_in: UserPlus,
};

const SOURCE_COLORS: Record<string, string> = {
  phone: '#3b82f6',
  online: '#ec4899',
  walk_in: '#22c55e',
};

const SEAT_LABELS_MAP: Record<SeatLabel, { label: string; icon: string }> = {
  aussicht: { label: 'Aussicht erbeten', icon: '🪟' },
  fensterplatz: { label: 'Fensterplatz erbeten', icon: '🪟' },
  nischenplatz: { label: 'Nischenplatz angefordert', icon: '🪟' },
  raucherplatz: { label: 'Raucherplatz erbeten', icon: '🪟' },
  rollstuhlgerecht: { label: 'Rollstuhlgerecht/Barrierefrei', icon: '♿' },
  ruhiger_tisch: { label: 'Ruhiger Tisch', icon: '🪟' },
  terrasse: { label: 'Terrasse erbeten', icon: '🪟' },
  hochstuhl: { label: 'Hochstuhl', icon: '🪟' },
};

const OCCASION_LABELS_MAP: Record<OccasionLabel, { label: string; icon: string }> = {
  besonderer_anlass: { label: 'Besonderer Anlass', icon: '✨' },
  date: { label: 'Date', icon: '✨' },
  geschaeftsessen: { label: 'Geschaeftsessen', icon: '✨' },
  gratis_extra: { label: 'Gratis-Extra', icon: '✨' },
  schulabschluss: { label: 'Schulabschluss', icon: '✨' },
  theater_kino: { label: 'Theater/Kino/Kurzaufenthalt', icon: '✨' },
  geburtstag: { label: 'Geburtstag', icon: '🎂' },
  jahrestag: { label: 'Jahrestag', icon: '🥂' },
};

// Figma-style occasion icon badges
const OCCASION_ICONS: Record<OccasionLabel, { Icon: typeof IconConfetti; color: string }> = {
  geburtstag: { Icon: IconConfetti, color: '#22c55e' },
  jahrestag: { Icon: IconHeartFilled, color: '#22c55e' },
  besonderer_anlass: { Icon: IconSparkles, color: '#a855f7' },
  date: { Icon: IconHeartHandshake, color: '#ec4899' },
  geschaeftsessen: { Icon: IconBriefcaseFilled, color: '#a855f7' },
  gratis_extra: { Icon: IconGiftFilled, color: '#22c55e' },
  schulabschluss: { Icon: IconSchool, color: '#3b82f6' },
  theater_kino: { Icon: IconMasksTheater, color: '#f59e0b' },
};

const ALL_TAGS_MAP: Record<string, { label: string; color: string; Icon: typeof IconStarFilled }> = {
  vip: { label: 'VIP', color: '#eab308', Icon: IconStarFilled },
  stammgast: { label: 'Stammgast', color: '#22d3ee', Icon: IconUserPlus },
  allergiker: { label: 'Allergiker', color: '#ef4444', Icon: IconAlertTriangleFilled },
  vegetarier: { label: 'Vegetarier', color: '#22c55e', Icon: IconLeaf },
  vegan: { label: 'Vegan', color: '#16a34a', Icon: IconPlant2 },
  kinderstuhl: { label: 'Kinderstuhl', color: '#f97316', Icon: IconBabyCarriage },
  rollstuhl: { label: 'Rollstuhl', color: '#8b5cf6', Icon: IconWheelchair },
  geburtstag: { label: 'Geburtstag', color: '#ec4899', Icon: IconCake },
  business: { label: 'Business', color: '#6366f1', Icon: IconBriefcaseFilled },
  presse: { label: 'Presse', color: '#a78bfa', Icon: IconNews },
};

// Deterministic color from name (like Google Contacts)
const NAME_COLORS = [
  '#e57373', '#f06292', '#ba68c8', '#9575cd',
  '#7986cb', '#64b5f6', '#4fc3f7', '#4dd0e1',
  '#4db6ac', '#81c784', '#aed581', '#dce775',
  '#fff176', '#ffd54f', '#ffb74d', '#ff8a65',
];
function getNameColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return NAME_COLORS[Math.abs(hash) % NAME_COLORS.length];
}

export function ReservationPanel({ onClose, onSeatReservation }: ReservationPanelProps) {
  const { state } = useApp();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showGuestList, setShowGuestList] = useState(false);
  const [showGuestProfile, setShowGuestProfile] = useState<Guest | null>(null);
  const [matchedGuest, setMatchedGuest] = useState<Guest | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showUpcoming, setShowUpcoming] = useState(true);
  const [showSeated, setShowSeated] = useState(true);
  const [showShiftOverview, setShowShiftOverview] = useState(false);
  const [wizardStep, setWizardStep] = useState<'date' | 'guests' | 'guest_info'>('date');
  const [guestSearch, setGuestSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Guest[]>([]);
  const [, setTick] = useState(0); // force re-render every minute for seated duration
  const [formData, setFormData] = useState({
    guestName: '',
    guestPhone: '',
    partySize: 2,
    date: getTodayStr(),
    time: '19:00',
    duration: 90,
    tableId: '',
    zone: '',
    notes: '',
    source: 'phone' as 'phone' | 'online' | 'walk_in',
    guestId: '',
    seatLabels: [] as SeatLabel[],
    occasionLabels: [] as OccasionLabel[],
    referralSource: '',
  });

  useEffect(() => {
    setReservations(loadReservations());
    setGuests(loadGuests());
  }, []);

  // Update seated duration every 60s
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const reloadAll = () => {
    setReservations(loadReservations());
    setGuests(loadGuests());
  };

  const dayReservations = useMemo(() => {
    return reservations
      .filter(r => r.date === selectedDate && r.status !== 'cancelled')
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [reservations, selectedDate]);

  const upcomingReservations = useMemo(() => dayReservations.filter(r => r.status === 'confirmed' || r.status === 'no_show'), [dayReservations]);
  const seatedReservations = useMemo(() => dayReservations.filter(r => r.status === 'seated'), [dayReservations]);
  const upcomingGuests = useMemo(() => upcomingReservations.reduce((s, r) => s + r.partySize, 0), [upcomingReservations]);
  const seatedGuests = useMemo(() => seatedReservations.reduce((s, r) => s + r.partySize, 0), [seatedReservations]);

  const getCountdown = (r: Reservation): { text: string; color: string } => {
    const now = new Date();
    const [rh, rm] = r.time.split(':').map(Number);
    const [sy, sm, sd] = r.date.split('-').map(Number);
    const resTime = new Date(sy, sm - 1, sd, rh, rm);
    if (r.status === 'seated') {
      const mins = Math.max(0, Math.floor((now.getTime() - resTime.getTime()) / 60000));
      if (mins >= 120) return { text: Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm', color: '#ef4444' };
      if (mins >= 60) return { text: '1h ' + (mins - 60) + 'm', color: '#f59e0b' };
      return { text: mins + 'm', color: '#8888aa' };
    }
    const mins = Math.floor((resTime.getTime() - now.getTime()) / 60000);
    if (mins < 0) return { text: Math.abs(mins) + 'm', color: '#ef4444' };
    if (mins <= 15) return { text: mins + 'm', color: '#f59e0b' };
    return { text: mins + 'm', color: '#4ade80' };
  };

  const totalGuests = useMemo(() => {
    return dayReservations.reduce((sum, r) => sum + r.partySize, 0);
  }, [dayReservations]);

  // Shift Overview computed stats
  const shiftStats = useMemo(() => {
    const allDayRes = reservations.filter(r => r.date === selectedDate);
    const totalParties = allDayRes.filter(r => r.status !== 'cancelled').length;
    const totalCovers = allDayRes.filter(r => r.status !== 'cancelled').reduce((s, r) => s + r.partySize, 0);
    const walkIns = allDayRes.filter(r => r.source === 'walk_in' && r.status !== 'cancelled').length;
    const onlineBookings = allDayRes.filter(r => r.source === 'online' && r.status !== 'cancelled').length;
    const phoneBookings = allDayRes.filter(r => r.source === 'phone' && r.status !== 'cancelled').length;
    const cancelled = allDayRes.filter(r => r.status === 'cancelled').length;
    const noShows = allDayRes.filter(r => r.status === 'no_show').length;
    const seated = allDayRes.filter(r => r.status === 'seated').length;
    // Large parties (6+)
    const largeParties = allDayRes.filter(r => r.partySize >= 6 && r.status !== 'cancelled');
    // Special events (occasions)
    const specialEvents = allDayRes.filter(r => r.status !== 'cancelled' && r.occasionLabels && r.occasionLabels.length > 0);
    // Guest requests (notes)
    const guestRequests = allDayRes.filter(r => r.status !== 'cancelled' && r.notes && r.notes.trim().length > 0);
    // Seating preferences
    const seatingPrefs = allDayRes.filter(r => r.status !== 'cancelled' && r.seatLabels && r.seatLabels.length > 0);
    // Referral tracking
    const referrals = allDayRes.filter(r => r.status !== 'cancelled' && r.referralSource);
    const referralSources = [...new Set(referrals.map(r => r.referralSource!))];
    // Payment stats
    const paidCount = allDayRes.filter(r => r.paymentStatus === 'paid').length;
    const partialCount = allDayRes.filter(r => r.paymentStatus === 'partial').length;
    return { totalParties, totalCovers, walkIns, onlineBookings, phoneBookings, cancelled, noShows, seated, largeParties, specialEvents, guestRequests, seatingPrefs, referrals, referralSources, paidCount, partialCount };
  }, [reservations, selectedDate]);

  const navigateDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
  };

  const isToday = selectedDate === getTodayStr();

  const resetForm = () => {
    setFormData({
      guestName: '',
      guestPhone: '',
      partySize: 2,
      date: selectedDate,
      time: '19:00',
      duration: 90,
      tableId: '',
      zone: '',
      notes: '',
      source: 'phone',
      guestId: '',
      seatLabels: [] as SeatLabel[],
      occasionLabels: [] as OccasionLabel[],
      referralSource: '',
    });
    setEditingId(null);
    setMatchedGuest(null);
    setShowLabelPicker(false);
    setWizardStep('date');
    setGuestSearch('');
    setSearchResults([]);
  };

  const handleOpenForm = () => {
    resetForm();
    setFormData(prev => ({ ...prev, date: selectedDate }));
    setWizardStep('date');
    setShowForm(true);
  };

  // Guest search handler
  const handleGuestSearch = (query: string) => {
    setGuestSearch(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    const normalizedQuery = query.toLowerCase().replace(/\s+/g, '');
    const results = guests.filter(g => {
      const nameMatch = g.name.toLowerCase().replace(/\s+/g, '').includes(normalizedQuery);
      const phoneMatch = g.phone ? g.phone.replace(/\s+/g, '').includes(normalizedQuery) : false;
      return nameMatch || phoneMatch;
    });
    setSearchResults(results);
  };

  // Select guest from search
  const handleSelectSearchGuest = (guest: Guest) => {
    setMatchedGuest(guest);
    setFormData(prev => ({
      ...prev,
      guestName: guest.name,
      guestPhone: guest.phone || '',
      guestId: guest.id,
    }));
    setGuestSearch('');
    setSearchResults([]);
  };

  // Calendar helper: generate month data
  const generateCalendarMonth = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = lastDay.getDate();
    const weeks: (number | null)[][] = [];
    let currentWeek: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) currentWeek.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      currentWeek.push(d);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      weeks.push(currentWeek);
    }
    return weeks;
  };

  // Get reservation count for a specific date
  const getReservationCountForDate = (dateStr: string): number => {
    return reservations.filter(r => r.date === dateStr && r.status !== 'cancelled').length;
  };

  const handleEditReservation = (r: Reservation) => {
    setFormData({
      guestName: r.guestName,
      guestPhone: r.guestPhone || '',
      partySize: r.partySize,
      date: r.date,
      time: r.time,
      duration: r.duration,
      tableId: r.tableId || '',
      zone: r.zone || '',
      notes: r.notes || '',
      source: r.source,
      guestId: '',
      seatLabels: (r.seatLabels || []) as SeatLabel[],
      occasionLabels: (r.occasionLabels || []) as OccasionLabel[],
      referralSource: r.referralSource || '',
    });
    // Try to find matching guest
    if (r.guestPhone) {
      const found = findGuestByPhone(r.guestPhone);
      if (found) {
        setMatchedGuest(found);
        setFormData(prev => ({ ...prev, guestId: found.id }));
      }
    }
    setEditingId(r.id);
    setShowForm(true);
  };

  // Auto-recognize guest by phone number
  const handlePhoneChange = (phone: string) => {
    setFormData(prev => ({ ...prev, guestPhone: phone }));
    if (phone.length >= 6) {
      const found = findGuestByPhone(phone);
      if (found) {
        setMatchedGuest(found);
        setFormData(prev => ({
          ...prev,
          guestName: prev.guestName || found.name,
          guestId: found.id,
        }));
      } else {
        setMatchedGuest(null);
        setFormData(prev => ({ ...prev, guestId: '' }));
      }
    } else {
      setMatchedGuest(null);
      setFormData(prev => ({ ...prev, guestId: '' }));
    }
  };

  const handleSave = () => {
    if (!formData.guestName.trim()) return;

    // Auto-create guest profile if none exists
    let guestId = formData.guestId;
    if (!guestId && formData.guestPhone.trim()) {
      const existing = findGuestByPhone(formData.guestPhone.trim());
      if (existing) {
        guestId = existing.id;
      } else {
        // Create new guest automatically
        const newGuest: Guest = {
          id: generateId(),
          name: formData.guestName.trim(),
          phone: formData.guestPhone.trim(),
          tags: [],
          notes: [],
          visits: [],
          totalVisits: 0,
          totalSpend: 0,
          createdAt: Date.now(),
        };
        addGuest(newGuest);
        guestId = newGuest.id;
      }
    }

    if (editingId) {
      const updated = updateReservation(editingId, {
        guestName: formData.guestName.trim(),
        guestPhone: formData.guestPhone.trim() || undefined,
        partySize: formData.partySize,
        date: formData.date,
        time: formData.time,
        duration: formData.duration,
        tableId: formData.tableId || undefined,
        zone: formData.zone || undefined,
        notes: formData.notes.trim() || undefined,
        source: formData.source,
        seatLabels: formData.seatLabels.length > 0 ? formData.seatLabels : undefined,
        occasionLabels: formData.occasionLabels.length > 0 ? formData.occasionLabels : undefined,
        referralSource: formData.referralSource.trim() || undefined,
      });
      setReservations(updated);
    } else {
      const newRes: Reservation = {
        id: generateId(),
        guestName: formData.guestName.trim(),
        guestPhone: formData.guestPhone.trim() || undefined,
        partySize: formData.partySize,
        date: formData.date,
        time: formData.time,
        duration: formData.duration,
        tableId: formData.tableId || undefined,
        zone: formData.zone || undefined,
        notes: formData.notes.trim() || undefined,
        status: 'confirmed',
        source: formData.source,
        seatLabels: formData.seatLabels.length > 0 ? formData.seatLabels : undefined,
        occasionLabels: formData.occasionLabels.length > 0 ? formData.occasionLabels : undefined,
        referralSource: formData.referralSource.trim() || undefined,
        createdAt: Date.now(),
      };
      const updated = addReservation(newRes);
      setReservations(updated);
    }
    setShowForm(false);
    resetForm();
    reloadAll();
  };

  const handleDelete = (id: string) => {
    const updated = deleteReservation(id);
    setReservations(updated);
  };

  const handleStatusChange = (id: string, status: ReservationStatus) => {
    const updated = updateReservation(id, { status });
    setReservations(updated);
    if (status === 'seated') {
      const res = reservations.find(r => r.id === id);
      if (res?.tableId && onSeatReservation) {
        onSeatReservation(res.tableId);
      }
    }
  };

  const handleAssignTable = (resId: string, tableId: string) => {
    const updated = updateReservation(resId, { tableId: tableId || undefined });
    setReservations(updated);
  };

  const handlePaymentStatus = (resId: string, status: 'open' | 'partial' | 'paid') => {
    const updated = updateReservation(resId, { paymentStatus: status === 'open' ? undefined : status });
    setReservations(updated);
  };

  const handleToggleMultiTable = (resId: string, tableId: string) => {
    const res = reservations.find(r => r.id === resId);
    if (!res) return;
    const current = res.tableIds || (res.tableId ? [res.tableId] : []);
    const newIds = current.includes(tableId) ? current.filter(id => id !== tableId) : [...current, tableId];
    const updated = updateReservation(resId, {
      tableIds: newIds.length > 0 ? newIds : undefined,
      tableId: newIds[0] || undefined,
    });
    setReservations(updated);
  };

  const getTimeStatus = (r: Reservation): 'past' | 'soon' | 'upcoming' | 'now' => {
    const now = new Date();
    const [h, m] = r.time.split(':').map(Number);
    const resTime = new Date(now);
    const [ry, rm, rd] = r.date.split('-').map(Number);
    resTime.setFullYear(ry, rm - 1, rd);
    resTime.setHours(h, m, 0, 0);
    const diffMin = (resTime.getTime() - now.getTime()) / 60000;
    if (diffMin < -r.duration) return 'past';
    if (diffMin <= 0) return 'now';
    if (diffMin <= 30) return 'soon';
    return 'upcoming';
  };

  // Find guest for a reservation (by phone match)
  const getGuestForReservation = (r: Reservation): Guest | undefined => {
    if (!r.guestPhone) return undefined;
    return guests.find(g => {
      if (!g.phone) return false;
      const rNorm = r.guestPhone!.replace(/\s+/g, '').replace(/^(\+49|0049)/, '0');
      const gNorm = g.phone.replace(/\s+/g, '').replace(/^(\+49|0049)/, '0');
      return rNorm === gNorm;
    });
  };

  const freeTables = state.tables.filter(t => t.status === 'free');

  // Pacing limit check: count reservations in 30-min slot
  const pacingLimit = state.restaurant?.pacingLimit || 0;
  const getSlotCount = (date: string, time: string): number => {
    const [h, m] = time.split(':').map(Number);
    const slotStart = h * 60 + Math.floor(m / 30) * 30;
    return reservations.filter(r => {
      if (r.date !== date || r.status === 'cancelled') return false;
      const [rh, rm] = r.time.split(':').map(Number);
      const rSlot = rh * 60 + Math.floor(rm / 30) * 30;
      return rSlot === slotStart;
    }).length;
  };
  const currentSlotCount = showForm ? getSlotCount(formData.date, formData.time) : 0;
  const isPacingExceeded = pacingLimit > 0 && currentSlotCount >= pacingLimit;

  // Handle guest selected from GuestList
  const handleSelectGuestFromList = (guest: Guest) => {
    setShowGuestList(false);
    setShowGuestProfile(guest);
  };

  // Handle "Reservieren" from guest profile
  const handleReserveForGuest = (guestId: string) => {
    const guest = guests.find(g => g.id === guestId);
    if (!guest) return;
    setShowGuestProfile(null);
    setFormData(prev => ({
      ...prev,
      guestName: guest.name,
      guestPhone: guest.phone || '',
      guestId: guest.id,
      date: selectedDate,
    }));
    setMatchedGuest(guest);
    setShowForm(true);
  };

  if (showGuestProfile) {
    return (
      <GuestProfile
        guest={showGuestProfile}
        onClose={() => { setShowGuestProfile(null); reloadAll(); }}
        onUpdated={() => {
          setGuests(loadGuests());
          const updated = loadGuests().find(g => g.id === showGuestProfile.id);
          if (updated) setShowGuestProfile(updated);
        }}
        onReserve={handleReserveForGuest}
      />
    );
  }

  if (showGuestList) {
    return (
      <GuestList
        onClose={() => { setShowGuestList(false); reloadAll(); }}
        onSelectGuest={handleSelectGuestFromList}
      />
    );
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col" style={{ background: '#141425' }}>
      {/* resmio-style Header */}
      <div className="px-4 pt-4 pb-2" style={{ background: '#141425' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-white font-bold text-xl tracking-tight">Reservierungen</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose}
              className="p-2 text-[#8888aa] hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Date navigation - resmio clean text style */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigateDate(-1)} className="p-1 text-[#555577] hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-lg tracking-tight">
                {isToday ? 'Heute' : formatDateDisplay(selectedDate)}
              </span>
              <span className="text-[#8888aa] text-lg font-normal">
                {(() => {
                  const h = new Date().getHours();
                  return h < 12 ? 'Morgen' : h < 17 ? 'Mittag' : 'Abend';
                })()}
              </span>
            </div>
            <button onClick={() => navigateDate(1)} className="p-1 text-[#555577] hover:text-white transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-3 text-[#8888aa] text-xs">
            <button onClick={() => setShowShiftOverview(!showShiftOverview)}
              className={'p-1 rounded transition-colors ' + (showShiftOverview ? 'text-[#7bb7ef] bg-[#7bb7ef]/10' : 'text-[#8888aa] hover:text-white')}>
              <BarChart3 className="w-4 h-4" />
            </button>
            <span className="flex items-center gap-1"><Armchair className="w-3.5 h-3.5" /> {dayReservations.length}</span>
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {totalGuests}</span>
          </div>
        </div>
      </div>

      {/* Inline CTA Bars - always visible under header */}
      <div className="mx-3 mt-1 mb-1 flex gap-2">
        <button
          onClick={handleOpenForm}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-semibold text-sm transition-all active:scale-[0.98]"
          style={{ background: '#7c3aed', boxShadow: '0 2px 12px rgba(124, 58, 237, 0.3)' }}
        >
          <Plus className="w-4 h-4" />
          Neue Reservierung
        </button>
        <button
          onClick={() => setShowGuestList(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[#c0c0dd] font-medium text-sm border border-[#3d3d5c] hover:bg-[#2a2a42] transition-all active:scale-[0.98]"
        >
          <Users className="w-4 h-4" />
          Gästeliste
        </button>
      </div>

            {/* Shift Overview Dashboard - like OpenTable */}
            {showShiftOverview && (
        <div className="px-3 pb-2" style={{ background: '#141425' }}>
          <div className="rounded-[6px] p-3" style={{ background: '#222240' }}>
            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="rounded-[4px] p-2 text-center" style={{ background: '#181830' }}>
                <div className="text-white font-bold text-[16px]">{shiftStats.totalParties}</div>
                <div className="text-[#8888aa] text-[9px] uppercase font-semibold">Gruppen</div>
              </div>
              <div className="rounded-[4px] p-2 text-center" style={{ background: '#181830' }}>
                <div className="text-white font-bold text-[16px]">{shiftStats.totalCovers}</div>
                <div className="text-[#8888aa] text-[9px] uppercase font-semibold">Gäste</div>
              </div>
              <div className="rounded-[4px] p-2 text-center" style={{ background: '#181830' }}>
                <div className="text-white font-bold text-[16px]">{shiftStats.seated}</div>
                <div className="text-[#8888aa] text-[9px] uppercase font-semibold">Platziert</div>
              </div>
              <div className="rounded-[4px] p-2 text-center" style={{ background: '#181830' }}>
                <div className="text-white font-bold text-[16px]">{shiftStats.walkIns}</div>
                <div className="text-[#8888aa] text-[9px] uppercase font-semibold">Walk-Ins</div>
              </div>
            </div>

            {/* Source breakdown */}
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: '#3b82f6' }} />
                <span className="text-[#b0b0cc] text-[10px]">Telefon {shiftStats.phoneBookings}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: '#ec4899' }} />
                <span className="text-[#b0b0cc] text-[10px]">Online {shiftStats.onlineBookings}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
                <span className="text-[#b0b0cc] text-[10px]">Walk-In {shiftStats.walkIns}</span>
              </div>
              {shiftStats.cancelled > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />
                  <span className="text-[#b0b0cc] text-[10px]">Storniert {shiftStats.cancelled}</span>
                </div>
              )}
              {shiftStats.noShows > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} />
                  <span className="text-[#b0b0cc] text-[10px]">No-Show {shiftStats.noShows}</span>
                </div>
              )}
            </div>

            {/* Notable Parties */}
            {(shiftStats.largeParties.length > 0 || shiftStats.specialEvents.length > 0 || shiftStats.guestRequests.length > 0 || shiftStats.seatingPrefs.length > 0) && (
              <div className="border-t border-[#2d2d50] pt-2">
                <div className="text-[#7bb7ef] text-[11px] font-bold uppercase mb-2">Bemerkenswerte Gäste</div>

                {/* Large parties */}
                {shiftStats.largeParties.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Users className="w-3 h-3 text-[#8888aa]" />
                      <span className="text-[#b0b0cc] text-[10px] font-semibold">Große Gruppen ({shiftStats.largeParties.length})</span>
                    </div>
                    {shiftStats.largeParties.map(r => (
                      <div key={r.id} className="flex items-center gap-2 pl-5 py-0.5">
                        <span className="text-white text-[11px]">{r.time}</span>
                        <span className="text-[#c0c0dd] text-[11px] font-medium">{r.guestName}</span>
                        <span className="text-[#7bb7ef] text-[11px] font-bold">{r.partySize} Pers.</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Guest requests */}
                {shiftStats.guestRequests.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <MessageSquare className="w-3 h-3 text-[#8888aa]" />
                      <span className="text-[#b0b0cc] text-[10px] font-semibold">Gästewünsche ({shiftStats.guestRequests.length})</span>
                    </div>
                    {shiftStats.guestRequests.map(r => (
                      <div key={r.id} className="flex items-start gap-2 pl-5 py-0.5">
                        <span className="text-white text-[11px] shrink-0">{r.time}</span>
                        <span className="text-[#c0c0dd] text-[11px] font-medium shrink-0">{r.guestName}</span>
                        <span className="text-[#999] text-[10px] truncate">{r.notes}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Special events */}
                {shiftStats.specialEvents.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3 h-3 text-[#8888aa]" />
                      <span className="text-[#b0b0cc] text-[10px] font-semibold">Besondere Anlässe ({shiftStats.specialEvents.length})</span>
                    </div>
                    {shiftStats.specialEvents.map(r => (
                      <div key={r.id} className="flex items-center gap-2 pl-5 py-0.5">
                        <span className="text-white text-[11px]">{r.time}</span>
                        <span className="text-[#c0c0dd] text-[11px] font-medium">{r.guestName}</span>
                        <span className="text-[#b0b0cc] text-[11px]">{r.partySize} Pers.</span>
                        {(r.occasionLabels || []).map(oc => {
                          const info = OCCASION_LABELS_MAP[oc];
                          return info ? (
                            <span key={oc} className="px-1.5 py-[1px] rounded-[3px] text-[9px] font-bold text-white" style={{ background: OCCASION_ICONS[oc]?.color || '#8888aa' }}>
                              {info.label}
                            </span>
                          ) : null;
                        })}
                      </div>
                    ))}
                  </div>
                )}

                {/* Seating preferences */}
                {shiftStats.seatingPrefs.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Armchair className="w-3 h-3 text-[#8888aa]" />
                      <span className="text-[#b0b0cc] text-[10px] font-semibold">Sitzplatzwünsche ({shiftStats.seatingPrefs.length})</span>
                    </div>
                    {shiftStats.seatingPrefs.map(r => (
                      <div key={r.id} className="flex items-center gap-2 pl-5 py-0.5">
                        <span className="text-white text-[11px]">{r.time}</span>
                        <span className="text-[#c0c0dd] text-[11px] font-medium">{r.guestName}</span>
                        {(r.seatLabels || []).map(sl => {
                          const info = SEAT_LABELS_MAP[sl];
                          return info ? (
                            <span key={sl} className="text-[#999] text-[10px]">{info.label}</span>
                          ) : null;
                        })}
                      </div>
                    ))}
                  </div>
                )}

                {/* Referral sources */}
                {shiftStats.referrals.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Star className="w-3 h-3 text-[#8888aa]" />
                      <span className="text-[#b0b0cc] text-[10px] font-semibold">Empfehlungen ({shiftStats.referrals.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1 pl-5 mb-1">
                      {shiftStats.referralSources.map(src => (
                        <span key={src} className="px-1.5 py-[1px] rounded-[3px] text-[9px] font-medium bg-[#a78bfa]/15 text-[#a78bfa] border border-[#a78bfa]/30">
                          {src}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Payment stats */}
                {(shiftStats.paidCount > 0 || shiftStats.partialCount > 0) && (
                  <div className="mb-1">
                    <div className="flex items-center gap-3 pl-5">
                      {shiftStats.paidCount > 0 && (
                        <span className="text-[10px] text-[#22c55e]">{shiftStats.paidCount}x Bezahlt</span>
                      )}
                      {shiftStats.partialCount > 0 && (
                        <span className="text-[10px] text-[#f59e0b]">{shiftStats.partialCount}x Anzahlung</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dribbble-style reservation list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
        {dayReservations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#555577]">
            <Calendar className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-sm font-medium text-[#777]">Keine Reservierungen</p>
            <p className="text-xs mt-1 text-[#6b6b8a]">Nutze den Button oben um eine anzulegen</p>
          </div>
        ) : (
          <>
            {/* UPCOMING SECTION */}
            {upcomingReservations.length > 0 && (
              <div>
                {/* Section header */}
                <button
                  className="w-full flex items-center justify-between px-2 py-2.5"
                  onClick={() => setShowUpcoming(!showUpcoming)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-[15px]">Reservierungen</span>
                    <span className="text-[#7bb7ef] text-xs underline">nach Uhrzeit</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#8888aa] text-[11px]"><span className="text-white font-bold">{upcomingReservations.length}</span> Gruppen</span>
                    <span className="text-[#8888aa] text-[11px]"><span className="text-white font-bold">{upcomingGuests}</span> Gäste</span>
                    {showUpcoming ? <ChevronUp className="w-4 h-4 text-[#8888aa]" /> : <ChevronDown className="w-4 h-4 text-[#8888aa]" />}
                  </div>
                </button>
                {showUpcoming && upcomingReservations.map((r, idx) => {
                  const sourceColor = SOURCE_COLORS[r.source] || '#8888aa';
                  const SourceIcon = SOURCE_ICONS[r.source as keyof typeof SOURCE_ICONS] || Users;
                  const assignedTable = r.tableId ? state.tables.find(t => t.id === r.tableId) : null;
                  const guestProfile = getGuestForReservation(r);
                  const isMenuOpen = openMenuId === r.id;
                  const isVip = guestProfile?.tags.includes('vip') || guestProfile?.tags.includes('stammgast');
                  const occasions = r.occasionLabels || [];
                  const guestTags = guestProfile?.tags || [];
                  return (
                    <div key={r.id} style={{ marginBottom: '2px' }}>
                      {/* Figma card */}
                      <div
                        className="flex items-center h-[52px] rounded-[3px] hover:brightness-110 active:brightness-125 transition-all relative"
                        style={{ background: '#252540' }}
                        onClick={() => { if (!isMenuOpen) setOpenMenuId(r.id); }}
                      >
                        {/* Left color bar with icon + party size */}
                        <div className="shrink-0 ml-[3px] rounded-[3px] flex flex-col items-center justify-center gap-[2px]"                         style={{ background: sourceColor, width: '28px', height: '45px' }}>
                                                  <SourceIcon className="w-3.5 h-3.5 text-white" />
                                                  <span className="text-white font-bold text-[11px] leading-none mt-1">{r.partySize}</span>
                                                </div>
                                                {/* Content area */}
                                                <div className="flex-1 min-w-0 ml-[10px]">
                                                  {/* Line 1: time + duration */}
                          <div className="flex items-center gap-[6px]">
                            <span className="text-white font-normal text-[12px]">{r.time} Uhr</span>
                            <span className="text-[#8888aa] font-normal text-[10px]">{formatDuration(r.duration)}</span>
                          </div>
                          {/* Line 2: star + guest name */}
                          <div className="flex items-center gap-[4px] mt-[1px]">
                            {isVip && <IconStarFilled size={15} color="#FFCC00" />}
                            <span className="text-white font-semibold text-[16px] truncate whitespace-nowrap">{r.guestName}</span>
                            {r.referralSource && <span className="text-[#a78bfa] text-[9px] font-medium truncate">via {r.referralSource}</span>}
                          </div>
                        </div>
                        {/* Icon chips - right-aligned, bottom-aligned with name row */}
                        <div className="shrink-0 flex items-end gap-[3px] mr-[6px] pb-[18px]">
                          {r.paymentStatus === 'paid' && <IconCircleCheckFilled size={16} color="#15803d" />}
                          {r.paymentStatus === 'partial' && <IconCoinFilled size={16} color="#b45309" />}
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
                            const TagIcon = info.Icon;
                            return (
                              <TagIcon key={tag} size={16} color={info.color} />
                            );
                          })}
                        </div>
                        {/* Right side - table badge (OpenTable-style colored) */}
                        <div className="shrink-0 mr-[3px]">
                          {(() => {
                            const allIds = [...(r.tableIds || []), ...(r.tableId && !(r.tableIds || []).includes(r.tableId) ? [r.tableId] : [])];
                            const tables = allIds.map(tid => state.tables.find(t => t.id === tid)).filter(Boolean);
                            if (tables.length > 1) {
                              return (
                                <div className="flex flex-col items-center justify-center rounded-[4px] px-[4px]"
                                  style={{ background: '#9333ea', minWidth: '40px', height: '40px' }}>
                                  <span className="text-white font-bold text-[10px] leading-tight text-center whitespace-nowrap">{tables.map(t => t!.name.replace(/[^0-9]/g, '') || t!.name).join('+')}</span>
                                  <span className="text-white/70 font-medium text-[8px] leading-none mt-[2px]">{tables.length} Tische</span>
                                </div>
                              );
                            } else if (assignedTable) {
                              return (
                                <div className="flex flex-col items-center justify-center rounded-[4px]"
                                  style={{ background: '#9333ea', width: '40px', height: '40px' }}>
                                  <span className="text-white font-bold text-[15px] leading-none">{assignedTable.name.replace(/[^0-9]/g, '') || assignedTable.name}</span>
                                </div>
                              );
                            } else {
                              return (
                                <div className="flex items-center justify-center rounded-[4px]"
                                  style={{ background: '#222238', width: '40px', height: '40px' }}>
                                  <Armchair className="w-5 h-5 text-[#555577]" />
                                </div>
                              );
                            }
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Context menu modal for upcoming */}
            {openMenuId && upcomingReservations.find(r => r.id === openMenuId) && (() => {
              const r = upcomingReservations.find(r => r.id === openMenuId)!;
              const assignedTable = r.tableId ? state.tables.find(t => t.id === r.tableId) : null;
              const guestProfile = getGuestForReservation(r);
              return (
                <div className="fixed inset-0 z-[9999] flex flex-col" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }} style={{ background: 'rgba(0,0,0,0.6)' }}>
                  <div className="mt-auto w-full rounded-t-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto" style={{ background: '#1a1a2e' }} onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-5 py-4">
                      <span className="text-2xl font-bold text-white">{r.guestName}</span>
                      <button onClick={() => setOpenMenuId(null)} className="p-1 text-[#b0b0cc] hover:text-[#e0e0f0]"><X className="w-6 h-6" /></button>
                    </div>
                    <div className="px-5 py-2 space-y-2">
                      <button onClick={() => { handleStatusChange(r.id, 'seated'); setOpenMenuId(null); }}
                        className="w-full flex items-center gap-3 py-4 px-4 rounded-xl text-white font-semibold text-base transition-colors" style={{ background: '#7c3aed' }}>
                        <Check className="w-5 h-5" /> Platzieren
                      </button>
                      <button onClick={() => { handleEditReservation(r); setOpenMenuId(null); }}
                        className="w-full flex items-center gap-3 py-4 px-4 rounded-xl border border-[#3d3d5c] text-[#c0c0dd] font-medium text-base hover:bg-[#2a2a42] active:bg-[#353558] transition-colors">
                        <Edit3 className="w-5 h-5 text-[#b0b0cc]" /> Bearbeiten
                      </button>
                      {guestProfile && (
                        <button onClick={() => { setShowGuestProfile(guestProfile); setOpenMenuId(null); }}
                          className="w-full flex items-center gap-3 py-4 px-4 rounded-xl border border-[#3d3d5c] text-[#c0c0dd] font-medium text-base hover:bg-[#2a2a42] active:bg-[#353558] transition-colors">
                          <User className="w-5 h-5 text-[#b0b0cc]" /> Gast-Profil
                        </button>
                      )}
                    </div>
                    <div className="px-5 py-3">
                      <p className="text-sm font-bold text-[#b0b0cc] tracking-wider mb-3">Tische zuweisen</p>
                      <div className="max-h-[160px] overflow-y-auto pr-1">
                        <div className="flex flex-wrap gap-2">
                          {state.tables.map(t => {
                            const currentIds = r.tableIds || (r.tableId ? [r.tableId] : []);
                            const isSelected = currentIds.includes(t.id);
                            const isFree = t.status === 'free' || isSelected;
                            return (
                              <button key={t.id} disabled={!isFree}
                                onClick={() => handleToggleMultiTable(r.id, t.id)}
                                className={'px-3 py-2 rounded-lg text-sm font-medium transition-all ' +
                                  (isSelected ? 'border-2 border-[#7bb7ef] text-white bg-[#2a2a42]' :
                                    isFree ? 'border border-[#3d3d5c] text-[#c0c0dd] bg-[#2d2d50] hover:bg-[#444] cursor-pointer' :
                                      'border border-[#333355] text-[#555577] bg-[#222238] cursor-not-allowed')}>
                                {t.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="px-5 py-3">
                      <p className="text-sm font-bold text-[#b0b0cc] tracking-wider mb-3">Zahlungsstatus</p>
                      <div className="flex gap-2">
                        {([['open', 'OFFEN'], ['partial', 'ANZAHLUNG'], ['paid', 'BEZAHLT']] as const).map(([val, label]) => {
                          const isActive = (r.paymentStatus || 'open') === val;
                          return (
                            <button key={val} onClick={() => handlePaymentStatus(r.id, val)}
                              className={'px-4 py-2.5 rounded-lg text-sm font-bold tracking-wider transition-all ' +
                                (isActive ? 'border-2 border-[#7bb7ef] text-white bg-[#2a2a42]' :
                                  'border border-[#3d3d5c] text-[#c0c0dd] bg-[#2d2d50] hover:bg-[#444]')}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="px-5 py-3 pb-20 space-y-1">
                      <button onClick={() => { handleStatusChange(r.id, 'cancelled'); setOpenMenuId(null); }}
                        className="w-full flex items-center gap-3 py-4 px-4 text-[#ef4444] font-semibold text-base hover:bg-[#3a1a1a] transition-colors rounded-xl">
                        <X className="w-5 h-5" /> Stornieren
                      </button>
                      <button onClick={() => { handleDelete(r.id); setOpenMenuId(null); }}
                        className="w-full flex items-center gap-3 py-4 px-4 text-[#ef4444] font-semibold text-base hover:bg-[#3a1a1a] transition-colors rounded-xl">
                        <Trash2 className="w-5 h-5" /> Loeschen
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* SEATED SECTION */}
            {seatedReservations.length > 0 && (
              <div>
                {/* Section header */}
                <button
                  className="w-full flex items-center justify-between px-2 py-2.5"
                  onClick={() => setShowSeated(!showSeated)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-[15px]">Platziert</span>
                    <span className="text-[#7bb7ef] text-xs underline">nach Sitzzeit</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#8888aa] text-[11px]"><span className="text-white font-bold">{seatedReservations.length}</span> Gruppen</span>
                    <span className="text-[#8888aa] text-[11px]"><span className="text-white font-bold">{seatedGuests}</span> Gäste</span>
                    {showSeated ? <ChevronUp className="w-4 h-4 text-[#8888aa]" /> : <ChevronDown className="w-4 h-4 text-[#8888aa]" />}
                  </div>
                </button>
                {showSeated && seatedReservations.map((r, idx) => {
                  const sourceColor = SOURCE_COLORS[r.source] || '#8888aa';
                  const SourceIcon = SOURCE_ICONS[r.source as keyof typeof SOURCE_ICONS] || Users;
                  const assignedTable = r.tableId ? state.tables.find(t => t.id === r.tableId) : null;
                  const guestProfile = getGuestForReservation(r);
                  const isMenuOpen = openMenuId === r.id;
                  const isVip = guestProfile?.tags.includes('vip') || guestProfile?.tags.includes('stammgast');
                  const occasions = r.occasionLabels || [];
                  const guestTags = guestProfile?.tags || [];
                  const seatedDuration = getCountdown(r);
                  return (
                    <div key={r.id} style={{ marginBottom: '2px' }}>
                      {/* Figma card */}
                      <div
                        className="flex items-center h-[52px] rounded-[3px] hover:brightness-110 active:brightness-125 transition-all relative"
                        style={{ background: '#252540' }}
                        onClick={() => { if (!isMenuOpen) setOpenMenuId(r.id); }}
                      >
                        {/* Left color bar with icon + party size */}
                        <div className="shrink-0 ml-[3px] rounded-[3px] flex flex-col items-center justify-center gap-[2px]"                         style={{ background: sourceColor, width: '28px', height: '45px' }}>
                                                  <SourceIcon className="w-3.5 h-3.5 text-white" />
                                                  <span className="text-white font-bold text-[11px] leading-none mt-1">{r.partySize}</span>
                                                </div>
                                                {/* Content area */}
                                                <div className="flex-1 min-w-0 ml-[10px]">
                                                  {/* Line 1: time + seated duration */}
                          <div className="flex items-center gap-[6px]">
                            <span className="text-white font-normal text-[12px]">{r.time} Uhr</span>
                            <span className="text-[10px] font-medium" style={{ color: seatedDuration.color }}>{seatedDuration.text}</span>
                          </div>
                          {/* Line 2: star + guest name */}
                          <div className="flex items-center gap-[4px] mt-[1px]">
                            {isVip && <IconStarFilled size={15} color="#FFCC00" />}
                            <span className="text-white font-semibold text-[16px] truncate whitespace-nowrap">{r.guestName}</span>
                            {r.referralSource && <span className="text-[#a78bfa] text-[9px] font-medium truncate">via {r.referralSource}</span>}
                          </div>
                        </div>
                        {/* Icon chips - right-aligned, bottom-aligned with name row */}
                        <div className="shrink-0 flex items-end gap-[3px] mr-[6px] pb-[18px]">
                          {r.paymentStatus === 'paid' && <IconCircleCheckFilled size={16} color="#15803d" />}
                          {r.paymentStatus === 'partial' && <IconCoinFilled size={16} color="#b45309" />}
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
                            const TagIcon = info.Icon;
                            return (
                              <TagIcon key={tag} size={16} color={info.color} />
                            );
                          })}
                        </div>
                        {/* Right side - table badge (OpenTable-style colored) */}
                        <div className="shrink-0 mr-[3px]">
                          {(() => {
                            const allIds = [...(r.tableIds || []), ...(r.tableId && !(r.tableIds || []).includes(r.tableId) ? [r.tableId] : [])];
                            const tables = allIds.map(tid => state.tables.find(t => t.id === tid)).filter(Boolean);
                            if (tables.length > 1) {
                              return (
                                <div className="flex flex-col items-center justify-center rounded-[4px] px-[4px]"
                                  style={{ background: '#9333ea', minWidth: '40px', height: '40px' }}>
                                  <span className="text-white font-bold text-[10px] leading-tight text-center whitespace-nowrap">{tables.map(t => t!.name.replace(/[^0-9]/g, '') || t!.name).join('+')}</span>
                                  <span className="text-white/70 font-medium text-[8px] leading-none mt-[2px]">{tables.length} Tische</span>
                                </div>
                              );
                            } else if (assignedTable) {
                              return (
                                <div className="flex flex-col items-center justify-center rounded-[4px]"
                                  style={{ background: '#9333ea', width: '40px', height: '40px' }}>
                                  <span className="text-white font-bold text-[15px] leading-none">{assignedTable.name.replace(/[^0-9]/g, '') || assignedTable.name}</span>
                                </div>
                              );
                            } else {
                              return (
                                <div className="flex items-center justify-center rounded-[4px]"
                                  style={{ background: '#222238', width: '40px', height: '40px' }}>
                                  <Armchair className="w-5 h-5 text-[#555577]" />
                                </div>
                              );
                            }
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Context menu modal for seated */}
            {openMenuId && seatedReservations.find(r => r.id === openMenuId) && (() => {
              const r = seatedReservations.find(r => r.id === openMenuId)!;
              const assignedTable = r.tableId ? state.tables.find(t => t.id === r.tableId) : null;
              const guestProfile = getGuestForReservation(r);
              return (
                <div className="fixed inset-0 z-[9999] flex flex-col" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }} style={{ background: 'rgba(0,0,0,0.6)' }}>
                  <div className="mt-auto w-full rounded-t-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto" style={{ background: '#1a1a2e' }} onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-5 py-4">
                      <span className="text-2xl font-bold text-white">{r.guestName}</span>
                      <button onClick={() => setOpenMenuId(null)} className="p-1 text-[#b0b0cc] hover:text-[#e0e0f0]"><X className="w-6 h-6" /></button>
                    </div>
                    <div className="px-5 py-2 space-y-2">
                      <button onClick={() => { handleEditReservation(r); setOpenMenuId(null); }}
                        className="w-full flex items-center gap-3 py-4 px-4 rounded-xl border border-[#3d3d5c] text-[#c0c0dd] font-medium text-base hover:bg-[#2a2a42] active:bg-[#353558] transition-colors">
                        <Edit3 className="w-5 h-5 text-[#b0b0cc]" /> Bearbeiten
                      </button>
                      {guestProfile && (
                        <button onClick={() => { setShowGuestProfile(guestProfile); setOpenMenuId(null); }}
                          className="w-full flex items-center gap-3 py-4 px-4 rounded-xl border border-[#3d3d5c] text-[#c0c0dd] font-medium text-base hover:bg-[#2a2a42] active:bg-[#353558] transition-colors">
                          <User className="w-5 h-5 text-[#b0b0cc]" /> Gast-Profil
                        </button>
                      )}
                      {assignedTable && onSeatReservation && (
                        <button onClick={() => { onSeatReservation(assignedTable.id); setOpenMenuId(null); }}
                          className="w-full flex items-center gap-3 py-4 px-4 rounded-xl text-white font-semibold text-base transition-colors" style={{ background: '#7c3aed' }}>
                          <Armchair className="w-5 h-5" /> Zum Tisch
                        </button>
                      )}
                    </div>
                    <div className="px-5 py-3 pb-20">
                      <button onClick={() => { handleDelete(r.id); setOpenMenuId(null); }}
                        className="w-full flex items-center gap-3 py-4 px-4 text-[#ef4444] font-semibold text-base hover:bg-[#3a1a1a] transition-colors rounded-xl">
                        <Trash2 className="w-5 h-5" /> Loeschen
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* New/Edit Reservation Form - Bottom Drawer */}
      {showForm && (
        <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => { setShowForm(false); resetForm(); }}>
          <div className="mt-auto w-full rounded-t-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col" style={{ background: '#1a1a2e' }} onClick={e => e.stopPropagation()}>
          {/* Wizard Header */}
          <div className="flex items-center justify-between px-3 py-2.5" style={{ background: '#1a1a2e' }}>
            <button onClick={() => {
              if (editingId || wizardStep === 'date') {
                setShowForm(false); resetForm();
              } else if (wizardStep === 'guests') {
                setWizardStep('date');
              } else if (wizardStep === 'guest_info') {
                setWizardStep('guests');
              }
            }}
              className="p-1.5 text-[#b0b0cc] hover:text-[#e0e0f0] transition-colors">
              <X className="w-5 h-5" />
            </button>

            <div className="flex-1 mx-3">
              <div className="flex items-center justify-center gap-2 px-4 py-2">
                {wizardStep === 'date' && (
                  <><Calendar className="w-4 h-4 text-[#b0b0cc]" /><span className="text-white font-semibold text-sm">Datum</span></>
                )}
                {wizardStep === 'guests' && (
                  <><Users className="w-4 h-4 text-[#b0b0cc]" /><span className="text-white font-semibold text-sm">{formData.partySize} {formData.partySize === 1 ? 'Gast' : 'Gäste'}</span></>
                )}
                {wizardStep === 'guest_info' && (
                  <><User className="w-4 h-4 text-[#b0b0cc]" /><span className="text-white font-semibold text-sm truncate">{formData.guestName || 'Gast'}</span></>
                )}
              </div>
            </div>

            {/* Step indicator dots */}
            {!editingId && (
              <div className="flex items-center gap-1.5">
                {['date', 'guests', 'guest_info'].map((step, i) => (
                  <div key={step} className={'w-2 h-2 rounded-full transition-colors ' +
                    (step === wizardStep ? 'bg-[#7bb7ef]' : i < ['date', 'guests', 'guest_info'].indexOf(wizardStep) ? 'bg-[#5d9edb]' : 'bg-[#555]')}
                  />
                ))}
              </div>
            )}
            {editingId && <div className="w-8" />}
          </div>

          {/* Step Content */}
          <div className="flex-1 overflow-y-auto" style={{ background: '#1a1a2e' }}>

            {/* === STEP 1: DATE PICKER === */}
            {wizardStep === 'date' && !editingId && (
              <div className="pb-4">
                <p className="text-center text-xs font-medium text-[#b0b0cc] py-1.5">{state.restaurant?.name || 'Restaurant'}</p>
                {(() => {
                  const today = new Date();
                  const months: { year: number; month: number }[] = [];
                  for (let i = 0; i < 3; i++) {
                    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
                    months.push({ year: d.getFullYear(), month: d.getMonth() });
                  }
                  const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
                  const dayHeaders = ['M', 'D', 'M', 'D', 'F', 'S', 'S'];
                  const todayStr = getTodayStr();
                  const [selY, selM, selD] = formData.date.split('-').map(Number);

                  return months.map(({ year, month }) => {
                    const weeks = generateCalendarMonth(year, month);
                    return (
                      <div key={`${year}-${month}`} className="mb-2">
                        <h3 className="text-center text-sm font-bold text-white py-1.5">
                          {monthNames[month]} {year}
                        </h3>
                        <div className="grid grid-cols-7 gap-0 px-3">
                          {dayHeaders.map((d, i) => (
                            <div key={i} className="text-center text-xs font-semibold text-[#b0b0cc] py-1">{d}</div>
                          ))}
                          {weeks.flat().map((day, i) => {
                            if (day === null) return <div key={`empty-${i}`} />;
                            const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
                            const isToday2 = dateStr === todayStr;
                            const isSelected = year === selY && month === selM - 1 && day === selD;
                            const isPast = dateStr < todayStr;
                            const resCount = getReservationCountForDate(dateStr);
                            return (
                              <button key={dateStr}
                                disabled={isPast}
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, date: dateStr }));
                                  setWizardStep('guests');
                                }}
                                className={'flex flex-col items-center py-1 rounded-lg transition-colors ' +
                                  (isSelected ? 'bg-[#5d9edb] text-white' : isToday2 ? 'bg-purple-900/40 text-[#7bb7ef]' : isPast ? 'opacity-30 text-[#777] cursor-not-allowed' : 'text-[#c0c0dd] hover:bg-[#2a2a42]')}>
                                <span className={'text-xs font-semibold ' + (isSelected ? 'text-white' : isPast ? 'text-[#777] line-through' : '')}>{day}</span>
                                {resCount > 0 && !isPast && (
                                  <span className={'text-[7px] leading-none ' + (isSelected ? 'text-purple-200' : 'text-[#7bb7ef]')}>
                                    {resCount}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}

            {/* === STEP 2: PARTY SIZE + TIME === */}
            {wizardStep === 'guests' && !editingId && (
              <div className="p-4 space-y-4">
                <div className="text-center">
                  <p className="text-xs text-[#b0b0cc] mb-0.5">{formatDateDisplay(formData.date)}</p>
                  <h3 className="text-base font-bold text-white">Wie viele Gäste?</h3>
                </div>

                {/* Party size - compact grid like Waitlist */}
                <div>
                  <div className="flex gap-2 flex-wrap">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                      <button key={n} onClick={() => setFormData(prev => ({ ...prev, partySize: n }))}
                        className={'w-12 h-12 rounded-xl border-2 text-base font-bold transition-colors ' +
                          (formData.partySize === n ? 'border-[#7bb7ef] bg-[#7bb7ef] text-white' : 'border-[#3d3d5c] text-[#c0c0dd] hover:border-[#7bb7ef]')}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    placeholder="Andere Anzahl..."
                    value={formData.partySize > 8 ? formData.partySize : ''}
                    onChange={e => {
                      const val = parseInt(e.target.value);
                      if (val > 0) setFormData(prev => ({ ...prev, partySize: val }));
                    }}
                    className="w-full mt-2 border border-[#3d3d5c] rounded-xl py-2.5 px-4 text-center text-white outline-none focus:border-[#7bb7ef] bg-[#2a2a42] placeholder:text-[#8888aa] text-sm"
                  />
                </div>

                {/* Time picker - compact */}
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-xs font-semibold text-[#b0b0cc] uppercase tracking-wider">Uhrzeit</h4>
                    <input type="time" value={formData.time}
                      onChange={e => setFormData(prev => ({ ...prev, time: e.target.value }))}
                      className="border border-[#3d3d5c] rounded-lg py-1.5 px-3 text-center text-white outline-none focus:border-[#7bb7ef] text-xs bg-[#2a2a42] w-24" />
                  </div>
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30'].map(t => (
                      <button key={t} onClick={() => setFormData(prev => ({ ...prev, time: t }))}
                        className={'shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ' +
                          (formData.time === t ? 'border-[#7bb7ef] bg-[#7bb7ef]/20 text-[#7bb7ef]' : 'border-[#3d3d5c] text-[#b0b0cc] hover:bg-[#2a2a42]')}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pacing limit warning */}
                {isPacingExceeded && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#f59e0b]/15 border border-[#f59e0b]/30">
                    <AlertCircle className="w-4 h-4 text-[#f59e0b] shrink-0" />
                    <p className="text-[11px] text-[#f59e0b]">Pacing Limit erreicht: {currentSlotCount}/{pacingLimit} Reservierungen in diesem Zeitslot</p>
                  </div>
                )}

                {/* Duration - compact inline */}
                <div className="flex items-center gap-3">
                  <h4 className="text-xs font-semibold text-[#b0b0cc] uppercase tracking-wider shrink-0">Dauer</h4>
                  <div className="flex gap-1.5 flex-1">
                    {[60, 90, 120, 150, 180].map(d => (
                      <button key={d} onClick={() => setFormData(prev => ({ ...prev, duration: d }))}
                        className={'flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ' +
                          (formData.duration === d ? 'border-[#7bb7ef] bg-[#7bb7ef]/20 text-[#7bb7ef]' : 'border-[#3d3d5c] text-[#b0b0cc] hover:bg-[#2a2a42]')}>
                        {d}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table assignment */}
                <div>
                  <h4 className="text-xs font-semibold text-[#b0b0cc] uppercase tracking-wider mb-1.5">Tisch (optional)</h4>
                  <select value={formData.tableId}
                    onChange={e => setFormData(prev => ({ ...prev, tableId: e.target.value }))}
                    className="w-full rounded-lg px-3 py-2 border border-[#3d3d5c] text-[#c0c0dd] outline-none focus:border-[#7bb7ef] text-xs bg-[#2a2a42]">
                    <option value="">Automatisch zuweisen</option>
                    {state.tables.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.status === 'free' ? 'frei' : 'besetzt'})</option>
                    ))}
                  </select>
                </div>

                {/* Continue button */}
                <button onClick={() => setWizardStep('guest_info')}
                  className="w-full py-3 rounded-xl font-semibold text-white text-sm"
                  style={{ background: '#7c3aed' }}>
                  Weiter
                </button>
              </div>
            )}

            {/* === STEP 3: GUEST / VERMITTLER INFO === */}
            {(wizardStep === 'guest_info' || editingId) && (
              <div className="pb-20">
                {/* Search bar */}
                <div className="px-4 py-3 border-b border-[#333355]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8888aa]" />
                    <input
                      type="text"
                      value={guestSearch}
                      onChange={e => handleGuestSearch(e.target.value)}
                      placeholder="Nach Telefonnummer oder Namen suchen"
                      className="w-full pl-9 pr-3 py-2.5 border border-[#3d3d5c] rounded-lg text-sm text-white outline-none focus:border-[#7bb7ef] bg-[#2a2a42] placeholder:text-[#8888aa]"
                    />
                  </div>
                  {/* Search results dropdown */}
                  {searchResults.length > 0 && (
                    <div className="mt-1 border border-[#3d3d5c] rounded-lg overflow-hidden shadow-lg">
                      {searchResults.slice(0, 5).map(g => (
                        <button key={g.id} onClick={() => handleSelectSearchGuest(g)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#353558] text-left border-b border-[#333355] last:border-0 bg-[#2a2a42]">
                          <div className="w-8 h-8 rounded-full bg-purple-900/40 flex items-center justify-center">
                            <User className="w-4 h-4 text-[#7bb7ef]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{g.name}</p>
                            {g.phone && <p className="text-xs text-[#b0b0cc]">{g.phone}</p>}
                          </div>
                          {g.totalVisits > 0 && (
                            <span className="text-xs text-[#7bb7ef] font-medium">{g.totalVisits}x</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Guest form fields */}
                <div className="px-4 py-3 space-y-4">
                  {/* Matched guest banner */}
                  {matchedGuest && (
                    <div className="rounded-lg bg-[#7bb7ef]/15 border border-purple-700/30 p-3 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-purple-900/40 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-[#7bb7ef]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#b1d9ff]">{matchedGuest.name}</p>
                        {matchedGuest.tags.length > 0 && (
                          <div className="flex gap-1 mt-0.5">
                            {matchedGuest.tags.slice(0, 3).map(tag => {
                              const info = ALL_TAGS_MAP[tag];
                              return info ? (
                                <span key={tag} className="px-1.5 py-0.5 rounded-full text-[9px] font-medium"
                                  style={{ background: info.color + '22', color: info.color }}>
                                  {info.label}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                      <button onClick={() => setShowGuestProfile(matchedGuest)}
                        className="text-xs text-[#7bb7ef] font-medium hover:text-[#b1d9ff] shrink-0">
                        Profil
                      </button>
                    </div>
                  )}

                  {/* Form fields in resmio style */}
                  <div className="space-y-0 border border-[#3d3d5c] rounded-lg overflow-hidden">
                    <div className="flex items-center border-b border-[#3d3d5c] px-3 py-2.5 bg-[#2a2a42]">
                      <span className="text-sm text-[#b0b0cc] w-24 shrink-0">Vorname</span>
                      <input type="text" value={formData.guestName.split(' ')[0] || ''}
                        onChange={e => {
                          const lastName = formData.guestName.split(' ').slice(1).join(' ');
                          setFormData(prev => ({ ...prev, guestName: e.target.value + (lastName ? ' ' + lastName : '') }));
                        }}
                        placeholder="Vorname"
                        className="flex-1 text-sm text-white outline-none bg-transparent placeholder:text-[#8888aa]"
                      />
                    </div>
                    <div className="flex items-center border-b border-[#3d3d5c] px-3 py-2.5 bg-[#2a2a42]">
                      <span className="text-sm text-[#b0b0cc] w-24 shrink-0">Nachname</span>
                      <input type="text" value={formData.guestName.split(' ').slice(1).join(' ')}
                        onChange={e => {
                          const firstName = formData.guestName.split(' ')[0] || '';
                          setFormData(prev => ({ ...prev, guestName: firstName + (e.target.value ? ' ' + e.target.value : '') }));
                        }}
                        placeholder="Nachname"
                        className="flex-1 text-sm text-white outline-none bg-transparent placeholder:text-[#8888aa]"
                      />
                    </div>
                    <div className="flex items-center border-b border-[#3d3d5c] px-3 py-2.5 bg-[#2a2a42]">
                      <span className="text-sm text-[#b0b0cc] w-24 shrink-0">Telefon</span>
                      <input type="tel" value={formData.guestPhone}
                        onChange={e => handlePhoneChange(e.target.value)}
                        placeholder="Telefonnummer"
                        className="flex-1 text-sm text-white outline-none bg-transparent placeholder:text-[#8888aa]"
                      />
                    </div>
                  </div>

                  {/* Source */}
                  <div>
                    <p className="text-xs text-[#b0b0cc] font-semibold uppercase tracking-wider mb-2">Quelle</p>
                    <div className="flex gap-2">
                      {([['phone', 'Telefon'], ['online', 'Online'], ['walk_in', 'Walk-In']] as const).map(([val, label]) => (
                        <button key={val}
                          onClick={() => setFormData(prev => ({ ...prev, source: val }))}
                          className={'flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ' +
                            (formData.source === val ? 'border-[#7bb7ef] bg-[#7bb7ef]/20 text-[#7bb7ef]' : 'border-[#3d3d5c] text-[#b0b0cc] hover:bg-[#2a2a42]')}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Vermittler/Referral */}
                  <div>
                    <p className="text-xs text-[#b0b0cc] font-semibold uppercase tracking-wider mb-2">Vermittler / Empfehlung</p>
                    <input type="text" value={formData.referralSource}
                      onChange={e => setFormData(prev => ({ ...prev, referralSource: e.target.value }))}
                      placeholder="z.B. Hotel Adlon, Google, Freund Max M."
                      className="w-full px-3 py-2.5 border border-[#3d3d5c] rounded-lg text-sm text-white outline-none focus:border-[#7bb7ef] bg-[#2a2a42] placeholder:text-[#8888aa]"
                    />
                  </div>

                  {/* Guest stats if matched */}
                  {matchedGuest && (
                    <div className="grid grid-cols-4 gap-2 py-2">
                      <div className="text-center">
                        <p className="text-xs text-[#8888aa]">Akzeptiert</p>
                        <p className="text-base font-bold text-white">{matchedGuest.totalVisits || 0}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-[#8888aa]">Besuche</p>
                        <p className="text-base font-bold text-white">{matchedGuest.totalVisits || 0}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-[#8888aa]">Stornierung</p>
                        <p className="text-base font-bold text-white">0</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-[#8888aa]">No-Shows</p>
                        <p className="text-base font-bold text-white">0</p>
                      </div>
                    </div>
                  )}

                  {/* Etiketten */}
                  <div>
                    <p className="text-xs text-[#b0b0cc] font-semibold uppercase tracking-wider mb-2">ETIKETTEN</p>
                    <button
                      onClick={() => setShowLabelPicker(!showLabelPicker)}
                      className="px-3 py-1.5 rounded-full border border-[#7bb7ef] text-[#7bb7ef] text-xs font-medium hover:bg-[#7bb7ef]/20 transition-colors">
                      + Etiketten hinzufügen
                      {(formData.seatLabels.length + formData.occasionLabels.length) > 0 && (
                        <span className="ml-1 bg-[#5d9edb] text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                          {formData.seatLabels.length + formData.occasionLabels.length}
                        </span>
                      )}
                    </button>

                    {/* Selected labels */}
                    {(formData.seatLabels.length > 0 || formData.occasionLabels.length > 0) && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {formData.seatLabels.map(sl => (
                          <span key={sl} className="px-2 py-1 rounded-full text-[10px] font-medium bg-blue-900/30 text-blue-400 border border-blue-800">
                            {SEAT_LABELS_MAP[sl]?.label}
                          </span>
                        ))}
                        {formData.occasionLabels.map(ol => (
                          <span key={ol} className="px-2 py-1 rounded-full text-[10px] font-medium bg-amber-900/30 text-amber-400 border border-amber-800">
                            {OCCASION_LABELS_MAP[ol]?.label}
                          </span>
                        ))}
                      </div>
                    )}

                    {showLabelPicker && (
                      <div className="mt-3 space-y-3 p-3 border border-[#3d3d5c] rounded-lg bg-[#2a2a42]">
                        <div>
                          <p className="text-[10px] text-[#b0b0cc] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <Armchair className="w-3 h-3" /> Sitzplatz-Präferenzen
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {(Object.entries(SEAT_LABELS_MAP) as [SeatLabel, { label: string; icon: string }][]).map(([key, val]) => {
                              const isActive = formData.seatLabels.includes(key);
                              return (
                                <button key={key} type="button"
                                  onClick={() => setFormData(prev => ({
                                    ...prev,
                                    seatLabels: isActive ? prev.seatLabels.filter(s => s !== key) : [...prev.seatLabels, key],
                                  }))}
                                  className={'px-2 py-1 rounded-lg text-[10px] font-medium border transition-colors ' +
                                    (isActive ? 'border-blue-500 bg-blue-900/40 text-blue-300' : 'border-[#3d3d5c] bg-[#353558] text-[#b0b0cc] hover:border-[#5a5a5a]')}>
                                  {val.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] text-[#b0b0cc] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Anlass
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {(Object.entries(OCCASION_LABELS_MAP) as [OccasionLabel, { label: string; icon: string }][]).map(([key, val]) => {
                              const isActive = formData.occasionLabels.includes(key);
                              return (
                                <button key={key} type="button"
                                  onClick={() => setFormData(prev => ({
                                    ...prev,
                                    occasionLabels: isActive ? prev.occasionLabels.filter(o => o !== key) : [...prev.occasionLabels, key],
                                  }))}
                                  className={'px-2 py-1 rounded-lg text-[10px] font-medium border transition-colors ' +
                                    (isActive ? 'border-amber-500 bg-amber-900/40 text-amber-300' : 'border-[#3d3d5c] bg-[#353558] text-[#b0b0cc] hover:border-[#5a5a5a]')}>
                                  {val.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <p className="text-xs text-[#b0b0cc] font-semibold uppercase tracking-wider mb-2">BESUCHSNOTIZEN</p>
                    <textarea value={formData.notes}
                      onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="z.B. Allergien, Kinderstuhl, Geburtstag..."
                      rows={2}
                      className="w-full rounded-lg px-3 py-2.5 border border-[#3d3d5c] text-white text-sm outline-none focus:border-[#7bb7ef] resize-none bg-[#2a2a42] placeholder:text-[#8888aa]"
                    />
                  </div>

                  {/* Edit mode: compact iOS-style inline rows */}
                  {editingId && (
                    <div className="border border-[#3d3d5c] rounded-lg overflow-hidden bg-[#2a2a42]">
                      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#333355]">
                        <span className="text-xs text-[#b0b0cc]">Datum</span>
                        <input type="date" value={formData.date}
                          onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                          className="text-sm text-white outline-none bg-transparent text-right" />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#333355]">
                        <span className="text-xs text-[#b0b0cc]">Uhrzeit</span>
                        <input type="time" value={formData.time}
                          onChange={e => setFormData(prev => ({ ...prev, time: e.target.value }))}
                          className="text-sm text-white outline-none bg-transparent text-right" />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#333355]">
                        <span className="text-xs text-[#b0b0cc]">Personen</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setFormData(prev => ({ ...prev, partySize: Math.max(1, prev.partySize - 1) }))}
                            className="w-6 h-6 rounded-md border border-[#3d3d5c] text-[#c0c0dd] flex items-center justify-center hover:bg-[#353558] text-sm font-bold">-</button>
                          <span className="text-white font-semibold text-sm w-5 text-center">{formData.partySize}</span>
                          <button onClick={() => setFormData(prev => ({ ...prev, partySize: Math.min(20, prev.partySize + 1) }))}
                            className="w-6 h-6 rounded-md border border-[#3d3d5c] text-[#c0c0dd] flex items-center justify-center hover:bg-[#353558] text-sm font-bold">+</button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#333355]">
                        <span className="text-xs text-[#b0b0cc]">Dauer</span>
                        <select value={formData.duration}
                          onChange={e => setFormData(prev => ({ ...prev, duration: Number(e.target.value) }))}
                          className="text-sm text-white outline-none bg-transparent text-right">
                          {[60, 90, 120, 150, 180].map(d => <option key={d} value={d}>{d} Min</option>)}
                        </select>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <span className="text-xs text-[#b0b0cc]">Tisch</span>
                        <select value={formData.tableId}
                          onChange={e => setFormData(prev => ({ ...prev, tableId: e.target.value }))}
                          className="text-sm text-white outline-none bg-transparent text-right">
                          <option value="">Automatisch</option>
                          {state.tables.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sticky Reservieren button at bottom */}
                <div className="px-4 py-3" style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
                  <button onClick={handleSave}
                    disabled={!formData.guestName.trim()}
                    className="w-full py-3.5 rounded-xl font-semibold text-white text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: '#7c3aed' }}>
                    <Check className="w-5 h-5" />
                    {editingId ? 'Speichern' : 'Reservieren'}
                  </button>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
