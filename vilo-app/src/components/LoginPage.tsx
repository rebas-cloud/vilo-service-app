import { useState } from 'react';
import { IconLogout } from '@tabler/icons-react';

import { useApp } from '../context/AppContext';
import viloLogo from '../assets/VILO.svg';

interface LoginPageProps {
  onLogout?: () => void;
}

export function LoginPage({ onLogout }: LoginPageProps) {
  const { state, dispatch } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handlePinEntry = (digit: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);

    if (newPin.length === 4) {
      const user = state.staff.find(s => s.pin === newPin);
      if (user) {
        setError('');
        dispatch({ type: 'LOGIN', userId: user.id });
      } else {
        setError('Falsche PIN');
        setTimeout(() => {
          setPin('');
          setError('');
        }, 1000);
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError('');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: '#151b31', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center">
          <img src={viloLogo} alt="VILO" className="h-10 w-auto" />
        </div>
      </div>

      {/* PIN Display */}
      <div className="mb-6">
        <div className="flex gap-3 justify-center">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                i < pin.length
                  ? error
                    ? 'bg-red-500 border-red-500'
                    : 'bg-[#8b5cf6] border-[#8b5cf6]'
                  : 'border-[#5d5878]'
              }`}
            />
          ))}
        </div>
        {error && (
          <p className="text-red-400 text-sm text-center mt-2">{error}</p>
        )}
      </div>

      {/* PIN Pad */}
      <div className="grid grid-cols-3 gap-3 w-64">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key) => {
          if (key === '') return <div key="empty" />;
          if (key === 'del') {
            return (
              <button
                key="del"
                onClick={handleDelete}
                className="h-16 rounded-xl bg-[#2b2944] text-[#d3ceed] text-lg font-medium
                  active:bg-[#3a3657] transition-colors flex items-center justify-center"
              >
                ←
              </button>
            );
          }
          return (
            <button
              key={key}
              onClick={() => handlePinEntry(key)}
              className="h-16 rounded-xl bg-[#353558] text-white text-2xl font-medium
                active:bg-[#8b5cf6] transition-colors hover:bg-[#413d63]"
            >
              {key}
            </button>
          );
        })}
      </div>

      <p className="text-[#9b96b8] text-xs mt-8">PIN eingeben zum Anmelden</p>
      <p className="text-[#9b96b8] text-xs mt-1">
        {state.staff.map(s => `${s.name} (${s.pin})`).join(' · ')}
      </p>

      {/* Restaurant Code Display */}
      {state.restaurant.code && state.restaurant.code !== '000000' && (
        <div className="mt-6 px-4 py-2 rounded-lg bg-[#2b2944] border border-[#4f4772]">
          <p className="text-[#9b96b8] text-xs text-center">Restaurant-Code</p>
          <p className="text-[#d8c7ff] text-lg font-mono font-bold text-center tracking-widest">{state.restaurant.code}</p>
        </div>
      )}

      {onLogout && (
        <button
          onClick={onLogout}
          className="mt-6 flex items-center gap-2 px-4 py-2 rounded-lg text-[#9b96b8] hover:text-[#d3ceed] hover:bg-[#2b2944] transition-colors text-sm"
        >
          <IconLogout className="w-4 h-4" />
          Anderes Restaurant
        </button>
      )}
    </div>
  );
}
