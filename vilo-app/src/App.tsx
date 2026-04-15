import { useCallback, useState, useRef, useEffect, lazy, Suspense } from 'react';
import { IconAlertTriangle, IconChartBar, IconCalendar, IconChefHat, IconChevronDown, IconChevronLeft, IconChevronRight, IconClipboardList, IconEye, IconLayoutGrid, IconLogout, IconMap2, IconMenu2, IconSearch, IconSettings, IconSparkles, IconX } from '@tabler/icons-react';

import './App.css';
import { AppProvider, useApp } from './context/AppContext';
import { useVoice } from './hooks/useVoice';
import { parseIntent } from './utils/intentParser';
import { parseIntentLLM, isLLMAvailable } from './utils/llmParser';
import { initAudioContext } from './utils/feedback';
import { loadStorage, saveStorage, generateRestaurantCode, hashPassword, completeSetup, clearStorage, registerViaApi, saveConfigToApi } from './utils/storage';
import { useSync } from './hooks/useSync';
import { WelcomePage } from './components/WelcomePage';
import { RegistrationPage } from './components/RegistrationPage';
import { WaiterLoginPage } from './components/WaiterLoginPage';
import { LoginPage } from './components/LoginPage';
import { BrandWordmark } from './components/BrandWordmark';
import { FloorPlan } from './components/FloorPlan';
import { TableDetail } from './components/TableDetail';
import { VoiceIndicator } from './components/VoiceIndicator';
import { BillingModal } from './components/BillingModal';

// Lazy-loaded components (code-splitting)
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const OnboardingWizard = lazy(() => import('./components/OnboardingWizard').then(m => ({ default: m.OnboardingWizard })));
const KitchenBarDisplay = lazy(() => import('./components/KitchenBarDisplay').then(m => ({ default: m.KitchenBarDisplay })));
const ManagerSettings = lazy(() => import('./components/ManagerSettings').then(m => ({ default: m.ManagerSettings })));
const ReservationList = lazy(() => import('./components/ReservationList').then(m => ({ default: m.ReservationList })));
const Timeline = lazy(() => import('./components/Timeline').then(m => ({ default: m.Timeline })));
const ProblemReservations = lazy(() => import('./components/ProblemReservations').then(m => ({ default: m.ProblemReservations })));

import { Restaurant, Zone, Table, MenuItem, Staff, TableCombination, ViloStorage } from './types';
import { restaurant as demoRestaurantData, zones as demoZones, tables as demoTables, menu as demoMenu, staff as demoStaff } from './data/mockData';

type AppScreen = 'welcome' | 'register' | 'onboarding' | 'waiter-login' | 'pos';
type SubTab = 'statistiken' | 'uebersicht' | 'liste' | 'raumplan' | 'timeline' | 'probleme' | 'reservierungen' | 'bearbeiten';

function POSContent({ onLogout }: { onLogout: () => void }) {
  const { state, dispatch, executeIntent } = useApp();
  const [subTab, setSubTab] = useState<SubTab>('statistiken');
  const [showSettings, setShowSettings] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showKitchenBar, setShowKitchenBar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedShift, setSelectedShift] = useState<'Mittag' | 'Abend'>('Abend');
  const [showShiftPicker, setShowShiftPicker] = useState(false);
  const [activePosHeaderTool, setActivePosHeaderTool] = useState<'search' | 'receipts' | 'orders' | 'map'>('receipts');
  const [voiceToastVisible, setVoiceToastVisible] = useState(false);
  const voiceToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHomeSection = ['statistiken', 'uebersicht', 'probleme'].includes(subTab);
  const isReservationSection = ['liste', 'timeline'].includes(subTab);
  const isFloorPlanSection = ['raumplan', 'bearbeiten'].includes(subTab);

  // WebSocket sync hook - connects to backend and syncs state in real-time
  useSync();

  const stateRef = useRef(state);
  stateRef.current = state;

  // Initialize audio context on first user interaction (needed for iOS Safari)
  useEffect(() => {
    const handler = () => {
      initAudioContext();
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('click', handler);
    };
    document.addEventListener('touchstart', handler, { once: true });
    document.addEventListener('click', handler, { once: true });
    return () => {
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('click', handler);
    };
  }, []);

  const speakConfirmation = useCallback((confirmation: string) => {
    if ('speechSynthesis' in window && confirmation && !confirmation.startsWith('__')) {
      const utterance = new SpeechSynthesisUtterance(confirmation);
      utterance.lang = 'de-DE';
      utterance.rate = 1.1;
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const handleVoiceCommand = useCallback((command: string) => {
    dispatch({ type: 'SET_LAST_COMMAND', command });

    const tableIds = stateRef.current.tables.map(t => t.id);
    const useLLM = isLLMAvailable();

    if (useLLM) {
      // Show "thinking" state
      dispatch({ type: 'SET_LAST_CONFIRMATION', confirmation: 'Denke nach...' });

      parseIntentLLM(command, stateRef.current.menu, tableIds, stateRef.current.activeTableId)
        .then(intent => {
          const confirmation = executeIntent(intent, command);
          dispatch({ type: 'SET_LAST_CONFIRMATION', confirmation });
          speakConfirmation(confirmation);
        })
        .catch(err => {
          console.warn('[VILO] LLM failed, falling back to rule-based:', err);
          // Fallback to rule-based parser
          const intent = parseIntent(command, stateRef.current.menu);
          const confirmation = executeIntent(intent, command);
          dispatch({ type: 'SET_LAST_CONFIRMATION', confirmation });
          speakConfirmation(confirmation);
        });
    } else {
      // Rule-based parser (no API key)
      const intent = parseIntent(command, stateRef.current.menu);
      const confirmation = executeIntent(intent, command);
      dispatch({ type: 'SET_LAST_CONFIRMATION', confirmation });
      speakConfirmation(confirmation);
    }
  }, [dispatch, executeIntent, speakConfirmation]);

  const voice = useVoice(handleVoiceCommand);

  const handleUndo = useCallback(() => {
    dispatch({ type: 'UNDO' });
    dispatch({ type: 'SET_LAST_CONFIRMATION', confirmation: 'Letzte Aktion rückgängig gemacht.' });
  }, [dispatch]);

  const handleSelectTable = useCallback((tableId: string) => {
    dispatch({ type: 'SET_ACTIVE_TABLE', tableId });
    setSubTab('raumplan');
  }, [dispatch]);

  // Handle zone change from FloorPlan
  const handleZoneChange = useCallback((_zoneId: string, _zoneName: string) => {}, []);

  // Show voice toast for a few seconds after each command
  useEffect(() => {
    if (state.lastConfirmation && state.lastConfirmation !== 'Denke nach...') {
      setVoiceToastVisible(true);
      if (voiceToastTimer.current) clearTimeout(voiceToastTimer.current);
      voiceToastTimer.current = setTimeout(() => setVoiceToastVisible(false), 4000);
    }
  }, [state.lastConfirmation]);

  // Also show while actively listening
  useEffect(() => {
    if (voice.mode !== 'idle') {
      setVoiceToastVisible(true);
      if (voiceToastTimer.current) clearTimeout(voiceToastTimer.current);
    }
  }, [voice.mode]);

  // Not logged in
  if (!state.currentUser) {
    return <LoginPage onLogout={onLogout} />;
  }

  const getDateHeader = () => {
    const d = selectedDate;
    const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const months = ['Jan', 'Feb', 'März', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    return `${days[d.getDay()]}. ${d.getDate()}. ${months[d.getMonth()]}`;
  };

  const changeDate = (offset: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + offset);
    setSelectedDate(newDate);
  };

  const posHeaderActions = [
    { key: 'search' as const, Icon: IconSearch, label: 'Suche' },
    { key: 'receipts' as const, Icon: IconCalendar, label: 'Belege' },
    { key: 'orders' as const, Icon: IconClipboardList, label: 'Bestellungen' },
    { key: 'map' as const, Icon: IconMap2, label: 'Karte' },
  ];

  const renderDatePickerModal = () => (
    showDatePicker ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8" onClick={() => setShowDatePicker(false)}>
        <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
        <div className="relative w-full max-w-xl overflow-hidden rounded-[28px] border border-vilo-border-subtle bg-vilo-surface shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-vilo-border-subtle px-6 py-5 shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-bold text-white">Datum</h2>
            </div>
            <button
              onClick={() => setShowDatePicker(false)}
              className="ml-3 p-1 text-vilo-text-secondary hover:text-vilo-text-primary transition-colors shrink-0"
            >
              <IconX className="w-6 h-6" />
            </button>
          </div>
          <div className="px-6 py-6">
            <div className="rounded-[24px] border border-vilo-border-subtle bg-vilo-card p-5">
              <input
                type="date"
                value={selectedDate.toISOString().split('T')[0]}
                onChange={(e) => {
                  if (e.target.value) {
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    setSelectedDate(new Date(y, m - 1, d));
                  }
                }}
                className="w-full rounded-xl border border-vilo-border-subtle bg-vilo-elevated px-4 py-4 text-center text-[16px] font-semibold text-white outline-none transition-colors focus:border-[#8b5cf6]"
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => { setSelectedDate(new Date()); setShowDatePicker(false); }}
                className="flex-1 rounded-lg border border-vilo-border-subtle bg-[#3a3656] px-4 py-3 text-sm font-semibold text-[#d8c7ff] transition-colors hover:text-white"
              >
                Heute
              </button>
              <button
                onClick={() => setShowDatePicker(false)}
                className="flex-1 rounded-lg border border-vilo-border-subtle bg-vilo-elevated px-4 py-3 text-sm font-semibold text-vilo-text-secondary transition-colors hover:text-white"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      </div>
    ) : null
  );

  const renderPosHeader = (showLogo: boolean = true) => (
    <header
      className="relative grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-vilo-border-subtle px-3 py-2"
      style={{ background: '#1a1a2e', paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}
    >
      <div className="flex min-w-0 items-center">
        {showLogo && (
          <div className="flex items-center shrink-0">
            <BrandWordmark className="text-[1.9rem]" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 items-center justify-center">
        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto hide-scrollbar">
          <button
            onClick={() => changeDate(-1)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-vilo-border-subtle bg-[#27233c] text-vilo-text-secondary transition-colors hover:bg-[#312d48] hover:text-white"
          >
            <IconChevronLeft className="h-4 w-4" />
          </button>

          <button
            onClick={() => {
              setShowShiftPicker(false);
              setShowDatePicker(true);
            }}
            className="flex h-8 shrink-0 items-center rounded-lg border border-vilo-border-subtle bg-[#27233c] px-3 text-white transition-colors hover:bg-[#312d48]"
          >
            <span className="truncate text-[12px] font-semibold leading-none">{getDateHeader()}</span>
          </button>

          <div className="flex h-8 w-8 shrink-0 items-center justify-center">
            <span className="h-3.5 w-3.5 rounded-full bg-[#49d36d]" />
          </div>

          <div className="relative shrink-0">
            <button
              onClick={() => setShowShiftPicker(prev => !prev)}
              className="flex h-8 min-w-[124px] items-center justify-between rounded-lg border border-vilo-border-subtle bg-[#27233c] px-3 text-white transition-colors hover:bg-[#312d48]"
            >
              <span className="truncate text-[12px] font-semibold leading-none">{selectedShift}</span>
              <IconChevronDown className={`ml-2 h-4 w-4 text-vilo-text-secondary transition-transform ${showShiftPicker ? 'rotate-180' : ''}`} />
            </button>

            {showShiftPicker && (
              <>
                <button className="fixed inset-0 z-40 cursor-default" onClick={() => setShowShiftPicker(false)} aria-label="Schichtauswahl schließen" />
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-full overflow-hidden rounded-lg border border-vilo-border-subtle bg-vilo-surface shadow-2xl">
                  {(['Mittag', 'Abend'] as const).map(shift => (
                    <button
                      key={shift}
                      onClick={() => {
                        setSelectedShift(shift);
                        setShowShiftPicker(false);
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${
                        selectedShift === shift
                          ? 'bg-[#2b2b44] text-white'
                          : 'text-vilo-text-secondary hover:bg-vilo-elevated hover:text-white'
                      }`}
                    >
                      <span>{shift}</span>
                      {selectedShift === shift && <span className="text-[#8b5cf6]">●</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => changeDate(1)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-vilo-border-subtle bg-[#27233c] text-vilo-text-secondary transition-colors hover:bg-[#312d48] hover:text-white"
          >
            <IconChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-1.5">
        {posHeaderActions.map(({ key, Icon, label }) => (
          <button
            key={key}
            onClick={() => setActivePosHeaderTool(key)}
            aria-label={label}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
              activePosHeaderTool === key
                ? 'border-vilo-border-subtle bg-[#3a3656] text-[#d8c7ff]'
                : 'border-vilo-border-subtle bg-[#27233c] text-vilo-text-secondary hover:bg-[#312d48] hover:text-white'
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </header>
  );

  // Active table view
  if (state.activeTableId) {
    return (
      <div className="flex flex-col h-screen-safe bg-[#1a1a2e]">
        {renderPosHeader(false)}
        <div className="flex-1 overflow-hidden">
          <TableDetail
            onBack={() => dispatch({ type: 'CLEAR_ACTIVE_TABLE' })}
            voiceIndicator={
              <VoiceIndicator
                mode={voice.mode}
                transcript={voice.transcript}
                lastCommand={state.lastCommand}
                lastConfirmation={state.lastConfirmation}
                isSupported={voice.isSupported}
                isWakeMode={voice.isWakeMode}
                onTapSpeak={voice.startDirectCommand}
                onToggleWake={voice.startListening}
                onStop={voice.stopListening}
                onUndo={handleUndo}
              />
            }
          />
        </div>
        {renderDatePickerModal()}
        {state.showBilling && <BillingModal />}
      </div>
    );
  }

  // Map subTab to content (lazy-loaded tabs wrapped in Suspense)
  const lazyFallback = (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#7bb7ef] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const getSubTabContent = () => {
    const content = (() => {
      switch (subTab) {
        case 'statistiken':
          return <Dashboard onSelectTable={handleSelectTable} />;
        case 'uebersicht':
          return <Dashboard onSelectTable={handleSelectTable} initialTab="uebersicht" />;
        case 'liste':
          return <ReservationList onSelectTable={handleSelectTable} />;
        case 'raumplan':
          return <FloorPlan onZoneChange={handleZoneChange} />;
        case 'bearbeiten':
          return <FloorPlan onZoneChange={handleZoneChange} initialEditMode={true} />;
        case 'timeline':
          return <Timeline onSelectTable={handleSelectTable} />;
        case 'probleme':
          return <ProblemReservations onSelectTable={handleSelectTable} />;
        case 'reservierungen':
          return <ReservationList onSelectTable={handleSelectTable} />;
        default:
          return null;
      }
    })();
    return <Suspense fallback={lazyFallback}>{content}</Suspense>;
  };

  // Main view with clean sub-tab navigation
  return (
    <div className="flex flex-col h-screen-safe bg-[#1a1a2e]">
      {/* Top Header */}
      {subTab !== 'reservierungen' && (
        <>
          {renderPosHeader(true)}

          {/* Date Picker Modal */}
          {renderDatePickerModal()}

        </>
      )}

      {/* Sub-Tabs + Content Wrapper */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {/* Scrollable Sub-Tabs */}
        {subTab !== 'reservierungen' && !isFloorPlanSection && (
          <div className="flex overflow-x-auto hide-scrollbar border-b border-vilo-border-subtle shrink-0" style={{ background: '#1a1a2e' }}>
            {(isHomeSection
              ? [
                  { id: 'statistiken' as SubTab, label: 'Statistiken' },
                  { id: 'uebersicht' as SubTab, label: 'Übersicht' },
                  { id: 'probleme' as SubTab, label: 'Probleme' },
                ]
              : [
                    { id: 'liste' as SubTab, label: 'Liste' },
                    { id: 'timeline' as SubTab, label: 'Timeline' },
                  ]
            ).map(tab => (
              <button
                key={tab.id}
                onClick={() => { setSubTab(tab.id); setShowMoreMenu(false); }}
                className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors relative ${
                  subTab === tab.id
                    ? 'text-[#c4b5fd]'
                    : 'text-vilo-text-muted hover:text-vilo-text-soft'
                }`}
              >
                {tab.label}
                {subTab === tab.id && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full" style={{ background: '#8b5cf6' }} />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Main Content Area - reserve enough space for bottom nav on iPad/mobile */}
        <div
          className="flex-1 overflow-hidden"
          style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
        {getSubTabContent()}

        {/* Voice feedback toast - stays visible for 4 seconds after command */}
        {voiceToastVisible && (state.lastCommand || state.lastConfirmation) && (
          <div className="absolute top-2 left-4 right-4 bg-vilo-surface/95 backdrop-blur rounded-xl px-4 py-2.5 z-30 shadow-lg animate-fade-in"
            onClick={() => setVoiceToastVisible(false)}>
            {state.lastCommand && (
              <p className="text-vilo-text-secondary text-xs truncate">
                Erkannt: <span className="text-[#ddd]">"{state.lastCommand}"</span>
              </p>
            )}
            {state.lastConfirmation && (
              <p className="text-[#b1d9ff] text-xs truncate mt-0.5">{state.lastConfirmation}</p>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Küche/Bar Display (overlay) */}
      {showKitchenBar && (
        <div className="fixed inset-0 z-50">
          <Suspense fallback={lazyFallback}>
            <KitchenBarDisplay onBack={() => setShowKitchenBar(false)} />
          </Suspense>
        </div>
      )}

      {/* Settings view (overlay) */}
      {showSettings && (
        <div className="fixed inset-0 z-50">
          <Suspense fallback={lazyFallback}>
          <ManagerSettings
            onBack={() => setShowSettings(false)}
            onDataChanged={(data) => {
              dispatch({
                type: 'UPDATE_CONFIG',
                restaurant: data.restaurant,
                zones: data.zones,
                tables: data.tables,
                tableCombinations: state.tableCombinations,
                menu: data.menu,
                staff: data.staff,
              });
            }}
          />
          </Suspense>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#1a1a2e] border-t border-[#2a2a42]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
          {/* Statistiken */}
          <button
            onClick={() => { setSubTab('statistiken'); setShowDrawer(false); }}
            className="relative flex flex-col items-center justify-center w-16 h-full transition-colors"
          >
            <IconChartBar className={`w-6 h-6 ${isHomeSection && !showDrawer ? 'text-[#8b5cf6]' : 'text-[#6b6b8a]'}`} />
            {isHomeSection && !showDrawer && <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[#8b5cf6]" />}
          </button>
          {/* AI Voice */}
          <button
            onClick={() => {
              setShowDrawer(false);
              if (voice.mode === 'idle') {
                voice.startDirectCommand();
              } else {
                voice.stopListening();
              }
            }}
            className="relative flex flex-col items-center justify-center w-16 h-full transition-colors"
          >
            <IconSparkles className={`w-6 h-6 ${
              voice.mode !== 'idle' ? 'text-[#7c3aed] animate-pulse' : 'text-[#6b6b8a]'
            }`} />
            {voice.mode !== 'idle' && <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[#7c3aed]" />}
          </button>
          {/* Reservierungen */}
          <button
            onClick={() => { setSubTab('liste'); setShowDrawer(false); }}
            className="relative flex flex-col items-center justify-center w-16 h-full transition-colors"
          >
            <IconCalendar className={`w-6 h-6 ${isReservationSection && !showDrawer ? 'text-[#8b5cf6]' : 'text-[#6b6b8a]'}`} />
            {isReservationSection && !showDrawer && <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[#8b5cf6]" />}
          </button>
          {/* Raumplan */}
          <button
            onClick={() => { setSubTab('raumplan'); setShowDrawer(false); }}
            className="relative flex flex-col items-center justify-center w-16 h-full transition-colors"
          >
            <IconLayoutGrid className={`w-6 h-6 ${isFloorPlanSection && !showDrawer ? 'text-[#8b5cf6]' : 'text-[#6b6b8a]'}`} />
            {isFloorPlanSection && !showDrawer && <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[#8b5cf6]" />}
          </button>
          {/* Mehr - Slide-Up Drawer */}
          <button
            onClick={() => setShowDrawer(prev => !prev)}
            className="relative flex flex-col items-center justify-center w-16 h-full transition-colors"
          >
            <IconMenu2 className={`w-6 h-6 ${showDrawer ? 'text-[#7bb7ef]' : 'text-[#6b6b8a]'}`} />
            {showDrawer && <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[#7bb7ef]" />}
          </button>
        </div>
      </div>

      {/* Slide-Up Drawer */}
      {showDrawer && (
        <div className="fixed inset-0 z-30" onClick={() => setShowDrawer(false)}>
          <div className="absolute inset-0 bg-black/50 transition-opacity" />
          <div
            className="absolute bottom-14 left-0 right-0 bg-[#1a1a2e] rounded-t-2xl border-t border-vilo-border-subtle shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', animation: 'slideUp 0.25s ease-out' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-[#444466] rounded-full" />
            </div>

            {/* Section: Ansichten */}
            <div className="px-5 pb-2">
              <p className="text-[#6b6b8a] text-[11px] font-semibold uppercase tracking-wider mb-2">Ansichten</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'statistiken' as SubTab, label: 'Statistiken', icon: IconChartBar },
                  { id: 'uebersicht' as SubTab, label: 'Übersicht', icon: IconEye },
                  { id: 'probleme' as SubTab, label: 'Probleme', icon: IconAlertTriangle },
                ].map(item => {
                  const Icon = item.icon;
                  const isActive = subTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setSubTab(item.id); setShowDrawer(false); }}
                      className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl transition-colors ${
                        isActive
                          ? 'bg-[#8b5cf6]/15 text-[#c4b5fd]'
                          : 'text-vilo-text-muted hover:bg-vilo-surface hover:text-vilo-text-soft'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[11px] font-medium leading-tight text-center">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="mx-5 border-t border-[#2a2a42] my-2" />

            {/* Section: Tools */}
            <div className="px-5 pb-4">
              <p className="text-[#6b6b8a] text-[11px] font-semibold uppercase tracking-wider mb-2">Tools</p>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => { setShowDrawer(false); setShowSettings(true); }}
                  className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl text-vilo-text-muted hover:bg-vilo-surface hover:text-vilo-text-soft transition-colors"
                >
                  <IconSettings className="w-5 h-5" />
                  <span className="text-[11px] font-medium">Einstell.</span>
                </button>
                <button
                  onClick={() => { setShowDrawer(false); setShowKitchenBar(true); }}
                  className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl text-vilo-text-muted hover:bg-vilo-surface hover:text-vilo-text-soft transition-colors"
                >
                  <IconChefHat className="w-5 h-5" />
                  <span className="text-[11px] font-medium">Küche</span>
                </button>
                <button
                  onClick={() => { setShowDrawer(false); onLogout(); }}
                  className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl text-red-400/80 hover:bg-red-900/15 hover:text-red-400 transition-colors"
                >
                  <IconLogout className="w-5 h-5" />
                  <span className="text-[11px] font-medium">Abmelden</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Click-away for more menu */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
      )}

      {state.showBilling && <BillingModal />}
    </div>
  );
}

function App() {
  const storage = loadStorage();

  const getInitialScreen = (): AppScreen => {
    if (storage.setupComplete && storage.restaurant) return 'pos';
    if (storage.owner && storage.restaurant && !storage.setupComplete) return 'onboarding';
    return 'welcome';
  };

  const [screen, setScreen] = useState<AppScreen>(getInitialScreen);
  const [restaurantName, setRestaurantName] = useState(storage.restaurant?.name || '');

  const [posConfig, setPosConfig] = useState<{
    restaurant: Restaurant;
    zones: Zone[];
    tables: Table[];
    tableCombinations: TableCombination[];
    menu: MenuItem[];
    staff: Staff[];
  } | null>(() => {
    if (storage.setupComplete && storage.restaurant) {
      return {
        restaurant: storage.restaurant,
        zones: storage.zones,
        tables: storage.tables,
        tableCombinations: storage.tableCombinations || [],
        menu: storage.menu,
        staff: storage.staff,
      };
    }
    return null;
  });

  const handleRegister = async (name: string, email: string, password: string) => {
    const code = generateRestaurantCode();
    const restaurantName = name + 's Restaurant';
    const passwordHash = await hashPassword(password);

    const persistAndContinue = (owner: {
      id: string;
      name: string;
      email: string;
      passwordHash: string;
      restaurantId: string;
    }, restaurant: Restaurant) => {
      saveStorage({ owner, restaurant, onboardingStep: 0, setupComplete: false });
      setRestaurantName(restaurant.name);
      setScreen('onboarding');
    };

    try {
      // Register via backend API
      const { restaurant, owner } = await registerViaApi(name, email, passwordHash, restaurantName, code);
      persistAndContinue(owner as {
        id: string;
        name: string;
        email: string;
        passwordHash: string;
        restaurantId: string;
      }, restaurant as Restaurant);
    } catch (e) {
      console.warn('[VILO] Backend registration failed, using local:', e);
      // Fallback to local-only registration
      const restaurantId = Math.random().toString(36).substring(2, 9);
      const owner = {
        id: Math.random().toString(36).substring(2, 9),
        name,
        email,
        passwordHash,
        restaurantId,
      };
      const restaurant: Restaurant = {
        id: restaurantId,
        name: restaurantName,
        code,
        currency: 'EUR',
        taxRate: 19,
      };
      persistAndContinue(owner, restaurant);
    }
  };

  const handleOnboardingComplete = async (data: { zones: Zone[]; tables: Table[]; menu: MenuItem[]; staff: Staff[] }) => {
    const currentStorage = loadStorage();
    const restaurant = currentStorage.restaurant!;
    saveStorage({ zones: data.zones, tables: data.tables, menu: data.menu, staff: data.staff });
    completeSetup();
    // Save config to backend
    await saveConfigToApi(restaurant.id, data.zones, data.tables, data.menu, data.staff, true, 4);
    setPosConfig({ restaurant, zones: data.zones, tables: data.tables, tableCombinations: currentStorage.tableCombinations || [], menu: data.menu, staff: data.staff });
    setScreen('pos');
  };

  const handleQuickStart = async () => {
    const currentStorage = loadStorage();
    const code = currentStorage.restaurant?.code || generateRestaurantCode();

    try {
      // Register demo restaurant via API
      const { restaurant } = await registerViaApi('Demo', 'demo@vilo.app', 'demo', 'Demo Restaurant', code);
      const demoR = { ...restaurant, ...demoRestaurantData, code: restaurant.code, id: restaurant.id };
      saveStorage({ restaurant: demoR, zones: demoZones, tables: demoTables, menu: demoMenu, staff: demoStaff });
      completeSetup();
      await saveConfigToApi(demoR.id, demoZones, demoTables, demoMenu, demoStaff, true, 4);
      setPosConfig({ restaurant: demoR, zones: demoZones, tables: demoTables, tableCombinations: [], menu: demoMenu, staff: demoStaff });
    } catch (e) {
      console.warn('[VILO] Backend quickstart failed, using local:', e);
      const restaurant = { ...demoRestaurantData, code };
      saveStorage({ restaurant, zones: demoZones, tables: demoTables, menu: demoMenu, staff: demoStaff });
      completeSetup();
      setPosConfig({ restaurant, zones: demoZones, tables: demoTables, tableCombinations: [], menu: demoMenu, staff: demoStaff });
    }
    setScreen('pos');
  };

  const handleWaiterLogin = (_staff: Staff, restaurantData: ViloStorage | null) => {
    if (!restaurantData || !restaurantData.restaurant) return;
    setPosConfig({
      restaurant: restaurantData.restaurant,
      zones: restaurantData.zones,
      tables: restaurantData.tables,
      tableCombinations: restaurantData.tableCombinations || [],
      menu: restaurantData.menu,
      staff: restaurantData.staff,
    });
    setRestaurantName(restaurantData.restaurant.name);
    setScreen('pos');
  };

  const handleLogout = () => {
    setScreen('welcome');
    setPosConfig(null);
  };

  const handleReset = () => {
    clearStorage();
    setScreen('welcome');
    setPosConfig(null);
    setRestaurantName('');
  };

  switch (screen) {
    case 'welcome':
      return (
        <WelcomePage
          onCreateRestaurant={() => setScreen('register')}
          onWaiterLogin={() => setScreen('waiter-login')}
        />
      );
    case 'register':
      return (
        <RegistrationPage
          onBack={() => setScreen('welcome')}
          onRegister={handleRegister}
        />
      );
    case 'onboarding':
      return (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center h-screen bg-[#1a1a2e]"><div className="w-6 h-6 border-2 border-[#7bb7ef] border-t-transparent rounded-full animate-spin" /></div>}>
          <OnboardingWizard
            restaurantName={restaurantName}
            onComplete={handleOnboardingComplete}
            onBack={() => handleReset()}
            onQuickStart={handleQuickStart}
          />
        </Suspense>
      );
    case 'waiter-login':
      return (
        <WaiterLoginPage
          onBack={() => setScreen('welcome')}
          onLogin={handleWaiterLogin}
        />
      );
    case 'pos':
      if (!posConfig) {
        setScreen('welcome');
        return null;
      }
      return (
        <AppProvider config={posConfig}>
          <POSContent onLogout={handleLogout} />
        </AppProvider>
      );
  }
}

export default App;
