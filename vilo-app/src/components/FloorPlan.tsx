import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Table, TableShape, Reservation, Guest, GuestNote, GuestTag, ReservationStatus, OccasionLabel } from '../types';
import { Edit3, Plus, Trash2, Clock, CalendarCheck, Ban, ListOrdered, ChevronUp, ChevronDown, Users, Armchair, PanelLeftOpen, PanelLeftClose, User, Phone, Mail, MessageSquare, X, MapPin, Globe, PhoneCall, Footprints, UserCheck, UserPlus, ArrowRightLeft, Lightbulb, History, Tag, ChevronRight, AlignLeft, Star } from 'lucide-react';
import { IconCircleCheckFilled, IconCoinFilled, IconAlertTriangleFilled, IconLeaf, IconPlant2, IconBabyCarriage, IconWheelchair, IconCake, IconBriefcaseFilled, IconNews, IconStarFilled, IconUserPlus, IconConfetti, IconHeartFilled, IconGiftFilled, IconHeartHandshake, IconSparkles, IconSchool, IconMasksTheater, IconPhoneFilled, IconGlobeFilled, IconWalk } from '@tabler/icons-react';
import { saveStorage, loadStorage, loadReservations, loadWaitlist, loadGuests, addGuest, toggleGuestTag, addGuestNote, removeGuestNote } from '../utils/storage';
import { ReservationPanel } from './Reservations';
import { TableManagement } from './TableManagement';
import { WaitlistPanel } from './Waitlist';
import { GuestProfile } from './GuestProfile';
import { ReservationDetail } from './ReservationDetail';

interface FloorPlanProps {
  voiceMode?: string;
  onStartVoice?: () => void;
  onStopVoice?: () => void;
  onZoneChange?: (zoneId: string, zoneName: string) => void;
  onShowReservations?: () => void;
}

// OpenTable-style: size varies by seat count
function getTableSize(table: { shape?: string; seats?: number }): { w: number; h: number } {
  const shape = table.shape || 'rect';
  const seats = table.seats || 4;
  if (shape === 'barstool') return { w: 40, h: 40 };
  if (shape === 'round') {
    if (seats >= 8) return { w: 95, h: 95 };
    if (seats >= 6) return { w: 80, h: 80 };
    return { w: 65, h: 65 };
  }
  if (shape === 'diamond') return { w: 70, h: 70 };
  // rect, rect_v, square - scale by seats
  if (shape === 'square') {
    if (seats >= 8) return { w: 72, h: 72 };
    return { w: 56, h: 56 };
  }
  if (shape === 'rect_v') {
    if (seats >= 6) return { w: 60, h: 90 };
    return { w: 56, h: 80 };
  }
  // rect
  if (seats >= 10) return { w: 100, h: 70 };
  if (seats >= 6) return { w: 90, h: 62 };
  return { w: 75, h: 54 };
}

const SHAPE_SIZES: Record<string, { w: number; h: number }> = {
  diamond: { w: 70, h: 70 },
  rect: { w: 75, h: 54 },
  rect_v: { w: 56, h: 80 },
  square: { w: 56, h: 56 },
  round: { w: 80, h: 80 },
  barstool: { w: 40, h: 40 },
};

const SHAPE_OPTIONS: { value: TableShape; label: string }[] = [
  { value: 'rect', label: 'Rechteck' },
  { value: 'rect_v', label: 'Rechteck (hoch)' },
  { value: 'square', label: 'Quadrat' },
  { value: 'diamond', label: 'Diamant' },
  { value: 'round', label: 'Rund' },
  { value: 'barstool', label: 'Barhocker' },
];

const SERVICE_STATUS_SHORT: Record<string, string> = {
  teilweise_platziert: 'Teilw.',
  platziert: 'Platziert',
  getraenke: 'Getränke',
  vorspeise: 'Vorspeise',
  hauptgericht: 'Hauptgang',
  dessert: 'Dessert',
  gang_1: '1.Gang', gang_2: '2.Gang', gang_3: '3.Gang', gang_4: '4.Gang',
  gang_5: '5.Gang', gang_6: '6.Gang', gang_7: '7.Gang', gang_8: '8.Gang',
  gang_9: '9.Gang', gang_10: '10.Gang', gang_11: '11.Gang', gang_12: '12.Gang',
  digestif: 'Digestif',
  flaschenservice: 'Flasche',
  rechnung_faellig: 'Rechnung',
  bezahlt: 'Bezahlt',
  restaurantleiter: 'Manager!',
  abraeumen: 'Abraeumen',
  abgeraeumt: 'Abgeraeumt',
  beendet: 'Beendet',
};

export function FloorPlan({ onZoneChange, onShowReservations }: FloorPlanProps) {
  const { state, dispatch } = useApp();
  const [activeZone, setActiveZone] = useState<string>(state.zones[0]?.id || '');
  const [editMode, setEditMode] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableManagementId, setTableManagementId] = useState<string | null>(null);
  const [newTableShape, setNewTableShape] = useState<TableShape>('rect');
  const [showShapePicker, setShowShapePicker] = useState(false);
  const [showReservations, setShowReservations] = useState(false);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarResCollapsed, setSidebarResCollapsed] = useState(false);
  const [sidebarSeatedCollapsed, setSidebarSeatedCollapsed] = useState(false);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [highlightedTableId, setHighlightedTableId] = useState<string | null>(null);
  const [guestProfileGuest, setGuestProfileGuest] = useState<Guest | null>(null);
  const [guestProfileKey, setGuestProfileKey] = useState(0); // force re-render on guest update
  const [activeNoteTab, setActiveNoteTab] = useState<GuestNote['category']>('general');
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showSeatOverlay, setShowSeatOverlay] = useState(false);
  const [seatOverlayTab, setSeatOverlayTab] = useState<'preassign' | 'seat'>('seat');
  const [seatOverlayZone, setSeatOverlayZone] = useState<string>(activeZone);
  const [resDetailId, setResDetailId] = useState<string | null>(null);

  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef({ startDist: 0, startScale: 1, startX: 0, startY: 0, startTx: 0, startTy: 0, isPinching: false, isPanning: false });
  const dragRef = useRef<{ tableId: string; startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);

  const switchZone = useCallback((zoneId: string) => {
    setActiveZone(zoneId);
    setSelectedTable(null);
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    const zone = state.zones.find(z => z.id === zoneId);
    if (onZoneChange && zone) onZoneChange(zoneId, zone.name);
  }, [state.zones, onZoneChange]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const getDistance = (t1: Touch, t2: Touch) =>
      Math.sqrt((t1.clientX - t2.clientX) ** 2 + (t1.clientY - t2.clientY) ** 2);
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const d = getDistance(e.touches[0], e.touches[1]);
        pinchRef.current = { ...pinchRef.current, startDist: d, startScale: scale, isPinching: true, isPanning: false };
      } else if (e.touches.length === 1 && scale > 1 && !editMode) {
        pinchRef.current = { ...pinchRef.current, startX: e.touches[0].clientX, startY: e.touches[0].clientY, startTx: translate.x, startTy: translate.y, isPanning: true, isPinching: false };
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (pinchRef.current.isPinching && e.touches.length === 2) {
        e.preventDefault();
        const d = getDistance(e.touches[0], e.touches[1]);
        const ns = Math.min(3, Math.max(0.5, pinchRef.current.startScale * (d / pinchRef.current.startDist)));
        setScale(ns);
      } else if (pinchRef.current.isPanning && e.touches.length === 1 && scale > 1) {
        const dx = e.touches[0].clientX - pinchRef.current.startX;
        const dy = e.touches[0].clientY - pinchRef.current.startY;
        setTranslate({ x: pinchRef.current.startTx + dx, y: pinchRef.current.startTy + dy });
      }
    };
    const handleTouchEnd = () => {
      pinchRef.current.isPinching = false;
      pinchRef.current.isPanning = false;
      if (scale <= 0.6) { setScale(1); setTranslate({ x: 0, y: 0 }); }
    };
    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [scale, translate, editMode]);

  // Load reservations
  useEffect(() => {
    setReservations(loadReservations());
  }, [showReservations]);

  // Load waitlist count
  useEffect(() => {
    const wl = loadWaitlist();
    setWaitlistCount(wl.filter(e => e.status === 'waiting' || e.status === 'notified').length);
  }, [showWaitlist]);

  // Get today's active reservations for table indicators
  const tableReservationMap = useMemo(() => {
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    const map: Record<string, Reservation> = {};
    reservations
      .filter(r => r.date === todayStr && (r.status === 'confirmed' || r.status === 'seated') && r.tableId)
      .forEach(r => {
        if (r.tableId) map[r.tableId] = r;
      });
    return map;
  }, [reservations]);

  // Count today's upcoming reservations for badge
  const todayReservationCount = useMemo(() => {
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    return reservations.filter(r => r.date === todayStr && r.status === 'confirmed').length;
  }, [reservations]);

  // Next upcoming reservation per table (for showing time under free tables like OpenTable)
  const nextReservationMap = useMemo(() => {
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    const nowMins = today.getHours() * 60 + today.getMinutes();
    const map: Record<string, string> = {};
    reservations
      .filter(r => r.date === todayStr && r.status === 'confirmed' && r.tableId)
      .forEach(r => {
        const [rh, rm] = r.time.split(':').map(Number);
        const resMins = rh * 60 + rm;
        if (resMins >= nowMins - 30 && r.tableId) {
          if (!map[r.tableId] || r.time < map[r.tableId]) {
            map[r.tableId] = r.time;
          }
        }
      });
    return map;
  }, [reservations]);

  const zoneTables = state.tables.filter(t => t.zone === activeZone);

  useEffect(() => {
    const unpositioned = state.tables.filter(t => t.zone === activeZone && (t.x === undefined || t.y === undefined));
    if (unpositioned.length === 0) return;
    let nextX = 30;
    let nextY = 30;
    const updatedTables = state.tables.map(t => {
      if (t.zone !== activeZone || (t.x !== undefined && t.y !== undefined)) return t;
      const pos = { ...t, x: nextX, y: nextY };
      nextX += 100;
      if (nextX > 350) { nextX = 30; nextY += 100; }
      return pos;
    });
    const storage = loadStorage();
    saveStorage({ ...storage, tables: updatedTables });
    dispatch({ type: 'UPDATE_CONFIG', restaurant: state.restaurant, zones: state.zones, tables: updatedTables, menu: state.menu, staff: state.staff });
  }, [activeZone]);

  const saveTableUpdate = useCallback((updatedTables: Table[]) => {
    dispatch({ type: 'UPDATE_CONFIG', restaurant: state.restaurant, zones: state.zones, tables: updatedTables, menu: state.menu, staff: state.staff });
    const storage = loadStorage();
    saveStorage({ ...storage, tables: updatedTables });
  }, [state, dispatch]);

  const getOrderInfo = (tableId: string) => {
    const session = state.sessions[tableId];
    if (!session) return { count: 0, total: 0, hasReady: false, startTime: 0 };
    const count = session.orders.length;
    const total = session.orders.reduce((s, o) => s + o.price * o.quantity, 0);
    const hasReady = session.orders.some(o => o.state === 'ready');
    return { count, total, hasReady, startTime: session.startTime };
  };

  const formatTime = (timestamp: number): string => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  };

  const handleTableClick = (table: Table) => {
    if (editMode) {
      setSelectedTable(prev => prev === table.id ? null : table.id);
      return;
    }
    // If occupied table has a reservation, open 3-panel OpenTable view
    const res = tableReservationMap[table.id];
    if (res && (table.status === 'occupied' || table.status === 'billing')) {
      handleSidebarCardClick(res);
      return;
    }
    // Otherwise open TableManagement drawer
    setTableManagementId(table.id);
  };

  const handleAddTable = () => {
    const zoneName = state.zones.find(z => z.id === activeZone)?.name || 'Tisch';
    const existingNumbers = zoneTables.map(t => {
      const match = t.name.match(/(\d+)$/);
      return match ? parseInt(match[1]) : 0;
    });
    const nextNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    const shape = newTableShape;
    const size = SHAPE_SIZES[shape] || SHAPE_SIZES.rect;
    let px = 30, py = 30;
    const occupied = zoneTables.map(t => ({ x: t.x || 0, y: t.y || 0, w: SHAPE_SIZES[t.shape || 'rect']?.w || 80, h: SHAPE_SIZES[t.shape || 'rect']?.h || 56 }));
    let placed = false;
    for (let row = 0; row < 10 && !placed; row++) {
      for (let col = 0; col < 5 && !placed; col++) {
        const cx = 30 + col * 100;
        const cy = 30 + row * 100;
        const overlaps = occupied.some(o => Math.abs(o.x - cx) < Math.max(o.w, size.w) && Math.abs(o.y - cy) < Math.max(o.h, size.h));
        if (!overlaps) { px = cx; py = cy; placed = true; }
      }
    }
    const newTable: Table = {
      id: 'table-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      name: zoneName.charAt(0).toUpperCase() + ' ' + nextNum,
      zone: activeZone,
      status: 'free',
      shape: shape,
      seats: shape === 'barstool' ? 1 : shape === 'round' ? 6 : 4,
      x: px,
      y: py,
    };
    saveTableUpdate([...state.tables, newTable]);
    setSelectedTable(newTable.id);
  };

  const handleDeleteTable = () => {
    if (!selectedTable) return;
    saveTableUpdate(state.tables.filter(t => t.id !== selectedTable));
    setSelectedTable(null);
  };

  const handleChangeShape = (shape: TableShape) => {
    if (selectedTable) {
      saveTableUpdate(state.tables.map(t => t.id === selectedTable ? { ...t, shape } : t));
    } else {
      setNewTableShape(shape);
    }
    setShowShapePicker(false);
  };

  const handleMouseDown = (e: React.MouseEvent, tableId: string) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    const table = state.tables.find(t => t.id === tableId);
    if (!table) return;
    dragRef.current = { tableId, startX: e.clientX, startY: e.clientY, origX: table.x || 0, origY: table.y || 0, moved: false };
    setSelectedTable(tableId);
  };

  const handleTouchDown = (e: React.TouchEvent, tableId: string) => {
    if (!editMode) return;
    e.stopPropagation();
    const table = state.tables.find(t => t.id === tableId);
    if (!table) return;
    dragRef.current = { tableId, startX: e.touches[0].clientX, startY: e.touches[0].clientY, origX: table.x || 0, origY: table.y || 0, moved: false };
    setSelectedTable(tableId);
  };

  useEffect(() => {
    if (!editMode) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = (e.clientX - dragRef.current.startX) / scale;
      const dy = (e.clientY - dragRef.current.startY) / scale;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
      const newX = Math.max(0, dragRef.current.origX + dx);
      const newY = Math.max(0, dragRef.current.origY + dy);
      const updatedTables = state.tables.map(t =>
        t.id === dragRef.current!.tableId ? { ...t, x: Math.round(newX), y: Math.round(newY) } : t
      );
      dispatch({ type: 'UPDATE_CONFIG', restaurant: state.restaurant, zones: state.zones, tables: updatedTables, menu: state.menu, staff: state.staff });
    };
    const handleMouseUp = () => {
      if (dragRef.current) {
        const storage = loadStorage();
        saveStorage({ ...storage, tables: state.tables });
        dragRef.current = null;
      }
    };
    const handleTouchMoveDoc = (e: TouchEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();
      const dx = (e.touches[0].clientX - dragRef.current.startX) / scale;
      const dy = (e.touches[0].clientY - dragRef.current.startY) / scale;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
      const newX = Math.max(0, dragRef.current.origX + dx);
      const newY = Math.max(0, dragRef.current.origY + dy);
      const updatedTables = state.tables.map(t =>
        t.id === dragRef.current!.tableId ? { ...t, x: Math.round(newX), y: Math.round(newY) } : t
      );
      dispatch({ type: 'UPDATE_CONFIG', restaurant: state.restaurant, zones: state.zones, tables: updatedTables, menu: state.menu, staff: state.staff });
    };
    const handleTouchEndDoc = () => {
      if (dragRef.current) {
        const storage = loadStorage();
        saveStorage({ ...storage, tables: state.tables });
        dragRef.current = null;
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMoveDoc, { passive: false });
    window.addEventListener('touchend', handleTouchEndDoc);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMoveDoc);
      window.removeEventListener('touchend', handleTouchEndDoc);
    };
  }, [editMode, state.tables, scale, dispatch, state.restaurant, state.zones, state.menu, state.staff]);

  // OpenTable sidebar data
  const sidebarReservations = useMemo(() => {
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    return reservations
      .filter(r => r.date === todayStr && ['confirmed', 'running_late', 'partially_arrived'].includes(r.status))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [reservations]);

  const sidebarSeated = useMemo(() => {
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    return reservations
      .filter(r => r.date === todayStr && ['seated', 'partially_seated', 'appetizer', 'entree', 'dessert', 'cleared', 'check_dropped', 'paid', 'bussing_needed'].includes(r.status))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [reservations]);

  const sidebarResParties = sidebarReservations.length;
  const sidebarResCovers = sidebarReservations.reduce((s, r) => s + r.partySize, 0);
  const sidebarSeatedParties = sidebarSeated.length;
  const sidebarSeatedCovers = sidebarSeated.reduce((s, r) => s + r.partySize, 0);

  const getSeatedDuration = (r: Reservation): string => {
    const [rh, rm] = r.time.split(':').map(Number);
    const now = new Date();
    const seated = new Date(now);
    seated.setHours(rh, rm, 0, 0);
    const diffMs = now.getTime() - seated.getTime();
    if (diffMs < 0) return '';
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    return hours > 0 ? hours + 'h ' + mins + 'm' : mins + 'm';
  };

  // SVG-based table rendering (OpenTable style)
  // Generates SVG paths for table body + chairs as a unified shape
  const buildTableSvg = (shape: string, w: number, h: number, seats: number, color: string) => {
    const isBarstool = shape === 'barstool';
    const isRound = shape === 'round' || isBarstool;
    const isDiamond = shape === 'diamond';

    // Chair dimensions (relative to SVG coordinate space)
    const cW = 12, cH = 5.5, cR = 2.5, cGap = 3, cOff = 2;
    // Padding around table for chairs
    const pad = isBarstool || isDiamond ? 0 : cH + cOff + 1;
    const svgW = w + pad * 2;
    const svgH = h + pad * 2;
    const ox = pad; // table offset x
    const oy = pad; // table offset y

    const paths: string[] = [];

    // Table body path
    if (isRound) {
      const cx = svgW / 2, cy = svgH / 2, r = w / 2;
      paths.push(`M${cx + r},${cy} A${r},${r} 0 1,1 ${cx - r},${cy} A${r},${r} 0 1,1 ${cx + r},${cy}Z`);
    } else if (isDiamond) {
      const cx = w / 2, cy = h / 2;
      paths.push(`M${cx},0 L${w},${cy} L${cx},${h} L0,${cy}Z`);
    } else {
      const br = shape === 'square' ? 5 : 7;
      paths.push(`M${ox + br},${oy} h${w - br * 2} a${br},${br} 0 0 1 ${br},${br} v${h - br * 2} a${br},${br} 0 0 1 -${br},${br} h-${w - br * 2} a${br},${br} 0 0 1 -${br},-${br} v-${h - br * 2} a${br},${br} 0 0 1 ${br},-${br}Z`);
    }

    // Chair paths
    if (!isBarstool && !isDiamond) {
      const chairSeats = Math.min(seats, 10);
      if (isRound) {
        const cx = svgW / 2, cy = svgH / 2, radius = w / 2 + cOff + cH / 2;
        for (let i = 0; i < chairSeats; i++) {
          const angle = (i / chairSeats) * Math.PI * 2 - Math.PI / 2;
          const px = cx + Math.cos(angle) * radius;
          const py = cy + Math.sin(angle) * radius;
          const deg = (angle * 180 / Math.PI) + 90;
          paths.push(`M${px},${py}` + ` m${-cW / 2},${-cH / 2}` + ` l${cW},0` + ` l0,${cH}` + ` l${-cW},0 Z`);
          // Use transform on this path for rotation
        }
      } else if (shape === 'rect_v') {
        // Chairs on left and right
        const leftCount = Math.ceil(chairSeats / 2);
        const rightCount = Math.floor(chairSeats / 2);
        const leftTotal = leftCount * cW + (leftCount - 1) * cGap;
        const leftStart = oy + (h - leftTotal) / 2;
        for (let i = 0; i < leftCount; i++) {
          const cy = leftStart + i * (cW + cGap);
          paths.push(`M${ox - cOff - cH},${cy} h${cH} q${cR},0 ${cR},${cR} v${cW - cR * 2} q0,${cR} -${cR},${cR} h-${cH} q-${cR},0 -${cR},-${cR} v-${cW - cR * 2} q0,-${cR} ${cR},-${cR}Z`);
        }
        const rightTotal = rightCount * cW + (rightCount - 1) * cGap;
        const rightStart = oy + (h - rightTotal) / 2;
        for (let i = 0; i < rightCount; i++) {
          const cy = rightStart + i * (cW + cGap);
          paths.push(`M${ox + w + cOff},${cy} h${cH} q${cR},0 ${cR},${cR} v${cW - cR * 2} q0,${cR} -${cR},${cR} h-${cH} q-${cR},0 -${cR},-${cR} v-${cW - cR * 2} q0,-${cR} ${cR},-${cR}Z`);
        }
      } else {
        // rect, square: chairs on top and bottom
        const topCount = Math.ceil(chairSeats / 2);
        const bottomCount = Math.floor(chairSeats / 2);
        const topTotal = topCount * cW + (topCount - 1) * cGap;
        const topStart = ox + (w - topTotal) / 2;
        for (let i = 0; i < topCount; i++) {
          const cx = topStart + i * (cW + cGap);
          paths.push(`M${cx},${oy - cOff - cH} h${cW} q${cR},0 ${cR},${cR} v${cH - cR * 2} q0,${cR} -${cR},${cR} h-${cW} q-${cR},0 -${cR},-${cR} v-${cH - cR * 2} q0,-${cR} ${cR},-${cR}Z`);
        }
        const bottomTotal = bottomCount * cW + (bottomCount - 1) * cGap;
        const bottomStart = ox + (w - bottomTotal) / 2;
        for (let i = 0; i < bottomCount; i++) {
          const cx = bottomStart + i * (cW + cGap);
          paths.push(`M${cx},${oy + h + cOff} h${cW} q${cR},0 ${cR},${cR} v${cH - cR * 2} q0,${cR} -${cR},${cR} h-${cW} q-${cR},0 -${cR},-${cR} v-${cH - cR * 2} q0,-${cR} ${cR},-${cR}Z`);
        }
      }
    }

    return { paths, svgW: isDiamond ? w : svgW, svgH: isDiamond ? h : svgH, ox: isDiamond ? 0 : ox, oy: isDiamond ? 0 : oy };
  };

  const renderTableShape = (table: Table) => {
    const shape = table.shape || 'rect';
    const info = getOrderInfo(table.id);
    const isOccupied = table.status === 'occupied';
    const isBilling = table.status === 'billing';
    const isSelected = selectedTable === table.id;
    const hasReservation = !!tableReservationMap[table.id];
    const reservation = tableReservationMap[table.id];
    let isSoon = false;
    if (reservation && reservation.status === 'confirmed') {
      const now = new Date();
      const [rh, rm] = reservation.time.split(':').map(Number);
      const resTime = new Date(now);
      resTime.setHours(rh, rm, 0, 0);
      const diffMin = (resTime.getTime() - now.getTime()) / 60000;
      isSoon = diffMin > 0 && diffMin <= 30;
    }
    const isBlocked = table.status === 'blocked';
    const isActive = isOccupied || isBilling;
    const bgColor = isBlocked ? '#ef4444' : isOccupied ? '#a855f7' : isBilling ? '#fbbf24' : (hasReservation && table.status === 'free') ? '#22d3ee' : '#3d3d5c';
    const size = getTableSize(table);
    const tableX = table.x || 0;
    const tableY = table.y || 0;
    const displayName = table.name.replace(/^[A-Za-z]+\s*/, '') || table.name;
    const tableSession = state.sessions[table.id];
    const serviceStatusLabel = tableSession?.serviceStatus ? SERVICE_STATUS_SHORT[tableSession.serviceStatus] : null;
    const isBarstool = shape === 'barstool';
    const isRound = shape === 'round' || isBarstool;
    const isDiamond = shape === 'diamond';
    const isPopupActive = !!(selectedReservationId && reservation && reservation.id === selectedReservationId);
    const seats = table.seats || 4;

    // Time below table (OpenTable style)
    const nextResTime = nextReservationMap[table.id];
    const activeTime = isActive && info.startTime > 0 ? formatTime(info.startTime) : null;
    const belowTime = isActive ? (activeTime || serviceStatusLabel) : nextResTime;

    // Progress bar for occupied tables (like OpenTable)
    let progressPct = 0;
    if (isActive && info.startTime > 0) {
      const elapsed = (Date.now() - info.startTime) / 60000; // minutes
      progressPct = Math.min(100, (elapsed / 90) * 100); // assume 90min dining
    }

    // Build SVG
    const svg = buildTableSvg(shape, size.w, size.h, seats, bgColor);
    const { paths, svgW, svgH, ox, oy } = svg;

    const isHighlighted = highlightedTableId === table.id;

    const wrapperStyle: React.CSSProperties = {
      position: 'absolute',
      left: tableX - (isDiamond ? 0 : (svgW - size.w) / 2),
      top: tableY - (isDiamond ? 0 : (svgH - size.h) / 2),
      width: svgW,
      height: svgH,
      cursor: editMode ? 'grab' : 'pointer',
      zIndex: isSelected || isHighlighted ? 10 : 1,
      filter: isSelected ? 'drop-shadow(0 0 8px rgba(167,139,250,0.6))' : isHighlighted ? 'drop-shadow(0 0 12px rgba(236,72,153,0.8)) brightness(1.2)' : 'none',
      transition: dragRef.current?.tableId === table.id ? 'none' : 'filter 0.15s',
    };

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (dragRef.current?.moved) return;
      handleTableClick(table);
    };

    return (
      <div key={table.id} style={wrapperStyle} onClick={handleClick}
        onMouseDown={(e) => handleMouseDown(e, table.id)}
        onTouchStart={(e) => handleTouchDown(e, table.id)}>
        {/* SVG table shape with chairs */}
        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="absolute inset-0">
          {/* Chair paths (slightly transparent) */}
          {paths.slice(1).map((d, i) => (
            <path key={`c${i}`} d={d} fill={bgColor} opacity={0.55} />
          ))}
          {/* Table body */}
          {isDiamond ? (
            <path d={paths[0]} fill={bgColor} />
          ) : (
            <path d={paths[0]} fill={bgColor} />
          )}
          
        </svg>
        {/* Selection borders */}
        {isSelected && editMode && (
          <div className="absolute pointer-events-none" style={{
            left: ox - 2, top: oy - 2, width: size.w + 4, height: size.h + 4,
            border: '2px solid #a78bfa', borderRadius: isRound ? '50%' : isDiamond ? 8 : 10,
            transform: isDiamond ? 'rotate(45deg)' : undefined, transformOrigin: 'center',
          }} />
        )}
        {isPopupActive && !editMode && (
          <div className="absolute pointer-events-none" style={{
            left: ox - 2, top: oy - 2, width: size.w + 4, height: size.h + 4,
            border: '2px solid #ffffff', borderRadius: isRound ? '50%' : isDiamond ? 8 : 10,
            transform: isDiamond ? 'rotate(45deg)' : undefined, transformOrigin: 'center',
          }} />
        )}
        {/* Overlay: table info (positioned on table body area) */}
        <div className="absolute flex flex-col items-center justify-center pointer-events-none"
          style={{ left: ox, top: oy, width: size.w, height: size.h, transform: isDiamond ? 'rotate(0deg)' : undefined }}>
          {/* Blocked icon */}
          {isBlocked && (
            <Ban className="w-3.5 h-3.5" style={{ color: '#fff', position: 'absolute', top: isRound ? 6 : 4 }} />
          )}
          {/* Progress indicator above number (OpenTable style — white bar = progress) */}
          {!isBlocked && isActive && !isBarstool && (
            <div className="absolute" style={{ top: isRound ? 12 : 10, left: '15%', right: '15%', height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }}>
              <div style={{ width: `${Math.max(8, progressPct)}%`, height: '100%', borderRadius: 2, background: '#fff', transition: 'width 1s ease' }} />
            </div>
          )}
          {/* Table number */}
          <span className="font-bold leading-none select-none" style={{
            color: '#fff', fontSize: isBarstool ? 11 : isDiamond ? 14 : 18,
            marginTop: isActive && !isBarstool ? 4 : 0,
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          }}>
            {displayName}
          </span>
        </div>
        {/* Time callout with dark bg + chevron (OpenTable style) */}
        {belowTime && !isBarstool && (
          <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none" style={{ top: oy + size.h - 2 }}>
            {/* Chevron triangle pointing up */}
            <div style={{
              width: 0, height: 0, margin: '0 auto',
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderBottom: '5px solid rgba(0,0,0,0.7)',
            }} />
            {/* Dark pill with time */}
            <div style={{
              background: 'rgba(0,0,0,0.7)',
              borderRadius: 4,
              padding: '2px 6px',
              fontSize: 12, fontWeight: 700, color: '#fff',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              whiteSpace: 'nowrap',
              textAlign: 'center',
              lineHeight: '16px',
            }}>
              {belowTime}
            </div>
          </div>
        )}
      </div>
    );
  };

  const currentZone = state.zones.find(z => z.id === activeZone);
  const currentZoneIdx = state.zones.findIndex(z => z.id === activeZone);

  // Notify parent of initial zone on mount
  useEffect(() => {
    if (onZoneChange && currentZone) onZoneChange(activeZone, currentZone.name);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Expose zone switching for parent (App header arrows)
  const switchToPrevZone = useCallback(() => {
    const prev = currentZoneIdx > 0 ? currentZoneIdx - 1 : state.zones.length - 1;
    switchZone(state.zones[prev].id);
  }, [currentZoneIdx, state.zones, switchZone]);

  const switchToNextZone = useCallback(() => {
    const next = currentZoneIdx < state.zones.length - 1 ? currentZoneIdx + 1 : 0;
    switchZone(state.zones[next].id);
  }, [currentZoneIdx, state.zones, switchZone]);

  // Attach to window for parent access
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__floorPlanPrevZone = switchToPrevZone;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__floorPlanNextZone = switchToNextZone;
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__floorPlanPrevZone;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__floorPlanNextZone;
    };
  }, [switchToPrevZone, switchToNextZone]);

  // Source labels
  const SOURCE_LABELS: Record<string, { icon: typeof Phone; label: string }> = {
    phone: { icon: PhoneCall, label: 'Telefon' },
    online: { icon: Globe, label: 'Online' },
    walk_in: { icon: Footprints, label: 'Walk-In' },
  };

  const SOURCE_ICONS: Record<string, typeof IconPhoneFilled> = {
    phone: IconPhoneFilled,
    online: IconGlobeFilled,
    walk_in: IconWalk,
  };

  const SOURCE_COLORS: Record<string, string> = {
    phone: '#3b82f6',
    online: '#ec4899',
    walk_in: '#22c55e',
  };

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

  // Handle sidebar card click - toggle 3-panel OpenTable view
  const handleSidebarCardClick = (r: Reservation) => {
    // Toggle: if same card clicked again, close the panel
    if (selectedReservationId === r.id) {
      closeGuestPanel();
      return;
    }
    setSelectedReservationId(r.id);
    setHighlightedTableId(r.tableId || null);
    // Load guest profile for center panel
    const guests = loadGuests();
    let guest = r.guestPhone ? guests.find(g => g.phone === r.guestPhone) : null;
    if (!guest && r.guestName) {
      guest = guests.find(g => g.name === r.guestName) || null;
    }
    if (!guest && r.guestName) {
      // Auto-create guest profile so 3-panel view can open
      const newGuest: Guest = {
        id: 'g-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        name: r.guestName,
        phone: r.guestPhone || '',
        email: '',
        tags: [],
        notes: [],
        visitCount: 1,
        lastVisit: r.date,
      };
      addGuest(newGuest);
      guest = newGuest;
    }
    setGuestProfileGuest(guest);
  };

  // Get selected reservation object
  const selectedReservation = useMemo(() => {
    if (!selectedReservationId) return null;
    return reservations.find(r => r.id === selectedReservationId) || null;
  }, [selectedReservationId, reservations]);

  // OpenTable sidebar render - 1:1 match with Reservations card design
  const renderSidebarCard = (r: Reservation, showDuration: boolean) => {
    const sourceColor = SOURCE_COLORS[r.source] || '#8888aa';
    const SourceIcon = SOURCE_ICONS[r.source] || Users;
    const assignedTable = r.tableId ? state.tables.find(t => t.id === r.tableId) : null;
    const guests = loadGuests();
    const guestProfile = r.guestPhone ? guests.find(g => g.phone === r.guestPhone) : guests.find(g => g.name === r.guestName) || null;
    const isVip = guestProfile?.tags.includes('vip') || guestProfile?.tags.includes('stammgast');
    const guestTags = guestProfile?.tags || [];
    const occasions = (r.occasionLabels || []) as OccasionLabel[];
    const duration = showDuration ? getSeatedDuration(r) : '';
    const isCardSelected = selectedReservationId === r.id;
    return (
      <div key={r.id} style={{ marginBottom: '2px', padding: '0 6px' }}>
        <div
          className="flex items-center h-[52px] rounded-[3px] hover:brightness-110 active:brightness-125 transition-all cursor-pointer"
          style={{ background: isCardSelected ? '#2e2e50' : '#252540', outline: isCardSelected ? '2px solid #ec4899' : 'none' }}
          onClick={() => handleSidebarCardClick(r)}
        >
          {/* Left color bar with icon + party size */}
          <div className="shrink-0 ml-[3px] rounded-[3px] flex flex-col items-center justify-center gap-[2px]" style={{ background: sourceColor, width: '28px', height: '45px' }}>
            <SourceIcon size={14} color="white" />
            <span className="text-white font-bold text-[11px] leading-none mt-1">{r.partySize}</span>
          </div>
          {/* Content area */}
          <div className="flex-1 min-w-0 ml-[10px]">
            {/* Line 1: time + duration */}
            <div className="flex items-center gap-[6px]">
              <span className="text-white font-normal text-[12px]">{r.time} Uhr</span>
              {duration ? (
                <span className="text-[#8888aa] font-normal text-[10px]">{duration}</span>
              ) : (
                <span className="text-[#8888aa] font-normal text-[10px]">{r.duration ? (r.duration >= 60 ? Math.floor(r.duration / 60) + 'h' + (r.duration % 60 ? ' ' + (r.duration % 60) + 'm' : '') : r.duration + 'm') : ''}</span>
              )}
            </div>
            {/* Line 2: star + guest name */}
            <div className="flex items-center gap-[4px] mt-[1px]">
              {isVip && <IconStarFilled size={15} color="#FFCC00" />}
              <span className="text-white font-semibold text-[14px] truncate whitespace-nowrap">{r.guestName}</span>
            </div>
          </div>
          {/* Icon chips - right-aligned, top-aligned with left bar */}
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
          {/* Right side - table badge (square 40x40) */}
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
  };

  // Tag constants
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
  const NOTE_CATS: { value: GuestNote['category']; label: string; icon: typeof Star }[] = [
    { value: 'general', label: 'Allgemein', icon: AlignLeft },
    { value: 'status', label: 'Gaststatus', icon: Star },
    { value: 'food', label: 'Speisen & Getränke', icon: User },
    { value: 'seating', label: 'Sitzplätze', icon: Armchair },
    { value: 'info', label: 'Gastdetails', icon: User },
    { value: 'history', label: 'Verlauf', icon: Clock },
  ];

  const refreshGuest = () => {
    if (!guestProfileGuest) return;
    const guests = loadGuests();
    const updated = guests.find(g => g.id === guestProfileGuest.id);
    if (updated) { setGuestProfileGuest(updated); setGuestProfileKey(k => k + 1); }
  };

  const handleToggleTag = (tag: GuestTag) => {
    if (!guestProfileGuest) return;
    toggleGuestTag(guestProfileGuest.id, tag);
    refreshGuest();
  };

  const handleAddNote = () => {
    if (!noteText.trim() || !guestProfileGuest) return;
    const note: GuestNote = {
      id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      category: activeNoteTab,
      text: noteText.trim(),
      createdAt: Date.now(),
    };
    addGuestNote(guestProfileGuest.id, note);
    setNoteText('');
    setShowAddNote(false);
    refreshGuest();
  };

  const handleRemoveNote = (noteId: string) => {
    if (!guestProfileGuest) return;
    removeGuestNote(guestProfileGuest.id, noteId);
    refreshGuest();
  };

  const closeGuestPanel = () => {
    setSelectedReservationId(null);
    setHighlightedTableId(null);
    setGuestProfileGuest(null);
    setShowAddNote(false);
    setNoteText('');
    setShowTagPicker(false);
  };

  // OpenTable CENTER PANEL - Guest profile + notes (card-row layout)
  const renderCenterPanel = () => {
    if (!selectedReservation || !guestProfileGuest) return null;
    const r = selectedReservation;
    const g = guestProfileGuest;
    const zoneName = r.zone ? (state.zones.find(z => z.id === r.zone)?.name || '') : '';

    // Card background from user swatch
    const cardBg = '#252540';
    // Which category is expanded for inline adding
    const isExpanded = (cat: string) => showAddNote && activeNoteTab === cat;

    // Render inline note input for a category
    const renderInlineInput = (catValue: string) => (
      <div className="px-4 pb-3 pt-1 space-y-2">
        <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
          placeholder="Notiz eingeben..."
          rows={2}
          className="w-full rounded-lg px-3 py-2 bg-[#1a1a2e] text-[#e2e8f0] border border-[#3d3d5c] focus:border-[#7bb7ef] focus:outline-none text-[13px] resize-none"
          autoFocus />
        <div className="flex gap-2">
          <button onClick={handleAddNote} disabled={!noteText.trim()}
            className="px-3 py-1.5 rounded-lg bg-[#7bb7ef] text-white text-[12px] font-medium disabled:opacity-50 transition-colors">
            Speichern
          </button>
          <button onClick={() => { setShowAddNote(false); setNoteText(''); }}
            className="px-3 py-1.5 rounded-lg text-[#94a3b8] text-[12px] hover:text-[#e2e8f0] transition-colors">
            Abbrechen
          </button>
        </div>
      </div>
    );

    // Render notes list for a category
    const renderNotes = (notes: GuestNote[]) => (
      <div className="px-4 pb-3 space-y-1.5">
        {notes.map(note => (
          <div key={note.id} className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-[#e2e8f0] text-[14px]">{note.text}</p>
              <p className="text-[#64748b] text-[11px] mt-0.5">{new Date(note.createdAt).toLocaleDateString('de-DE')}</p>
            </div>
            <button onClick={() => handleRemoveNote(note.id)}
              className="p-1.5 text-red-400/60 hover:text-red-400 transition-colors shrink-0 ml-2">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    );

    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: '#1a1a2e' }}>
        {/* Guest header */}
        <div className="px-5 py-4 border-b border-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#334155] flex items-center justify-center shrink-0 border border-[#475569]">
              <User className="w-5 h-5 text-[#94a3b8]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[#e2e8f0] font-bold text-[17px]">{g.name}</h2>
                <button onClick={() => { closeGuestPanel(); setShowReservations(true); }}
                  className="text-[#7bb7ef] hover:text-[#93c5fd] transition-colors">
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <button onClick={closeGuestPanel} className="p-1.5 rounded-lg hover:bg-[#334155] transition-colors shrink-0">
              <X className="w-5 h-5 text-[#94a3b8]" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {/* Quick add note bar (general) */}
          <button onClick={() => { setActiveNoteTab('general'); setShowAddNote(!isExpanded('general')); setNoteText(''); }}
            className="w-full text-left px-4 py-3.5 rounded-xl text-[#64748b] text-[14px] transition-colors hover:brightness-110"
            style={{ background: cardBg }}>
            Allgemeine Notiz hinzufügen ...
          </button>
          {/* Inline input for general (expands below the bar) */}
          {isExpanded('general') && (
            <div className="rounded-xl overflow-hidden" style={{ background: cardBg }}>
              {renderInlineInput('general')}
            </div>
          )}

          {/* Reservation notes if any */}
          {r.notes && (
            <div className="text-[#e2e8f0] text-[13px] leading-relaxed rounded-xl px-4 py-3 border border-white/[0.03]" style={{ background: cardBg }}>{r.notes}</div>
          )}

          {/* Category rows - first two as individual cards */}
          {NOTE_CATS.slice(0, 2).map(cat => {
            const Icon = cat.icon;
            const notes = g.notes.filter(n => n.category === cat.value);
            const expanded = isExpanded(cat.value);
            return (
              <div key={cat.value} className="rounded-xl overflow-hidden" style={{ background: cardBg }}>
                {/* Category header row */}
                <button
                  onClick={() => { setActiveNoteTab(cat.value); setShowAddNote(!expanded); setNoteText(''); }}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:brightness-110 transition-all">
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-[#94a3b8]" />
                    <span className="text-[#e2e8f0] text-[15px] font-semibold">{cat.label}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[#64748b] text-[13px]">
                    {notes.length === 0 && !expanded && <span>Hinzufügen</span>}
                    <ChevronRight className={'w-4 h-4 transition-transform ' + (expanded ? 'rotate-90' : '')} />
                  </div>
                </button>
                {/* Notes below header */}
                {notes.length > 0 && renderNotes(notes)}
                {/* Inline add form */}
                {expanded && renderInlineInput(cat.value)}
              </div>
            );
          })}

          {/* Remaining categories as grouped card */}
          <div className="rounded-xl overflow-hidden" style={{ background: cardBg }}>
            {NOTE_CATS.slice(2).map((cat, idx) => {
              const Icon = cat.icon;
              const notes = g.notes.filter(n => n.category === cat.value);
              const expanded = isExpanded(cat.value);
              return (
                <div key={cat.value}>
                  {idx > 0 && <div className="mx-4 border-t border-white/[0.06]" />}
                  <button
                    onClick={() => { setActiveNoteTab(cat.value); setShowAddNote(!expanded); setNoteText(''); }}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:brightness-110 transition-all">
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-[#94a3b8]" />
                      <span className="text-[#e2e8f0] text-[15px] font-semibold">{cat.label}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[#64748b] text-[13px]">
                      {!expanded && <span>Hinzufügen</span>}
                      <ChevronRight className={'w-4 h-4 transition-transform ' + (expanded ? 'rotate-90' : '')} />
                    </div>
                  </button>
                  {/* Notes */}
                  {notes.length > 0 && renderNotes(notes)}
                  {/* Inline add form */}
                  {expanded && renderInlineInput(cat.value)}
                </div>
              );
            })}
          </div>

          {/* Tags section */}
          {(g.tags.length > 0 || zoneName) && (
            <div className="flex items-center gap-2 flex-wrap px-1">
              {zoneName && (
                <span className="flex items-center gap-1 px-2 py-[3px] rounded-[4px] text-[9px] font-semibold uppercase text-white" style={{ background: '#4c1d95' }}>
                  <Tag className="w-3 h-3" /> {zoneName}
                </span>
              )}
              {g.tags.map(tag => {
                const info = ALL_TAGS.find(t => t.value === tag);
                return info ? (
                  <span key={tag} className="px-2 py-[3px] rounded-[4px] text-[9px] font-semibold uppercase text-white"
                    style={{ background: info.color }}>
                    {info.label}
                  </span>
                ) : null;
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // OpenTable RIGHT PANEL - 1:1 OpenTable Design
  const [pacingExcluded, setPacingExcluded] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // Status config: groups of statuses based on current state (like OpenTable)
  const STATUS_CONFIG: { value: ReservationStatus; label: string; icon: string; color: string }[] = [
    { value: 'confirmed', label: 'Gebucht', icon: '📋', color: '#7c3aed' },
    { value: 'running_late', label: 'Verspätet', icon: '🕐', color: '#f59e0b' },
    { value: 'partially_arrived', label: 'Teilweise da', icon: '🚪', color: '#f97316' },
    { value: 'seated', label: 'Platziert', icon: '🪑', color: '#8b5cf6' },
    { value: 'partially_seated', label: 'Teilweise platziert', icon: '🪑', color: '#a78bfa' },
    { value: 'appetizer', label: 'Vorspeise', icon: '🥗', color: '#6366f1' },
    { value: 'entree', label: 'Hauptgang', icon: '🍽️', color: '#4f46e5' },
    { value: 'dessert', label: 'Dessert', icon: '🍰', color: '#7c3aed' },
    { value: 'cleared', label: 'Abgeräumt', icon: '✨', color: '#0891b2' },
    { value: 'check_dropped', label: 'Rechnung', icon: '🧾', color: '#059669' },
    { value: 'paid', label: 'Bezahlt', icon: '💳', color: '#16a34a' },
    { value: 'bussing_needed', label: 'Abräumen nötig', icon: '🧹', color: '#ca8a04' },
    { value: 'finished', label: 'Beendet', icon: '✅', color: '#22c55e' },
    { value: 'cancelled', label: 'Storniert', icon: '❌', color: '#ef4444' },
    { value: 'no_show', label: 'No-Show', icon: '👻', color: '#f59e0b' },
  ];

  // Get relevant statuses for dropdown based on current state
  const getStatusOptions = (currentStatus: ReservationStatus) => {
    const preSeated: ReservationStatus[] = ['confirmed', 'running_late', 'partially_arrived'];
    const seated: ReservationStatus[] = ['partially_seated', 'seated', 'appetizer', 'entree', 'dessert', 'cleared', 'check_dropped', 'paid', 'bussing_needed', 'finished'];
    const isPreSeated = preSeated.includes(currentStatus);
    return isPreSeated ? [...preSeated, ...seated] : [...seated, ...preSeated];
  };

  const renderRightPanel = () => {
    if (!selectedReservation) return null;
    const r = selectedReservation;
    const cardBg = '#252540';
    const tableNames = (() => {
      const ids = r.tableIds && r.tableIds.length > 0 ? r.tableIds : (r.tableId ? [r.tableId] : []);
      return ids.map(id => state.tables.find(t => t.id === id)?.name || '').filter(Boolean).join(', ');
    })();
    const tableName = tableNames || 'Kein Tisch';
    const currentConfig = STATUS_CONFIG.find(s => s.value === r.status) || STATUS_CONFIG[0];
    const hasPhone = !!(r.guestPhone || guestProfileGuest?.phone);
    const phoneValid = hasPhone && (r.guestPhone || guestProfileGuest?.phone || '').replace(/\s/g, '').length >= 6;
    const isSeatedGroup = ['seated', 'partially_seated', 'appetizer', 'entree', 'dessert', 'cleared', 'check_dropped', 'paid', 'bussing_needed'].includes(r.status);
    const statusOptions = getStatusOptions(r.status);

    return (
      <div className="flex flex-col h-full overflow-y-auto" style={{ width: 260, minWidth: 260, background: '#1a1a2e', borderLeft: '1px solid rgba(255,255,255,0.03)' }}>
        {/* Status header */}
        <div className="relative px-3 pt-2.5 pb-1">
          <button onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            className="w-full px-3.5 py-2 flex items-center justify-between text-white font-semibold text-[13px] rounded-xl"
            style={{ background: currentConfig.color }}>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              {currentConfig.label}
            </div>
            <ChevronDown className="w-4 h-4 opacity-70" />
          </button>
          {showStatusDropdown && (
            <div className="absolute top-full left-3 right-3 z-50 border border-white/[0.03] shadow-xl rounded-xl overflow-hidden max-h-[360px] overflow-y-auto mt-1" style={{ background: cardBg }}>
              {statusOptions.map(st => {
                const cfg = STATUS_CONFIG.find(s => s.value === st);
                if (!cfg) return null;
                return (
                  <button key={st} onClick={() => {
                    const updated = reservations.map(res => res.id === r.id ? { ...res, status: st } : res);
                    setReservations(updated);
                    saveStorage({ ...loadStorage(), reservations: updated } as never);
                    setShowStatusDropdown(false);
                  }}
                    className={'w-full px-4 py-2.5 text-left text-[13px] hover:bg-[#1a1a2e] transition-colors flex items-center gap-2 ' +
                      (r.status === st ? 'font-semibold text-[#7bb7ef] bg-[#1a1a2e]' : 'text-[#cbd5e1]')}>
                    <span className="text-[13px]">{cfg.icon}</span>
                    <span>{cfg.label}</span>
                    {r.status === st && <Check className="w-3.5 h-3.5 ml-auto text-[#7bb7ef]" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Card-based sections */}
        <div className="px-3 py-1.5 space-y-1.5 flex-1 overflow-y-auto">
          {/* Table assignment card */}
          <button onClick={() => { setShowSeatOverlay(true); setSeatOverlayZone(activeZone); }}
            className="w-full text-left rounded-xl px-3 py-2.5 hover:brightness-110 transition-all"
            style={{ background: cardBg }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#1a1a2e' }}>
                <Armchair className="w-4 h-4 text-[#94a3b8]" />
              </div>
              <div>
                <div className="text-[#e2e8f0] text-[13px] font-semibold">{tableName}</div>
                {(r.tableId || (r.tableIds && r.tableIds.length > 0)) && (
                  <div className="text-[#64748b] text-[12px]">{isSeatedGroup ? 'Zugewiesen' : 'Vorgeschlagen'}</div>
                )}
                {!r.tableId && (!r.tableIds || r.tableIds.length === 0) && (
                  <div className="text-[#64748b] text-[12px]">Kein Tisch zugewiesen</div>
                )}
              </div>
            </div>
          </button>

          {/* Phone / SMS card */}
          <div className="rounded-xl px-3 py-2.5" style={{ background: cardBg }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#1a1a2e' }}>
                <MessageSquare className="w-4 h-4 text-[#94a3b8]" />
              </div>
              <div>
                <div className={'text-[13px] font-semibold ' + (phoneValid ? 'text-[#e2e8f0]' : 'text-[#64748b]')}>
                  {phoneValid ? (r.guestPhone || guestProfileGuest?.phone) : 'Ungültige Telefonnummer'}
                </div>
                <div className="flex items-center gap-1 text-[12px]">
                  {phoneValid && <Check className="w-3 h-3 text-[#22c55e]" />}
                  <span className={phoneValid ? 'text-[#22c55e]' : 'text-[#64748b]'}>
                    {phoneValid ? 'SMS-Updates aktiv' : 'SMS-Updates deaktiviert'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons card (mail + card icons) */}
          <div className="flex gap-1.5">
            <button className="flex-1 py-2.5 rounded-xl flex items-center justify-center hover:brightness-110 transition-all"
              style={{ background: cardBg }}>
              <Mail className="w-5 h-5 text-[#94a3b8]" />
            </button>
            <button className="flex-1 py-2.5 rounded-xl flex items-center justify-center hover:brightness-110 transition-all"
              style={{ background: cardBg }}>
              <CreditCard className="w-5 h-5 text-[#94a3b8]" />
            </button>
          </div>

          {/* Kreditkarte + Pacing toggle grouped card */}
          <div className="rounded-xl overflow-hidden" style={{ background: cardBg }}>
            <button className="w-full text-left px-3 py-2.5 flex items-center justify-between hover:brightness-110 transition-all border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#2b8c8c]" />
                <span className="text-[#e2e8f0] text-[13px] font-medium">Kreditkarte hinzufügen</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#64748b]" />
            </button>
            <div className="px-3 py-2.5">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[#94a3b8] text-[11px] leading-snug">
                    Gästegruppe von maximaler Anzahl eintreffender Gäste ausnehmen
                  </p>
                </div>
                <button onClick={() => setPacingExcluded(!pacingExcluded)}
                  className={'relative w-10 h-6 rounded-full transition-colors shrink-0 ' +
                    (pacingExcluded ? 'bg-[#7bb7ef]' : 'bg-[#475569]')}>
                  <div className={'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ' +
                    (pacingExcluded ? 'translate-x-[18px]' : 'translate-x-0.5')}>
                    {!pacingExcluded && <X className="w-3 h-3 text-[#94a3b8] absolute top-1 left-1" />}
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Vermittler*in card */}
          <div className="rounded-xl px-3 py-2.5" style={{ background: cardBg }}>
            {r.referralSource ? (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#1a1a2e' }}>
                  <User className="w-4 h-4 text-[#94a3b8]" />
                </div>
                <div>
                  <div className="text-[#e2e8f0] text-[13px] font-semibold">Vermittler*in</div>
                  <div className="text-[#64748b] text-[11px]">{r.referralSource}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#1a1a2e' }}>
                  <User className="w-4 h-4 text-[#94a3b8]" />
                </div>
                <div className="flex-1">
                  <div className="text-[#e2e8f0] text-[13px] font-semibold">Vermittler*in</div>
                  <div className="text-[#64748b] text-[11px]">Noch nicht zugewiesen</div>
                </div>
                <Plus className="w-5 h-5 text-[#2b8c8c] shrink-0" />
              </div>
            )}
          </div>
        </div>

        {/* Primary action + Cancel at bottom */}
        <div className="px-3 pb-3 pt-2 space-y-2 shrink-0">
          {(isSeatedGroup || r.status === 'confirmed') && (
            isSeatedGroup ? (
              <button onClick={() => {
                const updated = reservations.map(res => res.id === r.id ? { ...res, status: 'finished' as const } : res);
                setReservations(updated);
                saveStorage({ ...loadStorage(), reservations: updated } as never);
              }}
                className="w-full py-3 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-2 transition-colors text-white hover:brightness-110"
                style={{ background: '#2b8c8c' }}>
                Beenden
              </button>
            ) : (
              <button onClick={() => {
                const updated = reservations.map(res => res.id === r.id ? { ...res, status: 'seated' as const } : res);
                setReservations(updated);
                saveStorage({ ...loadStorage(), reservations: updated } as never);
              }}
                className="w-full py-3 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-2 transition-colors text-white hover:brightness-110"
                style={{ background: '#2b8c8c' }}>
                Platzieren
              </button>
            )
          )}
          {r.status !== 'cancelled' && r.status !== 'no_show' && r.status !== 'finished' && (
            <button onClick={() => {
              const updated = reservations.map(res => res.id === r.id ? { ...res, status: 'cancelled' as const } : res);
              setReservations(updated);
              saveStorage({ ...loadStorage(), reservations: updated } as never);
              closeGuestPanel();
            }}
              className="w-full py-3 rounded-xl font-semibold text-[13px] transition-colors text-[#ef4444] border border-[#7f1d1d] hover:brightness-110"
              style={{ background: 'transparent' }}>
              Stornieren
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderSidebar = () => {
    if (!showSidebar || editMode) return null;
    return (
      <div className="flex flex-col h-full overflow-y-auto" style={{ width: 320, minWidth: 320, background: '#1a1a2e', borderRight: '1px solid rgba(255,255,255,0.03)' }}>
        {/* Reservations section */}
        <div className="border-b border-white/[0.03]">
          <button onClick={() => setSidebarResCollapsed(!sidebarResCollapsed)}
            className="w-full flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-semibold text-white">Reservierungen</span>
              <span className="text-[11px] text-[#8888aa] ml-1">
                <Users className="w-3 h-3 inline" /> {sidebarResParties} <User className="w-3 h-3 inline ml-0.5" /> {sidebarResCovers}
              </span>
            </div>
            {sidebarResCollapsed ? <ChevronDown className="w-4 h-4 text-[#8888aa]" /> : <ChevronUp className="w-4 h-4 text-[#8888aa]" />}
          </button>
          {!sidebarResCollapsed && (
            <div className="pb-2">
              {sidebarReservations.length === 0 && (
                <div className="px-3 py-2 text-[11px] text-[#666688]">Keine Reservierungen</div>
              )}
              {sidebarReservations.map(r => renderSidebarCard(r, false))}
            </div>
          )}
        </div>

        {/* Seated section */}
        <div>
          <button onClick={() => setSidebarSeatedCollapsed(!sidebarSeatedCollapsed)}
            className="w-full flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-semibold text-white">Platziert</span>
              <span className="text-[11px] text-[#8888aa] ml-1">
                <Users className="w-3 h-3 inline" /> {sidebarSeatedParties} <User className="w-3 h-3 inline ml-0.5" /> {sidebarSeatedCovers}
              </span>
            </div>
            {sidebarSeatedCollapsed ? <ChevronDown className="w-4 h-4 text-[#8888aa]" /> : <ChevronUp className="w-4 h-4 text-[#8888aa]" />}
          </button>
          {!sidebarSeatedCollapsed && (
            <div className="pb-2">
              {sidebarSeated.length === 0 && (
                <div className="px-3 py-2 text-[11px] text-[#666688]">Keine platzierten Gaeste</div>
              )}
              {sidebarSeated.map(r => renderSidebarCard(r, true))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col" style={{ background: '#1a1a2e' }}>

      {editMode && (
        <div className="px-4 py-2 flex items-center gap-2 flex-wrap relative" style={{ background: '#1a1a2e' }}>
          <button onClick={handleAddTable}
            className="flex items-center gap-1.5 bg-[#7bb7ef] text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-[#7bb7ef] transition-colors">
            <Plus className="w-3.5 h-3.5" /> Tisch
          </button>
          <button onClick={() => setShowShapePicker(!showShapePicker)}
            className="flex items-center gap-1.5 bg-[#353558] text-[#c0c0dd] rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-[#555] transition-colors">
            Form: {SHAPE_OPTIONS.find(s => s.value === (selectedTable ? (state.tables.find(t => t.id === selectedTable)?.shape || 'rect') : newTableShape))?.label}
          </button>
          {selectedTable && (
            <button onClick={handleDeleteTable}
              className="flex items-center gap-1.5 bg-red-900/50 text-red-300 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-red-800/50 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Loeschen
            </button>
          )}
          <span className="text-[#8888aa] text-[10px] ml-auto">Drag zum Verschieben</span>
          {showShapePicker && (
            <div className="absolute top-full left-16 z-50 bg-[#2a2a42] rounded-xl border border-[#333355] p-2 shadow-2xl mt-1">
              {SHAPE_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => handleChangeShape(opt.value)}
                  className={'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ' +
                    ((selectedTable ? state.tables.find(t => t.id === selectedTable)?.shape === opt.value : newTableShape === opt.value)
                      ? 'bg-[#7bb7ef] text-white' : 'text-[#c0c0dd] hover:bg-[#353558]')}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* OpenTable-style sidebar */}
        {renderSidebar()}

        {/* Sidebar toggle */}
        {!editMode && (
          <button onClick={() => setShowSidebar(!showSidebar)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-[#1a1a2e] border border-white/[0.03] rounded-r-lg p-1"
            style={{ left: showSidebar ? 320 : 0 }}>
            {showSidebar ? <PanelLeftClose className="w-4 h-4 text-[#8888aa]" /> : <PanelLeftOpen className="w-4 h-4 text-[#8888aa]" />}
          </button>
        )}

        {/* Conditional: 3-panel guest view OR floor plan canvas */}
        {selectedReservation && guestProfileGuest && !editMode ? (
          <>
            {renderCenterPanel()}
            {renderRightPanel()}
          </>
        ) : (
          <div ref={canvasRef} className="flex-1 overflow-hidden relative"
            style={{ background: '#1a1a2e', touchAction: scale > 1 || editMode ? 'none' : 'auto' }}
            onClick={() => { if (editMode) { setSelectedTable(null); setShowShapePicker(false); } }}>
            <div style={{
              transform: 'scale(' + scale + ') translate(' + (translate.x / scale) + 'px, ' + (translate.y / scale) + 'px)',
              transformOrigin: 'center center', width: '100%', height: '100%', position: 'relative',
              transition: pinchRef.current.isPinching ? 'none' : 'transform 0.1s ease-out',
            }}>
              {zoneTables.map(table => renderTableShape(table))}
            </div>

            {/* Zone selector - OpenTable style bottom-right */}
            {!editMode && (
              <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-2">
                <button
                  onClick={() => { const idx = state.zones.findIndex(z => z.id === activeZone); switchZone(state.zones[(idx + 1) % state.zones.length].id); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-[14px] font-medium"
                  style={{ background: '#2a2a42' }}>
                  {currentZone?.name || 'Hauptetage'}
                  <ChevronUp className="w-4 h-4 text-[#8888aa]" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-2 flex items-center justify-between" style={{ background: '#1a1a2e', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
        <div className="flex items-center gap-2">
          <button onClick={() => { setEditMode(!editMode); setSelectedTable(null); setShowShapePicker(false); }}
            className={'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ' +
              (editMode ? 'bg-[#7bb7ef] text-white' : 'bg-[#2a2a42] text-[#b0b0cc] hover:bg-[#353558]')}>
            {editMode ? <><Check className="w-4 h-4" />Fertig</> : <><Edit3 className="w-4 h-4" />Edit</>}
          </button>
          <button onClick={() => onShowReservations ? onShowReservations() : setShowReservations(true)} className="p-2 rounded-lg bg-[#2a2a42] text-[#b0b0cc] hover:bg-[#353558] transition-colors relative">
            <Clock className="w-5 h-5" />
            {todayReservationCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan-500 text-white text-[9px] font-bold flex items-center justify-center">
                {todayReservationCount}
              </span>
            )}
          </button>
          <button onClick={() => setShowSidebar(!showSidebar)} className={'p-2 rounded-lg transition-colors ' + (showSidebar ? 'bg-[#7bb7ef] text-white' : 'bg-[#2a2a42] text-[#b0b0cc] hover:bg-[#353558]')}>
            <PanelLeftOpen className="w-5 h-5" />
          </button>
          <button onClick={() => setShowWaitlist(true)} className="p-2 rounded-lg bg-[#2a2a42] text-[#b0b0cc] hover:bg-[#353558] transition-colors relative">
            <ListOrdered className="w-5 h-5" />
            {waitlistCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#7bb7ef] text-white text-[9px] font-bold flex items-center justify-center">
                {waitlistCount}
              </span>
            )}
          </button>
        </div>
        <button onClick={() => onShowReservations ? onShowReservations() : setShowReservations(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[13px] font-semibold hover:brightness-110 transition-all"
          style={{ background: '#2b8c8c' }}>
          <CalendarCheck className="w-4 h-4" />
          Reservieren
        </button>
      </div>

      {showReservations && (
        <ReservationPanel
          onClose={() => setShowReservations(false)}
          onSeatReservation={(tableId) => {
            setShowReservations(false);
            dispatch({ type: 'SET_ACTIVE_TABLE', tableId });
          }}
        />
      )}

      {showWaitlist && (
        <WaitlistPanel
          onClose={() => setShowWaitlist(false)}
          onSeatGuest={(tableId) => {
            setShowWaitlist(false);
            dispatch({ type: 'SET_ACTIVE_TABLE', tableId });
          }}
          tables={state.tables}
        />
      )}

      {/* OpenTable Seat Overlay - Full-screen floor plan for table assignment */}
      {showSeatOverlay && selectedReservation && (() => {
        const r = selectedReservation;
        const overlayZoneTables = state.tables.filter(t => t.zone === seatOverlayZone);
        const assignedIds = r.tableIds && r.tableIds.length > 0 ? r.tableIds : (r.tableId ? [r.tableId] : []);
        const assignedNames = assignedIds.map(id => state.tables.find(t => t.id === id)?.name || '').filter(Boolean).join(', ');
        const isSeatedNow = ['seated', 'partially_seated', 'appetizer', 'entree', 'dessert', 'cleared', 'check_dropped', 'paid', 'bussing_needed'].includes(r.status);
        const overlayZoneName = state.zones.find(z => z.id === seatOverlayZone)?.name || 'Hauptbereich';

        const handleOverlayTableClick = (tableId: string) => {
          const currentIds = r.tableIds && r.tableIds.length > 0 ? [...r.tableIds] : (r.tableId ? [r.tableId] : []);
          let newIds: string[];
          if (currentIds.includes(tableId)) {
            newIds = currentIds.filter(id => id !== tableId);
          } else {
            newIds = [...currentIds, tableId];
          }
          const updated = reservations.map(res => res.id === r.id ? { ...res, tableId: newIds[0] || '', tableIds: newIds } : res);
          setReservations(updated);
          saveStorage({ ...loadStorage(), reservations: updated } as never);
        };

        const handleSeatNow = () => {
          const updated = reservations.map(res => res.id === r.id ? { ...res, status: 'seated' as const } : res);
          setReservations(updated);
          saveStorage({ ...loadStorage(), reservations: updated } as never);
          setShowSeatOverlay(false);
        };

        return (
          <div className="fixed inset-0 z-[100] flex" style={{ background: '#1a1a2e' }}>
            {/* Left sidebar - dark mode */}
            <div className="flex flex-col h-full" style={{ width: 240, minWidth: 240, background: '#1a1a2e', borderRight: '1px solid rgba(255,255,255,0.03)' }}>
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div />
                <button onClick={() => setShowSeatOverlay(false)} className="text-[#64748b] hover:text-[#e2e8f0] transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-4 pb-3">
                <h2 className="text-[#e2e8f0] font-bold text-[18px]">{r.guestName}</h2>
                <p className="text-[#94a3b8] text-[13px] mt-0.5">{r.time} Uhr, Gruppe von {r.partySize}</p>
              </div>
              {/* Pre-Assign / Seat tabs */}
              <div className="flex border-b border-white/[0.03] px-4">
                <button onClick={() => setSeatOverlayTab('preassign')}
                  className={'pb-2 px-2 text-[13px] font-medium border-b-2 transition-colors mr-4 ' +
                    (seatOverlayTab === 'preassign' ? 'border-[#e2e8f0] text-[#e2e8f0]' : 'border-transparent text-[#64748b] hover:text-[#94a3b8]')}>
                  Vorschlagen
                </button>
                <button onClick={() => setSeatOverlayTab('seat')}
                  className={'pb-2 px-2 text-[13px] font-medium border-b-2 transition-colors ' +
                    (seatOverlayTab === 'seat' ? 'border-[#7bb7ef] text-[#7bb7ef]' : 'border-transparent text-[#64748b] hover:text-[#94a3b8]')}>
                  Platzieren
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {assignedNames ? (
                  <div className="flex items-center gap-2 mb-3">
                    <Armchair className="w-4 h-4 text-[#94a3b8]" />
                    <span className="text-[#e2e8f0] text-[13px]">Tisch {assignedNames}</span>
                  </div>
                ) : (
                  <p className="text-[#64748b] text-[13px] mb-3">Tisch auf dem Plan anklicken</p>
                )}
                {/* Seat now button */}
                <button onClick={handleSeatNow}
                  className="w-full py-3 rounded-lg font-semibold text-[14px] flex items-center justify-center gap-2 transition-colors bg-[#7bb7ef] text-white hover:bg-[#93c5fd] mb-4">
                  {seatOverlayTab === 'seat' ? 'Jetzt platzieren' : 'Tisch vorschlagen'}
                </button>
                {/* Seating Preferences */}
                <div className="flex items-center gap-2 text-[13px]">
                  <Armchair className="w-4 h-4 text-[#94a3b8]" />
                  <div>
                    <div className="text-[#e2e8f0] font-medium">Sitzplatzpräferenzen</div>
                    <div className="text-[#64748b] text-[12px]">{state.zones.find(z => z.id === r.zone)?.name || 'Restaurantbereich'} Gebucht</div>
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 border-t border-white/[0.03]">
                <button onClick={() => setShowSeatOverlay(false)}
                  className="text-[#7bb7ef] text-[13px] font-medium hover:underline">Mehr Details</button>
              </div>
            </div>

            {/* Floor plan area - dark background like OpenTable */}
            <div className="flex-1 flex flex-col">
              {/* Top bar */}
              <div className="flex items-center justify-center px-4 py-2.5 border-b border-white/[0.03]" style={{ background: '#252545' }}>
                <span className="text-white text-[14px] font-medium">{r.guestName} jetzt platzieren</span>
              </div>
              {/* Floor plan canvas */}
              <div className="flex-1 overflow-hidden relative" style={{ background: '#1a1a2e' }}>
                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                  {overlayZoneTables.map(table => {
                    const shape = table.shape || 'rect';
                    const sizeKey = shape === 'barstool' ? 'barstool' : shape;
                    const size = SHAPE_SIZES[sizeKey] || SHAPE_SIZES.rect;
                    const isAssigned = assignedIds.includes(table.id);
                    const tableRes = tableReservationMap[table.id];
                    const isOccupiedByOther = tableRes && tableRes.id !== r.id;
                    const isAvail = !isOccupiedByOther && table.status !== 'blocked';

                    // Color logic like OpenTable: purple=occupied, gray=available, highlighted=assigned
                    let bgColor = '#6b7280'; // gray for available
                    let textColor = 'white';
                    if (isAssigned) {
                      bgColor = '#4a5568'; // darker for selected/assigned
                    }
                    if (isOccupiedByOther) {
                      bgColor = '#9333ea'; // purple for occupied
                    }
                    if (table.status === 'blocked') {
                      bgColor = '#2a2a42';
                      textColor = '#666688';
                    }

                    const w = size.w;
                    const h = size.h;
                    const isRound = shape === 'round' || shape === 'barstool';

                    return (
                      <div key={table.id}
                        onClick={() => isAvail && handleOverlayTableClick(table.id)}
                        className={'absolute flex flex-col items-center justify-center transition-all ' + (isAvail ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-60')}
                        style={{
                          left: table.x || 0, top: table.y || 0,
                          width: w, height: h,
                          background: bgColor, color: textColor,
                          borderRadius: isRound ? '50%' : 8,
                          border: isAssigned ? '3px solid #fff' : '1px solid rgba(255,255,255,0.15)',
                          boxShadow: isAssigned ? '0 0 12px rgba(255,255,255,0.3)' : 'none',
                        }}>
                        {isAvail && !isAssigned && (
                          <Plus className="w-3.5 h-3.5 text-white/60 mb-0.5" />
                        )}
                        <span className="text-[12px] font-bold">{table.name}</span>
                        {isAssigned && (
                          <span className="text-[9px] font-semibold mt-0.5 px-1.5 py-0.5 rounded" style={{ background: '#38bdf8', color: '#fff' }}>
                            {r.time}
                          </span>
                        )}
                        {isOccupiedByOther && tableRes && (
                          <span className="text-[9px] mt-0.5">{tableRes.time}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Zone selector bottom-right */}
              <div className="absolute bottom-4 right-4 z-10">
                <div className="flex items-center gap-1 bg-[#1a1a2e] rounded-lg shadow-lg px-3 py-2 border border-white/[0.03]">
                  <select value={seatOverlayZone} onChange={e => setSeatOverlayZone(e.target.value)}
                    className="text-[#e2e8f0] text-[13px] font-medium bg-transparent border-none outline-none cursor-pointer appearance-none pr-4">
                    {state.zones.map(z => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                  </select>
                  <ChevronUp className="w-4 h-4 text-[#64748b]" />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {tableManagementId && (() => {
        const managedTable = state.tables.find(t => t.id === tableManagementId);
        if (!managedTable) return null;
        return (
          <TableManagement
            table={managedTable}
            onClose={() => setTableManagementId(null)}
            onOpenTableDetail={(tableId) => {
              setTableManagementId(null);
              dispatch({ type: 'SET_ACTIVE_TABLE', tableId });
            }}
            onReserve={() => {
              setTableManagementId(null);
              setShowReservations(true);
            }}
            allTables={state.tables}
          />
        );
      })()}

      {resDetailId && (() => {
        const detailRes = reservations.find(r => r.id === resDetailId);
        if (!detailRes) return null;
        return (
          <ReservationDetail
            reservation={detailRes}
            allTables={state.tables}
            onClose={() => { setResDetailId(null); setHighlightedTableId(null); }}
            onUpdated={(updated) => setReservations(updated)}
            onEdit={() => {
              setResDetailId(null);
              setShowReservations(true);
            }}
            onSeat={() => {
              setResDetailId(null);
              setHighlightedTableId(null);
            }}
          />
        );
      })()}
    </div>
  );
}
