import { useState, useEffect } from 'react';
import { IconArrowLeft, IconHash, IconKey } from '@tabler/icons-react';

import viloLogo from '../assets/VILO.svg';
import { findRestaurantByCode, loadStorage } from '../utils/storage';
import { Staff, ViloStorage } from '../types';

interface WaiterLoginPageProps {
  onBack: () => void;
  onLogin: (staff: Staff, restaurantData: ViloStorage | null) => void;
}

type LoginPhase = 'code' | 'pin';

export function WaiterLoginPage({ onBack, onLogin }: WaiterLoginPageProps) {
  const [phase, setPhase] = useState<LoginPhase>('code');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [restaurantData, setRestaurantData] = useState<ViloStorage | null>(null);

  // Auto-detect existing restaurant in localStorage and skip code entry
  useEffect(() => {
    const storage = loadStorage();
    if (storage.setupComplete && storage.restaurant && storage.staff.length > 0) {
      setRestaurantName(storage.restaurant.name);
      setStaffList(storage.staff);
      setRestaurantData(storage);
      setPhase('pin');
    }
  }, []);

  const handleCodeSubmit = async () => {
    try {
      const data = await findRestaurantByCode(code.toUpperCase());
      if (data && data.restaurant) {
        setRestaurantName(data.restaurant.name);
        setStaffList(data.staff);
        setRestaurantData(data);
        setPhase('pin');
        setError('');
      } else {
        setError('Restaurant nicht gefunden');
        setTimeout(() => {
          setError('');
          setCode('');
        }, 1500);
      }
    } catch {
      setError('Verbindungsfehler');
      setTimeout(() => { setError(''); setCode(''); }, 1500);
    }
  };

  const handleCodeInput = (char: string) => {
    if (code.length >= 6) return;
    const newCode = code + char.toUpperCase();
    setCode(newCode);
    setError('');
  };

  const handleCodeDelete = () => {
    setCode(code.slice(0, -1));
    setError('');
  };

  const handlePinEntry = (digit: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);

    if (newPin.length === 4) {
      const user = staffList.find(s => s.pin === newPin);
      if (user) {
        setError('');
        onLogin(user, restaurantData);
      } else {
        setError('Falsche PIN');
        setTimeout(() => {
          setPin('');
          setError('');
        }, 1000);
      }
    }
  };

  const handlePinDelete = () => {
    setPin(pin.slice(0, -1));
    setError('');
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center px-4"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center gap-3 px-4 py-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
        <button
          onClick={() => {
            if (phase === 'pin') {
              setPhase('code');
              setPin('');
              setError('');
            } else {
              onBack();
            }
          }}
          className="p-2 rounded-lg hover:bg-[#353558]/50 transition-colors"
        >
          <IconArrowLeft className="w-5 h-5 text-[#b0b0cc]" />
        </button>
        <h2 className="text-lg font-semibold text-white">
          {phase === 'code' ? 'Restaurant finden' : restaurantName}
        </h2>
      </div>

      {/* Logo */}
      <div className="mb-8 text-center">
        <img src={viloLogo} alt="Vilo" className="mx-auto mb-2 h-12 w-auto" />
        <p className="text-[#b0b0cc] text-sm">
          {phase === 'code' ? 'Restaurant-Code eingeben' : 'PIN eingeben'}
        </p>
        {phase === 'pin' && (
          <p className="text-[#b1d9ff] text-xs mt-1">{restaurantName}</p>
        )}
      </div>

      {/* Code Entry Phase */}
      {phase === 'code' && (
        <>
          {/* Code Display */}
          <div className="mb-6">
            <div className="flex gap-2 justify-center mb-2">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className={`w-10 h-12 rounded-lg border-2 flex items-center justify-center text-xl font-bold transition-all ${
                    i < code.length
                      ? error
                        ? 'border-red-500 bg-red-500/10 text-red-400'
                        : 'border-violet-500 bg-[#7bb7ef]/10 text-[#b1d9ff]'
                      : 'border-[#3d3d5c] bg-[#353558]/50 text-[#8888aa]'
                  }`}
                >
                  {code[i] || ''}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-1.5 text-[#8888aa] text-xs">
              <IconHash className="w-3 h-3" />
              6-stelliger Restaurant-Code
            </div>
            {error && <p className="text-red-400 text-sm text-center mt-2">{error}</p>}
          </div>

          {/* Alphanumeric Keyboard */}
          <div className="grid grid-cols-6 gap-2 w-72">
            {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '2', '3', '4', '5', '6', '7', '8', '9'].map(char => (
              <button
                key={char}
                onClick={() => handleCodeInput(char)}
                className="h-11 rounded-lg bg-[#353558]/80 text-white text-sm font-medium active:bg-[#7bb7ef] transition-colors hover:bg-[#555]"
              >
                {char}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-2 w-72">
            <button
              onClick={handleCodeDelete}
              className="flex-1 h-11 rounded-lg bg-[#353558]/50 text-[#c0c0dd] text-sm font-medium active:bg-[#555] transition-colors"
            >
              Loeschen
            </button>
            <button
              onClick={handleCodeSubmit}
              disabled={code.length !== 6}
              className="flex-1 h-11 rounded-lg bg-[#7bb7ef] text-white text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed active:bg-violet-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <IconKey className="w-4 h-4" />
              Einloggen
            </button>
          </div>
        </>
      )}

      {/* PIN Entry Phase */}
      {phase === 'pin' && (
        <>
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
                        : 'bg-[#7bb7ef] border-violet-500'
                      : 'border-[#5a5a5a]'
                  }`}
                />
              ))}
            </div>
            {error && <p className="text-red-400 text-sm text-center mt-2">{error}</p>}
          </div>

          {/* PIN Pad */}
          <div className="grid grid-cols-3 gap-3 w-64">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key) => {
              if (key === '') return <div key="empty" />;
              if (key === 'del') {
                return (
                  <button
                    key="del"
                    onClick={handlePinDelete}
                    className="h-16 rounded-xl bg-[#353558]/50 text-[#c0c0dd] text-lg font-medium active:bg-[#555] transition-colors flex items-center justify-center"
                  >
                    &#8592;
                  </button>
                );
              }
              return (
                <button
                  key={key}
                  onClick={() => handlePinEntry(key)}
                  className="h-16 rounded-xl bg-[#353558]/80 text-white text-2xl font-medium active:bg-[#7bb7ef] transition-colors hover:bg-[#555]"
                >
                  {key}
                </button>
              );
            })}
          </div>

          <p className="text-[#8888aa] text-xs mt-6">Deine persoenliche PIN eingeben</p>
        </>
      )}
    </div>
  );
}
