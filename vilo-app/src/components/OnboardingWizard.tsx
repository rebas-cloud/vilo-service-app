import { useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, Trash2, Check, Zap, Store, LayoutGrid, UtensilsCrossed, Users } from 'lucide-react';
import { Zone, Table, MenuItem, Staff, MenuCategory } from '../types';

interface OnboardingWizardProps {
  initialStep?: number;
  onComplete: (data: { zones: Zone[]; tables: Table[]; menu: MenuItem[]; staff: Staff[] }) => void;
  onBack: () => void;
  onQuickStart: () => void;
  restaurantName: string;
}

const STEP_TITLES = [
  'Restaurant-Profil',
  'Tische einrichten',
  'Speisekarte',
  'Team einrichten',
];

const STEP_ICONS = [Store, LayoutGrid, UtensilsCrossed, Users];

const CATEGORY_LABELS: Record<MenuCategory, string> = {
  drinks: 'Getränke',
  starters: 'Vorspeisen',
  mains: 'Hauptgerichte',
  desserts: 'Desserts',
};

const CATEGORY_ROUTING: Record<MenuCategory, 'bar' | 'kitchen'> = {
  drinks: 'bar',
  starters: 'kitchen',
  mains: 'kitchen',
  desserts: 'kitchen',
};

export function OnboardingWizard({ initialStep = 0, onComplete, onBack, onQuickStart, restaurantName }: OnboardingWizardProps) {
  const [step, setStep] = useState(initialStep);

  // Step 1: Restaurant Profile (already saved, just confirm)
  const [currency, setCurrency] = useState('EUR');
  const [taxRate, setTaxRate] = useState('19');

  // Step 2: Zones & Tables
  const [zones, setZones] = useState<{ id: string; name: string; tableCount: number }[]>([
    { id: 'zone-1', name: 'Innen', tableCount: 10 },
    { id: 'zone-2', name: 'Terrasse', tableCount: 4 },
  ]);

  // Step 3: Menu
  const [menuItems, setMenuItems] = useState<{ id: string; name: string; price: string; category: MenuCategory }[]>([]);
  const [activeCategory, setActiveCategory] = useState<MenuCategory>('drinks');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  // Step 4: Staff
  const [staffMembers, setStaffMembers] = useState<{ id: string; name: string; pin: string; role: 'waiter' | 'manager' }[]>([]);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'waiter' | 'manager'>('waiter');

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const canProceed = (): boolean => {
    switch (step) {
      case 0: return true; // profile is always valid
      case 1: return zones.length > 0 && zones.every(z => z.name.trim() && z.tableCount > 0);
      case 2: return menuItems.length > 0;
      case 3: return staffMembers.length > 0 && staffMembers.every(s => s.pin.length === 4);
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      // Complete onboarding
      const finalZones: Zone[] = zones.map(z => ({ id: z.id, name: z.name }));

      const finalTables: Table[] = zones.flatMap(zone =>
        Array.from({ length: zone.tableCount }, (_, i) => ({
          id: `${zone.id}-tisch-${i + 1}`,
          name: `${zone.name} ${i + 1}`,
          zone: zone.id,
          status: 'free' as const,
        }))
      );

      const finalMenu: MenuItem[] = menuItems.map(item => ({
        id: item.id,
        name: item.name,
        price: parseFloat(item.price) || 0,
        category: item.category,
        routing: CATEGORY_ROUTING[item.category],
        aliases: [item.name.toLowerCase()],
      }));

      const finalStaff: Staff[] = staffMembers.map(s => ({
        id: s.id,
        name: s.name,
        pin: s.pin,
        role: s.role,
      }));

      onComplete({ zones: finalZones, tables: finalTables, menu: finalMenu, staff: finalStaff });
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
    else onBack();
  };

  // Zone helpers
  const addZone = () => {
    setZones([...zones, { id: `zone-${generateId()}`, name: '', tableCount: 4 }]);
  };

  const removeZone = (id: string) => {
    setZones(zones.filter(z => z.id !== id));
  };

  const updateZone = (id: string, field: 'name' | 'tableCount', value: string | number) => {
    setZones(zones.map(z => z.id === id ? { ...z, [field]: value } : z));
  };

  // Menu helpers
  const addMenuItem = () => {
    if (!newItemName.trim() || !newItemPrice.trim()) return;
    setMenuItems([...menuItems, {
      id: generateId(),
      name: newItemName.trim(),
      price: newItemPrice,
      category: activeCategory,
    }]);
    setNewItemName('');
    setNewItemPrice('');
  };

  const removeMenuItem = (id: string) => {
    setMenuItems(menuItems.filter(m => m.id !== id));
  };

  // Staff helpers
  const addStaffMember = () => {
    if (!newStaffName.trim() || newStaffPin.length !== 4) return;
    // Check PIN uniqueness
    if (staffMembers.some(s => s.pin === newStaffPin)) return;
    setStaffMembers([...staffMembers, {
      id: generateId(),
      name: newStaffName.trim(),
      pin: newStaffPin,
      role: newStaffRole,
    }]);
    setNewStaffName('');
    setNewStaffPin('');
  };

  const removeStaffMember = (id: string) => {
    setStaffMembers(staffMembers.filter(s => s.id !== id));
  };

  const progressPercent = ((step + 1) / 4) * 100;

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <button onClick={handlePrev} className="p-2 rounded-lg hover:bg-[#353558]/50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-[#b0b0cc]" />
          </button>
          <span className="text-sm text-[#b0b0cc]">Schritt {step + 1} von 4</span>
          {step === 0 && (
            <button
              onClick={onQuickStart}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/30 transition-colors"
            >
              <Zap className="w-4 h-4" />
              Schnellstart
            </button>
          )}
          {step > 0 && <div className="w-20" />}
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 bg-[#353558] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#7bb7ef] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Step Title */}
        <div className="flex items-center gap-3 mt-4 mb-2">
          {(() => {
            const Icon = STEP_ICONS[step];
            return <Icon className="w-6 h-6 text-[#b1d9ff]" />;
          })()}
          <div>
            <h2 className="text-xl font-bold text-white">{STEP_TITLES[step]}</h2>
            <p className="text-sm text-[#b0b0cc]">
              {step === 0 && `${restaurantName} – Grundeinstellungen`}
              {step === 1 && 'Definiere Bereiche und Tische'}
              {step === 2 && 'Füge deine Gerichte und Getränke hinzu'}
              {step === 3 && 'Erstelle Konten für dein Team'}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Step 1: Restaurant Profile */}
        {step === 0 && (
          <div className="space-y-4 mt-2">
            <div className="p-4 rounded-xl bg-[#2a2a42]/80 border border-[#333355]">
              <div className="text-sm text-[#b0b0cc] mb-1">Restaurant</div>
              <div className="text-lg font-semibold text-white">{restaurantName}</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#c0c0dd] mb-1.5">Waehrung</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#353558]/80 text-white border border-[#3d3d5c] focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="EUR">EUR (Euro)</option>
                <option value="CHF">CHF (Schweizer Franken)</option>
                <option value="USD">USD (US Dollar)</option>
                <option value="GBP">GBP (Britisches Pfund)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#c0c0dd] mb-1.5">Steuersatz (%)</label>
              <input
                type="number"
                value={taxRate}
                onChange={e => setTaxRate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#353558]/80 text-white border border-[#3d3d5c] focus:outline-none focus:ring-2 focus:ring-violet-500"
                min="0"
                max="30"
                step="0.5"
              />
            </div>

            <div className="p-4 rounded-xl bg-[#7bb7ef]/10 border border-violet-500/20">
              <p className="text-[#b1d9ff] text-sm">
                <strong>Tipp:</strong> Druecke &quot;Schnellstart&quot; oben rechts, um mit Beispieldaten sofort loszulegen.
                Du kannst alles spaeter aendern.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Zones & Tables */}
        {step === 1 && (
          <div className="space-y-3 mt-2">
            {zones.map((zone) => (
              <div key={zone.id} className="p-4 rounded-xl bg-[#2a2a42]/80 border border-[#333355]">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={zone.name}
                    onChange={e => updateZone(zone.id, 'name', e.target.value)}
                    placeholder="Bereichsname (z.B. Innen, Terrasse)"
                    className="flex-1 px-3 py-2 rounded-lg bg-[#353558]/80 text-white placeholder-[#888] border border-[#3d3d5c] focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                  />
                  <button
                    onClick={() => removeZone(zone.id)}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <label className="text-sm text-[#b0b0cc] whitespace-nowrap">Anzahl Tische:</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateZone(zone.id, 'tableCount', Math.max(1, zone.tableCount - 1))}
                      className="w-8 h-8 rounded-lg bg-[#353558] text-white flex items-center justify-center hover:bg-[#555]"
                    >
                      -
                    </button>
                    <span className="text-white font-semibold w-8 text-center">{zone.tableCount}</span>
                    <button
                      onClick={() => updateZone(zone.id, 'tableCount', Math.min(30, zone.tableCount + 1))}
                      className="w-8 h-8 rounded-lg bg-[#353558] text-white flex items-center justify-center hover:bg-[#555]"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={addZone}
              className="w-full p-3 rounded-xl border-2 border-dashed border-[#3d3d5c] text-[#b0b0cc] hover:border-violet-500 hover:text-[#b1d9ff] transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Bereich hinzufuegen
            </button>

            <div className="p-3 rounded-xl bg-[#2a2a42]/50">
              <p className="text-[#b0b0cc] text-sm text-center">
                Gesamt: {zones.reduce((sum, z) => sum + z.tableCount, 0)} Tische in {zones.length} Bereichen
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Menu */}
        {step === 2 && (
          <div className="space-y-3 mt-2">
            {/* Category Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(Object.keys(CATEGORY_LABELS) as MenuCategory[]).map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    activeCategory === cat
                      ? 'bg-[#7bb7ef] text-white'
                      : 'bg-[#353558]/80 text-[#b0b0cc] hover:text-[#e0e0f0]'
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                  {menuItems.filter(m => m.category === cat).length > 0 && (
                    <span className="ml-1.5 text-xs opacity-70">
                      ({menuItems.filter(m => m.category === cat).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Add Item Form */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                placeholder="Name (z.B. Cola klein)"
                className="flex-1 px-3 py-2.5 rounded-xl bg-[#353558]/80 text-white placeholder-[#888] border border-[#3d3d5c] focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                onKeyDown={e => e.key === 'Enter' && addMenuItem()}
              />
              <input
                type="number"
                value={newItemPrice}
                onChange={e => setNewItemPrice(e.target.value)}
                placeholder="Preis"
                className="w-24 px-3 py-2.5 rounded-xl bg-[#353558]/80 text-white placeholder-[#888] border border-[#3d3d5c] focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                step="0.10"
                min="0"
                onKeyDown={e => e.key === 'Enter' && addMenuItem()}
              />
              <button
                onClick={addMenuItem}
                disabled={!newItemName.trim() || !newItemPrice.trim()}
                className="px-3 py-2.5 rounded-xl bg-[#7bb7ef] text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#7bb7ef] transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Items List for active category */}
            <div className="space-y-2">
              {menuItems
                .filter(m => m.category === activeCategory)
                .map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-[#2a2a42]/80 border border-[#333355]">
                    <div>
                      <span className="text-white text-sm">{item.name}</span>
                      <span className="text-[#b1d9ff] text-sm ml-2">{parseFloat(item.price).toFixed(2)} EUR</span>
                    </div>
                    <button
                      onClick={() => removeMenuItem(item.id)}
                      className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              {menuItems.filter(m => m.category === activeCategory).length === 0 && (
                <p className="text-[#8888aa] text-sm text-center py-4">
                  Noch keine {CATEGORY_LABELS[activeCategory]} hinzugefuegt
                </p>
              )}
            </div>

            <div className="p-3 rounded-xl bg-[#2a2a42]/50">
              <p className="text-[#b0b0cc] text-sm text-center">
                Gesamt: {menuItems.length} Positionen
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Staff */}
        {step === 3 && (
          <div className="space-y-3 mt-2">
            {/* Add Staff Form */}
            <div className="p-4 rounded-xl bg-[#2a2a42]/80 border border-[#333355] space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newStaffName}
                  onChange={e => setNewStaffName(e.target.value)}
                  placeholder="Name (z.B. Max)"
                  className="flex-1 px-3 py-2.5 rounded-xl bg-[#353558]/80 text-white placeholder-[#888] border border-[#3d3d5c] focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                />
                <input
                  type="text"
                  value={newStaffPin}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setNewStaffPin(v);
                  }}
                  placeholder="4-stellige PIN"
                  className="w-32 px-3 py-2.5 rounded-xl bg-[#353558]/80 text-white placeholder-[#888] border border-[#3d3d5c] focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-center tracking-widest"
                  inputMode="numeric"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewStaffRole('waiter')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      newStaffRole === 'waiter'
                        ? 'bg-[#7bb7ef] text-white'
                        : 'bg-[#353558] text-[#b0b0cc]'
                    }`}
                  >
                    Kellner
                  </button>
                  <button
                    onClick={() => setNewStaffRole('manager')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      newStaffRole === 'manager'
                        ? 'bg-[#7bb7ef] text-white'
                        : 'bg-[#353558] text-[#b0b0cc]'
                    }`}
                  >
                    Manager
                  </button>
                </div>
                <button
                  onClick={addStaffMember}
                  disabled={!newStaffName.trim() || newStaffPin.length !== 4}
                  className="px-4 py-1.5 rounded-lg bg-[#7bb7ef] text-white text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#7bb7ef] transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Hinzufuegen
                </button>
              </div>
              {staffMembers.some(s => s.pin === newStaffPin) && newStaffPin.length === 4 && (
                <p className="text-red-400 text-xs">Diese PIN wird bereits verwendet</p>
              )}
            </div>

            {/* Staff List */}
            <div className="space-y-2">
              {staffMembers.map(member => (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-xl bg-[#2a2a42]/80 border border-[#333355]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#7bb7ef]/30 flex items-center justify-center text-[#b1d9ff] font-semibold text-sm">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-white text-sm font-medium">{member.name}</div>
                      <div className="text-[#b0b0cc] text-xs">
                        PIN: {member.pin} · {member.role === 'waiter' ? 'Kellner' : 'Manager'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeStaffMember(member.id)}
                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {staffMembers.length === 0 && (
                <p className="text-[#8888aa] text-sm text-center py-4">
                  Noch keine Mitarbeiter hinzugefuegt
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action */}
      <div className="px-4 pb-4 pt-2 bg-[#1a1a2e]/80 backdrop-blur border-t border-[#333355]/50">
        <button
          onClick={handleNext}
          disabled={!canProceed()}
          className="w-full py-3.5 rounded-xl bg-[#7bb7ef] hover:bg-[#7bb7ef] active:bg-violet-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold text-lg transition-colors flex items-center justify-center gap-2"
        >
          {step < 3 ? (
            <>
              Weiter
              <ArrowRight className="w-5 h-5" />
            </>
          ) : (
            <>
              <Check className="w-5 h-5" />
              Fertig – Restaurant starten
            </>
          )}
        </button>
      </div>
    </div>
  );
}
