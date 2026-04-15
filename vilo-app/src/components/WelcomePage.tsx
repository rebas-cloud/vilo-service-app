import { useState } from 'react';
import { IconUserCircle, IconToolsKitchen } from '@tabler/icons-react';

import { BrandWordmark } from './BrandWordmark';
import { AboutVilo } from './AboutVilo';

interface WelcomePageProps {
  onCreateRestaurant: () => void;
  onWaiterLogin: () => void;
}

export function WelcomePage({ onCreateRestaurant, onWaiterLogin }: WelcomePageProps) {
  const [showAbout, setShowAbout] = useState(false);

  return (
    <>
    <div
      className="min-h-screen bg-[#1a1a2e] flex flex-col items-center justify-center px-6"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Logo */}
      <div className="mb-12 text-center">
        <BrandWordmark className="mx-auto mb-3 text-[4.25rem]" />
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={onCreateRestaurant}
          className="w-full flex items-center gap-4 p-5 rounded-2xl bg-[#8b5cf6] hover:bg-[#7c3aed] active:bg-[#6d28d9] transition-colors text-white shadow-[0_16px_40px_rgba(139,92,246,0.24)]"
        >
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <IconToolsKitchen className="w-6 h-6" />
          </div>
          <div className="text-left">
            <div className="font-semibold text-lg">Restaurant erstellen</div>
            <div className="text-violet-100/85 text-sm">Neues Restaurant einrichten</div>
          </div>
        </button>

        <button
          onClick={onWaiterLogin}
          className="w-full flex items-center gap-4 p-5 rounded-2xl bg-vilo-elevated/90 hover:bg-[#312d4c] active:bg-[#26233c] transition-colors text-white border border-vilo-border-subtle"
        >
          <div className="w-12 h-12 rounded-xl bg-[#8b5cf6]/18 flex items-center justify-center flex-shrink-0">
            <IconUserCircle className="w-6 h-6" />
          </div>
          <div className="text-left">
            <div className="font-semibold text-lg">Als Kellner einloggen</div>
            <div className="text-vilo-text-secondary text-sm">Restaurant-Code + PIN</div>
          </div>
        </button>
      </div>

      <button
        onClick={() => setShowAbout(true)}
        className="text-[#777] text-xs mt-12 hover:text-vilo-text-secondary transition-colors"
      >
        about vilo
      </button>
    </div>

    {showAbout && <AboutVilo onClose={() => setShowAbout(false)} />}
    </>
  );
}
