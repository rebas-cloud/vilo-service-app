import { IconChartBar, IconCalendar, IconLayoutGrid, IconMenu2, IconSparkles } from '@tabler/icons-react';

export type SubTab = 'statistiken' | 'uebersicht' | 'liste' | 'raumplan' | 'timeline' | 'probleme' | 'reservierungen' | 'bearbeiten';

interface BottomNavProps {
  subTab: SubTab;
  onTabChange: (tab: SubTab) => void;
  showDrawer: boolean;
  onToggleDrawer: () => void;
  voiceMode: string;
  onVoiceToggle: () => void;
}

export function BottomNav({ subTab, onTabChange, showDrawer, onToggleDrawer, voiceMode, onVoiceToggle }: BottomNavProps) {
  const isHomeSection = ['statistiken', 'uebersicht', 'probleme'].includes(subTab);
  const isReservationSection = ['liste', 'timeline'].includes(subTab);
  const isFloorPlanSection = ['raumplan', 'bearbeiten'].includes(subTab);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#1a1a2e] border-t border-[#2a2a42]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {/* Statistiken */}
        <button
          onClick={() => onTabChange('statistiken')}
          className="relative flex flex-col items-center justify-center w-16 h-full transition-colors"
        >
          <IconChartBar className={`w-6 h-6 ${isHomeSection && !showDrawer ? 'text-[#8b5cf6]' : 'text-[#6b6b8a]'}`} />
          {isHomeSection && !showDrawer && <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[#8b5cf6]" />}
        </button>
        {/* AI Voice */}
        <button
          onClick={onVoiceToggle}
          className="relative flex flex-col items-center justify-center w-16 h-full transition-colors"
        >
          <IconSparkles className={`w-6 h-6 ${
            voiceMode !== 'idle' ? 'text-[#7c3aed] animate-pulse' : 'text-[#6b6b8a]'
          }`} />
          {voiceMode !== 'idle' && <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[#7c3aed]" />}
        </button>
        {/* Reservierungen */}
        <button
          onClick={() => onTabChange('liste')}
          className="relative flex flex-col items-center justify-center w-16 h-full transition-colors"
        >
          <IconCalendar className={`w-6 h-6 ${isReservationSection && !showDrawer ? 'text-[#8b5cf6]' : 'text-[#6b6b8a]'}`} />
          {isReservationSection && !showDrawer && <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[#8b5cf6]" />}
        </button>
        {/* Raumplan */}
        <button
          onClick={() => onTabChange('raumplan')}
          className="relative flex flex-col items-center justify-center w-16 h-full transition-colors"
        >
          <IconLayoutGrid className={`w-6 h-6 ${isFloorPlanSection && !showDrawer ? 'text-[#8b5cf6]' : 'text-[#6b6b8a]'}`} />
          {isFloorPlanSection && !showDrawer && <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[#8b5cf6]" />}
        </button>
        {/* Mehr */}
        <button
          onClick={onToggleDrawer}
          className="relative flex flex-col items-center justify-center w-16 h-full transition-colors"
        >
          <IconMenu2 className={`w-6 h-6 ${showDrawer ? 'text-[#7bb7ef]' : 'text-[#6b6b8a]'}`} />
          {showDrawer && <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[#7bb7ef]" />}
        </button>
      </div>
    </div>
  );
}
