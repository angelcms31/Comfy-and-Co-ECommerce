import { jsPDF } from 'jspdf';
import { COURIER, STORE_ADDRESS, STORE_PHONE } from './constants';
import { formatDateTime } from './dates';
import { parseShipping, paymentLabel } from './tracking';
import type { OrderWithItems } from '@/types/models';

// A5 portrait, in points
const W = 420;
const H = 595;
const M = 28;
const FOREST: [number, number, number] = [31, 61, 51];
const INK: [number, number, number] = [26, 32, 29];
const MUTED: [number, number, number] = [92, 107, 101];
const LINE: [number, number, number] = [226, 222, 212];

// the built-in font has no ₱ glyph
const php = (n: number) => `PHP ${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// the store logo as a data URL, or null if it can't be loaded (the receipt is fine without it)
function loadLogo(): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d')?.drawImage(img, 0, 0);
        resolve(c.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = '/logo.png';
  });
}

// Builds and downloads the delivery receipt in one click: store header, deliver-to, items, Lalamove booking,
// what to collect, and the rider's QR code (qr is the PNG data URL from the qrcode package). Same content as the
// on-screen sheet in pages/admin/ReceiptPage.tsx.
export async function downloadReceiptPdf(order: OrderWithItems, qr: string): Promise<string> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a5' });
  const { address } = parseShipping(order.shipping_add);
  const cod = order.payment_method === 'COD' || order._temp_payment_status !== 'Paid';
  const logo = await loadLogo();

  // header
  let x = M;
  if (logo) {
    doc.addImage(logo, 'PNG', M, M, 40, 40);
    x = M + 48;
  }
  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...FOREST).text('comfy&co', x, M + 18);
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED);
  doc.text(doc.splitTextToSize(STORE_ADDRESS, 200), x, M + 29);
  doc.text(STORE_PHONE, x, M + 46);
  doc.setFontSize(7.5).text('DELIVERY RECEIPT', W - M, M + 10, { align: 'right' });
  doc.setFont('courier', 'bold').setFontSize(16).setTextColor(...INK).text(order.order_num, W - M, M + 28, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED).text(`Placed ${formatDateTime(order.placed_at)}`, W - M, M + 40, { align: 'right' });
  doc.setDrawColor(...INK).setLineWidth(1.2).line(M, M + 56, W - M, M + 56);

  // QR code on the right, the details on the left
  const qrSize = 130;
  const qrX = W - M - qrSize;
  const qrY = M + 70;
  doc.addImage(qr, 'PNG', qrX, qrY, qrSize, qrSize);
  doc.setDrawColor(...LINE).setLineWidth(0.6).roundedRect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, 4, 4);
  doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...INK).text('Rider: scan at the door', qrX + qrSize / 2, qrY + qrSize + 13, { align: 'center' });
  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED);
  doc.text(doc.splitTextToSize('Opens the delivery page: confirm with photos, or log a failed attempt. No app or login needed.', qrSize), qrX + qrSize / 2, qrY + qrSize + 24, { align: 'center' });

  const colW = qrX - M - 16;
  let y = M + 72;
  const label = (t: string) => {
    doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(...MUTED).text(t.toUpperCase(), M, y);
    y += 11;
  };

  label('Deliver to');
  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...INK).text(order.customer_name, M, y);
  y += 14;
  if (order.customer_mobile) {
    doc.setFontSize(9.5).text(order.customer_mobile, M, y);
    y += 12;
  }
  doc.setFont('helvetica', 'normal').setFontSize(9);
  const addr = doc.splitTextToSize(address, colW) as string[];
  doc.text(addr, M, y);
  y += addr.length * 11 + 2;
  if (order.delivery_note) {
    const note = doc.splitTextToSize(`Note for rider: ${order.delivery_note}`, colW - 8) as string[];
    doc.setFillColor(255, 248, 220).roundedRect(M, y - 8, colW, note.length * 10 + 8, 3, 3, 'F');
    doc.setFontSize(8).text(note, M + 4, y);
    y += note.length * 10 + 6;
  }

  y += 6;
  label('Items');
  doc.setDrawColor(...LINE).setLineWidth(0.5).line(M, y - 7, M + colW, y - 7);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...INK);
  for (const i of order.items) {
    const lines = doc.splitTextToSize(i.item_name, colW - 30) as string[];
    doc.text(lines, M, y);
    doc.setFont('helvetica', 'bold').text(`x ${i.quantity}`, M + colW, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += lines.length * 11 + 2;
    doc.line(M, y - 7, M + colW, y - 7);
  }

  y += 6;
  const row = (k: string, v: string) => {
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUTED).text(k, M, y);
    doc.setFont('helvetica', 'bold').setTextColor(...INK).text(v, M + 70, y);
    y += 12;
  };
  row(`${COURIER} vehicle`, `${order.vehicle ?? '-'}${order.trips > 1 ? ` x ${order.trips} trips` : ''}`);
  row('Distance', order.distance_km != null ? `${order.distance_km} km` : '-');
  row('Payment', paymentLabel(order));

  // what the rider collects; the box sits below both columns
  y = Math.max(y + 6, qrY + qrSize + 44);
  doc.setDrawColor(...(cod ? INK : LINE)).setLineWidth(cod ? 1.5 : 0.6).roundedRect(M, y, W - 2 * M, 44, 5, 5);
  doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(...MUTED).text(cod ? 'COLLECT FROM CUSTOMER' : 'NOTHING TO COLLECT', M + 10, y + 14);
  doc.setFontSize(16).setTextColor(...INK).text(cod ? php(order.total_amt) : 'PAID via GCash', M + 10, y + 34);

  // footer
  doc.setDrawColor(...LINE).setLineWidth(0.5).line(M, H - 40, W - M, H - 40);
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED);
  doc.text(`Please handle with care. Questions? Call ${STORE_PHONE}. Thank you for choosing comfy&co!`, W / 2, H - 28, { align: 'center' });

  const filename = `receipt-${order.order_num}.pdf`;
  doc.save(filename);
  return filename;
}
