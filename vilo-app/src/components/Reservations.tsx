import { useState, useEffect, useMemo, type ComponentType } from 'react';
import { IconAlertCircle, IconArmchair, IconChartBar, IconCalendar, IconCheck, IconChevronDown, IconChevronLeft, IconChevronRight, IconChevronUp, IconEdit, IconMessage, IconPlus, IconSearch, IconSparkles, IconStar, IconTrash, IconUser, IconUserPlus, IconUsers, IconX, IconAlertTriangleFilled, IconBabyCarriage, IconBriefcaseFilled, IconCake, IconCircleCheckFilled, IconCoinFilled, IconConfetti, IconGiftFilled, IconGlobeFilled, IconHeartFilled, IconHeartHandshake, IconLeaf, IconMasksTheater, IconNews, IconPhoneFilled, IconPlant2, IconSchool, IconStarFilled, IconWalk, IconWheelchair } from '@tabler/icons-react';

import { Reservation, ReservationStatus, Guest, SeatLabel, OccasionLabel } from '../types';
import { loadReservations, addReservation, updateReservation, deleteReservation, findGuestByPhone, addGuest, loadGuests } from '../utils/storage';
import { generateId, getTodayStr, formatDateDisplay, formatDuration, maskPhoneValue } from '../utils/common';

import { useApp } from '../context/AppContext';
import { GuestProfile, GuestList } from './GuestProfile';

interface ReservationPanelProps {
  onClose: () => void;
  onSeatReservation?: (tableId: string) => void;
  onReservationsChange?: (reservations: Reservation[]) => void;
  initialShowForm?: boolean;
  embedded?: boolean;
}

const SOURCE_ICONS = {
  phone: IconPhoneFilled,
  online: IconGlobeFilled,
  walk_in: IconWalk,
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
type ReservationIconComponent = ComponentType<{ size?: string | number; color?: string }>;

const OCCASION_ICONS: Record<OccasionLabel, { Icon: ReservationIconComponent; color: string }> = {
  geburtstag: { Icon: IconConfetti, color: '#22c55e' },
  jahrestag: { Icon: IconHeartFilled, color: '#22c55e' },
  besonderer_anlass: { Icon: IconSparkles, color: '#a855f7' },
  date: { Icon: IconHeartHandshake, color: '#ec4899' },
  geschaeftsessen: { Icon: IconBriefcaseFilled, color: '#a855f7' },
  gratis_extra: { Icon: IconGiftFilled, color: '#22c55e' },
  schulabschluss: { Icon: IconSchool, color: '#3b82f6' },
  theater_kino: { Icon: IconMasksTheater, color: '#f59e0b' },
};

const ALL_TAGS_MAP: Record<string, { label: string; color: string; Icon: ReservationIconComponent; }> = {
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

export function ReservationPanel({ onClose, onSeatReservation, onReservationsChange, initialShowForm = false, embedded = false }: ReservationPanelProps) {
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
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [guestSearch, setGuestSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Guest[]>([]);
  const [, setTick] = useState(0); // force re-render every minute for seated duration
  const [formData, setFormData] = useState({
    guestName: '',
    guestPhone: '',
    guestEmail: '',
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
    const nextReservations = loadReservations();
    setReservations(nextReservations);
    onReservationsChange?.(nextReservations);
    setGuests(loadGuests());
  }, []);

  useEffect(() => {
    if (!initialShowForm) return;
    handleOpenForm();
  }, [initialShowForm]);

  // Update seated duration every 60s
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const reloadAll = () => {
    const nextReservations = loadReservations();
    setReservations(nextReservations);
    onReservationsChange?.(nextReservations);
    setGuests(loadGuests());
  };

  const applyReservationUpdate = (nextReservations: Reservation[]) => {
    setReservations(nextReservations);
    onReservationsChange?.(nextReservations);
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
      guestEmail: '',
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
    const selected = new Date(selectedDate);
    setCalendarMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    setGuestSearch('');
    setSearchResults([]);
  };

  const handleOpenForm = () => {
    resetForm();
    setFormData(prev => ({ ...prev, date: selectedDate }));
    const selected = new Date(selectedDate);
    setCalendarMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
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
      guestEmail: guest.email || '',
      guestId: guest.id,
    }));
    setGuestSearch('');
    setSearchResults([]);
  };

  const generateCalendarMatrix = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const startDate = new Date(year, month, 1 - startOffset);
    const weeks: { date: Date; currentMonth: boolean }[][] = [];

    for (let week = 0; week < 6; week++) {
      const row: { date: Date; currentMonth: boolean }[] = [];
      for (let day = 0; day < 7; day++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + week * 7 + day);
        row.push({
          date: cellDate,
          currentMonth: cellDate.getMonth() === month,
        });
      }
      weeks.push(row);
    }

    return weeks;
  };

  const shiftCalendarMonth = (delta: number) => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  // Get reservation count for a specific date
  const getReservationCountForDate = (dateStr: string): number => {
    return reservations.filter(r => r.date === dateStr && r.status !== 'cancelled').length;
  };

  const handleEditReservation = (r: Reservation) => {
    setFormData({
      guestName: r.guestName,
      guestPhone: r.guestPhone || '',
      guestEmail: r.guestEmail || '',
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
          guestEmail: prev.guestEmail || found.email || '',
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
          email: formData.guestEmail.trim() || undefined,
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
        guestEmail: formData.guestEmail.trim() || undefined,
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
      applyReservationUpdate(updated);
    } else {
      const newRes: Reservation = {
        id: generateId(),
        guestName: formData.guestName.trim(),
        guestPhone: formData.guestPhone.trim() || undefined,
        guestEmail: formData.guestEmail.trim() || undefined,
        confirmationStatus: 'pending',
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
      applyReservationUpdate(updated);
    }
    setShowForm(false);
    resetForm();
    reloadAll();
    if (embedded) {
      onClose();
    }
  };

  const handleDelete = (id: string) => {
    const updated = deleteReservation(id);
    applyReservationUpdate(updated);
  };

  const handleStatusChange = (id: string, status: ReservationStatus) => {
    const updated = updateReservation(id, { status });
    applyReservationUpdate(updated);
    if (status === 'seated') {
      const res = reservations.find(r => r.id === id);
      if (res?.tableId && onSeatReservation) {
        onSeatReservation(res.tableId);
      }
    }
  };

  const handlePaymentStatus = (resId: string, status: 'open' | 'partial' | 'paid') => {
    const updated = updateReservation(resId, { paymentStatus: status === 'open' ? undefined : status });
    applyReservationUpdate(updated);
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
    applyReservationUpdate(updated);
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
      <div
        className={embedded ? 'absolute inset-0 z-20 flex flex-col' : 'fixed inset-0 z-50 flex flex-col'}
        style={{ background: embedded ? 'var(--vilo-bg-base)' : 'rgba(0,0,0,0.5)' }}
        onClick={() => { if (!embedded) { setShowGuestProfile(null); reloadAll(); } }}
      >
        <div
          className={embedded ? 'h-full min-h-0 flex flex-col relative overflow-hidden' : 'mt-auto rounded-t-2xl overflow-hidden shadow-2xl min-h-[70vh] max-h-[90vh] flex flex-col relative'}
          style={{ background: 'var(--vilo-bg-base)' }}
          onClick={e => e.stopPropagation()}
        >
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
        </div>
      </div>
    );
  }

  if (showGuestList) {
    return (
      <div
        className={embedded ? 'absolute inset-0 z-20 flex flex-col' : 'fixed inset-0 z-50 flex flex-col'}
        style={{ background: embedded ? 'var(--vilo-bg-base)' : 'rgba(0,0,0,0.5)' }}
        onClick={() => { if (!embedded) { setShowGuestList(false); reloadAll(); } }}
      >
        <div
          className={embedded ? 'h-full min-h-0 flex flex-col relative overflow-hidden' : 'mt-auto rounded-t-2xl overflow-hidden shadow-2xl min-h-[70vh] max-h-[90vh] flex flex-col relative'}
          style={{ background: 'var(--vilo-bg-base)' }}
          onClick={e => e.stopPropagation()}
        >
          <GuestList
            onClose={() => { setShowGuestList(false); reloadAll(); }}
            onSelectGuest={handleSelectGuestFromList}
          />
        </div>
      </div>
    );
  }

  const renderEmbeddedCalendarSidebar = () => {
    const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const dayHeaders = ['M', 'D', 'M', 'D', 'F', 'S', 'S'];
    const todayStr = getTodayStr();
    const [selY, selM, selD] = formData.date.split('-').map(Number);
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const weeks = generateCalendarMatrix(year, month);

    return (
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="relative flex items-center justify-center mb-3 pb-3 border-b border-vilo-border-subtle">
          <span className="text-white font-semibold text-sm">Datum</span>
          <button
            onClick={() => {
              setShowForm(false);
              resetForm();
              if (embedded) {
                onClose();
              }
            }}
            className="absolute right-0 top-1/2 -translate-y-1/2 p-1.5 text-vilo-text-secondary hover:text-vilo-text-primary transition-colors"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => shiftCalendarMonth(-1)}
            className="w-10 h-10 flex items-center justify-center text-white transition-colors"
            style={{ background: '#312e4f' }}
          >
            <IconChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="px-2 py-2 text-[15px] font-semibold text-white">{monthNames[month]}</div>
            <div className="px-2 py-2 text-[15px] font-semibold text-white">{year}</div>
          </div>
          <button
            type="button"
            onClick={() => shiftCalendarMonth(1)}
            className="w-10 h-10 flex items-center justify-center text-white transition-colors"
            style={{ background: '#312e4f' }}
          >
            <IconChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-x-1 mb-2">
          {dayHeaders.map((d, i) => (
            <div key={i} className="text-center text-[13px] font-semibold tracking-[0.08em] text-[#c4b5fd] py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="space-y-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-1">
              {week.map(({ date, currentMonth }) => {
                const dateStr = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
                const isToday2 = dateStr === todayStr;
                const isSelected = date.getFullYear() === selY && date.getMonth() === selM - 1 && date.getDate() === selD;
                const isPast = dateStr < todayStr;
                const resCount = getReservationCountForDate(dateStr);

                return (
                  <button
                    key={dateStr}
                    disabled={isPast}
                    onClick={() => {
                      setFormData(prev => ({ ...prev, date: dateStr }));
                      setWizardStep('guests');
                    }}
                    className="aspect-square w-full flex flex-col items-center justify-center transition-all duration-150"
                    style={{
                      background: isSelected ? '#d946ef' : (!isPast && resCount > 0 ? '#5b216f' : '#2d2b48'),
                      color: isPast ? '#61677f' : currentMonth ? '#ffffff' : '#7f86a2',
                      opacity: isPast ? 0.42 : 1,
                      boxShadow: isSelected ? '0 8px 18px rgba(217,70,239,0.30)' : 'none',
                      borderRadius: 0,
                    }}
                  >
                    <span className="text-[17px] leading-none font-bold tracking-[-0.03em]">{date.getDate()}</span>
                    <span className="mt-1 h-[8px] flex items-center justify-center text-[8px] font-semibold tracking-[0.08em]">
                      {!isPast && isToday2 ? 'HEUTE' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className={embedded ? 'h-full min-h-0 flex flex-col relative' : 'fixed inset-0 z-50 flex flex-col'}
      style={{ background: embedded ? 'var(--vilo-bg-base)' : 'rgba(0,0,0,0.5)' }}
      onClick={embedded ? undefined : onClose}
    >
      <div
        className={embedded ? 'h-full min-h-0 flex flex-col overflow-hidden' : 'mt-auto rounded-t-2xl overflow-hidden shadow-2xl min-h-[70vh] max-h-[90vh] flex flex-col'}
        style={{ background: 'var(--vilo-bg-base)' }}
        onClick={e => e.stopPropagation()}
      >
      {/* Header */}
      {!(embedded && showForm) && (
      <div className={'border-b border-[var(--vilo-border-subtle)] shrink-0 ' + (embedded ? 'px-3 py-3' : 'px-5 py-4')} style={{ background: 'var(--vilo-bg-base)' }}>
        <div className={'mb-3 ' + (embedded ? 'space-y-2' : 'flex items-center justify-between')}>
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-white font-bold text-xl tracking-tight">Reservierungen</h1>
            {dayReservations.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: 'var(--vilo-accent-secondary)' }}>
                {dayReservations.length}
              </span>
            )}
          </div>
          <div className={'flex items-center gap-2 ' + (embedded ? 'flex-wrap' : '')}>
            <button
              onClick={() => setShowGuestList(true)}
              className={'flex items-center gap-1.5 text-vilo-text-soft font-medium border border-vilo-border-strong hover:bg-vilo-surface transition-colors ' + (embedded ? 'px-2.5 py-2 rounded-lg text-[13px]' : 'px-3 py-2 rounded-xl text-sm')}
            >
              <IconUsers className="w-4 h-4" />
              Gästeliste
            </button>
            <button
              onClick={handleOpenForm}
              className={'flex items-center gap-1.5 text-white font-semibold ' + (embedded ? 'px-2.5 py-2 rounded-lg text-[13px]' : 'px-3 py-2 rounded-xl text-sm')}
              style={{ background: 'var(--vilo-accent-secondary)' }}
            >
              <IconPlus className="w-4 h-4" />
              Hinzufügen
            </button>
            <button onClick={onClose} className="p-1 text-vilo-text-secondary hover:text-vilo-text-primary transition-colors">
              <IconX className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Summary bar */}
        <div className={'text-vilo-text-secondary ' + (embedded ? 'space-y-2 text-[13px]' : 'flex items-center justify-between gap-4 text-sm')}>
          <div className={'min-w-0 ' + (embedded ? 'space-y-2' : 'flex items-center gap-4')}>
            <div className="flex items-center gap-1.5">
              <button onClick={() => navigateDate(-1)} className="p-1 -ml-1 text-[#555577] hover:text-white transition-colors">
                <IconChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-white whitespace-nowrap">
                {isToday ? 'Heute' : formatDateDisplay(selectedDate)}
              </span>
              <button onClick={() => navigateDate(1)} className="p-1 -mr-1 text-[#555577] hover:text-white transition-colors">
                <IconChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className={'gap-3 ' + (embedded ? 'grid grid-cols-2' : 'flex items-center')}>
              <span className="flex items-center gap-1.5 whitespace-nowrap"><IconArmchair className="w-4 h-4 text-vilo-text-muted" /> {dayReservations.length} Gruppen</span>
              <span className="flex items-center gap-1.5 whitespace-nowrap"><IconUsers className="w-4 h-4 text-vilo-text-muted" /> {totalGuests} Gäste</span>
            </div>
          </div>
          <div className={'flex items-center gap-3 shrink-0 ' + (embedded ? 'justify-between' : '')}>
            <button onClick={() => setShowShiftOverview(!showShiftOverview)}
              className={'p-1 rounded transition-colors ' + (showShiftOverview ? 'text-[#7bb7ef] bg-[#7bb7ef]/10' : 'text-vilo-text-muted hover:text-white')}>
              <IconChartBar className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{freeTables.length} Tische frei</span>
            </div>
          </div>
        </div>
      </div>
      )}

            {/* Shift Overview Dashboard - like OpenTable */}
            {!showForm && showShiftOverview && (
        <div className="px-3 pb-2" style={{ background: 'var(--vilo-bg-base)' }}>
          <div className="rounded-[6px] p-3" style={{ background: '#222240' }}>
            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="rounded-[4px] p-2 text-center" style={{ background: '#181830' }}>
                <div className="text-white font-bold text-[16px]">{shiftStats.totalParties}</div>
                <div className="text-vilo-text-muted text-[9px] uppercase font-semibold">Gruppen</div>
              </div>
              <div className="rounded-[4px] p-2 text-center" style={{ background: '#181830' }}>
                <div className="text-white font-bold text-[16px]">{shiftStats.totalCovers}</div>
                <div className="text-vilo-text-muted text-[9px] uppercase font-semibold">Gäste</div>
              </div>
              <div className="rounded-[4px] p-2 text-center" style={{ background: '#181830' }}>
                <div className="text-white font-bold text-[16px]">{shiftStats.seated}</div>
                <div className="text-vilo-text-muted text-[9px] uppercase font-semibold">Platziert</div>
              </div>
              <div className="rounded-[4px] p-2 text-center" style={{ background: '#181830' }}>
                <div className="text-white font-bold text-[16px]">{shiftStats.walkIns}</div>
                <div className="text-vilo-text-muted text-[9px] uppercase font-semibold">Walk-Ins</div>
              </div>
            </div>

            {/* Source breakdown */}
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: '#3b82f6' }} />
                <span className="text-vilo-text-secondary text-[10px]">Telefon {shiftStats.phoneBookings}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: '#ec4899' }} />
                <span className="text-vilo-text-secondary text-[10px]">Online {shiftStats.onlineBookings}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
                <span className="text-vilo-text-secondary text-[10px]">Walk-In {shiftStats.walkIns}</span>
              </div>
              {shiftStats.cancelled > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />
                  <span className="text-vilo-text-secondary text-[10px]">Storniert {shiftStats.cancelled}</span>
                </div>
              )}
              {shiftStats.noShows > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} />
                  <span className="text-vilo-text-secondary text-[10px]">No-Show {shiftStats.noShows}</span>
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
                      <IconUsers className="w-3 h-3 text-vilo-text-muted" />
                      <span className="text-vilo-text-secondary text-[10px] font-semibold">Große Gruppen ({shiftStats.largeParties.length})</span>
                    </div>
                    {shiftStats.largeParties.map(r => (
                      <div key={r.id} className="flex items-center gap-2 pl-5 py-0.5">
                        <span className="text-white text-[11px]">{r.time}</span>
                        <span className="text-vilo-text-soft text-[11px] font-medium">{r.guestName}</span>
                        <span className="text-[#7bb7ef] text-[11px] font-bold">{r.partySize} Pers.</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Guest requests */}
                {shiftStats.guestRequests.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <IconMessage className="w-3 h-3 text-vilo-text-muted" />
                      <span className="text-vilo-text-secondary text-[10px] font-semibold">Gästewünsche ({shiftStats.guestRequests.length})</span>
                    </div>
                    {shiftStats.guestRequests.map(r => (
                      <div key={r.id} className="flex items-start gap-2 pl-5 py-0.5">
                        <span className="text-white text-[11px] shrink-0">{r.time}</span>
                        <span className="text-vilo-text-soft text-[11px] font-medium shrink-0">{r.guestName}</span>
                        <span className="text-[#999] text-[10px] truncate">{r.notes}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Special events */}
                {shiftStats.specialEvents.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <IconSparkles className="w-3 h-3 text-vilo-text-muted" />
                      <span className="text-vilo-text-secondary text-[10px] font-semibold">Besondere Anlässe ({shiftStats.specialEvents.length})</span>
                    </div>
                    {shiftStats.specialEvents.map(r => (
                      <div key={r.id} className="flex items-center gap-2 pl-5 py-0.5">
                        <span className="text-white text-[11px]">{r.time}</span>
                        <span className="text-vilo-text-soft text-[11px] font-medium">{r.guestName}</span>
                        <span className="text-vilo-text-secondary text-[11px]">{r.partySize} Pers.</span>
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
                      <IconArmchair className="w-3 h-3 text-vilo-text-muted" />
                      <span className="text-vilo-text-secondary text-[10px] font-semibold">Sitzplatzwünsche ({shiftStats.seatingPrefs.length})</span>
                    </div>
                    {shiftStats.seatingPrefs.map(r => (
                      <div key={r.id} className="flex items-center gap-2 pl-5 py-0.5">
                        <span className="text-white text-[11px]">{r.time}</span>
                        <span className="text-vilo-text-soft text-[11px] font-medium">{r.guestName}</span>
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
                      <IconStar className="w-3 h-3 text-vilo-text-muted" />
                      <span className="text-vilo-text-secondary text-[10px] font-semibold">Empfehlungen ({shiftStats.referrals.length})</span>
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
      {embedded && showForm && wizardStep === 'date' ? renderEmbeddedCalendarSidebar() : !showForm && (
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
        {dayReservations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#555577]">
            <IconCalendar className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-sm font-medium text-[#777]">Keine Reservierungen</p>
            <p className="text-xs mt-1 text-[#6b6b8a]">Tippe auf "Hinzufügen" um eine Reservierung anzulegen</p>
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
                    <span className="text-vilo-text-muted text-[11px]"><span className="text-white font-bold">{upcomingReservations.length}</span> Gruppen</span>
                    <span className="text-vilo-text-muted text-[11px]"><span className="text-white font-bold">{upcomingGuests}</span> Gäste</span>
                    {showUpcoming ? <IconChevronUp className="w-4 h-4 text-vilo-text-muted" /> : <IconChevronDown className="w-4 h-4 text-vilo-text-muted" />}
                  </div>
                </button>
                {showUpcoming && upcomingReservations.map((r) => {
                  const sourceColor = SOURCE_COLORS[r.source] || '#8888aa';
                  const SourceIcon = SOURCE_ICONS[r.source as keyof typeof SOURCE_ICONS] || IconUsers;
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
                                                                                                  <SourceIcon size={14} color="white" />
                                                                                                  <span className="text-white font-bold text-[11px] leading-none mt-1">{r.partySize}</span>
                                                                                                </div>
                                                                                                {/* Content area */}
                                                                                                <div className="flex-1 min-w-0 ml-[10px]">
                                                                                                  {/* Line 1: time + duration */}
                          <div className="flex items-center gap-[6px]">
                            <span className="text-white font-normal text-[12px]">{r.time} Uhr</span>
                            <span className="text-vilo-text-muted font-normal text-[10px]">{formatDuration(r.duration)}</span>
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
                                  <IconArmchair className="w-5 h-5 text-[#555577]" />
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
              const guestProfile = getGuestForReservation(r);
              return (
                <div className="fixed inset-0 z-[9999] flex flex-col" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }} style={{ background: 'rgba(0,0,0,0.6)' }}>
                  <div className="mt-auto w-full rounded-t-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto" style={{ background: '#1a1a2e' }} onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-5 py-4">
                      <span className="text-2xl font-bold text-white">{r.guestName}</span>
                      <button onClick={() => setOpenMenuId(null)} className="p-1 text-vilo-text-secondary hover:text-vilo-text-primary"><IconX className="w-6 h-6" /></button>
                    </div>
                    <div className="px-5 py-2 space-y-2">
                      <button onClick={() => { handleStatusChange(r.id, 'seated'); setOpenMenuId(null); }}
                        className="w-full flex items-center gap-3 py-4 px-4 rounded-xl text-white font-semibold text-base transition-colors" style={{ background: '#7c3aed' }}>
                        <IconCheck className="w-5 h-5" /> Platzieren
                      </button>
                      <button onClick={() => { handleEditReservation(r); setOpenMenuId(null); }}
                        className="w-full flex items-center gap-3 py-4 px-4 rounded-xl border border-vilo-border-strong text-vilo-text-soft font-medium text-base hover:bg-vilo-surface active:bg-vilo-elevated transition-colors">
                        <IconEdit className="w-5 h-5 text-vilo-text-secondary" /> Bearbeiten
                      </button>
                      {guestProfile && (
                        <button onClick={() => { setShowGuestProfile(guestProfile); setOpenMenuId(null); }}
                          className="w-full flex items-center gap-3 py-4 px-4 rounded-xl border border-vilo-border-strong text-vilo-text-soft font-medium text-base hover:bg-vilo-surface active:bg-vilo-elevated transition-colors">
                          <IconUser className="w-5 h-5 text-vilo-text-secondary" /> Gast-Profil
                        </button>
                      )}
                    </div>
                    <div className="px-5 py-3">
                      <p className="text-sm font-bold text-vilo-text-secondary tracking-wider mb-3">Tische zuweisen</p>
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
                                  (isSelected ? 'border-2 border-[#7bb7ef] text-white bg-vilo-surface' :
                                    isFree ? 'border border-vilo-border-strong text-vilo-text-soft bg-[#2d2d50] hover:bg-[#444] cursor-pointer' :
                                      'border border-vilo-border-subtle text-[#555577] bg-[#222238] cursor-not-allowed')}>
                                {t.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="px-5 py-3">
                      <p className="text-sm font-bold text-vilo-text-secondary tracking-wider mb-3">Zahlungsstatus</p>
                      <div className="flex gap-2">
                        {([['open', 'OFFEN'], ['partial', 'ANZAHLUNG'], ['paid', 'BEZAHLT']] as const).map(([val, label]) => {
                          const isActive = (r.paymentStatus || 'open') === val;
                          return (
                            <button key={val} onClick={() => handlePaymentStatus(r.id, val)}
                              className={'px-4 py-2.5 rounded-lg text-sm font-bold tracking-wider transition-all ' +
                                (isActive ? 'border-2 border-[#7bb7ef] text-white bg-vilo-surface' :
                                  'border border-vilo-border-strong text-vilo-text-soft bg-[#2d2d50] hover:bg-[#444]')}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="px-5 py-3 pb-20 space-y-1">
                      <button onClick={() => { handleStatusChange(r.id, 'cancelled'); setOpenMenuId(null); }}
                        className="w-full flex items-center gap-3 py-4 px-4 text-[#ef4444] font-semibold text-base hover:bg-[#3a1a1a] transition-colors rounded-xl">
                        <IconX className="w-5 h-5" /> Stornieren
                      </button>
                      <button onClick={() => { handleDelete(r.id); setOpenMenuId(null); }}
                        className="w-full flex items-center gap-3 py-4 px-4 text-[#ef4444] font-semibold text-base hover:bg-[#3a1a1a] transition-colors rounded-xl">
                        <IconTrash className="w-5 h-5" /> Loeschen
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
                    <span className="text-vilo-text-muted text-[11px]"><span className="text-white font-bold">{seatedReservations.length}</span> Gruppen</span>
                    <span className="text-vilo-text-muted text-[11px]"><span className="text-white font-bold">{seatedGuests}</span> Gäste</span>
                    {showSeated ? <IconChevronUp className="w-4 h-4 text-vilo-text-muted" /> : <IconChevronDown className="w-4 h-4 text-vilo-text-muted" />}
                  </div>
                </button>
                {showSeated && seatedReservations.map((r) => {
                  const sourceColor = SOURCE_COLORS[r.source] || '#8888aa';
                  const SourceIcon = SOURCE_ICONS[r.source as keyof typeof SOURCE_ICONS] || IconUsers;
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
                                                                                                  <SourceIcon size={14} color="white" />
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
                                  <IconArmchair className="w-5 h-5 text-[#555577]" />
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
                      <button onClick={() => setOpenMenuId(null)} className="p-1 text-vilo-text-secondary hover:text-vilo-text-primary"><IconX className="w-6 h-6" /></button>
                    </div>
                    <div className="px-5 py-2 space-y-2">
                      <button onClick={() => { handleEditReservation(r); setOpenMenuId(null); }}
                        className="w-full flex items-center gap-3 py-4 px-4 rounded-xl border border-vilo-border-strong text-vilo-text-soft font-medium text-base hover:bg-vilo-surface active:bg-vilo-elevated transition-colors">
                        <IconEdit className="w-5 h-5 text-vilo-text-secondary" /> Bearbeiten
                      </button>
                      {guestProfile && (
                        <button onClick={() => { setShowGuestProfile(guestProfile); setOpenMenuId(null); }}
                          className="w-full flex items-center gap-3 py-4 px-4 rounded-xl border border-vilo-border-strong text-vilo-text-soft font-medium text-base hover:bg-vilo-surface active:bg-vilo-elevated transition-colors">
                          <IconUser className="w-5 h-5 text-vilo-text-secondary" /> Gast-Profil
                        </button>
                      )}
                      {assignedTable && onSeatReservation && (
                        <button onClick={() => { onSeatReservation(assignedTable.id); setOpenMenuId(null); }}
                          className="w-full flex items-center gap-3 py-4 px-4 rounded-xl text-white font-semibold text-base transition-colors" style={{ background: '#7c3aed' }}>
                          <IconArmchair className="w-5 h-5" /> Zum Tisch
                        </button>
                      )}
                    </div>
                    <div className="px-5 py-3 pb-20">
                      <button onClick={() => { handleDelete(r.id); setOpenMenuId(null); }}
                        className="w-full flex items-center gap-3 py-4 px-4 text-[#ef4444] font-semibold text-base hover:bg-[#3a1a1a] transition-colors rounded-xl">
                        <IconTrash className="w-5 h-5" /> Loeschen
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
      )}

      {/* New/Edit Reservation Form - Bottom Drawer */}
      {showForm && !(embedded && wizardStep === 'date') && (
        <div
          className={embedded ? 'absolute top-0 z-[30] h-full w-[360px] min-w-[360px] max-w-[calc(100vw-360px)] flex flex-col' : 'fixed inset-0 z-[9999] flex flex-col'}
          {...(embedded ? { style: { background: '#1f1e33', left: 0, borderRight: '1px solid var(--vilo-border-subtle)' } } : { style: { background: 'rgba(0,0,0,0.6)' } })}
          onClick={() => { if (!embedded) { setShowForm(false); resetForm(); } }}
        >
          <div
            className={embedded ? 'h-full w-full flex flex-col overflow-hidden' : 'mt-auto w-full rounded-t-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col'}
            style={{ background: embedded ? '#1f1e33' : '#1a1a2e' }}
            onClick={e => e.stopPropagation()}
          >
          {/* Wizard Header */}
          <div className="flex items-center justify-between border-b border-vilo-border-subtle px-5 py-4 shrink-0" style={{ background: '#1a1a2e' }}>
            <div className="flex items-center gap-3 min-w-0">
              {wizardStep !== 'date' && !editingId && (
                <button
                  onClick={() => {
                    if (wizardStep === 'guests') {
                      setWizardStep('date');
                    } else if (wizardStep === 'guest_info') {
                      setWizardStep('guests');
                    }
                  }}
                  className="p-1 text-vilo-text-secondary hover:text-vilo-text-primary transition-colors shrink-0"
                  aria-label="Zurück"
                >
                  <IconChevronLeft className="w-5 h-5" />
                </button>
              )}
              <h2 className="text-[16px] font-bold text-white leading-none">Reservierung</h2>
            </div>

            <button
              onClick={() => {
                setShowForm(false);
                resetForm();
                if (embedded) {
                  onClose();
                }
              }}
              className="ml-3 p-1 text-vilo-text-secondary hover:text-vilo-text-primary transition-colors shrink-0"
            >
              <IconX className="w-5 h-5" />
            </button>
          </div>

          {/* Step Content */}
          <div className="flex-1 overflow-y-auto" style={{ background: '#1a1a2e' }}>

            {/* === STEP 1: DATE PICKER === */}
            {wizardStep === 'date' && !editingId && !embedded && (
              <div className="pb-5 pt-3">
                <div className="px-4 pb-1">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-vilo-text-muted">Datum</div>
                </div>
                {(() => {
                  const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
                  const dayHeaders = ['M', 'D', 'M', 'D', 'F', 'S', 'S'];
                  const todayStr = getTodayStr();
                  const [selY, selM, selD] = formData.date.split('-').map(Number);
                  const year = calendarMonth.getFullYear();
                  const month = calendarMonth.getMonth();
                  const weeks = generateCalendarMatrix(year, month);

                  return (
                    <section
                      className="p-2"
                      style={{
                        background: 'transparent',
                        borderRadius: 0,
                      }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <button
                          type="button"
                          onClick={() => shiftCalendarMonth(-1)}
                          className="w-10 h-10 flex items-center justify-center text-white transition-colors"
                          style={{ background: '#312e4f', borderRadius: 0 }}
                        >
                          <IconChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-2">
                          <div className="px-2 py-2 text-[15px] font-semibold text-white">
                            {monthNames[month]}
                          </div>
                          <div className="px-2 py-2 text-[15px] font-semibold text-white">
                            {year}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => shiftCalendarMonth(1)}
                          className="w-10 h-10 flex items-center justify-center text-white transition-colors"
                          style={{ background: '#312e4f', borderRadius: 0 }}
                        >
                          <IconChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-7 gap-x-2 mb-2 px-1">
                        {dayHeaders.map((d, i) => (
                          <div key={i} className="text-center text-[13px] font-semibold tracking-[0.08em] text-[#c4b5fd] py-1">
                            {d}
                          </div>
                        ))}
                      </div>

                      <div className="space-y-1">
                        {weeks.map((week, weekIndex) => {
                          return (
                            <div
                              key={weekIndex}
                              className="grid grid-cols-7 gap-1"
                            >
                              {week.map(({ date, currentMonth }) => {
                                const dateStr = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
                                const isToday2 = dateStr === todayStr;
                                const isSelected = date.getFullYear() === selY && date.getMonth() === selM - 1 && date.getDate() === selD;
                                const isPast = dateStr < todayStr;
                                const resCount = getReservationCountForDate(dateStr);

                                return (
                                  <button
                                    key={dateStr}
                                    disabled={isPast}
                                    onClick={() => {
                                      setFormData(prev => ({ ...prev, date: dateStr }));
                                      setWizardStep('guests');
                                    }}
                                    className="aspect-square w-full flex flex-col items-center justify-center transition-all duration-150"
                                    style={{
                                      background: isSelected ? '#d946ef' : (!isPast && resCount > 0 ? '#5b216f' : '#2d2b48'),
                                      color: isPast ? '#61677f' : currentMonth ? '#ffffff' : '#7f86a2',
                                      opacity: isPast ? 0.42 : 1,
                                      boxShadow: isSelected ? '0 8px 18px rgba(217,70,239,0.30)' : 'none',
                                      borderRadius: 0,
                                    }}
                                  >
                                    <span className="text-[17px] leading-none font-bold tracking-[-0.03em]">
                                      {date.getDate()}
                                    </span>
                                    <span className="mt-1 h-[8px] flex items-center justify-center text-[8px] font-semibold tracking-[0.08em]">
                                      {!isPast && isToday2 ? 'HEUTE' : ''}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })()}
              </div>
            )}

            {/* === STEP 2: PARTY SIZE + TIME === */}
            {wizardStep === 'guests' && !editingId && (
              <div className="p-4 space-y-4">
                {/* Party size - compact grid like Waitlist */}
                <div>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7].map(n => (
                      <button key={n} onClick={() => setFormData(prev => ({ ...prev, partySize: n }))}
                        className={'w-full aspect-square text-[18px] font-bold transition-colors ' +
                          (formData.partySize === n ? 'bg-[#d946ef] text-white' : 'bg-vilo-card text-[#d7d3e8] hover:bg-[#302d4a]')}
                        style={{ borderRadius: 0 }}>
                        {n}
                      </button>
                    ))}
                    <div
                      className={'relative w-full aspect-square transition-colors ' +
                        (formData.partySize > 7 ? 'bg-[#d946ef] text-white' : 'bg-vilo-card text-[#d7d3e8] hover:bg-[#302d4a]')}
                      style={{ borderRadius: 0 }}
                    >
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={formData.partySize > 7 ? formData.partySize : ''}
                        onChange={e => {
                          const val = parseInt(e.target.value);
                          if (val > 0) setFormData(prev => ({ ...prev, partySize: val }));
                        }}
                        className="absolute inset-0 w-full h-full bg-transparent text-center text-[18px] font-bold text-inherit outline-none appearance-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        style={{ borderRadius: 0 }}
                      />
                      {!(formData.partySize > 7) && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[26px] font-bold tracking-[-0.08em]">
                          ...
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Time picker - compact */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-[11px] font-semibold text-vilo-text-secondary uppercase tracking-[0.14em]">Uhrzeit</h4>
                    <input
                      type="time"
                      value={formData.time}
                      onChange={e => setFormData(prev => ({ ...prev, time: e.target.value }))}
                      className="py-1 w-[36px] text-transparent caret-transparent outline-none text-[11px] bg-vilo-card cursor-pointer"
                      style={{ borderRadius: 10 }}
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30'].map(t => (
                      <button key={t} onClick={() => setFormData(prev => ({ ...prev, time: t }))}
                        className={'px-0 py-2 text-[11px] font-medium transition-colors ' +
                          (formData.time === t ? 'bg-[#8b5cf6] text-white' : 'bg-vilo-card text-vilo-text-secondary hover:bg-[#302d4a]')}
                        style={{ borderRadius: 0 }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pacing limit warning */}
                {isPacingExceeded && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#f59e0b]/15 border border-[#f59e0b]/30">
                    <IconAlertCircle className="w-4 h-4 text-[#f59e0b] shrink-0" />
                    <p className="text-[11px] text-[#f59e0b]">Pacing Limit erreicht: {currentSlotCount}/{pacingLimit} Reservierungen in diesem Zeitslot</p>
                  </div>
                )}

                {/* Duration - compact inline */}
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-semibold text-vilo-text-secondary uppercase tracking-[0.14em]">Dauer</h4>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[60, 90, 120, 150, 180].map(d => (
                      <button key={d} onClick={() => setFormData(prev => ({ ...prev, duration: d }))}
                        className={'py-2 text-[11px] font-medium transition-colors ' +
                          (formData.duration === d ? 'bg-[#8b5cf6] text-white' : 'bg-vilo-card text-vilo-text-secondary hover:bg-[#302d4a]')}
                        style={{ borderRadius: 0 }}>
                        {d}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table assignment */}
                <div>
                  <h4 className="text-xs font-semibold text-vilo-text-secondary uppercase tracking-wider mb-1.5">Tisch (optional)</h4>
                  <div className="relative">
                    <div
                      className={'flex items-center gap-3 px-4 py-3 ' +
                        (formData.tableId ? 'bg-vilo-card' : 'border border-dashed border-[#6f5c9a] bg-transparent')}
                      style={{ borderRadius: 0 }}
                    >
                      <IconArmchair className="w-5 h-5 text-[#c7c0e8] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-white text-sm font-semibold leading-tight">
                          {formData.tableId
                            ? state.tables.find(t => t.id === formData.tableId)?.name ?? 'Tisch'
                            : 'Kein Tisch'}
                        </div>
                        <div className="text-[#c8b8ff] text-xs leading-tight mt-0.5">
                          {formData.tableId
                            ? (() => {
                                const selectedTable = state.tables.find(t => t.id === formData.tableId);
                                return selectedTable
                                  ? selectedTable.status === 'free'
                                    ? 'Tisch verfügbar'
                                    : 'Tisch belegt'
                                  : 'Tisch zugewiesen';
                              })()
                            : 'Automatisch zuweisen'}
                        </div>
                      </div>
                      <IconChevronRight className="w-4 h-4 text-[#9f93ca] shrink-0" />
                    </div>
                    <select
                      value={formData.tableId}
                      onChange={e => setFormData(prev => ({ ...prev, tableId: e.target.value }))}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    >
                      <option value="">Automatisch zuweisen</option>
                      {state.tables.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.status === 'free' ? 'frei' : 'besetzt'})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Continue button */}
                <button onClick={() => setWizardStep('guest_info')}
                  className="w-full py-4 font-semibold text-white text-sm"
                  style={{ background: '#8b5cf6', borderRadius: 0 }}>
                  Weiter
                </button>
              </div>
            )}

            {/* === STEP 3: GUEST / VERMITTLER INFO === */}
            {(wizardStep === 'guest_info' || editingId) && (
              <div className="pb-20">
                {/* Search bar */}
                <div className="px-4 py-2">
                  <div className="relative">
                    <IconSearch className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vilo-text-muted" />
                    <input
                      type="text"
                      value={guestSearch}
                      onChange={e => handleGuestSearch(e.target.value)}
                      placeholder="Nach Telefonnummer oder Namen suchen"
                      className="w-full pl-3 pr-9 py-2.5 text-sm text-white outline-none bg-[#211f36] placeholder:text-vilo-text-muted border border-transparent focus:border-[#8b5cf6] focus:ring-0"
                      style={{ borderRadius: 10 }}
                    />
                  </div>
                  {/* Search results dropdown */}
                  {searchResults.length > 0 && (
                    <div className="mt-1 overflow-hidden shadow-lg" style={{ borderRadius: 0 }}>
                      {searchResults.slice(0, 5).map(g => (
                        <button key={g.id} onClick={() => handleSelectSearchGuest(g)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#302d4a] text-left border-b border-[#26243f] last:border-0 bg-vilo-card">
                          <div className="w-8 h-8 bg-[#31224d] flex items-center justify-center" style={{ borderRadius: 0 }}>
                            <IconUser className="w-4 h-4 text-[#d8c7ff]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{g.name}</p>
                            {g.phone && <p className="text-xs text-vilo-text-secondary">{g.phone}</p>}
                          </div>
                          {g.totalVisits > 0 && (
                            <span className="text-xs text-[#d8c7ff] font-medium">{g.totalVisits}x</span>
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
                    <div className="bg-vilo-card px-3 py-2.5 flex items-center gap-3" style={{ borderRadius: 12 }}>
                      <div className="w-10 h-10 bg-[#8b5cf6] flex items-center justify-center shrink-0 text-white font-semibold text-sm" style={{ borderRadius: 0 }}>
                        {(matchedGuest.name || 'G').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#f2eaff]">{matchedGuest.name}</p>
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
                        className="text-xs text-[#d8c7ff] font-medium hover:text-white shrink-0">
                        Profil
                      </button>
                    </div>
                  )}

                  {/* Form fields in resmio style */}
                  <div className="space-y-3">
                    <div>
                      <input type="text" value={formData.guestName.split(' ')[0] || ''}
                        onChange={e => {
                          const lastName = formData.guestName.split(' ').slice(1).join(' ');
                          setFormData(prev => ({ ...prev, guestName: e.target.value + (lastName ? ' ' + lastName : '') }));
                        }}
                        placeholder="Vorname"
                        className="w-full px-3 py-3 text-[15px] text-white outline-none bg-vilo-card placeholder:text-vilo-text-muted border border-transparent focus:border-[#8b5cf6]"
                        style={{ borderRadius: 12 }}
                      />
                    </div>
                    <div>
                      <input type="text" value={formData.guestName.split(' ').slice(1).join(' ')}
                        onChange={e => {
                          const firstName = formData.guestName.split(' ')[0] || '';
                          setFormData(prev => ({ ...prev, guestName: firstName + (e.target.value ? ' ' + e.target.value : '') }));
                        }}
                        placeholder="Nachname"
                        className="w-full px-3 py-3 text-[15px] text-white outline-none bg-vilo-card placeholder:text-vilo-text-muted border border-transparent focus:border-[#8b5cf6]"
                        style={{ borderRadius: 12 }}
                      />
                    </div>
                    <div>
                      <input type="tel" value={maskPhoneValue(formData.guestPhone)}
                        onChange={e => handlePhoneChange(e.target.value)}
                        placeholder="Telefonnummer"
                        className="w-full px-3 py-3 text-[15px] text-white outline-none bg-vilo-card placeholder:text-vilo-text-muted border border-transparent focus:border-[#8b5cf6]"
                        style={{ borderRadius: 12 }}
                      />
                    </div>
                    <div>
                      <input
                        type="email"
                        value={formData.guestEmail}
                        onChange={e => setFormData(prev => ({ ...prev, guestEmail: e.target.value }))}
                        placeholder="E-Mail"
                        className="w-full px-3 py-3 text-[15px] text-white outline-none bg-vilo-card placeholder:text-vilo-text-muted border border-transparent focus:border-[#8b5cf6]"
                        style={{ borderRadius: 12 }}
                      />
                    </div>
                  </div>

                  {/* Source */}
                  <div>
                    <p className="text-xs text-vilo-text-secondary font-semibold uppercase tracking-wider mb-2">Quelle</p>
                    <div className="flex gap-2">
                      {([['phone', 'Telefon'], ['online', 'Online'], ['walk_in', 'Walk-In']] as const).map(([val, label]) => (
                        <button key={val}
                          onClick={() => setFormData(prev => ({ ...prev, source: val }))}
                          className={'flex-1 py-2 text-xs font-medium transition-colors ' +
                            (formData.source === val ? 'bg-[#8b5cf6] text-white' : 'bg-vilo-card text-vilo-text-secondary hover:bg-[#302d4a]')}
                          style={{ borderRadius: 0 }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Vermittler/Referral */}
                  <div>
                    <p className="text-xs text-vilo-text-secondary font-semibold uppercase tracking-wider mb-2">Vermittler / Empfehlung</p>
                    <input type="text" value={formData.referralSource}
                      onChange={e => setFormData(prev => ({ ...prev, referralSource: e.target.value }))}
                      placeholder="z.B. Hotel Adlon, Google, Freund Max M."
                      className="w-full px-3 py-3 text-sm text-white outline-none bg-vilo-card placeholder:text-vilo-text-muted border border-transparent focus:border-[#8b5cf6]"
                      style={{ borderRadius: 12 }}
                    />
                  </div>

                  {/* Guest stats if matched */}
                  {matchedGuest && (
                    <div className="grid grid-cols-4 gap-2 py-2">
                      <div className="text-center">
                        <p className="text-xs text-vilo-text-muted">Akzeptiert</p>
                        <p className="text-base font-bold text-white">{matchedGuest.totalVisits || 0}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-vilo-text-muted">Besuche</p>
                        <p className="text-base font-bold text-white">{matchedGuest.totalVisits || 0}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-vilo-text-muted">Stornierung</p>
                        <p className="text-base font-bold text-white">0</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-vilo-text-muted">No-Shows</p>
                        <p className="text-base font-bold text-white">0</p>
                      </div>
                    </div>
                  )}

                  {/* Etiketten */}
                  <div>
                    <p className="text-xs text-vilo-text-secondary font-semibold uppercase tracking-wider mb-2">ETIKETTEN</p>
                    <button
                      onClick={() => setShowLabelPicker(!showLabelPicker)}
                      className="px-3 py-2 text-[#d8c7ff] text-xs font-medium transition-colors bg-vilo-card hover:bg-[#302d4a]"
                      style={{ borderRadius: 16 }}>
                      + Etiketten hinzufügen
                      {(formData.seatLabels.length + formData.occasionLabels.length) > 0 && (
                        <span className="ml-1 bg-[#8b5cf6] text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                          {formData.seatLabels.length + formData.occasionLabels.length}
                        </span>
                      )}
                    </button>

                    {/* Selected labels */}
                    {(formData.seatLabels.length > 0 || formData.occasionLabels.length > 0) && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {formData.seatLabels.map(sl => (
                          <span key={sl} className="px-2 py-1 rounded-full text-[10px] font-medium bg-[#31224d] text-[#d8c7ff]">
                            {SEAT_LABELS_MAP[sl]?.label}
                          </span>
                        ))}
                        {formData.occasionLabels.map(ol => (
                          <span key={ol} className="px-2 py-1 rounded-full text-[10px] font-medium bg-[#5b216f] text-white">
                            {OCCASION_LABELS_MAP[ol]?.label}
                          </span>
                        ))}
                      </div>
                    )}

                    {showLabelPicker && (
                      <div className="mt-3 space-y-3 p-3 bg-vilo-card" style={{ borderRadius: 0 }}>
                        <div>
                          <p className="text-[10px] text-vilo-text-secondary font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <IconArmchair className="w-3 h-3" /> Sitzplatz-Präferenzen
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
                                  className={'px-2 py-1 text-[10px] font-medium transition-colors ' +
                                    (isActive ? 'bg-[#8b5cf6] text-white' : 'bg-[#312e4f] text-vilo-text-secondary hover:bg-[#3a365c]')}
                                  style={{ borderRadius: 0 }}>
                                  {val.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] text-vilo-text-secondary font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <IconSparkles className="w-3 h-3" /> Anlass
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
                                  className={'px-2 py-1 text-[10px] font-medium transition-colors ' +
                                    (isActive ? 'bg-[#d946ef] text-white' : 'bg-[#312e4f] text-vilo-text-secondary hover:bg-[#3a365c]')}
                                  style={{ borderRadius: 0 }}>
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
                    <p className="text-xs text-vilo-text-secondary font-semibold uppercase tracking-wider mb-2">BESUCHSNOTIZEN</p>
                    <textarea value={formData.notes}
                      onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="z.B. Allergien, Kinderstuhl, Geburtstag..."
                      rows={2}
                      className="w-full px-3 py-3 text-white text-sm outline-none resize-none bg-vilo-card placeholder:text-vilo-text-muted border border-transparent focus:border-[#8b5cf6]"
                      style={{ borderRadius: 12 }}
                    />
                  </div>

                  {/* Edit mode: compact iOS-style inline rows */}
	                  {editingId && (
	                    <div className="border border-vilo-border-strong rounded-lg overflow-hidden bg-vilo-surface">
                      <div className="flex items-center justify-between px-3 py-2.5 border-b border-vilo-border-subtle">
                        <span className="text-xs text-vilo-text-secondary">Datum</span>
                        <input type="date" value={formData.date}
                          onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                          className="text-sm text-white outline-none bg-transparent text-right" />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 border-b border-vilo-border-subtle">
                        <span className="text-xs text-vilo-text-secondary">Uhrzeit</span>
                        <input type="time" value={formData.time}
                          onChange={e => setFormData(prev => ({ ...prev, time: e.target.value }))}
                          className="text-sm text-white outline-none bg-transparent text-right" />
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 border-b border-vilo-border-subtle">
                        <span className="text-xs text-vilo-text-secondary">Personen</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setFormData(prev => ({ ...prev, partySize: Math.max(1, prev.partySize - 1) }))}
                            className="w-6 h-6 rounded-md border border-vilo-border-strong text-vilo-text-soft flex items-center justify-center hover:bg-vilo-elevated text-sm font-bold">-</button>
                          <span className="text-white font-semibold text-sm w-5 text-center">{formData.partySize}</span>
                          <button onClick={() => setFormData(prev => ({ ...prev, partySize: Math.min(20, prev.partySize + 1) }))}
                            className="w-6 h-6 rounded-md border border-vilo-border-strong text-vilo-text-soft flex items-center justify-center hover:bg-vilo-elevated text-sm font-bold">+</button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5 border-b border-vilo-border-subtle">
                        <span className="text-xs text-vilo-text-secondary">Dauer</span>
                        <select value={formData.duration}
                          onChange={e => setFormData(prev => ({ ...prev, duration: Number(e.target.value) }))}
                          className="text-sm text-white outline-none bg-transparent text-right">
                          {[60, 90, 120, 150, 180].map(d => <option key={d} value={d}>{d} Min</option>)}
                        </select>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <span className="text-xs text-vilo-text-secondary">Tisch</span>
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
	                  <div className="sticky bottom-0 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[var(--vilo-bg-base)] via-[var(--vilo-bg-base)] to-transparent">
	                    <button
	                      onClick={handleSave}
	                      disabled={!formData.guestName.trim()}
	                      className="w-full py-3.5 font-semibold text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
	                      style={{ background: 'var(--vilo-accent)' }}
	                    >
	                      {editingId ? 'Speichern' : 'Reservierung anlegen'}
	                    </button>
	                  </div>
	                </div>

	              </div>
            )}
          </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
