import { IconAlertTriangle, IconChartBar, IconChefHat, IconEye, IconLogout, IconSettings } from '@tabler/icons-react';
import type { SubTab } from './BottomNav';

interface DrawerMenuProps {
  subTab: SubTab;
  onTabChange: (tab: SubTab) => void;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenKitchenBar: () => void;
  onLogout: () => void;
}

export function DrawerMenu({ subTab, onTabChange, onClose, onOpenSettings, onOpenKitchenBar, onLogout }: DrawerMenuProps) {
  return (
    <div className="fixed inset-0 z-30" onClick={onClose}>
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
                  onClick={() => { onTabChange(item.id); onClose(); }}
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
              onClick={() => { onClose(); onOpenSettings(); }}
              className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl text-vilo-text-muted hover:bg-vilo-surface hover:text-vilo-text-soft transition-colors"
            >
              <IconSettings className="w-5 h-5" />
              <span className="text-[11px] font-medium">Einstell.</span>
            </button>
            <button
              onClick={() => { onClose(); onOpenKitchenBar(); }}
              className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl text-vilo-text-muted hover:bg-vilo-surface hover:text-vilo-text-soft transition-colors"
            >
              <IconChefHat className="w-5 h-5" />
              <span className="text-[11px] font-medium">Küche</span>
            </button>
            <button
              onClick={() => { onClose(); onLogout(); }}
              className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl text-red-400/80 hover:bg-red-900/15 hover:text-red-400 transition-colors"
            >
              <IconLogout className="w-5 h-5" />
              <span className="text-[11px] font-medium">Abmelden</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
