// Utility helpers for CSV and PDF exports across components
// Lightweight, no framework dependencies besides jsPDF (only imported where used to avoid bundling everywhere)

// Escape a single CSV cell value
export function escapeCsv(value) {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// Build CSV string from header array and rows (array of arrays)
export function buildCsv(header, rows) {
  const headLine = header.map(escapeCsv).join(',');
  const dataLines = rows.map(r => r.map(escapeCsv).join(',')).join('\n');
  return headLine + (rows.length ? '\n' + dataLines : '');
}

// Trigger a browser download for a CSV string
export function downloadCsv(csvString, baseName) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Generic PDF table export using jsPDF + autoTable
export function exportPdfTable({ title = 'Export', subtitle = '', head, body, fileName, headColor = [31,119,180] }) {
  // Lazy import jsPDF/autoTable to avoid loading unless used
  const jsPDF = require('jspdf').default || require('jspdf');
  require('jspdf-autotable');
  const doc = new jsPDF();
  doc.setFontSize(16); doc.text('Bin Masud Kuku', 14, 14);
  doc.setFontSize(11); doc.text(title, 14, 22);
  if (subtitle) { doc.setFontSize(9); doc.text(subtitle, 14, 28); }
  // @ts-ignore
  doc.autoTable({ startY: subtitle ? 32 : 28, head, body, styles: { fontSize: 9 }, headStyles: { fillColor: headColor } });
  doc.save(`${fileName}-${new Date().toISOString().slice(0,10)}.pdf`);
}

// Fetch helper to retrieve up to 1000 filtered items for export
export async function fetchAllForExport(path, filterParams = {}) {
  const params = new URLSearchParams();
  params.set('page', '1');
  params.set('limit', '1000');
  Object.entries(filterParams).forEach(([k,v]) => { if (v) params.set(k, v); });
  const api = require('../services/api').default || require('../services/api');
  const res = await api.get(`${path}?${params.toString()}`);
  return res.data?.data || res.data || [];
}
