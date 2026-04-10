import { useState } from 'react';
import { IconUserCircle, IconToolsKitchen } from '@tabler/icons-react';

import viloLogo from '../assets/VILO.svg';
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
      className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center px-6"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Logo */}
      <div className="mb-12 text-center">
        <img src={viloLogo} alt="Vilo" className="mx-auto mb-3 h-14 w-auto" />
        <p className="text-[#b0b0cc] text-sm">Voice-First POS</p>
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={onCreateRestaurant}
          className="w-full flex items-center gap-4 p-5 rounded-2xl bg-[#7bb7ef] hover:bg-[#7bb7ef] active:bg-violet-700 transition-colors text-white"
        >
          <div className="w-12 h-12 rounded-xl bg-[#7bb7ef]/50 flex items-center justify-center flex-shrink-0">
            <IconToolsKitchen className="w-6 h-6" />
          </div>
          <div className="text-left">
            <div className="font-semibold text-lg">Restaurant erstellen</div>
            <div className="text-violet-200 text-sm">Neues Restaurant einrichten</div>
          </div>
        </button>

        <button
          onClick={onWaiterLogin}
          className="w-full flex items-center gap-4 p-5 rounded-2xl bg-[#353558]/80 hover:bg-[#555]/80 active:bg-[#353558] transition-colors text-white"
        >
          <div className="w-12 h-12 rounded-xl bg-[#555]/50 flex items-center justify-center flex-shrink-0">
            <IconUserCircle className="w-6 h-6" />
          </div>
          <div className="text-left">
            <div className="font-semibold text-lg">Als Kellner einloggen</div>
            <div className="text-[#b0b0cc] text-sm">Restaurant-Code + PIN</div>
          </div>
        </button>
      </div>

      <button
        onClick={() => setShowAbout(true)}
        className="text-[#777] text-xs mt-12 hover:text-[#b0b0cc] transition-colors"
      >
        about vilo
      </button>
    </div>

    {showAbout && <AboutVilo onClose={() => setShowAbout(false)} />}
    </>
  );
}
