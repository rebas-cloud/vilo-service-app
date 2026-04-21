import React, { useState, useRef, useCallback, useEffect } from 'react';
import { IconAlertTriangle, IconArrowLeft, IconChevronDown, IconChevronRight, IconClock, IconCoffee, IconCreditCard, IconGlass, IconSearch, IconTrash, IconUsers, IconToolsKitchen } from '@tabler/icons-react';

import { useApp } from '../context/AppContext';

import { feedbackOrderAdded, feedbackOrderSent, feedbackItemDeleted } from '../utils/feedback';
import { formatTime } from '../utils/common';
import { TableServiceStatus } from '../types';

const SERVICE_STATUS_OPTIONS: { key: TableServiceStatus; label: string; group: string; color: string }[] = [
  { key: 'teilweise_platziert', label: 'Teilw. platziert', group: 'sitzplatz', color: '#94a3b8' },
  { key: 'platziert', label: 'Platziert', group: 'sitzplatz', color: '#a78bfa' },
  { key: 'getraenke', label: 'Getränke', group: 'gang', color: '#38bdf8' },
  { key: 'vorspeise', label: 'Vorspeise', group: 'gang', color: '#34d399' },
  { key: 'hauptgericht', label: 'Hauptgericht', group: 'gang', color: '#fbbf24' },
  { key: 'dessert', label: 'Dessert', group: 'gang', color: '#f472b6' },
  { key: 'gang_1', label: '1. Gang', group: 'gang_num', color: '#6ee7b7' },
  { key: 'gang_2', label: '2. Gang', group: 'gang_num', color: '#6ee7b7' },
  { key: 'gang_3', label: '3. Gang', group: 'gang_num', color: '#6ee7b7' },
  { key: 'gang_4', label: '4. Gang', group: 'gang_num', color: '#6ee7b7' },
  { key: 'gang_5', label: '5. Gang', group: 'gang_num', color: '#6ee7b7' },
  { key: 'gang_6', label: '6. Gang', group: 'gang_num', color: '#6ee7b7' },
  { key: 'gang_7', label: '7. Gang', group: 'gang_num', color: '#6ee7b7' },
  { key: 'gang_8', label: '8. Gang', group: 'gang_num', color: '#6ee7b7' },
  { key: 'gang_9', label: '9. Gang', group: 'gang_num', color: '#6ee7b7' },
  { key: 'gang_10', label: '10. Gang', group: 'gang_num', color: '#6ee7b7' },
  { key: 'gang_11', label: '11. Gang', group: 'gang_num', color: '#6ee7b7' },
  { key: 'gang_12', label: '12. Gang', group: 'gang_num', color: '#6ee7b7' },
  { key: 'digestif', label: 'Digestif', group: 'service', color: '#c084fc' },
  { key: 'flaschenservice', label: 'Flaschenservice', group: 'service', color: '#c084fc' },
  { key: 'rechnung_faellig', label: 'Rechnung faellig', group: 'zahlung', color: '#fb923c' },
  { key: 'bezahlt', label: 'Bezahlt', group: 'zahlung', color: '#22c55e' },
  { key: 'restaurantleiter', label: 'Restaurantleiter', group: 'aktion', color: '#ef4444' },
  { key: 'abraeumen', label: 'Abraeumen', group: 'aktion', color: '#f97316' },
  { key: 'abgeraeumt', label: 'Abgeraeumt', group: 'aktion', color: '#64748b' },
  { key: 'beendet', label: 'Beendet', group: 'aktion', color: '#475569' },
];

function getServiceStatusInfo(status?: TableServiceStatus) {
  if (!status) return null;
  return SERVICE_STATUS_OPTIONS.find(s => s.key === status) || null;
}

interface TableDetailProps {
  onBack: () => void;
  voiceIndicator?: React.ReactNode;
}

export function TableDetail({ onBack, voiceIndicator }: TableDetailProps) {
  const { state, dispatch } = useApp();
  const showMenu = true;
  const [mobilePane, setMobilePane] = useState<'order' | 'menu'>('order');
  const [menuCategory, setMenuCategory] = useState<string>('drinks');
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [stackedSectionIds, setStackedSectionIds] = useState<string[]>([]);
  const orderListRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const table = state.tables.find(t => t.id === state.activeTableId);
  const session = state.activeTableId ? state.sessions[state.activeTableId] : null;
  // sessionOrders is safe to use before the early return (needed by hooks below)
  const sessionOrders = session?.orders ?? [];

  const total = sessionOrders.reduce((sum, o) => sum + o.price * o.quantity, 0);

  const handleBack = () => {
    if (session && session.orders.some(o => o.state === 'ordered')) {
      dispatch({ type: 'SEND_ORDERS' });
      feedbackOrderSent();
    }
    onBack();
  };

  const handleOpenCheckout = () => {
    dispatch({ type: 'SHOW_BILLING', mode: 'combined' });
  };

  const handleAddItem = (itemId: string) => {
    const menuItem = state.menu.find(m => m.id === itemId);
    if (!menuItem) return;

    const inferredCourse =
      menuItem.category === 'starters' ? 'starter' :
      menuItem.category === 'mains' ? 'main' :
      menuItem.category === 'desserts' ? 'dessert' :
      undefined;

    const existingOrder = sessionOrders.find(order =>
      order.menuItemId === menuItem.id &&
      order.state === 'ordered' &&
      order.modifiers.length === 0 &&
      !order.notes &&
      order.course === inferredCourse
    );

    if (existingOrder) {
      dispatch({
        type: 'UPDATE_ORDER_QUANTITY',
        orderId: existingOrder.id,
        quantity: existingOrder.quantity + 1,
      });
      feedbackOrderAdded();
      return;
    }

    dispatch({
      type: 'ADD_ORDER_ITEMS',
      items: [{
        id: Math.random().toString(36).substring(2, 9),
        menuItemId: menuItem.id,
        name: menuItem.name,
        quantity: 1,
        price: menuItem.price,
        modifiers: [],
        state: 'ordered',
        routing: menuItem.routing,
        course: inferredCourse,
        timestamp: Date.now(),
      }],
    });
    feedbackOrderAdded();
  };

  const handleDecreaseItem = (itemId: string) => {
    const menuItem = state.menu.find(m => m.id === itemId);
    if (!menuItem) return;

    const inferredCourse =
      menuItem.category === 'starters' ? 'starter' :
      menuItem.category === 'mains' ? 'main' :
      menuItem.category === 'desserts' ? 'dessert' :
      undefined;

    const existingOrder = [...sessionOrders]
      .reverse()
      .find(order =>
        order.menuItemId === menuItem.id &&
        order.state === 'ordered' &&
        order.modifiers.length === 0 &&
        !order.notes &&
        order.course === inferredCourse
      );

    if (!existingOrder) return;

    if (existingOrder.quantity <= 1) {
      dispatch({ type: 'REMOVE_ORDER_ITEM', orderId: existingOrder.id });
      feedbackItemDeleted();
      return;
    }

    dispatch({
      type: 'UPDATE_ORDER_QUANTITY',
      orderId: existingOrder.id,
      quantity: existingOrder.quantity - 1,
    });
    feedbackItemDeleted();
  };

  const handleMarkServed = (orderId: string) => {
    dispatch({ type: 'UPDATE_ORDER_STATE', orderId, state: 'served' });
  };

  const handleMarkReady = (orderId: string) => {
    dispatch({ type: 'UPDATE_ORDER_STATE', orderId, state: 'ready' });
  };

  const handleAcknowledgeProblem = (order: { id: string; routing: string }) => {
    dispatch({
      type: 'UPDATE_ORDER_STATE',
      orderId: order.id,
      state: order.routing === 'bar' ? 'sent_to_bar' : 'sent_to_kitchen',
    });
  };

  const handleDeleteOrder = (orderId: string) => {
    dispatch({ type: 'REMOVE_ORDER_ITEM', orderId });
    feedbackItemDeleted();
  };

  const getStateIcon = (orderState: string) => {
    switch (orderState) {
      case 'ordered': return <IconClock className="w-3.5 h-3.5 text-amber-400" />;
      case 'sent_to_kitchen': return <IconToolsKitchen className="w-3.5 h-3.5 text-blue-400" />;
      case 'sent_to_bar': return <IconGlass className="w-3.5 h-3.5 text-purple-400" />;
      case 'problem': return <IconAlertTriangle className="w-3.5 h-3.5 text-[#ec4899]" />;
      case 'ready': return <IconCoffee className="w-3.5 h-3.5 text-emerald-400" />;
      case 'served': return <IconChevronRight className="w-3.5 h-3.5 text-vilo-text-muted" />;
      default: return null;
    }
  };

  const getStateLabel = (orderState: string) => {
    switch (orderState) {
      case 'ordered': return 'Bestellt';
      case 'sent_to_kitchen': return 'In Küche';
      case 'sent_to_bar': return 'An Bar';
      case 'problem': return 'Problem';
      case 'ready': return 'Fertig';
      case 'served': return 'Serviert';
      default: return orderState;
    }
  };

  const getCourseLabel = (course?: string) => {
    switch (course) {
      case 'starter': return 'Vorspeise';
      case 'main': return 'Hauptgang';
      case 'dessert': return 'Dessert';
      default: return null;
    }
  };

  const categoryIcons: Record<string, React.ReactNode> = {
    drinks: <IconGlass className="h-5 w-5" />,
    starters: <IconToolsKitchen className="h-5 w-5" />,
    mains: <IconGlass className="h-5 w-5" />,
    desserts: <IconCoffee className="h-5 w-5" />,
  };

  const categoryLabels: Record<string, string> = {
    drinks: 'Getränke',
    starters: 'Vorspeisen',
    mains: 'Hauptgerichte',
    desserts: 'Desserts',
  };

  const categoryTileStyles: Record<string, { surface: string; strong: string; soft: string; muted: string; ink: string }> = {
    drinks: {
      surface: 'linear-gradient(135deg, #4f8dff 0%, #6f7cff 100%)',
      strong: '#4f8dff',
      soft: '#9ec2ff',
      muted: 'linear-gradient(135deg, #2f446d 0%, #4a5e97 100%)',
      ink: '#ffffff',
    },
    starters: {
      surface: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
      strong: '#8b5cf6',
      soft: '#d0acff',
      muted: 'linear-gradient(135deg, #4a3278 0%, #6947aa 100%)',
      ink: '#ffffff',
    },
    mains: {
      surface: 'linear-gradient(135deg, #bf32d8 0%, #ea4cc8 100%)',
      strong: '#d946ef',
      soft: '#f0a1f6',
      muted: 'linear-gradient(135deg, #6d285f 0%, #984094 100%)',
      ink: '#ffffff',
    },
    desserts: {
      surface: 'linear-gradient(135deg, #df568f 0%, #f07d63 100%)',
      strong: '#e86a84',
      soft: '#ffb3c7',
      muted: 'linear-gradient(135deg, #7d3557 0%, #a8506d 100%)',
      ink: '#ffffff',
    },
  };

  const operatorLabel = state.staff[0]
    ? `${state.staff[0].name} | PIN ${state.staff[0].pin}`
    : state.restaurant?.name || 'Vilo Service';

  const menuItemsForCategory = state.menu.filter(item => item.category === menuCategory);
  const guestSourceLabel =
    session?.guestSource === 'walk_in' ? 'Walk-in' :
    session?.guestSource === 'phone' ? 'Telefon' :
    session?.guestSource === 'online' ? 'Online' :
    'Offen';
  const activePositionCount = sessionOrders.filter(order => order.state !== 'served').length;
  const currentServiceStatusInfo = getServiceStatusInfo(session?.serviceStatus);
  const accentAccordionColor =
    table?.status === 'billing'
      ? '#f59e0b'
      : currentServiceStatusInfo?.color || '#8b5cf6';
  const quantityByMenuItem = sessionOrders.reduce<Record<string, number>>((acc, order) => {
    acc[order.menuItemId] = (acc[order.menuItemId] || 0) + order.quantity;
    return acc;
  }, {});

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleSelectCategory = (category: string) => {
    setMenuCategory(category);
  };

  const leftSections = [
    {
      id: 'order',
      title: 'BESTELLUNG',
      accent: 'text-sky-300',
      color: '#8b5cf6',
      helper: 'Offene Positionen',
      orders: sessionOrders.filter(order => !order.course).sort((a, b) => a.timestamp - b.timestamp),
    },
    {
      id: 'starter',
      title: 'GANG 1',
      accent: 'text-emerald-300',
      color: '#8b5cf6',
      helper: 'Vorspeisen',
      orders: sessionOrders.filter(order => order.course === 'starter').sort((a, b) => a.timestamp - b.timestamp),
    },
    {
      id: 'main',
      title: 'GANG 2',
      accent: 'text-amber-300',
      color: '#8b5cf6',
      helper: 'Hauptgerichte',
      orders: sessionOrders.filter(order => order.course === 'main').sort((a, b) => a.timestamp - b.timestamp),
    },
    {
      id: 'dessert',
      title: 'GANG 3',
      accent: 'text-pink-300',
      color: '#a855f7',
      helper: 'Desserts',
      orders: sessionOrders.filter(order => order.course === 'dessert').sort((a, b) => a.timestamp - b.timestamp),
    },
  ].filter(section => section.orders.length > 0);
  const stickySectionHeight = 58;

  const updateStackedSections = useCallback(() => {
    const container = orderListRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const nextStacked = leftSections
      .filter((section, index) => {
        const sectionEl = sectionRefs.current[section.id];
        if (!sectionEl) return false;
        return scrollTop >= sectionEl.offsetTop - index * stickySectionHeight;
      })
      .map(section => section.id);

    setStackedSectionIds(prev =>
      prev.length === nextStacked.length && prev.every((id, index) => id === nextStacked[index])
        ? prev
        : nextStacked
    );
  }, [leftSections]);

  useEffect(() => {
    updateStackedSections();
    const container = orderListRef.current;
    if (!container) return;

    container.addEventListener('scroll', updateStackedSections, { passive: true });
    window.addEventListener('resize', updateStackedSections);

    return () => {
      container.removeEventListener('scroll', updateStackedSections);
      window.removeEventListener('resize', updateStackedSections);
    };
  }, [updateStackedSections]);

  if (!table || !session) return null;

  const renderSectionHeader = (section: typeof leftSections[number], stacked = false) => (
    <button
      onClick={() => toggleSection(section.id)}
      className="flex w-full items-center justify-between border-b border-[#3a3558] px-4 py-3 text-left transition-colors"
      style={stacked ? {
        background: '#312c4b',
        boxShadow: `inset 4px 0 0 ${section.color}, 0 1px 0 #3a3558`,
      } : {
        background: section.color + '33',
        boxShadow: `inset 4px 0 0 ${section.color}`,
      }}
    >
      <div className="min-w-0">
        <p
          className="text-[12px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: '#ffffff' }}
        >
          {section.title}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold text-white">{section.orders.length}</span>
        <IconChevronDown
          className={`h-4 w-4 transition-transform ${collapsedSections[section.id] ? '' : 'rotate-180'}`}
          style={{ color: '#ffffff' }}
        />
      </div>
    </button>
  );

  return (
    <div className="h-full bg-[#1a1a2e] flex flex-col">
      {/* Header */}
      <header className="bg-vilo-surface/80 backdrop-blur border-b border-vilo-border-subtle">
        <div className="flex">
          <div className={`px-4 py-3 border-r border-vilo-border-subtle ${showMenu ? 'w-full lg:basis-[28%] lg:max-w-[28%]' : 'flex-1'}`}>
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={handleBack}
                className="p-1.5 rounded-lg border border-vilo-border-subtle bg-[#312e4f] text-[#d8c7ff] hover:bg-[#3a365c] transition-colors"
              >
                <IconArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="text-white font-semibold text-lg leading-tight">Tisch {table.name.replace(/^Tisch\s*/i, '')}</h2>
                <div className="flex items-center gap-3 text-vilo-text-secondary text-xs">
                  <span className="truncate">Seit {formatTime(session.startTime)} · {session.orders.length} Positionen</span>
                </div>
              </div>
            </div>
          </div>
          {showMenu && (
            <div className="hidden lg:flex flex-1 items-center justify-between gap-3 px-4 py-3 bg-[#24223c]">
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-white">{categoryLabels[menuCategory]}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex flex-shrink-0 items-center gap-1.5 text-sm text-[#cfd3e6]">
                  <IconUsers className="w-4 h-4 text-[#8b5cf6]" />
                  {operatorLabel}
                </span>
                <button className="p-2 text-[#8b5cf6] hover:text-white transition-colors">
                  <IconSearch className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="lg:hidden border-b border-vilo-border-subtle bg-[#1d1f33] px-3 py-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMobilePane('order')}
            className={`rounded-xl border px-4 py-2.5 text-left transition-colors ${
              mobilePane === 'order'
                ? 'border-[#b78dff]/40 bg-[#8b5cf6] text-white'
                : 'border-vilo-border-subtle bg-[#2b2944] text-[#cfd3e6] hover:bg-[#353154]'
            }`}
          >
            <span className="block text-sm font-semibold leading-tight">Bestellung</span>
            <span className={`mt-0.5 block text-[11px] leading-tight ${mobilePane === 'order' ? 'text-white/80' : 'text-[#9f9aba]'}`}>
              {activePositionCount} offen · {total.toFixed(2)} €
            </span>
          </button>
          <button
            onClick={() => setMobilePane('menu')}
            className={`rounded-xl border px-4 py-2.5 text-left transition-colors ${
              mobilePane === 'menu'
                ? 'border-[#b78dff]/40 bg-[#8b5cf6] text-white'
                : 'border-vilo-border-subtle bg-[#2b2944] text-[#cfd3e6] hover:bg-[#353154]'
            }`}
          >
            <span className="block text-sm font-semibold leading-tight">Menü</span>
            <span className={`mt-0.5 block text-[11px] leading-tight ${mobilePane === 'menu' ? 'text-white/80' : 'text-[#9f9aba]'}`}>
              {categoryLabels[menuCategory]}
            </span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <section className={`min-w-0 min-h-0 flex-1 flex-col border-b border-[#2c2e49] bg-[#1a1b2d] lg:border-b-0 lg:border-r ${mobilePane === 'menu' ? 'hidden lg:flex' : 'flex'} ${showMenu ? 'lg:max-w-[28%] lg:basis-[28%] lg:flex-none' : 'lg:flex-1'}`}>
          <div className="border-b border-[#2c2e49] bg-[#1d1f33]">
          <div
            className="px-4 py-3"
            style={{
                background: accentAccordionColor + '26',
                boxShadow: `inset 4px 0 0 ${accentAccordionColor}`,
              }}
            >
              <button
                onClick={() => setShowStatusPicker(!showStatusPicker)}
                className="flex w-full items-center justify-between gap-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {session.serviceStatus ? (
                    <span
                      className="truncate text-sm font-semibold uppercase tracking-[0.12em] text-white"
                    >
                      {currentServiceStatusInfo?.label || session.serviceStatus}
                    </span>
                  ) : (
                    <span className="text-sm font-semibold uppercase tracking-[0.12em] text-white">Kein Status</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {session.serviceStatus && (
                    <span className="text-[11px] font-semibold text-white">1</span>
                  )}
                  <IconChevronDown
                    className={'h-4 w-4 flex-shrink-0 text-white transition-transform ' + (showStatusPicker ? 'rotate-180' : '')}
                  />
                </div>
              </button>

              {showStatusPicker && (
                <div className="mt-2 max-h-[300px] overflow-y-auto">
                  {[
                    { label: 'Sitzplatz', keys: SERVICE_STATUS_OPTIONS.filter(s => s.group === 'sitzplatz') },
                    { label: 'Gang (Standard)', keys: SERVICE_STATUS_OPTIONS.filter(s => s.group === 'gang') },
                    { label: 'Gang (Nummer)', keys: SERVICE_STATUS_OPTIONS.filter(s => s.group === 'gang_num') },
                    { label: 'Service', keys: SERVICE_STATUS_OPTIONS.filter(s => s.group === 'service') },
                    { label: 'Zahlung', keys: SERVICE_STATUS_OPTIONS.filter(s => s.group === 'zahlung') },
                    { label: 'Aktion', keys: SERVICE_STATUS_OPTIONS.filter(s => s.group === 'aktion') },
                  ].map(group => (
                    <div key={group.label} className="pt-2 first:pt-1">
                      <p className="px-3 pb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#ffffff]/70">{group.label}</p>
                      <div className="space-y-0.5">
                        {group.keys.map(opt => {
                          const isActive = session.serviceStatus === opt.key;
                          return (
                            <button
                              key={opt.key}
                              onClick={() => {
                                dispatch({ type: 'SET_SERVICE_STATUS', tableId: table.id, serviceStatus: opt.key });
                                setShowStatusPicker(false);
                              }}
                              className="w-full px-3 py-2 text-left transition-colors hover:bg-white/10"
                              style={isActive ? { background: 'rgba(0,0,0,0.12)' } : undefined}
                            >
                              <span
                                className="block text-[13px] leading-tight"
                                style={{ color: '#ffffff', fontWeight: isActive ? 700 : 500 }}
                              >
                                {opt.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="mx-3 mt-2 h-px bg-white/10" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-px bg-[#2c2e49]">
              <button className="bg-[#23253a] px-3 py-3 text-left hover:bg-[#282b45] transition-colors">
                <span className="block text-[10px] uppercase tracking-[0.18em] text-vilo-text-muted">Partei</span>
                <span className="mt-1.5 block text-sm font-semibold text-white">{guestSourceLabel}</span>
              </button>
              <button className="bg-[#23253a] px-3 py-3 text-left hover:bg-[#282b45] transition-colors">
                <span className="block text-[10px] uppercase tracking-[0.18em] text-vilo-text-muted">Umbuchen</span>
                <span className="mt-1.5 block text-sm font-semibold text-white">Später</span>
              </button>
              <button className="bg-[#23253a] px-3 py-3 text-left hover:bg-[#282b45] transition-colors">
                <span className="block text-[10px] uppercase tracking-[0.18em] text-vilo-text-muted">Gäste</span>
                <select
                  value={session.guestCount || 0}
                  onChange={e => dispatch({ type: 'SET_GUEST_COUNT', tableId: table.id, guestCount: Number(e.target.value) })}
                  className="mt-1.5 block text-sm font-semibold text-white bg-transparent border-none outline-none cursor-pointer"
                >
                  {(session.guestCount === 0 ? [0] : []).concat(Array.from({length: 20}, (_, i) => i + 1)).map(n => (
                    <option key={n} value={n} className="bg-[#1a1b2d] text-white">{n}</option>
                  ))}
                </select>
              </button>
            </div>

            {session.notes.length > 0 && (
              <div className="border-t border-[#2c2e49] px-4 py-2.5">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-vilo-text-muted">Notizen</p>
                <div className="flex flex-wrap gap-2">
                  {session.notes.map((note, i) => (
                    <span key={i} className="rounded-full bg-amber-800/30 px-2 py-0.5 text-xs text-amber-200">
                      {note}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div ref={orderListRef} className="flex-1 overflow-y-auto bg-[#1a1b2d]">
            {session.orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-vilo-text-muted">
                <IconToolsKitchen className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">Noch keine Bestellungen</p>
              </div>
            ) : (
              <div className="divide-y divide-[#3a3558]">
                {stackedSectionIds.length > 0 && (
                  <div className="sticky top-0 z-30 border-b border-[#3a3558] bg-[#1a1b2d]">
                    {leftSections
                      .filter(section => stackedSectionIds.includes(section.id))
                      .map(section => (
                        <div key={`stacked-${section.id}`} className="border-b border-[#3a3558] last:border-b-0">
                          {renderSectionHeader(section, true)}
                        </div>
                      ))}
                  </div>
                )}
                {leftSections.map(section => (
                  <div
                    key={section.id}
                    ref={node => {
                      sectionRefs.current[section.id] = node;
                    }}
                    className="overflow-hidden"
                  >
                    <div className={stackedSectionIds.includes(section.id) ? 'pointer-events-none opacity-0' : ''}>
                      {renderSectionHeader(section)}
                    </div>
                    {!collapsedSections[section.id] && (
                      <div className="divide-y divide-[#3a3558] bg-[#1a1b2d]">
                        {section.orders.map(order => (
                          <OrderRow
                            key={order.id}
                            order={order}
                            getStateIcon={getStateIcon}
                            getStateLabel={getStateLabel}
                            getCourseLabel={getCourseLabel}
                            formatTime={formatTime}
                            onAction={
                              order.state === 'problem' ? () => handleAcknowledgeProblem(order) :
                              order.state === 'ready' ? () => handleMarkServed(order.id) :
                              (order.state === 'sent_to_kitchen' || order.state === 'sent_to_bar') ? () => handleMarkReady(order.id) :
                              undefined
                            }
                            actionLabel={
                              order.state === 'problem' ? 'Quittieren' :
                              order.state === 'ready' ? 'Serviert' :
                              (order.state === 'sent_to_kitchen' || order.state === 'sent_to_bar') ? 'Fertig' :
                              undefined
                            }
                            onDelete={() => handleDeleteOrder(order.id)}
                            dimmed={order.state === 'served'}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <div className="border-t border-[#3a3558]">
                  <button
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors"
                    style={{
                      background: '#8b5cf633',
                      boxShadow: 'inset 4px 0 0 #8b5cf6',
                    }}
                  >
                    <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white">Gang hinzufügen</span>
                    <span className="text-[18px] leading-none text-white">+</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-vilo-border-subtle bg-[#171827]">
            <div className="px-2 pt-[3px] pb-2">
              <div className="mt-2 mb-2 flex items-center gap-2">
                <span className="inline-flex h-8 items-center rounded-lg border border-vilo-border-subtle bg-vilo-card px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  Hier
                </span>
                <span className="inline-flex h-8 items-center rounded-lg border border-vilo-border-subtle bg-vilo-card px-3 text-[11px] font-semibold text-vilo-text-soft shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  {activePositionCount} offen
                </span>
              </div>
              <div>
                <button
                  onClick={handleOpenCheckout}
                  className="w-full min-h-[44px] min-w-0 rounded-lg border border-vilo-border-strong bg-[#302c4b] px-3 py-2 text-left text-white shadow-[0_10px_24px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:bg-[#353154]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block text-[8px] uppercase tracking-[0.16em] text-[#9f9aba]">Gesamt</span>
                      <span className="mt-1 flex items-center justify-start gap-1.5 whitespace-nowrap text-[14px] font-bold leading-none text-white">
                        <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-md bg-[#8b5cf6]/15 text-[#cf8cff]">
                          <IconCreditCard className="h-3 w-3" />
                        </span>
                        <span>{total.toFixed(2)} €</span>
                      </span>
                    </div>
                    <IconChevronRight className="h-4 w-4 shrink-0 text-[#b8addd]" />
                  </div>
                </button>
              </div>
            </div>
          </div>

          {voiceIndicator && (
            <div className="border-t border-[#2c2e49]">
              {voiceIndicator}
            </div>
          )}
        </section>

        {(showMenu || mobilePane === 'menu') && (
          <aside className={`w-full flex-col bg-[#1d1c32] min-h-0 lg:min-h-[48vh] ${mobilePane === 'menu' ? 'flex' : 'hidden'} ${showMenu ? 'lg:flex lg:flex-1' : 'lg:hidden'}`}>
            <div className="border-b border-vilo-border-subtle bg-[#24223c] lg:hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div />
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-white">{categoryLabels[menuCategory]}</p>
                </div>
                <div />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 bg-[#1d1c32]">
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {Object.entries(categoryLabels).map(([key, label]) => {
                    const style = categoryTileStyles[key];
                    const isActive = menuCategory === key;
                    return (
                      <button
                        key={key}
                        onClick={() => handleSelectCategory(key)}
                        className="min-h-[132px] p-4 text-left transition-transform hover:scale-[1.01]"
                        style={{
                          background: isActive ? style.surface : style.muted,
                          boxShadow: isActive ? `inset 0 0 0 2px ${style.soft}66` : `inset 0 0 0 1px ${style.soft}22`,
                        }}
                      >
                        <div className="flex h-full flex-col justify-between">
                          <div>
                            <div className="inline-flex h-10 w-10 items-center justify-center" style={{ color: style.ink }}>
                              {categoryIcons[key]}
                            </div>
                            <p className="mt-6 text-[16px] font-semibold leading-tight" style={{ color: style.ink }}>{label}</p>
                          </div>
                          <p className="text-sm" style={{ color: style.ink + 'aa' }}>
                            {state.menu.filter(item => item.category === key).length} Artikel
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {menuItemsForCategory.map(item => {
                    const style = categoryTileStyles[item.category];
                    const quantity = quantityByMenuItem[item.id] || 0;
                    const isSelected = quantity > 0;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleAddItem(item.id)}
                        className="min-h-[132px] p-4 text-left transition-transform hover:scale-[1.01]"
                        style={{
                          background: isSelected ? style.surface : style.muted,
                          color: style.ink,
                          boxShadow: isSelected ? `inset 0 0 0 2px ${style.soft}66` : `inset 0 0 0 1px ${style.soft}22`,
                        }}
                      >
                        <div className="flex h-full flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="inline-flex h-10 w-10 items-center justify-center">
                                {categoryIcons[item.category]}
                              </div>
                              {quantity > 0 && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleDecreaseItem(item.id);
                                  }}
                                  className="flex h-9 w-9 items-center justify-center rounded-full border text-[13px] font-bold transition-colors hover:bg-black/20"
                                  style={{
                                    background: 'rgba(0,0,0,0.16)',
                                    borderColor: 'rgba(255,255,255,0.12)',
                                    color: style.ink,
                                  }}
                                  aria-label={`${item.name} um eins reduzieren`}
                                >
                                  {quantity}
                                </button>
                              )}
                            </div>
                            <p className="mt-6 text-[16px] font-semibold leading-tight">
                              {item.name}
                            </p>
                          </div>
                          <div>
                            <span className="text-sm font-semibold whitespace-nowrap" style={{ color: style.ink + 'dd' }}>
                              {item.price.toFixed(2)} €
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

          </aside>
        )}
      </div>
    </div>
  );
}

interface OrderRowProps {
  order: {
    id: string;
    name: string;
    quantity: number;
    price: number;
    state: string;
    modifiers: string[];
    course?: string;
    seatId?: number;
    timestamp: number;
    routing: string;
    notes?: string;
  };
  getStateIcon: (state: string) => React.ReactNode;
  getStateLabel: (state: string) => string;
  getCourseLabel: (course?: string) => string | null;
  formatTime: (ts: number) => string;
  onAction?: () => void;
  actionLabel?: string;
  onDelete?: () => void;
  dimmed?: boolean;
}

const DELETE_THRESHOLD = -80;

function OrderRow({ order, getStateIcon, getStateLabel, getCourseLabel, formatTime, onAction, actionLabel, onDelete, dimmed }: OrderRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const [offsetX, setOffsetX] = useState(0);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = 0;
    isDraggingRef.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const diff = e.touches[0].clientX - startXRef.current;
    // Only allow left swipe
    const clamped = Math.min(0, Math.max(-120, diff));
    currentXRef.current = clamped;
    setOffsetX(clamped);
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
    if (currentXRef.current <= DELETE_THRESHOLD && onDelete) {
      setIsRemoving(true);
      setOffsetX(-400);
      setTimeout(() => onDelete(), 250);
    } else {
      setOffsetX(0);
    }
  }, [onDelete]);

  // Mouse support for desktop
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    startXRef.current = e.clientX;
    currentXRef.current = 0;
    isDraggingRef.current = true;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const diff = ev.clientX - startXRef.current;
      const clamped = Math.min(0, Math.max(-120, diff));
      currentXRef.current = clamped;
      setOffsetX(clamped);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      if (currentXRef.current <= DELETE_THRESHOLD && onDelete) {
        setIsRemoving(true);
        setOffsetX(-400);
        setTimeout(() => onDelete(), 250);
      } else {
        setOffsetX(0);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onDelete]);

  return (
    <div className={`relative overflow-hidden ${isRemoving ? 'h-0 opacity-0' : ''}`}
      style={{ transition: isRemoving ? 'height 0.25s ease, opacity 0.25s ease, margin 0.25s ease' : undefined }}
    >
      {/* Red delete background - only visible when swiping */}
      {offsetX < 0 && (
        <div className="absolute inset-0 bg-red-600 flex items-center justify-end pr-5">
          <IconTrash className="w-5 h-5 text-white" />
        </div>
      )}

      {/* Swipeable content */}
      <div
        ref={rowRef}
        className={`relative grid grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 bg-transparent hover:bg-[#23253a]/65 ${dimmed ? 'opacity-50' : ''} select-none`}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDraggingRef.current ? 'none' : 'transform 0.25s ease',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#3a3d61] bg-[#262944]">
          <span className="text-[13px] font-bold leading-none text-[#ffffff]">{order.quantity}</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-white text-sm font-medium leading-tight">
              {order.name}
            </p>
            {order.seatId && (
              <span className="rounded bg-[#8b5cf6]/12 px-1.5 py-0.5 text-[10px] font-semibold text-[#c4b5fd]">
                Gast {order.seatId}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="flex-shrink-0">{getStateIcon(order.state)}</span>
            <span className="text-vilo-text-secondary text-xs">{formatTime(order.timestamp)}</span>
            <span className="text-[#777] text-xs">·</span>
            <span className="text-vilo-text-secondary text-xs">{getStateLabel(order.state)}</span>
            {getCourseLabel(order.course) && (
              <>
                <span className="text-[#777] text-xs">·</span>
                <span className="text-vilo-text-secondary text-xs">{getCourseLabel(order.course)}</span>
              </>
            )}
            {order.modifiers.length > 0 && (
              <>
                <span className="text-[#777] text-xs">·</span>
                <span className="text-amber-400 text-xs">{order.modifiers.join(', ')}</span>
              </>
            )}
            {order.notes && (
              <>
                <span className="text-[#777] text-xs">·</span>
                <span className="text-[#f5d78a] text-xs">{order.notes}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <span className="text-vilo-text-soft text-sm font-medium">{(order.price * order.quantity).toFixed(2)} €</span>
          <div className="flex items-center gap-2">
            {onAction && (
              <button
                onClick={onAction}
                className="rounded-md bg-vilo-elevated px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-vilo-text-soft hover:bg-[#3a365c] transition-colors"
              >
                {actionLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
