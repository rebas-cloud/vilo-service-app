import { useState } from 'react';
import { IconChevronDown, IconChevronLeft, IconChevronRight, IconCalendar, IconClipboardList, IconMap2, IconSearch, IconX } from '@tabler/icons-react';
import { BrandWordmark } from '../BrandWordmark';

type HeaderTool = 'search' | 'receipts' | 'orders' | 'map';

interface POSHeaderProps {
  showLogo?: boolean;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  selectedShift: 'Mittag' | 'Abend';
  onShiftChange: (shift: 'Mittag' | 'Abend') => void;
}

const posHeaderActions: { key: HeaderTool; Icon: typeof IconSearch; label: string }[] = [
  { key: 'search', Icon: IconSearch, label: 'Suche' },
  { key: 'receipts', Icon: IconCalendar, label: 'Belege' },
  { key: 'orders', Icon: IconClipboardList, label: 'Bestellungen' },
  { key: 'map', Icon: IconMap2, label: 'Karte' },
];

export function POSHeader({ showLogo = true, selectedDate, onDateChange, selectedShift, onShiftChange }: POSHeaderProps) {
  const [activeTool, setActiveTool] = useState<HeaderTool>('receipts');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showShiftPicker, setShowShiftPicker] = useState(false);

  const getDateHeader = () => {
    const d = selectedDate;
    const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const months = ['Jan', 'Feb', 'März', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    return `${days[d.getDay()]}. ${d.getDate()}. ${months[d.getMonth()]}`;
  };

  const changeDate = (offset: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + offset);
    onDateChange(newDate);
  };

  return (
    <>
      <header
        className="relative grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-vilo-border-subtle px-3 py-2"
        style={{ background: '#1a1a2e', paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}
      >
        <div className="flex min-w-0 items-center">
          {showLogo && (
            <div className="flex items-center shrink-0">
              <BrandWordmark className="text-[1.9rem]" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 items-center justify-center">
          <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto hide-scrollbar">
            <button
              onClick={() => changeDate(-1)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-vilo-border-subtle bg-[#27233c] text-vilo-text-secondary transition-colors hover:bg-[#312d48] hover:text-white"
            >
              <IconChevronLeft className="h-4 w-4" />
            </button>

            <button
              onClick={() => {
                setShowShiftPicker(false);
                setShowDatePicker(true);
              }}
              className="flex h-8 shrink-0 items-center rounded-lg border border-vilo-border-subtle bg-[#27233c] px-3 text-white transition-colors hover:bg-[#312d48]"
            >
              <span className="truncate text-[12px] font-semibold leading-none">{getDateHeader()}</span>
            </button>

            <div className="flex h-8 w-8 shrink-0 items-center justify-center">
              <span className="h-3.5 w-3.5 rounded-full bg-[#49d36d]" />
            </div>

            <div className="relative shrink-0">
              <button
                onClick={() => setShowShiftPicker(prev => !prev)}
                className="flex h-8 min-w-[124px] items-center justify-between rounded-lg border border-vilo-border-subtle bg-[#27233c] px-3 text-white transition-colors hover:bg-[#312d48]"
              >
                <span className="truncate text-[12px] font-semibold leading-none">{selectedShift}</span>
                <IconChevronDown className={`ml-2 h-4 w-4 text-vilo-text-secondary transition-transform ${showShiftPicker ? 'rotate-180' : ''}`} />
              </button>

              {showShiftPicker && (
                <>
                  <button className="fixed inset-0 z-40 cursor-default" onClick={() => setShowShiftPicker(false)} aria-label="Schichtauswahl schließen" />
                  <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-full overflow-hidden rounded-lg border border-vilo-border-subtle bg-vilo-surface shadow-2xl">
                    {(['Mittag', 'Abend'] as const).map(shift => (
                      <button
                        key={shift}
                        onClick={() => {
                          onShiftChange(shift);
                          setShowShiftPicker(false);
                        }}
                        className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${
                          selectedShift === shift
                            ? 'bg-[#2b2b44] text-white'
                            : 'text-vilo-text-secondary hover:bg-vilo-elevated hover:text-white'
                        }`}
                      >
                        <span>{shift}</span>
                        {selectedShift === shift && <span className="text-[#8b5cf6]">●</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => changeDate(1)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-vilo-border-subtle bg-[#27233c] text-vilo-text-secondary transition-colors hover:bg-[#312d48] hover:text-white"
            >
              <IconChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-1.5">
          {posHeaderActions.map(({ key, Icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveTool(key)}
              aria-label={label}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                activeTool === key
                  ? 'border-vilo-border-subtle bg-[#3a3656] text-[#d8c7ff]'
                  : 'border-vilo-border-subtle bg-[#27233c] text-vilo-text-secondary hover:bg-[#312d48] hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </header>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8" onClick={() => setShowDatePicker(false)}>
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
          <div className="relative w-full max-w-xl overflow-hidden rounded-[28px] border border-vilo-border-subtle bg-vilo-surface shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-vilo-border-subtle px-6 py-5 shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[18px] font-bold text-white">Datum</h2>
              </div>
              <button
                onClick={() => setShowDatePicker(false)}
                className="ml-3 p-1 text-vilo-text-secondary hover:text-vilo-text-primary transition-colors shrink-0"
              >
                <IconX className="w-6 h-6" />
              </button>
            </div>
            <div className="px-6 py-6">
              <div className="rounded-[24px] border border-vilo-border-subtle bg-vilo-card p-5">
                <input
                  type="date"
                  value={selectedDate.toISOString().split('T')[0]}
                  onChange={(e) => {
                    if (e.target.value) {
                      const [y, m, d] = e.target.value.split('-').map(Number);
                      onDateChange(new Date(y, m - 1, d));
                    }
                  }}
                  className="w-full rounded-xl border border-vilo-border-subtle bg-vilo-elevated px-4 py-4 text-center text-[16px] font-semibold text-white outline-none transition-colors focus:border-[#8b5cf6]"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => { onDateChange(new Date()); setShowDatePicker(false); }}
                  className="flex-1 rounded-lg border border-vilo-border-subtle bg-[#3a3656] px-4 py-3 text-sm font-semibold text-[#d8c7ff] transition-colors hover:text-white"
                >
                  Heute
                </button>
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="flex-1 rounded-lg border border-vilo-border-subtle bg-vilo-elevated px-4 py-3 text-sm font-semibold text-vilo-text-secondary transition-colors hover:text-white"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
