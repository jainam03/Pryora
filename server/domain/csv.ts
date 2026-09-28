/**
 * PRYORA Financial Domain - RFC-4180 CSV Engine
 * 
 * Supports:
 * - Robust quoted-string parsing with escaped quotes ("") and embedded commas/newlines
 * - Automatic delimiter detection (comma, semicolon, tab)
 * - Header detection & intelligent column mapping
 * - Validation & transaction conversion
 * - CSV generation with proper escaping
 */

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  delimiter: string;
}

export interface CsvColumnMapping {
  dateCol: string;
  amountCol?: string;
  debitCol?: string;
  creditCol?: string;
  merchantCol: string;
  categoryCol?: string;
  accountCol?: string;
  typeCol?: string;
  notesCol?: string;
  dateFormat?: string; // 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'auto'
}

export interface CsvPreviewItem {
  rowIndex: number;
  date: string;
  merchant: string;
  type: 'expense' | 'income' | 'transfer';
  amountMinor: number;
  amountDisplay: number;
  categoryName?: string;
  accountName?: string;
  notes?: string;
  isValid: boolean;
  errors: string[];
  isPotentialDuplicate?: boolean;
}

/**
 * Detects the delimiter used in a CSV string.
 */
export function detectDelimiter(text: string): string {
  const sample = text.slice(0, 4096);
  const commaCount = (sample.match(/,/g) || []).length;
  const semicolonCount = (sample.match(/;/g) || []).length;
  const tabCount = (sample.match(/\t/g) || []).length;

  if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
  if (semicolonCount > commaCount) return ';';
  return ',';
}

/**
 * Parses a CSV string according to RFC-4180.
 */
export function parseCsvString(csvText: string, delimiter?: string): ParsedCsv {
  if (!csvText || !csvText.trim()) {
    return { headers: [], rows: [], delimiter: ',' };
  }

  const delim = delimiter || detectDelimiter(csvText);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++;
        } else {
          // Closing quote
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delim) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') i++;
        currentRow.push(currentField.trim());
        if (currentRow.some(field => field.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some(field => field.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(field => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) {
    return { headers: [], rows: [], delimiter: delim };
  }

  const headers = rows[0].map(h => h.replace(/^["']|["']$/g, '').trim());
  const dataRows = rows.slice(1);

  return {
    headers,
    rows: dataRows,
    delimiter: delim,
  };
}

/**
 * Intelligent guess for column mappings based on common banking & finance header names.
 */
export function guessColumnMapping(headers: string[]): CsvColumnMapping {
  const cleanHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  const findHeader = (patterns: string[]): string => {
    for (let i = 0; i < headers.length; i++) {
      const h = cleanHeaders[i];
      if (patterns.some(p => h.includes(p))) {
        return headers[i];
      }
    }
    return '';
  };

  const dateCol = findHeader(['date', 'time', 'timestamp', 'posted']);
  const debitCol = findHeader(['debit', 'withdrawal', 'out', 'paidout']);
  const creditCol = findHeader(['credit', 'deposit', 'in', 'received']);
  const amountCol = (!debitCol || !creditCol) ? findHeader(['amount', 'sum', 'total', 'transactionamount']) : '';
  const merchantCol = findHeader(['merchant', 'payee', 'description', 'details', 'name', 'particulars', 'narrative']) || headers[0] || '';
  const categoryCol = findHeader(['category', 'tag', 'group', 'classification']);
  const accountCol = findHeader(['account', 'bank', 'wallet', 'source']);
  const notesCol = findHeader(['notes', 'remark', 'memo', 'comment']);
  const typeCol = findHeader(['type', 'direction', 'crdr']);

  return {
    dateCol,
    amountCol,
    debitCol,
    creditCol,
    merchantCol,
    categoryCol,
    accountCol,
    typeCol,
    notesCol,
    dateFormat: 'auto',
  };
}

/**
 * Normalizes date strings into ISO format YYYY-MM-DD.
 */
export function normalizeDate(dateStr: string, formatHint: string = 'auto'): string | null {
  if (!dateStr || !dateStr.trim()) return null;
  const clean = dateStr.trim();

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

  // Split by slash, dash, dot
  const parts = clean.split(/[-/.]/);
  if (parts.length >= 3) {
    let y = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    let d = parseInt(parts[2], 10);

    if (parts[0].length === 4) {
      // YYYY/MM/DD
      y = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
      d = parseInt(parts[2], 10);
    } else if (parts[2].length === 4 || parts[2].length === 2) {
      const yearPart = parts[2].length === 2 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10);
      if (formatHint === 'MM/DD/YYYY' || (parseInt(parts[0], 10) <= 12 && parseInt(parts[1], 10) > 12)) {
        // MM/DD/YYYY
        m = parseInt(parts[0], 10);
        d = parseInt(parts[1], 10);
        y = yearPart;
      } else {
        // DD/MM/YYYY (default international/Indian)
        d = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10);
        y = yearPart;
      }
    }

    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1970 && y <= 2100) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

/**
 * Escapes field for CSV serialization.
 */
export function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports transactions to CSV string.
 */
export function exportTransactionsToCsv(
  transactions: Array<{
    date: string;
    type: string;
    merchant: string;
    categoryName: string;
    accountName: string;
    amountDisplay: number;
    notes?: string | null;
    tags?: string | null;
  }>
): string {
  const headers = ['Date', 'Type', 'Merchant / Source', 'Category', 'Account', 'Amount', 'Notes', 'Tags'];
  const lines = [headers.map(escapeCsvField).join(',')];

  for (const t of transactions) {
    const row = [
      t.date,
      t.type,
      t.merchant,
      t.categoryName,
      t.accountName,
      t.amountDisplay.toFixed(2),
      t.notes || '',
      t.tags || '',
    ];
    lines.push(row.map(escapeCsvField).join(','));
  }

  return lines.join('\n');
}
