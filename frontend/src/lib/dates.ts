const TZ = 'Asia/Manila';

// YYYY-MM-DD in PH time
export function toDay(date: Date | string = new Date()) {
  return new Date(date).toLocaleDateString('en-CA', { timeZone: TZ });
}

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-PH', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(date: string) {
  return new Date(date).toLocaleString('en-PH', {
    timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}
