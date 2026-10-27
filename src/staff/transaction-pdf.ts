import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface PdfTransaction {
  documentType: 'Invoice' | 'Receipt';
  reference: string;
  transactionReference: string;
  date: string;
  method: string;
  status: string;
  paymentState: string;
  customerName: string;
  memberId?: string;
  email?: string;
  phone?: string;
  items: { description: string; quantity: number; total: number }[];
  amount: number;
  fees: number;
  isSimulated: boolean;
}

const ink = rgb(0.09, 0.20, 0.16);
const muted = rgb(0.35, 0.44, 0.40);
const green = rgb(0.09, 0.30, 0.22);
const line = rgb(0.85, 0.89, 0.86);
const money = (value: number) => `PHP ${new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value)}`;

// Standard PDF fonts use WinAnsi. Replace unsupported characters instead of
// failing to generate a receipt because a customer name contains one.
const printable = (value: string) => value.replace(/[\u2010-\u2015]/g, '-')
  .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');

export async function createTransactionPdf(transaction: PdfTransaction): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = 595.28;
  const height = 841.89;
  const margin = 46;
  let page = pdf.addPage([width, height]);
  let y = height - 54;

  const text = (value: string, x: number, top: number, size = 10, strong = false, color = ink) => {
    page.drawText(printable(value), { x, y: top - size, size, font: strong ? bold : regular, color });
  };
  const rule = (top: number) => page.drawLine({ start: { x: margin, y: top },
    end: { x: width - margin, y: top }, thickness: 0.8, color: line });
  const wrap = (value: string, maxWidth: number, size = 10, strong = false) => {
    const font = strong ? bold : regular;
    const words = printable(value).split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) { current = candidate; continue; }
      if (current) { lines.push(current); current = ''; }
      let part = '';
      for (const character of word) {
        if (font.widthOfTextAtSize(part + character, size) > maxWidth && part) {
          lines.push(part);
          part = '';
        }
        part += character;
      }
      current = part;
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  };
  const wrappedText = (value: string, x: number, top: number, maxWidth: number,
    size = 10, strong = false, color = ink) => {
    const lines = wrap(value, maxWidth, size, strong);
    lines.forEach((part, index) => text(part, x, top - index * (size + 4), size, strong, color));
    return lines.length * (size + 4);
  };
  const newPage = () => {
    page = pdf.addPage([width, height]);
    y = height - 50;
    text(`VinAthletics Gym  |  ${transaction.documentType} ${transaction.reference}`, margin, y, 9, true, muted);
    y -= 28;
    rule(y);
    y -= 22;
  };
  const ensure = (space: number) => { if (y - space < 62) newPage(); };

  page.drawRectangle({ x: 0, y: height - 137, width, height: 137, color: green });
  text('VINATHLETICS GYM', margin, height - 40, 21, true, rgb(1, 1, 1));
  text(transaction.documentType.toUpperCase(), margin, height - 74, 12, true, rgb(0.72, 0.90, 0.79));
  wrappedText(transaction.reference, margin, height - 97, width - 2 * margin, 9, false, rgb(1, 1, 1));
  y = height - 163;

  text('PAYMENT DETAILS', margin, y, 10, true, green);
  y -= 25;
  const details: [string, string][] = [
    ['Payment date', transaction.date],
    ['Transaction reference', transaction.transactionReference],
    ['Payment method', transaction.method],
    ['Payment status', `${transaction.status} (${transaction.paymentState})`],
  ];
  for (const [label, value] of details) {
    text(label, margin, y, 9, false, muted);
    const used = wrappedText(value, margin + 145, y, width - 2 * margin - 145, 9, true);
    y -= Math.max(20, used + 3);
  }
  y -= 3;
  rule(y);
  y -= 25;

  text('BILLED TO', margin, y, 10, true, green);
  y -= 21;
  y -= wrappedText(transaction.customerName || 'Walk-in', margin, y, width - 2 * margin, 12, true) + 2;
  for (const detail of [transaction.memberId && `Member ID: ${transaction.memberId}`,
    transaction.email, transaction.phone].filter((item): item is string => Boolean(item))) {
    y -= wrappedText(detail, margin, y, width - 2 * margin, 9, false, muted) + 1;
  }
  y -= 15;
  rule(y);
  y -= 26;

  ensure(58);
  text('DESCRIPTION / PURCHASED PLAN', margin, y, 9, true, muted);
  text('AMOUNT', width - margin - 52, y, 9, true, muted);
  y -= 19;
  rule(y);
  y -= 13;
  const items = transaction.items.length ? transaction.items : [{
    description: 'Gym purchase', quantity: 1, total: transaction.amount,
  }];
  for (const item of items) {
    const description = item.quantity > 1 ? `${item.description} x ${item.quantity}` : item.description;
    const lines = wrap(description, 345, 10);
    ensure(lines.length * 15 + 16);
    lines.forEach((part, index) => text(part, margin, y - index * 15, 10));
    const value = money(item.total);
    text(value, width - margin - regular.widthOfTextAtSize(value, 10), y, 10, true);
    y -= lines.length * 15 + 10;
    rule(y);
    y -= 13;
  }

  ensure(125);
  const total = transaction.amount + transaction.fees;
  const summary = [['Amount', money(transaction.amount)], ['Fees', money(transaction.fees)]];
  for (const [label, value] of summary) {
    text(label, width - margin - 245, y, 10, false, muted);
    text(value, width - margin - bold.widthOfTextAtSize(value, 10), y, 10, true);
    y -= 22;
  }
  page.drawLine({ start: { x: width - margin - 245, y },
    end: { x: width - margin, y }, thickness: 1.5, color: green });
  y -= 12;
  const totalLabel = transaction.status === 'Paid' ? 'Total paid' : 'Total due';
  const totalValue = money(total);
  text(totalLabel, width - margin - 245, y, 12, true, green);
  text(totalValue, width - margin - bold.widthOfTextAtSize(totalValue, 12), y, 12, true, green);
  y -= 40;

  if (transaction.isSimulated) {
    ensure(35);
    y -= wrappedText('SIMULATED TEST TRANSACTION - NO REAL PAYMENT WAS PROCESSED.',
      margin, y, width - 2 * margin, 9, true, rgb(0.55, 0.19, 0.14)) + 10;
  }
  ensure(35);
  rule(y);
  y -= 20;
  wrappedText('Thank you for choosing VinAthletics. Please retain this document for your records.',
    margin, y, width - 2 * margin, 9, false, muted);

  pdf.setTitle(`VinAthletics ${transaction.documentType} ${transaction.reference}`);
  pdf.setSubject('Gym transaction document');
  return pdf.save();
}
