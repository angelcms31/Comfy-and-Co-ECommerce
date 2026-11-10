import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateTime } from './dates';

// the "who and when" line printed on every export (CSV and PDF), so a printed report can be traced
export function downloadStamp(by: string | null | undefined) {
  return `Downloaded by ${by?.trim() || 'Admin'} on ${formatDateTime(new Date().toISOString())}`;
}

interface PdfTable {
  title: string;
  subtitle?: string; // e.g. the filter that was on
  by?: string | null; // who downloaded it
  columns: string[];
  rows: (string | number)[][];
  landscape?: boolean;
}

export interface SavedPdf {
  filename: string;
  url: string; // object URL of the same file, to open it in a tab; call URL.revokeObjectURL when done
}

// saves a table as a PDF: title, who downloaded it and when, the table, and page numbers.
// The built-in font has no ₱ glyph, so write amounts as "PHP 1,200" in the rows.
export function downloadPdf(name: string, { title, subtitle, by, columns, rows, landscape = true }: PdfTable): SavedPdf {
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  const stamp = downloadStamp(by);
  const margin = 36;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(31, 61, 51); // forest
  doc.text(`Comfy&Co – ${title}`, margin, 44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(92, 107, 101); // muted
  doc.text(stamp, margin, 62);
  if (subtitle) doc.text(subtitle, margin, 76);

  autoTable(doc, {
    head: [columns],
    body: rows.map((r) => r.map(String)),
    startY: subtitle ? 90 : 76,
    margin: { left: margin, right: margin },
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, textColor: [26, 32, 29], overflow: 'linebreak' },
    headStyles: { fillColor: [31, 61, 51], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 245, 238] }, // cream
    didDrawPage: () => {
      const page = doc.getCurrentPageInfo().pageNumber;
      const { width, height } = doc.internal.pageSize;
      doc.setFontSize(8);
      doc.setTextColor(92, 107, 101);
      doc.text(stamp, margin, height - 18);
      doc.text(`Page ${page}`, width - margin, height - 18, { align: 'right' });
    },
  });

  const filename = `${name}-${new Date().toLocaleDateString('en-CA')}.pdf`;
  doc.save(filename);
  return { filename, url: URL.createObjectURL(doc.output('blob')) };
}
