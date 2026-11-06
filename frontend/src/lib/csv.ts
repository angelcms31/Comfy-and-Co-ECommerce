// saves rows as a spreadsheet file. Excel runs cells that start with = + - @ as formulas, so those get a leading '
function cell(value: string | number) {
  const text = typeof value === 'string' && /^[=+\-@\t\r]/.test(value) ? `'${value}` : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function downloadCsv(name: string, rows: (string | number)[][]) {
  // the mark at the start tells Excel it's UTF-8, so ₱ and ñ show properly
  const blob = new Blob(['﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}-${new Date().toLocaleDateString('en-CA')}.csv`; // en-CA is written 2026-11-06, in the user's own timezone
  a.click();
  URL.revokeObjectURL(a.href);
}
