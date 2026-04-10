import { useState } from 'react';
import { IconArrowLeft, IconCheck, IconChevronDown, IconChevronUp, IconCopy, IconEdit, IconGripVertical, IconLayoutGrid, IconPlus, IconReceipt, IconBuildingStore, IconTrash, IconUsers, IconToolsKitchen, IconX } from '@tabler/icons-react';

import { Restaurant, Zone, Table, MenuItem, MenuCategory, Staff } from '../types';
import { loadStorage, saveStorage } from '../utils/storage';
import { OrderHistory } from './OrderHistory';

type SettingsTab = 'restaurant' | 'tables' | 'menu' | 'staff' | 'history';

interface ManagerSettingsProps {
  onBack: () => void;
  onDataChanged: (data: {
    restaurant: Restaurant;
    zones: Zone[];
    tables: Table[];
    menu: MenuItem[];
    staff: Staff[];
  }) => void;
}

export function ManagerSettings({ onBack, onDataChanged }: ManagerSettingsProps) {
  const storage = loadStorage();
  const [activeTab, setActiveTab] = useState<SettingsTab>('restaurant');

  // Restaurant state
  const [restaurant, setRestaurant] = useState<Restaurant>(
    storage.restaurant || { id: '', name: '', code: '', currency: 'EUR', taxRate: 19 }
  );

  // Zones & Tables state
  const [zones, setZones] = useState<Zone[]>(storage.zones || []);
  const [tables, setTables] = useState<Table[]>(storage.tables || []);

  // Menu state
  const [menuItems, setMenuItems] = useState<MenuItem[]>(storage.menu || []);

  // Staff state
  const [staffList, setStaffList] = useState<Staff[]>(storage.staff || []);

  // Edit states
  const [editingZone, setEditingZone] = useState<string | null>(null);
  const [newZoneName, setNewZoneName] = useState('');
  const [addingZone, setAddingZone] = useState(false);
  const [addZoneValue, setAddZoneValue] = useState('');

  const [addingTable, setAddingTable] = useState<string | null>(null);
  const [addTableName, setAddTableName] = useState('');

  const [editingMenuItem, setEditingMenuItem] = useState<string | null>(null);
  const [addingMenuItem, setAddingMenuItem] = useState(false);
  const [menuForm, setMenuForm] = useState<{
    name: string; price: string; category: MenuCategory; routing: 'bar' | 'kitchen';
  }>({ name: '', price: '', category: 'mains', routing: 'kitchen' });

  const [editingStaff, setEditingStaff] = useState<string | null>(null);
  const [addingStaff, setAddingStaff] = useState(false);
  const [staffForm, setStaffForm] = useState<{
    name: string; pin: string; role: 'waiter' | 'manager';
  }>({ name: '', pin: '', role: 'waiter' });

  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set(zones.map(z => z.id)));
  const [expandedCategory, setExpandedCategory] = useState<MenuCategory | null>('mains');

  // Save all changes
  const saveAll = (
    r?: Restaurant, z?: Zone[], t?: Table[], m?: MenuItem[], s?: Staff[]
  ) => {
    const finalR = r || restaurant;
    const finalZ = z || zones;
    const finalT = t || tables;
    const finalM = m || menuItems;
    const finalS = s || staffList;
    saveStorage({
      restaurant: finalR,
      zones: finalZ,
      tables: finalT,
      menu: finalM,
      staff: finalS,
    });
    onDataChanged({
      restaurant: finalR,
      zones: finalZ,
      tables: finalT,
      menu: finalM,
      staff: finalS,
    });
  };

  const genId = () => Math.random().toString(36).substring(2, 9);

  // ======== RESTAURANT TAB ========
  const renderRestaurant = () => (
    <div className="space-y-4">
      <div>
        <label className="text-vilo-text-secondary text-xs block mb-1">Restaurant-Name</label>
        <input
          type="text"
          value={restaurant.name}
          onChange={e => {
            const updated = { ...restaurant, name: e.target.value };
            setRestaurant(updated);
          }}
          onBlur={() => saveAll(restaurant)}
          className="w-full px-3 py-2.5 rounded-xl bg-vilo-elevated/50 border border-vilo-border-strong text-white text-sm outline-none focus:border-violet-500 transition-colors"
        />
      </div>
      <div>
        <label className="text-vilo-text-secondary text-xs block mb-1">Adresse (optional)</label>
        <input
          type="text"
          value={restaurant.address || ''}
          onChange={e => {
            const updated = { ...restaurant, address: e.target.value };
            setRestaurant(updated);
          }}
          onBlur={() => saveAll(restaurant)}
          placeholder="Musterstraße 1, 10115 Berlin"
          className="w-full px-3 py-2.5 rounded-xl bg-vilo-elevated/50 border border-vilo-border-strong text-white text-sm outline-none focus:border-violet-500 transition-colors placeholder:text-vilo-text-muted"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-vilo-text-secondary text-xs block mb-1">Waehrung</label>
          <select
            value={restaurant.currency}
            onChange={e => {
              const updated = { ...restaurant, currency: e.target.value };
              setRestaurant(updated);
              saveAll(updated);
            }}
            className="w-full px-3 py-2.5 rounded-xl bg-vilo-elevated/50 border border-vilo-border-strong text-white text-sm outline-none focus:border-violet-500"
          >
            <option value="EUR">EUR</option>
            <option value="CHF">CHF</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </select>
        </div>
        <div>
          <label className="text-vilo-text-secondary text-xs block mb-1">MwSt. (%)</label>
          <input
            type="number"
            value={restaurant.taxRate}
            onChange={e => {
              const updated = { ...restaurant, taxRate: parseFloat(e.target.value) || 0 };
              setRestaurant(updated);
            }}
            onBlur={() => saveAll(restaurant)}
            className="w-full px-3 py-2.5 rounded-xl bg-vilo-elevated/50 border border-vilo-border-strong text-white text-sm outline-none focus:border-violet-500"
          />
        </div>
      </div>
      <div>
        <label className="text-vilo-text-secondary text-xs block mb-1">Pacing Limit (Max. Reservierungen pro 30 Min.)</label>
        <input
          type="number"
          min="0"
          value={restaurant.pacingLimit || 0}
          onChange={e => {
            const updated = { ...restaurant, pacingLimit: parseInt(e.target.value) || 0 };
            setRestaurant(updated);
          }}
          onBlur={() => saveAll(restaurant)}
          placeholder="0 = unbegrenzt"
          className="w-full px-3 py-2.5 rounded-xl bg-vilo-elevated/50 border border-vilo-border-strong text-white text-sm outline-none focus:border-violet-500 transition-colors placeholder:text-vilo-text-muted"
        />
        <p className="text-[#777] text-[10px] mt-1">0 = kein Limit. Bei Überschreitung wird eine Warnung angezeigt.</p>
      </div>
      <div>
        <label className="text-vilo-text-secondary text-xs block mb-1">Restaurant-Code (für Kellner-Login)</label>
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-2.5 rounded-xl bg-vilo-elevated/50 border border-vilo-border-strong text-white text-sm font-mono tracking-wider">
            {restaurant.code}
          </div>
          <button
            onClick={() => navigator.clipboard?.writeText(restaurant.code)}
            className="p-2.5 rounded-xl bg-vilo-elevated text-vilo-text-soft hover:bg-[#555] transition-colors"
            title="Code kopieren"
          >
            <IconCopy className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  // ======== TABLES TAB ========
  const toggleZoneExpanded = (zoneId: string) => {
    setExpandedZones(prev => {
      const next = new Set(prev);
      if (next.has(zoneId)) next.delete(zoneId);
      else next.add(zoneId);
      return next;
    });
  };

  const handleAddZone = () => {
    if (!addZoneValue.trim()) return;
    const newZone: Zone = { id: genId(), name: addZoneValue.trim() };
    const updated = [...zones, newZone];
    setZones(updated);
    setAddingZone(false);
    setAddZoneValue('');
    setExpandedZones(prev => new Set([...prev, newZone.id]));
    saveAll(undefined, updated);
  };

  const handleRenameZone = (zoneId: string) => {
    if (!newZoneName.trim()) { setEditingZone(null); return; }
    const updated = zones.map(z => z.id === zoneId ? { ...z, name: newZoneName.trim() } : z);
    setZones(updated);
    setEditingZone(null);
    saveAll(undefined, updated);
  };

  const handleDeleteZone = (zoneId: string) => {
    const updated = zones.filter(z => z.id !== zoneId);
    const updatedTables = tables.filter(t => t.zone !== zoneId);
    setZones(updated);
    setTables(updatedTables);
    saveAll(undefined, updated, updatedTables);
  };

  const handleAddTable = (zoneId: string) => {
    if (!addTableName.trim()) return;
    const newTable: Table = {
      id: genId(),
      name: addTableName.trim(),
      zone: zoneId,
      status: 'free',
    };
    const updated = [...tables, newTable];
    setTables(updated);
    setAddingTable(null);
    setAddTableName('');
    saveAll(undefined, undefined, updated);
  };

  const handleDeleteTable = (tableId: string) => {
    const updated = tables.filter(t => t.id !== tableId);
    setTables(updated);
    saveAll(undefined, undefined, updated);
  };

  const renderTables = () => (
    <div className="space-y-3">
      {zones.map(zone => {
        const zoneTables = tables.filter(t => t.zone === zone.id);
        const isExpanded = expandedZones.has(zone.id);
        return (
          <div key={zone.id} className="rounded-xl bg-vilo-surface/60 border border-vilo-border-subtle/50 overflow-hidden">
            {/* Zone header */}
            <div className="flex items-center justify-between p-3">
              <button
                onClick={() => toggleZoneExpanded(zone.id)}
                className="flex items-center gap-2 flex-1 text-left"
              >
                {isExpanded ? <IconChevronUp className="w-4 h-4 text-vilo-text-secondary" /> : <IconChevronDown className="w-4 h-4 text-vilo-text-secondary" />}
                {editingZone === zone.id ? (
                  <input
                    type="text"
                    value={newZoneName}
                    onChange={e => setNewZoneName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRenameZone(zone.id); if (e.key === 'Escape') setEditingZone(null); }}
                    onBlur={() => handleRenameZone(zone.id)}
                    autoFocus
                    className="bg-vilo-elevated px-2 py-1 rounded text-white text-sm outline-none focus:ring-1 focus:ring-violet-500"
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span className="text-white text-sm font-medium">{zone.name}</span>
                )}
                <span className="text-vilo-text-muted text-xs">({zoneTables.length})</span>
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setEditingZone(zone.id); setNewZoneName(zone.name); }}
                  className="p-1.5 rounded-lg text-vilo-text-secondary hover:text-vilo-text-primary hover:bg-vilo-elevated transition-colors"
                >
                  <IconEdit className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteZone(zone.id)}
                  className="p-1.5 rounded-lg text-vilo-text-secondary hover:text-red-400 hover:bg-vilo-elevated transition-colors"
                >
                  <IconTrash className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tables list */}
            {isExpanded && (
              <div className="border-t border-vilo-border-subtle/50 p-2 space-y-1">
                {zoneTables.map(table => (
                  <div key={table.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-vilo-elevated/30 group">
                    <div className="flex items-center gap-2">
                      <IconGripVertical className="w-3.5 h-3.5 text-[#777]" />
                      <span className="text-[#ddd] text-sm">{table.name}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteTable(table.id)}
                      className="p-1 rounded text-vilo-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <IconTrash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Add table to zone */}
                {addingTable === zone.id ? (
                  <div className="flex items-center gap-2 px-2 pt-1">
                    <input
                      type="text"
                      value={addTableName}
                      onChange={e => setAddTableName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddTable(zone.id); if (e.key === 'Escape') setAddingTable(null); }}
                      placeholder="Tisch-Name"
                      autoFocus
                      className="flex-1 px-3 py-2 rounded-lg bg-vilo-elevated text-white text-sm placeholder:text-vilo-text-muted outline-none focus:ring-1 focus:ring-violet-500"
                    />
                    <button onClick={() => handleAddTable(zone.id)} className="p-2 rounded-lg bg-[#7bb7ef] text-white hover:bg-[#7bb7ef] transition-colors">
                      <IconCheck className="w-4 h-4" />
                    </button>
                    <button onClick={() => setAddingTable(null)} className="p-2 rounded-lg bg-vilo-elevated text-vilo-text-soft hover:bg-[#555] transition-colors">
                      <IconX className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingTable(zone.id); setAddTableName(''); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-vilo-text-secondary hover:text-vilo-text-primary hover:bg-vilo-elevated/50 transition-colors w-full text-left text-sm"
                  >
                    <IconPlus className="w-3.5 h-3.5" /> Tisch hinzufuegen
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add zone */}
      {addingZone ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={addZoneValue}
            onChange={e => setAddZoneValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddZone(); if (e.key === 'Escape') setAddingZone(false); }}
            placeholder="Zone-Name (z.B. Terrasse)"
            autoFocus
            className="flex-1 px-3 py-2.5 rounded-xl bg-vilo-elevated text-white text-sm placeholder:text-vilo-text-muted outline-none focus:ring-1 focus:ring-violet-500"
          />
          <button onClick={handleAddZone} className="p-2.5 rounded-xl bg-[#7bb7ef] text-white hover:bg-[#7bb7ef] transition-colors">
            <IconCheck className="w-4 h-4" />
          </button>
          <button onClick={() => setAddingZone(false)} className="p-2.5 rounded-xl bg-vilo-elevated text-vilo-text-soft hover:bg-[#555] transition-colors">
            <IconX className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => { setAddingZone(true); setAddZoneValue(''); }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-vilo-border-subtle text-vilo-text-secondary hover:text-vilo-text-primary hover:border-violet-500 transition-colors text-sm"
        >
          <IconPlus className="w-4 h-4" /> Neue Zone
        </button>
      )}
    </div>
  );

  // ======== MENU TAB ========
  const categoryLabels: Record<MenuCategory, string> = {
    drinks: 'Getränke',
    starters: 'Vorspeisen',
    mains: 'Hauptgerichte',
    desserts: 'Desserts',
  };

  const categoryOrder: MenuCategory[] = ['drinks', 'starters', 'mains', 'desserts'];

  const handleSaveMenuItem = (itemId: string | null) => {
    if (!menuForm.name.trim() || !menuForm.price) return;
    const price = parseFloat(menuForm.price.replace(',', '.'));
    if (isNaN(price) || price <= 0) return;

    if (itemId) {
      // Edit existing
      const updated = menuItems.map(m =>
        m.id === itemId ? { ...m, name: menuForm.name.trim(), price, category: menuForm.category, routing: menuForm.routing } : m
      );
      setMenuItems(updated);
      setEditingMenuItem(null);
      saveAll(undefined, undefined, undefined, updated);
    } else {
      // Add new
      const newItem: MenuItem = {
        id: genId(),
        name: menuForm.name.trim(),
        price,
        category: menuForm.category,
        routing: menuForm.routing,
        aliases: [menuForm.name.trim().toLowerCase()],
      };
      const updated = [...menuItems, newItem];
      setMenuItems(updated);
      setAddingMenuItem(false);
      saveAll(undefined, undefined, undefined, updated);
    }
    setMenuForm({ name: '', price: '', category: 'mains', routing: 'kitchen' });
  };

  const handleDeleteMenuItem = (itemId: string) => {
    const updated = menuItems.filter(m => m.id !== itemId);
    setMenuItems(updated);
    saveAll(undefined, undefined, undefined, updated);
  };

  const startEditMenuItem = (item: MenuItem) => {
    setEditingMenuItem(item.id);
    setMenuForm({
      name: item.name,
      price: item.price.toString(),
      category: item.category,
      routing: item.routing,
    });
  };

  const renderMenuItemForm = (itemId: string | null) => (
    <div className="p-3 rounded-xl bg-vilo-elevated/40 border border-vilo-border-strong space-y-2">
      <input
        type="text"
        value={menuForm.name}
        onChange={e => setMenuForm(f => ({ ...f, name: e.target.value }))}
        placeholder="Name (z.B. Pizza Margherita)"
        autoFocus
        className="w-full px-3 py-2 rounded-lg bg-vilo-elevated text-white text-sm placeholder:text-vilo-text-muted outline-none focus:ring-1 focus:ring-violet-500"
      />
      <div className="grid grid-cols-3 gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={menuForm.price}
          onChange={e => setMenuForm(f => ({ ...f, price: e.target.value }))}
          placeholder="Preis"
          className="px-3 py-2 rounded-lg bg-vilo-elevated text-white text-sm placeholder:text-vilo-text-muted outline-none focus:ring-1 focus:ring-violet-500"
        />
        <select
          value={menuForm.category}
          onChange={e => setMenuForm(f => ({ ...f, category: e.target.value as MenuCategory }))}
          className="px-2 py-2 rounded-lg bg-vilo-elevated text-white text-sm outline-none focus:ring-1 focus:ring-violet-500"
        >
          {categoryOrder.map(cat => (
            <option key={cat} value={cat}>{categoryLabels[cat]}</option>
          ))}
        </select>
        <select
          value={menuForm.routing}
          onChange={e => setMenuForm(f => ({ ...f, routing: e.target.value as 'bar' | 'kitchen' }))}
          className="px-2 py-2 rounded-lg bg-vilo-elevated text-white text-sm outline-none focus:ring-1 focus:ring-violet-500"
        >
          <option value="kitchen">Küche</option>
          <option value="bar">Bar</option>
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => { setEditingMenuItem(null); setAddingMenuItem(false); setMenuForm({ name: '', price: '', category: 'mains', routing: 'kitchen' }); }}
          className="px-3 py-1.5 rounded-lg bg-[#555] text-vilo-text-soft text-sm hover:bg-slate-500 transition-colors"
        >
          Abbrechen
        </button>
        <button
          onClick={() => handleSaveMenuItem(itemId)}
          className="px-3 py-1.5 rounded-lg bg-[#7bb7ef] text-white text-sm hover:bg-[#7bb7ef] transition-colors"
        >
          Speichern
        </button>
      </div>
    </div>
  );

  const renderMenu = () => (
    <div className="space-y-3">
      {categoryOrder.map(cat => {
        const items = menuItems.filter(m => m.category === cat);
        const isExpanded = expandedCategory === cat;
        return (
          <div key={cat} className="rounded-xl bg-vilo-surface/60 border border-vilo-border-subtle/50 overflow-hidden">
            <button
              onClick={() => setExpandedCategory(isExpanded ? null : cat)}
              className="w-full flex items-center justify-between p-3"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <IconChevronUp className="w-4 h-4 text-vilo-text-secondary" /> : <IconChevronDown className="w-4 h-4 text-vilo-text-secondary" />}
                <span className="text-white text-sm font-medium">{categoryLabels[cat]}</span>
                <span className="text-vilo-text-muted text-xs">({items.length})</span>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-vilo-border-subtle/50 p-2 space-y-1">
                {items.map(item => (
                  editingMenuItem === item.id ? (
                    <div key={item.id}>{renderMenuItemForm(item.id)}</div>
                  ) : (
                    <div key={item.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-vilo-elevated/30 group">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[#ddd] text-sm">{item.name}</span>
                          <span className="text-vilo-text-muted text-xs px-1.5 py-0.5 rounded bg-vilo-elevated">
                            {item.routing === 'bar' ? 'Bar' : 'Küche'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium">{item.price.toFixed(2)} {restaurant.currency}</span>
                        <button
                          onClick={() => startEditMenuItem(item)}
                          className="p-1 rounded text-vilo-text-muted hover:text-vilo-text-primary opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <IconEdit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteMenuItem(item.id)}
                          className="p-1 rounded text-vilo-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                ))}

                {/* Add item in this category */}
                {addingMenuItem && menuForm.category === cat ? (
                  renderMenuItemForm(null)
                ) : (
                  <button
                    onClick={() => { setAddingMenuItem(true); setMenuForm({ name: '', price: '', category: cat, routing: cat === 'drinks' ? 'bar' : 'kitchen' }); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-vilo-text-secondary hover:text-vilo-text-primary hover:bg-vilo-elevated/50 transition-colors w-full text-left text-sm"
                  >
                    <IconPlus className="w-3.5 h-3.5" /> Item hinzufuegen
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ======== STAFF TAB ========
  const handleSaveStaff = (staffId: string | null) => {
    if (!staffForm.name.trim() || !staffForm.pin.trim()) return;
    if (staffForm.pin.length !== 4 || !/^\d{4}$/.test(staffForm.pin)) return;

    // Check PIN uniqueness
    const pinExists = staffList.some(s => s.pin === staffForm.pin && s.id !== staffId);
    if (pinExists) return;

    if (staffId) {
      const updated = staffList.map(s =>
        s.id === staffId ? { ...s, name: staffForm.name.trim(), pin: staffForm.pin, role: staffForm.role } : s
      );
      setStaffList(updated);
      setEditingStaff(null);
      saveAll(undefined, undefined, undefined, undefined, updated);
    } else {
      const newStaff: Staff = {
        id: genId(),
        name: staffForm.name.trim(),
        pin: staffForm.pin,
        role: staffForm.role,
      };
      const updated = [...staffList, newStaff];
      setStaffList(updated);
      setAddingStaff(false);
      saveAll(undefined, undefined, undefined, undefined, updated);
    }
    setStaffForm({ name: '', pin: '', role: 'waiter' });
  };

  const handleDeleteStaff = (staffId: string) => {
    const updated = staffList.filter(s => s.id !== staffId);
    setStaffList(updated);
    saveAll(undefined, undefined, undefined, undefined, updated);
  };

  const startEditStaff = (s: Staff) => {
    setEditingStaff(s.id);
    setStaffForm({ name: s.name, pin: s.pin, role: s.role });
  };

  const renderStaffForm = (staffId: string | null) => (
    <div className="p-3 rounded-xl bg-vilo-elevated/40 border border-vilo-border-strong space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={staffForm.name}
          onChange={e => setStaffForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Name"
          autoFocus
          className="px-3 py-2 rounded-lg bg-vilo-elevated text-white text-sm placeholder:text-vilo-text-muted outline-none focus:ring-1 focus:ring-violet-500"
        />
        <input
          type="text"
          inputMode="numeric"
          maxLength={4}
          value={staffForm.pin}
          onChange={e => setStaffForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
          placeholder="4-stellige PIN"
          className="px-3 py-2 rounded-lg bg-vilo-elevated text-white text-sm placeholder:text-vilo-text-muted outline-none focus:ring-1 focus:ring-violet-500 font-mono tracking-wider"
        />
      </div>
      <div className="flex items-center gap-2">
        <select
          value={staffForm.role}
          onChange={e => setStaffForm(f => ({ ...f, role: e.target.value as 'waiter' | 'manager' }))}
          className="flex-1 px-3 py-2 rounded-lg bg-vilo-elevated text-white text-sm outline-none focus:ring-1 focus:ring-violet-500"
        >
          <option value="waiter">Kellner</option>
          <option value="manager">Manager</option>
        </select>
        <button
          onClick={() => { setEditingStaff(null); setAddingStaff(false); setStaffForm({ name: '', pin: '', role: 'waiter' }); }}
          className="px-3 py-2 rounded-lg bg-[#555] text-vilo-text-soft text-sm hover:bg-slate-500 transition-colors"
        >
          Abbrechen
        </button>
        <button
          onClick={() => handleSaveStaff(staffId)}
          className="px-3 py-2 rounded-lg bg-[#7bb7ef] text-white text-sm hover:bg-[#7bb7ef] transition-colors"
        >
          Speichern
        </button>
      </div>
      {staffForm.pin.length > 0 && staffForm.pin.length < 4 && (
        <p className="text-amber-400 text-xs">PIN muss 4 Ziffern haben</p>
      )}
      {staffList.some(s => s.pin === staffForm.pin && s.id !== staffId) && staffForm.pin.length === 4 && (
        <p className="text-red-400 text-xs">Diese PIN ist bereits vergeben</p>
      )}
    </div>
  );

  const renderStaff = () => (
    <div className="space-y-2">
      {staffList.map(s => (
        editingStaff === s.id ? (
          <div key={s.id}>{renderStaffForm(s.id)}</div>
        ) : (
          <div key={s.id} className="flex items-center justify-between px-3 py-3 rounded-xl bg-vilo-surface/60 border border-vilo-border-subtle/50 group">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                s.role === 'manager' ? 'bg-[#7bb7ef] text-white' : 'bg-vilo-elevated text-vilo-text-soft'
              }`}>
                {s.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-white text-sm font-medium">{s.name}</p>
                <p className="text-vilo-text-muted text-xs">{s.role === 'manager' ? 'Manager' : 'Kellner'} &middot; PIN: {s.pin}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => startEditStaff(s)}
                className="p-1.5 rounded-lg text-vilo-text-secondary hover:text-vilo-text-primary hover:bg-vilo-elevated opacity-0 group-hover:opacity-100 transition-all"
              >
                <IconEdit className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDeleteStaff(s.id)}
                className="p-1.5 rounded-lg text-vilo-text-secondary hover:text-red-400 hover:bg-vilo-elevated opacity-0 group-hover:opacity-100 transition-all"
              >
                <IconTrash className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )
      ))}

      {addingStaff ? (
        renderStaffForm(null)
      ) : (
        <button
          onClick={() => { setAddingStaff(true); setStaffForm({ name: '', pin: '', role: 'waiter' }); }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-vilo-border-subtle text-vilo-text-secondary hover:text-vilo-text-primary hover:border-violet-500 transition-colors text-sm"
        >
          <IconPlus className="w-4 h-4" /> Mitarbeiter hinzufuegen
        </button>
      )}
    </div>
  );

  // ======== MAIN RENDER ========
  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'restaurant', label: 'Restaurant', icon: <IconBuildingStore className="w-4 h-4" /> },
    { id: 'tables', label: 'Tische', icon: <IconLayoutGrid className="w-4 h-4" /> },
    { id: 'menu', label: 'Speisekarte', icon: <IconToolsKitchen className="w-4 h-4" /> },
    { id: 'staff', label: 'Team', icon: <IconUsers className="w-4 h-4" /> },
    { id: 'history', label: 'Historie', icon: <IconReceipt className="w-4 h-4" /> },
  ];

  return (
    <div className="h-full bg-[#1a1a2e] flex flex-col">
      {/* Header */}
      <header className="bg-vilo-surface/80 backdrop-blur border-b border-vilo-border-subtle px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg bg-vilo-elevated text-vilo-text-soft hover:bg-[#555] transition-colors">
            <IconArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-white font-semibold text-lg">Einstellungen</h1>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="flex bg-vilo-surface/50 border-b border-vilo-border-subtle px-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'text-[#b1d9ff] border-violet-400'
                : 'text-vilo-text-muted border-transparent hover:text-vilo-text-soft'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {activeTab === 'restaurant' && renderRestaurant()}
        {activeTab === 'tables' && renderTables()}
        {activeTab === 'menu' && renderMenu()}
        {activeTab === 'staff' && renderStaff()}
        {activeTab === 'history' && <OrderHistory onSelectTable={() => {}} />}
      </div>
    </div>
  );
}
