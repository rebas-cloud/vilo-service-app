import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';

import viloLogo from '../assets/VILO.svg';

interface RegistrationPageProps {
  onBack: () => void;
  onRegister: (name: string, email: string, password: string) => void;
}

export function RegistrationPage({ onBack, onRegister }: RegistrationPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name ist erforderlich';
    if (!email.trim()) newErrors.email = 'E-Mail ist erforderlich';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Ungueltige E-Mail-Adresse';
    if (!password) newErrors.password = 'Passwort ist erforderlich';
    else if (password.length < 6) newErrors.password = 'Mindestens 6 Zeichen';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onRegister(name.trim(), email.trim().toLowerCase(), password);
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-[#353558]/50 transition-colors">
          <ArrowLeft className="w-5 h-5 text-[#b0b0cc]" />
        </button>
        <h2 className="text-lg font-semibold text-white">Konto erstellen</h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        {/* Logo */}
        <div className="mb-8 text-center">
          <img src={viloLogo} alt="Vilo" className="mx-auto mb-2 h-10 w-auto" />
          <p className="text-[#b0b0cc] text-sm">Erstelle dein Owner-Konto</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-[#c0c0dd] mb-1.5">Dein Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="z.B. Marco Rossi"
              className={`w-full px-4 py-3 rounded-xl bg-[#353558]/80 text-white placeholder-[#888] border transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 ${
                errors.name ? 'border-red-500' : 'border-[#3d3d5c]'
              }`}
              autoFocus
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-[#c0c0dd] mb-1.5">E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="marco@restaurant.de"
              className={`w-full px-4 py-3 rounded-xl bg-[#353558]/80 text-white placeholder-[#888] border transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 ${
                errors.email ? 'border-red-500' : 'border-[#3d3d5c]'
              }`}
            />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-[#c0c0dd] mb-1.5">Passwort</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mindestens 6 Zeichen"
                className={`w-full px-4 py-3 pr-12 rounded-xl bg-[#353558]/80 text-white placeholder-[#888] border transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 ${
                  errors.password ? 'border-red-500' : 'border-[#3d3d5c]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b0b0cc] hover:text-[#c0c0dd]"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-[#7bb7ef] hover:bg-[#7bb7ef] active:bg-violet-700 text-white font-semibold text-lg transition-colors mt-6"
          >
            Weiter
          </button>
        </form>
      </div>
    </div>
  );
}
