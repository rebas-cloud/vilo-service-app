// Shared utility functions used across multiple components

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

export function getTodayStr(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${minutes}m`;
}

export function formatDurationMs(start: number, end: number): string {
  const diff = end - start;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} Min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export function formatDurationShort(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatDateDisplay(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, mo - 1, d);
  const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const months = ['Jan', 'Feb', 'März', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  return days[dt.getDay()] + '. ' + d + '. ' + months[dt.getMonth()];
}

export function maskPhoneValue(phone: string): string {
  const compact = phone.replace(/\s+/g, '');
  if (compact.length <= 4) return compact;
  return `${compact.slice(0, 2)}${'*'.repeat(Math.max(4, compact.length - 4))}${compact.slice(-2)}`;
}
