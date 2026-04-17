import { useCallback, useState, useRef, useEffect, lazy, Suspense } from 'react';
import { useApp } from '../../context/AppContext';
import { useVoice } from '../../hooks/useVoice';
import { useSync } from '../../hooks/useSync';
import { parseIntent } from '../../utils/intentParser';
import { parseIntentLLM, isLLMAvailable } from '../../utils/llmParser';
import { initAudioContext } from '../../utils/feedback';
import { LoginPage } from '../LoginPage';
import { VoiceIndicator } from '../VoiceIndicator';
import { POSHeader } from './POSHeader';
import { BottomNav, type SubTab } from './BottomNav';
import { DrawerMenu } from './DrawerMenu';

// Lazy-loaded components
const Dashboard = lazy(() => import('../Dashboard').then(m => ({ default: m.Dashboard })));
const FloorPlan = lazy(() => import('../FloorPlan').then(m => ({ default: m.FloorPlan })));
const TableDetail = lazy(() => import('../TableDetail').then(m => ({ default: m.TableDetail })));
const BillingModal = lazy(() => import('../BillingModal').then(m => ({ default: m.BillingModal })));
const KitchenBarDisplay = lazy(() => import('../KitchenBarDisplay').then(m => ({ default: m.KitchenBarDisplay })));
const ManagerSettings = lazy(() => import('../ManagerSettings').then(m => ({ default: m.ManagerSettings })));
const ReservationList = lazy(() => import('../ReservationList').then(m => ({ default: m.ReservationList })));
const Timeline = lazy(() => import('../Timeline').then(m => ({ default: m.Timeline })));
const ProblemReservations = lazy(() => import('../ProblemReservations').then(m => ({ default: m.ProblemReservations })));

const lazyFallback = (
  <div className="flex-1 flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-[#7bb7ef] border-t-transparent rounded-full animate-spin" />
  </div>
);

export function POSLayout({ onLogout }: { onLogout: () => void }) {
  const { state, dispatch, executeIntent } = useApp();
  const [subTab, setSubTab] = useState<SubTab>('statistiken');
  const [showSettings, setShowSettings] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showKitchenBar, setShowKitchenBar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedShift, setSelectedShift] = useState<'Mittag' | 'Abend'>('Abend');
  const [voiceToastVisible, setVoiceToastVisible] = useState(false);
  const voiceToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHomeSection = ['statistiken', 'uebersicht', 'probleme'].includes(subTab);
  const isFloorPlanSection = ['raumplan', 'bearbeiten'].includes(subTab);

  // Real-time sync
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
      dispatch({ type: 'SET_LAST_CONFIRMATION', confirmation: 'Denke nach...' });

      parseIntentLLM(command, stateRef.current.menu, tableIds, stateRef.current.activeTableId)
        .then(intent => {
          const confirmation = executeIntent(intent, command);
          dispatch({ type: 'SET_LAST_CONFIRMATION', confirmation });
          speakConfirmation(confirmation);
        })
        .catch(err => {
          console.warn('[VILO] LLM failed, falling back to rule-based:', err);
          const intent = parseIntent(command, stateRef.current.menu);
          const confirmation = executeIntent(intent, command);
          dispatch({ type: 'SET_LAST_CONFIRMATION', confirmation });
          speakConfirmation(confirmation);
        });
    } else {
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

  const handleZoneChange = useCallback((_zoneId: string, _zoneName: string) => {}, []);

  const handleTabChange = useCallback((tab: SubTab) => {
    setSubTab(tab);
    setShowDrawer(false);
  }, []);

  // Voice toast visibility
  useEffect(() => {
    if (state.lastConfirmation && state.lastConfirmation !== 'Denke nach...') {
      setVoiceToastVisible(true);
      if (voiceToastTimer.current) clearTimeout(voiceToastTimer.current);
      voiceToastTimer.current = setTimeout(() => setVoiceToastVisible(false), 4000);
    }
  }, [state.lastConfirmation]);

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

  // Active table view
  if (state.activeTableId) {
    return (
      <div className="flex flex-col h-screen-safe bg-[#1a1a2e]">
        <POSHeader
          showLogo={false}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          selectedShift={selectedShift}
          onShiftChange={setSelectedShift}
        />
        <div className="flex-1 overflow-hidden">
          <Suspense fallback={lazyFallback}>
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
          </Suspense>
        </div>
        {state.showBilling && (
          <Suspense fallback={null}>
            <BillingModal />
          </Suspense>
        )}
      </div>
    );
  }

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
          return (
            <Suspense fallback={lazyFallback}>
              <FloorPlan onZoneChange={handleZoneChange} />
            </Suspense>
          );
        case 'bearbeiten':
          return (
            <Suspense fallback={lazyFallback}>
              <FloorPlan onZoneChange={handleZoneChange} initialEditMode={true} />
            </Suspense>
          );
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

  return (
    <div className="flex flex-col h-screen-safe bg-[#1a1a2e]">
      {/* Header */}
      {subTab !== 'reservierungen' && !isFloorPlanSection && (
        <POSHeader
          showLogo={true}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          selectedShift={selectedShift}
          onShiftChange={setSelectedShift}
        />
      )}

      {/* Sub-Tabs + Content */}
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
                onClick={() => handleTabChange(tab.id)}
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

        {/* Content */}
        <div
          className="flex-1 overflow-hidden"
          style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {getSubTabContent()}

          {/* Voice feedback toast */}
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

      {/* Kitchen/Bar Display overlay */}
      {showKitchenBar && (
        <div className="fixed inset-0 z-50">
          <Suspense fallback={lazyFallback}>
            <KitchenBarDisplay onBack={() => setShowKitchenBar(false)} />
          </Suspense>
        </div>
      )}

      {/* Settings overlay */}
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

      {/* Bottom Navigation */}
      <BottomNav
        subTab={subTab}
        onTabChange={handleTabChange}
        showDrawer={showDrawer}
        onToggleDrawer={() => setShowDrawer(prev => !prev)}
        voiceMode={voice.mode}
        onVoiceToggle={() => {
          setShowDrawer(false);
          if (voice.mode === 'idle') {
            voice.startDirectCommand();
          } else {
            voice.stopListening();
          }
        }}
      />

      {/* Drawer Menu */}
      {showDrawer && (
        <DrawerMenu
          subTab={subTab}
          onTabChange={handleTabChange}
          onClose={() => setShowDrawer(false)}
          onOpenSettings={() => setShowSettings(true)}
          onOpenKitchenBar={() => setShowKitchenBar(true)}
          onLogout={onLogout}
        />
      )}

      {state.showBilling && <BillingModal />}
    </div>
  );
}
