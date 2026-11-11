/**
 * PRYORA — Flexible Excel (.xlsx / .xls) & CSV Statement Import Wizard
 *
 * Supports:
 * - Multi-sheet Excel workbooks (.xlsx, .xls) with smart transaction-sheet scoring & instant tab switching across all steps
 * - Configurable Header Row detection (Auto-detect, No Header Row, or specific Row 1..20)
 * - Forgiving column mapping with optional Date column & Fallback Date support
 * - Inline-editable Verify & Edit table (inline Date picker, Merchant input, Type, Category, Account, and live Amount input)
 * - 1-click Auto-Fix for invalid rows, junk/summary row removal, and manual row addition
 * - Duplicate detection & ACID ledger commit
 */

import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Account, Category } from '../types';
import { apiRequest } from '../lib/api';
import { formatMinorUnits, SUPPORTED_CURRENCIES } from '../lib/currency';
import { useAuth } from '../context/AuthContext';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Download,
  Layers,
  SlidersHorizontal,
  Loader2,
  RefreshCw,
  X,
  Search,
  Check,
  Plus,
  Trash2,
  Wand2,
  ChevronDown,
  Calendar,
  DollarSign,
  Tag,
  CreditCard,
  FileText,
  HelpCircle,
  ArrowRightLeft,
  Sparkles,
} from 'lucide-react';

interface SearchableColumnSelectProps {
  label: string;
  value: string;
  headers: string[];
  sampleValue?: string;
  placeholder?: string;
  required?: boolean;
  onChange: (value: string) => void;
  getSampleForCol: (col: string) => string;
}

const SearchableColumnSelect: React.FC<SearchableColumnSelectProps> = ({
  label,
  value,
  headers,
  sampleValue,
  placeholder = '— Select Column —',
  required = false,
  onChange,
  getSampleForCol,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredHeaders = useMemo(() => {
    if (!searchTerm.trim()) return headers;
    const q = searchTerm.toLowerCase().trim();
    return headers.filter(h => h.toLowerCase().includes(q));
  }, [headers, searchTerm]);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 rounded-xl border text-left text-xs font-medium flex items-center justify-between gap-2 transition-all ${
          isOpen
            ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-white dark:bg-slate-800'
            : value
            ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white hover:border-slate-300 dark:hover:border-slate-600'
            : 'border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 hover:border-slate-300'
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate flex-1 font-semibold">
          {value || <span className="font-normal opacity-80">{placeholder}</span>}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
          {value && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              title="Clear mapping"
              className="hover:text-rose-500 p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180 text-emerald-500' : ''}`} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-h-64 flex flex-col">
          {/* Search Input */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/60 sticky top-0 z-10">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search columns..."
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1">
            {!required && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 rounded-lg text-left text-xs transition-colors flex items-center justify-between ${
                  !value
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                }`}
              >
                <span>{placeholder}</span>
                {!value && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              </button>
            )}

            {filteredHeaders.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">
                No matching columns found
              </div>
            ) : (
              filteredHeaders.map(col => {
                const isSelected = value === col;
                const sample = getSampleForCol(col);
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => {
                      onChange(col);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-2 rounded-lg text-left text-xs transition-colors flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{col}</div>
                      {sample && sample !== '—' && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">
                          Sample: {sample}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

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
  dateFormat?: string;
}

export interface PreviewRowItem {
  rowIndex: number;
  selected: boolean;
  date: string;
  merchant: string;
  type: 'expense' | 'income';
  amountMinor: number;
  amountDisplay: number;
  categoryId: string | null;
  categoryName: string;
  categorySource?: 'column' | 'auto' | 'new' | 'none';
  accountId: string | null;
  accountName: string;
  notes: string;
  isValid: boolean;
  errors: string[];
  isDuplicate: boolean;
}

interface ParsedSheetData {
  name: string;
  rawGrid: string[][];
  detectedHeaderRowIdx: number;
  headerMode: 'auto' | 'none' | number;
  headers: string[];
  rows: string[][];
  score: number;
}

interface SpreadsheetImportWizardProps {
  accounts: Account[];
  categories?: Category[];
  onDataChanged: () => void;
  onNavigateToLedger?: () => void;
  onCloseModal?: () => void;
  isModal?: boolean;
}

type WizardStep = 1 | 2 | 3 | 4;
type PreviewFilter = 'all' | 'ready' | 'duplicate' | 'error';

const HEADER_KEYWORDS = [
  'date',
  'txn',
  'merchant',
  'payee',
  'description',
  'particulars',
  'narration',
  'details',
  'memo',
  'title',
  'item',
  'expense',
  'vendor',
  'name',
  'amount',
  'cost',
  'price',
  'value',
  'total',
  'paid',
  'spent',
  'debit',
  'credit',
  'withdrawal',
  'deposit',
  'category',
  'type',
  'account',
  'notes',
  'remarks',
];

function isLikelyNumericCell(val: string): boolean {
  if (!val) return false;
  const cleaned = val
    .replace(/\((.+)\)/, '-$1')
    .replace(/\b(dr|cr|inr|rs\.?|usd|eur|gbp)\b/gi, '')
    .replace(/[^0-9.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return false;
  const n = Number(cleaned);
  return Number.isFinite(n) && Math.abs(n) > 0;
}

function isLikelyDateCell(val: string): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(trimmed)) return true;
  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(trimmed)) return true;
  if (/^\d{1,2}[\s\-/.]+[A-Za-z]{3,9}[\s\-/.,]+\d{2,4}/.test(trimmed)) return true;
  if (/^[A-Za-z]{3,9}[\s\-/.]+\d{1,2}[\s\-/.,]+\d{2,4}/.test(trimmed)) return true;
  if (/^\d{5}(\.\d+)?$/.test(trimmed)) {
    const serial = parseFloat(trimmed);
    if (serial >= 30000 && serial <= 65000) return true;
  }
  return false;
}

/**
 * Extracts headers and data rows from a 2D array of non-empty rows,
 * using either auto-detection, 'none' (first row is data), or a specific 0-based row index.
 */
function buildSheetTable(
  nonEmptyRows: string[][],
  sheetName: string,
  headerMode: 'auto' | 'none' | number = 'auto'
): Omit<ParsedSheetData, 'name' | 'rawGrid'> {
  if (nonEmptyRows.length === 0) {
    return {
      detectedHeaderRowIdx: 0,
      headerMode,
      headers: [],
      rows: [],
      score: 0,
    };
  }

  let detectedHeaderRowIdx = 0;
  let bestHeaderScore = -1;

  // Scan up to first 25 rows to locate the actual table header
  for (let i = 0; i < Math.min(25, nonEmptyRows.length); i++) {
    const candidate = nonEmptyRows[i];
    const nonEmptyCells = candidate.filter(c => c.length > 0);
    if (nonEmptyCells.length < 2) continue;

    let keywordMatches = 0;
    let pureNumbers = 0;
    for (const cell of nonEmptyCells) {
      const lower = cell.toLowerCase();
      if (HEADER_KEYWORDS.some(kw => lower.includes(kw))) {
        keywordMatches++;
      }
      if (/^[$₹€£¥]?\s*-?\d+([.,]\d+)?$/.test(cell.trim())) {
        pureNumbers++;
      }
    }

    // A good header row has keyword matches, multiple columns, and is not mostly numbers
    const rowHeaderScore = keywordMatches * 4 + Math.min(nonEmptyCells.length, 8) - pureNumbers * 3;
    if (keywordMatches >= 1 && rowHeaderScore > bestHeaderScore) {
      bestHeaderScore = rowHeaderScore;
      detectedHeaderRowIdx = i;
    }
  }

  // If the sheet has only 1 row total and no header keywords, treat it as 'none' (data row) so we don't consume the only row as header!
  let effectiveMode: 'auto' | 'none' | number = headerMode;
  if (headerMode === 'auto' && nonEmptyRows.length === 1 && bestHeaderScore < 5) {
    effectiveMode = 'none';
  }

  const maxCols = Math.max(
    1,
    ...nonEmptyRows.slice(0, 60).map(r => r.length)
  );

  let headers: string[] = [];
  let rawDataRows: string[][] = [];

  if (effectiveMode === 'none') {
    headers = Array.from({ length: maxCols }, (_, idx) => `Column ${idx + 1}`);
    rawDataRows = nonEmptyRows;
  } else {
    const targetHeaderIdx =
      typeof effectiveMode === 'number'
        ? Math.min(Math.max(0, effectiveMode), nonEmptyRows.length - 1)
        : detectedHeaderRowIdx;

    const rawHeaders = nonEmptyRows[targetHeaderIdx] || [];
    const seenHeaders = new Set<string>();
    for (let c = 0; c < maxCols; c++) {
      const baseName = rawHeaders[c]?.replace(/^["']|["']$/g, '').trim() || `Column ${c + 1}`;
      let uniqueName = baseName;
      let counter = 2;
      while (seenHeaders.has(uniqueName.toLowerCase())) {
        uniqueName = `${baseName} (${counter})`;
        counter++;
      }
      seenHeaders.add(uniqueName.toLowerCase());
      headers.push(uniqueName);
    }
    rawDataRows = nonEmptyRows.slice(targetHeaderIdx + 1);
  }

  // If slicing after header left 0 data rows (e.g. a 1-row sheet), fall back to treating row 0 as data row
  if (rawDataRows.length === 0 && nonEmptyRows.length > 0) {
    headers = Array.from({ length: maxCols }, (_, idx) => `Column ${idx + 1}`);
    rawDataRows = nonEmptyRows;
  }

  const dataRows = rawDataRows
    .map(row => {
      const normalized: string[] = [];
      for (let c = 0; c < headers.length; c++) {
        normalized.push(row[c] ?? '');
      }
      return normalized;
    })
    .filter(row => row.some(cell => cell.trim().length > 0));

  // Score how likely this sheet is to be the main Transactions / Expenses sheet
  let txLikeRows = 0;
  for (const r of dataRows.slice(0, 50)) {
    const hasNum = r.some(c => isLikelyNumericCell(c));
    const hasDate = r.some(c => isLikelyDateCell(c));
    const nonEmpty = r.filter(c => c.trim().length > 0).length;
    if (hasNum && hasDate) {
      txLikeRows += 3;
    } else if (hasNum && nonEmpty >= 2) {
      txLikeRows += 1;
    }
  }

  const lowerSheetName = sheetName.toLowerCase();
  let sheetNameBonus = 0;
  if (/expense|transaction|ledger|spend|log|statement|entry|entries|data|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(lowerSheetName)) {
    sheetNameBonus += 15;
  }
  if (/summary|dashboard|overview|instruction|readme|welcome|setup|chart|balance/i.test(lowerSheetName)) {
    sheetNameBonus -= 15;
  }

  const score = txLikeRows * 2 + Math.min(dataRows.length, 30) + (bestHeaderScore > 0 ? 10 : 0) + sheetNameBonus;

  return {
    detectedHeaderRowIdx,
    headerMode: effectiveMode,
    headers,
    rows: dataRows,
    score,
  };
}

export const SpreadsheetImportWizard: React.FC<SpreadsheetImportWizardProps> = ({
  accounts,
  categories: propCategories = [],
  onDataChanged,
  onNavigateToLedger,
  onCloseModal,
  isModal = false,
}) => {
  const { user } = useAuth();
  const currency = user?.currency || 'INR';
  const currencySymbol = SUPPORTED_CURRENCIES.find(c => c.code === currency)?.symbol || '₹';
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Wizard step state
  const [step, setStep] = useState<WizardStep>(1);

  // Step 1: File & Workbook state
  const [fileName, setFileName] = useState<string>('');
  const [fileType, setFileType] = useState<'excel' | 'csv' | null>(null);
  const [sheets, setSheets] = useState<ParsedSheetData[]>([]);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState<number>(0);
  const [defaultAccountId, setDefaultAccountId] = useState<string>(accounts[0]?.id || '');
  const [fallbackDate, setFallbackDate] = useState<string>(todayIso);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Step 2: Column Mapping state
  const [mapping, setMapping] = useState<CsvColumnMapping>({
    dateCol: '',
    merchantCol: '',
    amountCol: '',
    debitCol: '',
    creditCol: '',
    categoryCol: '',
    accountCol: '',
    typeCol: '',
    notesCol: '',
    dateFormat: 'auto',
  });
  const [amountMode, setAmountMode] = useState<'single' | 'split'>('single');

  // Step 3: Preview & Row Validation state
  const [previewRows, setPreviewRows] = useState<PreviewRowItem[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Category[]>(propCategories);
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>('all');
  const [previewSearch, setPreviewSearch] = useState<string>('');
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);
  const [createMissingCategories, setCreateMissingCategories] = useState<boolean>(true);
  const [autoCategorizedCount, setAutoCategorizedCount] = useState<number>(0);

  // Loading & Error states
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [committing, setCommitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 4: Commit Result
  const [commitSummary, setCommitSummary] = useState<{
    importedCount: number;
    skippedDuplicateCount: number;
    skippedInvalidCount: number;
    createdCategoriesCount: number;
    message: string;
  } | null>(null);

  const activeSheet: ParsedSheetData | null = sheets[selectedSheetIndex] || null;

  /**
   * Parses an uploaded .xlsx, .xls, or .csv file in the browser using SheetJS.
   * Scores all worksheets and automatically selects the worksheet most likely to contain transactions.
   */
  const processUploadedFile = (file: File) => {
    setErrorMessage(null);
    setCommitSummary(null);
    setFileName(file.name);

    const lowerName = file.name.toLowerCase();
    const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.ods');
    setFileType(isExcel ? 'excel' : 'csv');

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = e.target?.result;
        if (!data) {
          setErrorMessage('Could not read file contents.');
          return;
        }

        const workbook = XLSX.read(data, {
          type: 'array',
          raw: false,
          dateNF: 'yyyy-mm-dd',
        });

        const parsedSheets: ParsedSheetData[] = [];
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) continue;
          const rawAoA = XLSX.utils.sheet_to_json<any[]>(worksheet, {
            header: 1,
            raw: false,
            defval: '',
          });

          // Clean each row and strip completely blank rows
          const nonEmptyRows = rawAoA
            .map(row => (Array.isArray(row) ? row.map(cell => String(cell ?? '').trim()) : []))
            .filter(row => row.some(cell => cell.length > 0));

          if (nonEmptyRows.length === 0) continue;

          const extracted = buildSheetTable(nonEmptyRows, sheetName, 'auto');
          if (extracted.headers.length > 0 && extracted.rows.length > 0) {
            parsedSheets.push({
              name: sheetName,
              rawGrid: nonEmptyRows,
              ...extracted,
            });
          }
        }

        if (parsedSheets.length === 0) {
          setErrorMessage('No non-empty rows were found in this file.');
          setSheets([]);
          return;
        }

        // Automatically select the sheet with the highest transaction score
        let bestIdx = 0;
        let bestScore = parsedSheets[0].score;
        for (let i = 1; i < parsedSheets.length; i++) {
          if (parsedSheets[i].score > bestScore) {
            bestScore = parsedSheets[i].score;
            bestIdx = i;
          }
        }

        setSheets(parsedSheets);
        setSelectedSheetIndex(bestIdx);
      } catch (err: any) {
        console.error('Error parsing spreadsheet:', err);
        setErrorMessage(
          err.message || 'Could not parse spreadsheet file. Ensure it is a valid .xlsx, .xls, or .csv file.'
        );
      }
    };

    reader.onerror = () => {
      setErrorMessage('Failed to read the selected file.');
    };

    reader.readAsArrayBuffer(file);
  };

  /**
   * Allows the user to change which row is treated as the column header for the active sheet.
   */
  const handleHeaderModeChange = (newMode: 'auto' | 'none' | number) => {
    if (!activeSheet) return;
    const updated = buildSheetTable(activeSheet.rawGrid, activeSheet.name, newMode);
    const nextSheet: ParsedSheetData = {
      ...activeSheet,
      ...updated,
    };
    const nextSheets = sheets.map((s, idx) => (idx === selectedSheetIndex ? nextSheet : s));
    setSheets(nextSheets);

    // If user is on Step 2 or Step 3, immediately refresh column detection & preview
    if (step === 2 || step === 3) {
      requestServerPreview(nextSheet, undefined, step);
    }
  };

  /**
   * Switches active worksheet from any step (Step 1, Step 2, or Step 3).
   */
  const handleSelectWorksheet = (idx: number) => {
    const targetSheet = sheets[idx];
    if (!targetSheet) return;
    setSelectedSheetIndex(idx);
    setErrorMessage(null);
    if (step === 2 || step === 3) {
      requestServerPreview(targetSheet, undefined, step);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  /**
   * Downloads a sample .xlsx or .csv expense template so users can see the structure.
   */
  const handleDownloadSample = (format: 'xlsx' | 'csv') => {
    const sampleData = [
      ['Date', 'Merchant / Description', 'Category', 'Type', 'Amount', 'Notes'],
      ['2026-11-01', 'Whole Foods Market', 'Food & Dining', 'expense', '1450.00', 'Weekly groceries'],
      ['2026-11-03', 'Uber Trip Airport', 'Transportation', 'expense', '680.50', 'Client visit cab'],
      ['2026-11-05', 'Netflix Monthly', 'Subscriptions', 'expense', '649.00', '4K family plan'],
      ['2026-11-07', 'TechCorp Payroll', 'Salary', 'income', '85000.00', 'Monthly salary credit'],
      ['2026-11-09', 'Shell Fuel Station', 'Transportation', 'expense', '2200.00', 'Full tank petrol'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');

    if (format === 'xlsx') {
      XLSX.writeFile(wb, 'pryora_expense_import_template.xlsx');
    } else {
      XLSX.writeFile(wb, 'pryora_expense_import_template.csv', { bookType: 'csv' });
    }
  };

  /**
   * Calls the server preview endpoint to detect columns, normalize dates, auto-categorize merchants, and check duplicates.
   */
  const requestServerPreview = async (
    sheetToPreview: ParsedSheetData,
    customMapping?: CsvColumnMapping,
    targetStep: WizardStep = 2
  ) => {
    if (!sheetToPreview || sheetToPreview.rows.length === 0) {
      setErrorMessage('Selected sheet has no rows to preview.');
      return;
    }

    setLoadingPreview(true);
    setErrorMessage(null);

    try {
      const res = await apiRequest<any>('/api/data/import/csv/preview', {
        method: 'POST',
        body: JSON.stringify({
          headers: sheetToPreview.headers,
          rows: sheetToPreview.rows,
          mapping: customMapping,
          defaultAccountId: defaultAccountId || accounts[0]?.id,
          fallbackDate: fallbackDate || todayIso,
          useFallbackDateForInvalid: true,
        }),
      });

      const detected: CsvColumnMapping = res.detectedMapping || {
        dateCol: sheetToPreview.headers[0] || '',
        merchantCol: sheetToPreview.headers[1] || sheetToPreview.headers[0] || '',
        amountCol: sheetToPreview.headers[2] || sheetToPreview.headers[1] || '',
        dateFormat: 'auto',
      };

      setMapping(detected);
      if (detected.debitCol && detected.creditCol && !detected.amountCol) {
        setAmountMode('split');
      } else {
        setAmountMode('single');
      }

      if (Array.isArray(res.categories) && res.categories.length > 0) {
        setAvailableCategories(res.categories);
      }

      setAutoCategorizedCount(res.autoCategorizedCount || 0);

      const formattedRows: PreviewRowItem[] = (res.preview || []).map((r: any) => ({
        ...r,
        date: r.date || fallbackDate || todayIso,
        selected: Boolean(r.isValid && (!skipDuplicates || !r.isDuplicate)),
      }));

      setPreviewRows(formattedRows);
      setPreviewFilter('all');
      setStep(targetStep);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not generate import preview.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleProceedFromStep1 = () => {
    if (!activeSheet) {
      setErrorMessage('Please upload an Excel (.xlsx, .xls) or CSV file first.');
      return;
    }
    if (!defaultAccountId && accounts.length > 0) {
      setDefaultAccountId(accounts[0].id);
    }
    requestServerPreview(activeSheet, undefined, 2);
  };

  const handleQuickJumpToStep3 = () => {
    if (!activeSheet) return;
    requestServerPreview(activeSheet, undefined, 3);
  };

  const handleApplyMappingAndPreview = () => {
    if (!activeSheet) return;

    const effectiveMapping: CsvColumnMapping = {
      ...mapping,
      amountCol: amountMode === 'single' ? mapping.amountCol : '',
      debitCol: amountMode === 'split' ? mapping.debitCol : '',
      creditCol: amountMode === 'split' ? mapping.creditCol : '',
    };

    requestServerPreview(activeSheet, effectiveMapping, 3);
  };

  /**
   * Re-validates a single row after inline user edits in Step 3.
   */
  const revalidateRow = (row: PreviewRowItem): PreviewRowItem => {
    const errors: string[] = [];
    const cleanDate = (row.date || '').trim();
    if (!cleanDate || !/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      errors.push('Select a valid date');
    }
    if (!row.amountMinor || row.amountMinor <= 0) {
      errors.push('Enter amount > 0');
    }
    const isValid = errors.length === 0;
    return {
      ...row,
      merchant: row.merchant.trim() || 'Expense',
      isValid,
      errors,
      selected: isValid ? (row.selected || true) : false,
    };
  };

  // Row-level inline edits in Step 3
  const handleToggleRowSelect = (rowIndex: number) => {
    setPreviewRows(prev =>
      prev.map(r => (r.rowIndex === rowIndex ? { ...r, selected: !r.selected } : r))
    );
  };

  const handleToggleSelectAllValid = (checked: boolean) => {
    setPreviewRows(prev =>
      prev.map(r => {
        if (!r.isValid) return { ...r, selected: false };
        if (skipDuplicates && r.isDuplicate) return { ...r, selected: false };
        return { ...r, selected: checked };
      })
    );
  };

  const handleRowDateChange = (rowIndex: number, newDate: string) => {
    setPreviewRows(prev =>
      prev.map(r => {
        if (r.rowIndex !== rowIndex) return r;
        return revalidateRow({ ...r, date: newDate });
      })
    );
  };

  const handleRowAmountChange = (rowIndex: number, rawAmountStr: string) => {
    const parsed = parseFloat(rawAmountStr);
    const amountDisplay = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    const amountMinor = Math.round(amountDisplay * 100);

    setPreviewRows(prev =>
      prev.map(r => {
        if (r.rowIndex !== rowIndex) return r;
        return revalidateRow({
          ...r,
          amountDisplay,
          amountMinor,
        });
      })
    );
  };

  const handleRowTypeChange = (rowIndex: number, newType: 'expense' | 'income') => {
    setPreviewRows(prev =>
      prev.map(r => (r.rowIndex === rowIndex ? { ...r, type: newType } : r))
    );
  };

  const handleRowCategoryChange = (rowIndex: number, categoryId: string) => {
    const matched = availableCategories.find(c => c.id === categoryId);
    setPreviewRows(prev =>
      prev.map(r =>
        r.rowIndex === rowIndex
          ? {
              ...r,
              categoryId: matched ? matched.id : null,
              categoryName: matched ? matched.name : '',
              categorySource: 'column',
            }
          : r
      )
    );
  };

  const handleRowAccountChange = (rowIndex: number, accountId: string) => {
    const matched = accounts.find(a => a.id === accountId);
    setPreviewRows(prev =>
      prev.map(r =>
        r.rowIndex === rowIndex
          ? {
              ...r,
              accountId: matched ? matched.id : defaultAccountId,
              accountName: matched ? matched.name : r.accountName,
            }
          : r
      )
    );
  };

  const handleRowMerchantChange = (rowIndex: number, merchant: string) => {
    setPreviewRows(prev =>
      prev.map(r => (r.rowIndex === rowIndex ? { ...r, merchant } : r))
    );
  };

  const handleDeleteRow = (rowIndex: number) => {
    setPreviewRows(prev => prev.filter(r => r.rowIndex !== rowIndex));
  };

  const handleAddManualRow = () => {
    const nextIdx = previewRows.reduce((max, r) => Math.max(max, r.rowIndex), 0) + 1;
    const defaultCat = availableCategories.find(c => c.type === 'expense') || availableCategories[0];
    const defaultAcc = accounts.find(a => a.id === defaultAccountId) || accounts[0];
    const newRow: PreviewRowItem = {
      rowIndex: nextIdx,
      selected: false,
      date: fallbackDate || todayIso,
      merchant: 'New Expense Item',
      type: 'expense',
      amountMinor: 0,
      amountDisplay: 0,
      categoryId: defaultCat?.id || null,
      categoryName: defaultCat?.name || 'Uncategorized',
      categorySource: 'column',
      accountId: defaultAcc?.id || null,
      accountName: defaultAcc?.name || 'Default Account',
      notes: '',
      isValid: false,
      errors: ['Enter amount > 0'],
      isDuplicate: false,
    };
    setPreviewRows(prev => [newRow, ...prev]);
    setPreviewFilter('all');
  };

  /**
   * 1-Click helper: Fills missing/invalid dates with fallbackDate and ensures merchant names are non-empty.
   */
  const handleAutoFixDatesAndMerchants = () => {
    const safeDate = fallbackDate || todayIso;
    setPreviewRows(prev =>
      prev.map(r => {
        const fixedDate = /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? r.date : safeDate;
        const fixedMerchant = (r.merchant || '').trim() || 'Imported Transaction';
        return revalidateRow({
          ...r,
          date: fixedDate,
          merchant: fixedMerchant,
        });
      })
    );
  };

  /**
   * 1-Click helper: Removes non-transaction summary/header rows that have 0 amount.
   */
  const handleRemoveInvalidRows = () => {
    setPreviewRows(prev => prev.filter(r => r.isValid));
    setPreviewFilter('all');
  };

  // Update row selection when skipDuplicates checkbox is toggled
  const handleToggleSkipDuplicates = (skip: boolean) => {
    setSkipDuplicates(skip);
    setPreviewRows(prev =>
      prev.map(r => {
        if (!r.isValid) return { ...r, selected: false };
        if (r.isDuplicate) return { ...r, selected: !skip };
        return r;
      })
    );
  };

  // Filtered rows & summary counts in Step 3
  const stats = useMemo(() => {
    const total = previewRows.length;
    const valid = previewRows.filter(r => r.isValid).length;
    const duplicates = previewRows.filter(r => r.isDuplicate).length;
    const errors = previewRows.filter(r => !r.isValid).length;
    const selectedToCommit = previewRows.filter(
      r => r.selected && r.isValid && (!skipDuplicates || !r.isDuplicate)
    );
    const totalExpenseMinor = selectedToCommit
      .filter(r => r.type === 'expense')
      .reduce((acc, r) => acc + r.amountMinor, 0);
    const totalIncomeMinor = selectedToCommit
      .filter(r => r.type === 'income')
      .reduce((acc, r) => acc + r.amountMinor, 0);

    return {
      total,
      valid,
      duplicates,
      errors,
      selectedCount: selectedToCommit.length,
      totalExpenseMinor,
      totalIncomeMinor,
    };
  }, [previewRows, skipDuplicates]);

  const filteredPreviewRows = useMemo(() => {
    return previewRows.filter(r => {
      if (previewFilter === 'ready' && (!r.isValid || (skipDuplicates && r.isDuplicate))) return false;
      if (previewFilter === 'duplicate' && !r.isDuplicate) return false;
      if (previewFilter === 'error' && r.isValid) return false;
      if (previewSearch.trim()) {
        const q = previewSearch.toLowerCase().trim();
        const matchMerchant = r.merchant.toLowerCase().includes(q);
        const matchCat = (r.categoryName || '').toLowerCase().includes(q);
        const matchDate = (r.date || '').toLowerCase().includes(q);
        const matchNotes = (r.notes || '').toLowerCase().includes(q);
        if (!matchMerchant && !matchCat && !matchDate && !matchNotes) return false;
      }
      return true;
    });
  }, [previewRows, previewFilter, previewSearch, skipDuplicates]);

  /**
   * Step 4: Commits selected valid rows to the database in an ACID transaction.
   */
  const handleCommitImport = async () => {
    const rowsToSend = previewRows.filter(
      r => r.selected && r.isValid && (!skipDuplicates || !r.isDuplicate)
    );

    if (rowsToSend.length === 0) {
      setErrorMessage(
        'Please enter a positive amount for at least one row (and ensure its checkbox is selected) before committing.'
      );
      return;
    }

    setCommitting(true);
    setErrorMessage(null);

    try {
      const res = await apiRequest<any>('/api/data/import/csv/commit', {
        method: 'POST',
        body: JSON.stringify({
          rows: rowsToSend,
          defaultAccountId: defaultAccountId || accounts[0]?.id,
          skipDuplicates,
          createMissingCategories,
          sourceFileName:
            activeSheet && sheets.length > 1 ? `${fileName} (${activeSheet.name})` : fileName || 'Manual Import',
        }),
      });

      setCommitSummary({
        importedCount: res.importedCount ?? rowsToSend.length,
        skippedDuplicateCount: res.skippedDuplicateCount ?? 0,
        skippedInvalidCount: res.skippedInvalidCount ?? 0,
        createdCategoriesCount: res.createdCategoriesCount ?? 0,
        message: res.message || `Imported ${rowsToSend.length} transactions.`,
      });
      setStep(4);
      onDataChanged();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to commit imported transactions.');
    } finally {
      setCommitting(false);
    }
  };

  const handleResetWizard = () => {
    setStep(1);
    setFileName('');
    setFileType(null);
    setSheets([]);
    setSelectedSheetIndex(0);
    setPreviewRows([]);
    setCommitSummary(null);
    setErrorMessage(null);
  };

  // Helper to show sample value from active sheet for a given header
  const getSampleValue = (colName?: string): string => {
    if (!colName || !activeSheet || activeSheet.rows.length === 0) return '—';
    const idx = activeSheet.headers.indexOf(colName);
    if (idx < 0) return '—';
    for (let r = 0; r < Math.min(8, activeSheet.rows.length); r++) {
      const val = activeSheet.rows[r][idx]?.trim();
      if (val) return val;
    }
    return 'Empty in first rows';
  };

  return (
    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* Wizard Top Header & Step Progress */}
      <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/60 dark:bg-slate-900/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Excel & CSV Expense Import Wizard
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <span>.xlsx</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>.xls</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>.csv</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>Multi-sheet & Bank Statement Support</span>
            </p>
          </div>
        </div>

        {/* Stepper Navigation + Optional Modal Close */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            {[
              { num: 1, label: '1. File & Sheet' },
              { num: 2, label: '2. Map Columns' },
              { num: 3, label: '3. Verify Rows' },
              { num: 4, label: '4. Done' },
            ].map(item => {
              const isActive = step === item.num;
              const isCompleted = step > item.num;
              const canJump = Boolean(activeSheet && item.num < 4 && step !== 4);
              return (
                <button
                  key={item.num}
                  type="button"
                  disabled={!canJump && !isActive}
                  onClick={() => {
                    if (!activeSheet || step === 4) return;
                    if (item.num === 1) setStep(1);
                    else if (item.num === 2) requestServerPreview(activeSheet, mapping.amountCol || mapping.debitCol ? mapping : undefined, 2);
                    else if (item.num === 3) requestServerPreview(activeSheet, mapping.amountCol || mapping.debitCol ? mapping : undefined, 3);
                  }}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 font-bold'
                      : isCompleted || canJump
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 cursor-pointer'
                      : 'text-slate-400 dark:text-slate-500 cursor-default'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {isModal && onCloseModal && (
            <button
              type="button"
              onClick={onCloseModal}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close import wizard"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Persistent Multi-Sheet & Header Row Bar (Visible across Steps 1, 2, and 3 whenever a file is loaded) */}
      {sheets.length > 0 && activeSheet && step < 4 && (
        <div className="px-5 py-2.5 bg-slate-100/70 dark:bg-slate-800/50 border-b border-slate-200/70 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0">
              <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Worksheet:</span>
            </span>
            {sheets.map((sh, idx) => (
              <button
                key={sh.name}
                type="button"
                onClick={() => handleSelectWorksheet(idx)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  selectedSheetIndex === idx
                    ? 'bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 border border-slate-200/70 dark:border-slate-700'
                }`}
              >
                <span>{sh.name}</span>
                <span className="font-mono tabular-nums opacity-75">({sh.rows.length})</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs shrink-0">
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="wizard-header-row-select"
                className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap"
              >
                Header Row:
              </label>
              <select
                id="wizard-header-row-select"
                value={
                  activeSheet.headerMode === 'auto'
                    ? 'auto'
                    : activeSheet.headerMode === 'none'
                    ? 'none'
                    : String(activeSheet.headerMode)
                }
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'auto') handleHeaderModeChange('auto');
                  else if (val === 'none') handleHeaderModeChange('none');
                  else handleHeaderModeChange( parseInt(val, 10) );
                }}
                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200"
              >
                <option value="auto">
                  Auto-Detect (Row {activeSheet.detectedHeaderRowIdx + 1})
                </option>
                <option value="none">No Header Row (First row is data)</option>
                {activeSheet.rawGrid.slice(0, 15).map((r, idx) => {
                  const previewText = r
                    .filter(c => c.length > 0)
                    .slice(0, 3)
                    .join(' | ')
                    .slice(0, 38);
                  return (
                    <option key={idx} value={String(idx)}>
                      Row {idx + 1}: {previewText || 'Empty'}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Main Wizard Body */}
      <div className="p-5 sm:p-6 space-y-6">
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-800 dark:hover:text-rose-200 font-bold"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {/* =====================================================================
            STEP 1: UPLOAD SPREADSHEET & PICK WORKSHEET
           ===================================================================== */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Destination Account Selector */}
              <div>
                <label
                  htmlFor="import-default-account"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Default Destination Account
                </label>
                <select
                  id="import-default-account"
                  value={defaultAccountId}
                  onChange={e => setDefaultAccountId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type.replace('_', ' ')})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Used for all imported rows unless your spreadsheet has an explicit Account column.
                </p>
              </div>

              {/* Sample Spreadsheet Downloaders */}
              <div className="flex flex-col justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    Need a reference spreadsheet format?
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                    Download a sample template or upload any Excel/CSV sheet directly.
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2.5">
                  <button
                    type="button"
                    onClick={() => handleDownloadSample('xlsx')}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Sample Excel (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadSample('csv')}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Sample CSV (.csv)
                  </button>
                </div>
              </div>
            </div>

            {/* Drag and Drop Upload Zone */}
            <div
              onDragOver={e => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-colors relative ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
                  : fileName
                  ? 'border-emerald-500/60 bg-emerald-50/20 dark:bg-emerald-950/10'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 bg-slate-50/50 dark:bg-slate-800/40'
              }`}
            >
              <input
                data-testid="spreadsheet-file-input"
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={handleFileInputChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                aria-label="Upload Excel or CSV expense file"
              />
              <FileSpreadsheet className="w-9 h-9 text-emerald-600 dark:text-emerald-400 mx-auto mb-2.5" />
              {fileName ? (
                <div className="space-y-1">
                  <span className="text-sm font-bold text-slate-900 dark:text-white block">
                    {fileName}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums block">
                    {fileType === 'excel' ? 'Excel Workbook' : 'CSV File'}
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    {sheets.length} {sheets.length === 1 ? 'sheet' : 'sheets'} detected
                    {activeSheet ? (
                      <>
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        {activeSheet.rows.length} data rows in &ldquo;{activeSheet.name}&rdquo;
                      </>
                    ) : null}
                  </span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold block pt-1">
                    Click or drop another file to replace
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200 block">
                    Drop your Excel (.xlsx, .xls) or CSV file here, or click to browse
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">
                    Supports custom Excel sheets, multi-tab templates, and bank statements
                  </span>
                </div>
              )}
            </div>

            {/* Raw Preview of Selected Sheet */}
            {sheets.length > 0 && activeSheet && (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Sheet Preview: &ldquo;{activeSheet.name}&rdquo;
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    {activeSheet.headers.length} columns · {activeSheet.rows.length} rows
                  </span>
                </div>

                <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                      <tr>
                        {activeSheet.headers.slice(0, 8).map(h => (
                          <th key={h} className="px-3 py-2 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                      {activeSheet.rows.slice(0, 4).map((row, rIdx) => (
                        <tr key={rIdx}>
                          {activeSheet.headers.slice(0, 8).map((_, cIdx) => (
                            <td key={cIdx} className="px-3 py-2 whitespace-nowrap truncate max-w-[180px]">
                              {row[cIdx] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Step 1 Footer CTA */}
            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
              {activeSheet && (
                <button
                  type="button"
                  disabled={loadingPreview}
                  onClick={handleQuickJumpToStep3}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Skip to Verify & Edit Rows</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                disabled={!activeSheet || loadingPreview}
                onClick={handleProceedFromStep1}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 text-xs font-bold inline-flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
              >
                {loadingPreview ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing Columns...</span>
                  </>
                ) : (
                  <>
                    <span>Continue to Column Mapping</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* =====================================================================
            STEP 2: FLEXIBLE COLUMN MAPPING
           ===================================================================== */}
        {step === 2 && activeSheet && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Smart Column Mapping</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Map your file columns from <strong>{activeSheet.name}</strong> to PRYORA fields. Inspect real cell samples side-by-side.
                </p>
              </div>

              {/* Amount Mode Switcher: Single vs Split Debit/Credit */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start">
                <button
                  type="button"
                  onClick={() => setAmountMode('single')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    amountMode === 'single'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Single Amount Column
                </button>
                <button
                  type="button"
                  onClick={() => setAmountMode('split')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    amountMode === 'split'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Separate Debit & Credit
                </button>
              </div>
            </div>

            {/* Smart Column Mapping Table (Side-by-side view) */}
            <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                      <th className="px-4 py-3 w-[260px]">PRYORA Transaction Field</th>
                      <th className="px-4 py-3 w-[340px]">Mapped File Column</th>
                      <th className="px-4 py-3 min-w-[240px]">Row 1 Preview / Sample Value</th>
                      <th className="px-3 py-3 w-[110px] text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-slate-700 dark:text-slate-300">
                    
                    {/* 1. Date Field */}
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3.5 align-top">
                        <div className="flex items-start gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>Transaction Date</span>
                              <span className="text-[10px] text-slate-400 font-medium">(Optional)</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                              Date of expense or receipt. Falls back to Fallback Date if unmapped or blank.
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <SearchableColumnSelect
                          label="Transaction Date"
                          value={mapping.dateCol}
                          headers={activeSheet.headers}
                          placeholder="— No Date Column (Use Fallback Date) —"
                          onChange={val => setMapping({ ...mapping, dateCol: val })}
                          getSampleForCol={getSampleValue}
                        />
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-slate-500">Fallback:</span>
                          <input
                            type="date"
                            value={fallbackDate}
                            onChange={e => setFallbackDate(e.target.value || todayIso)}
                            className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-mono text-slate-800 dark:text-slate-200"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 font-mono tabular-nums text-slate-800 dark:text-slate-200 truncate">
                          {mapping.dateCol ? getSampleValue(mapping.dateCol) : `Uses fallback: ${fallbackDate}`}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 align-top text-center">
                        {mapping.dateCol ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            <Check className="w-3 h-3 stroke-[2.5]" /> Mapped
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            Fallback
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* 2. Merchant / Description Field */}
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3.5 align-top">
                        <div className="flex items-start gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>Merchant / Description</span>
                              <span className="text-rose-500 font-bold">*</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                              Payee name, vendor, particulars, narration, or purchase title.
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <SearchableColumnSelect
                          label="Merchant / Description"
                          value={mapping.merchantCol}
                          headers={activeSheet.headers}
                          placeholder="— Select Description Column —"
                          required={true}
                          onChange={val => setMapping({ ...mapping, merchantCol: val })}
                          getSampleForCol={getSampleValue}
                        />
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 truncate">
                          {getSampleValue(mapping.merchantCol)}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 align-top text-center">
                        {mapping.merchantCol ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            <Check className="w-3 h-3 stroke-[2.5]" /> Mapped
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                            Required
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* 3. Amount Field(s) */}
                    {amountMode === 'single' ? (
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3.5 align-top">
                          <div className="flex items-start gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                              <DollarSign className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span>Transaction Amount</span>
                                <span className="text-rose-500 font-bold">*</span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                                Numeric expense or credit amount. Signs and parentheses are handled automatically.
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 align-top">
                          <SearchableColumnSelect
                            label="Transaction Amount"
                            value={mapping.amountCol || ''}
                            headers={activeSheet.headers}
                            placeholder="— Select Amount Column —"
                            required={true}
                            onChange={val => setMapping({ ...mapping, amountCol: val })}
                            getSampleForCol={getSampleValue}
                          />
                        </td>
                        <td className="px-4 py-3.5 align-top">
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 font-mono tabular-nums text-slate-800 dark:text-slate-200 truncate font-semibold">
                            {getSampleValue(mapping.amountCol)}
                          </div>
                        </td>
                        <td className="px-3 py-3.5 align-top text-center">
                          {mapping.amountCol ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              <Check className="w-3 h-3 stroke-[2.5]" /> Mapped
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                              Required
                            </span>
                          )}
                        </td>
                      </tr>
                    ) : (
                      <>
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3.5 align-top">
                            <div className="flex items-start gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                                <DollarSign className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span>Debit / Withdrawal (Expense)</span>
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                                  Outflow, paid out, or debit column from your bank statement.
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <SearchableColumnSelect
                              label="Debit / Withdrawal Column"
                              value={mapping.debitCol || ''}
                              headers={activeSheet.headers}
                              placeholder="— Select Debit Column —"
                              onChange={val => setMapping({ ...mapping, debitCol: val })}
                              getSampleForCol={getSampleValue}
                            />
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 font-mono tabular-nums text-slate-800 dark:text-slate-200 truncate">
                              {getSampleValue(mapping.debitCol)}
                            </div>
                          </td>
                          <td className="px-3 py-3.5 align-top text-center">
                            {mapping.debitCol ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                <Check className="w-3 h-3 stroke-[2.5]" /> Mapped
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">Optional</span>
                            )}
                          </td>
                        </tr>

                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3.5 align-top">
                            <div className="flex items-start gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                                <DollarSign className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span>Credit / Deposit (Income)</span>
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                                  Inflow, deposited, or credit column from your statement.
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <SearchableColumnSelect
                              label="Credit / Deposit Column"
                              value={mapping.creditCol || ''}
                              headers={activeSheet.headers}
                              placeholder="— Select Credit Column —"
                              onChange={val => setMapping({ ...mapping, creditCol: val })}
                              getSampleForCol={getSampleValue}
                            />
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 font-mono tabular-nums text-slate-800 dark:text-slate-200 truncate">
                              {getSampleValue(mapping.creditCol)}
                            </div>
                          </td>
                          <td className="px-3 py-3.5 align-top text-center">
                            {mapping.creditCol ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                <Check className="w-3 h-3 stroke-[2.5]" /> Mapped
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">Optional</span>
                            )}
                          </td>
                        </tr>
                      </>
                    )}

                    {/* 4. Category Column */}
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3.5 align-top">
                        <div className="flex items-start gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                            <Tag className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>Expense Category</span>
                              <span className="text-[10px] text-slate-400 font-medium">(Optional)</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                              Matches your PRYORA categories. If unmapped, merchants are auto-categorized.
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <SearchableColumnSelect
                          label="Category Column"
                          value={mapping.categoryCol || ''}
                          headers={activeSheet.headers}
                          placeholder="— Auto-Categorize from Merchant Name —"
                          onChange={val => setMapping({ ...mapping, categoryCol: val })}
                          getSampleForCol={getSampleValue}
                        />
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 truncate">
                          {mapping.categoryCol ? getSampleValue(mapping.categoryCol) : 'Auto-match by merchant keyword'}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 align-top text-center">
                        {mapping.categoryCol ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            <Check className="w-3 h-3 stroke-[2.5]" /> Mapped
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                            Auto-Match
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* 5. Account Column */}
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3.5 align-top">
                        <div className="flex items-start gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>Source Account</span>
                              <span className="text-[10px] text-slate-400 font-medium">(Optional)</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                              Checking, Credit Card, or Cash account. Defaults to selected destination account.
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <SearchableColumnSelect
                          label="Account Column"
                          value={mapping.accountCol || ''}
                          headers={activeSheet.headers}
                          placeholder="— Use Default Destination Account —"
                          onChange={val => setMapping({ ...mapping, accountCol: val })}
                          getSampleForCol={getSampleValue}
                        />
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 truncate">
                          {mapping.accountCol ? getSampleValue(mapping.accountCol) : `Default: ${accounts.find(a => a.id === defaultAccountId)?.name || 'Default'}`}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 align-top text-center">
                        {mapping.accountCol ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            <Check className="w-3 h-3 stroke-[2.5]" /> Mapped
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            Default Acc
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* 6. Notes Column */}
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3.5 align-top">
                        <div className="flex items-start gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0 mt-0.5">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>Notes / Remarks</span>
                              <span className="text-[10px] text-slate-400 font-medium">(Optional)</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                              Additional reference numbers, invoice numbers, or transaction remarks.
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <SearchableColumnSelect
                          label="Notes Column"
                          value={mapping.notesCol || ''}
                          headers={activeSheet.headers}
                          placeholder="— None —"
                          onChange={val => setMapping({ ...mapping, notesCol: val })}
                          getSampleForCol={getSampleValue}
                        />
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 truncate">
                          {mapping.notesCol ? getSampleValue(mapping.notesCol) : '—'}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 align-top text-center">
                        {mapping.notesCol ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            <Check className="w-3 h-3 stroke-[2.5]" /> Mapped
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Optional</span>
                        )}
                      </td>
                    </tr>

                  </tbody>
                </table>
              </div>
            </div>

            {/* Step 2 Navigation Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to File & Sheet</span>
              </button>

              <button
                type="button"
                disabled={loadingPreview}
                onClick={handleApplyMappingAndPreview}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 text-xs font-bold inline-flex items-center gap-2 transition-colors disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                {loadingPreview ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Validating Rows...</span>
                  </>
                ) : (
                  <>
                    <span>Preview & Verify Transactions</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* =====================================================================
            STEP 3: ROW PREVIEW, INLINE EDITING & DUPLICATE RESOLUTION
           ===================================================================== */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Summary Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Selected to Import
                </span>
                <span className="text-lg font-black text-emerald-700 dark:text-emerald-400 font-mono tabular-nums mt-0.5 block">
                  {stats.selectedCount} <span className="text-xs font-normal text-slate-400">/ {stats.total}</span>
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Net Expense / Income
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-1 block truncate">
                  -{formatMinorUnits(stats.totalExpenseMinor, currency)}{' '}
                  <span className="text-emerald-600 dark:text-emerald-400">
                    +{formatMinorUnits(stats.totalIncomeMinor, currency)}
                  </span>
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Duplicates Detected
                </span>
                <span className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono tabular-nums mt-0.5 block">
                  {stats.duplicates}
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Needs Attention
                </span>
                <span className="text-lg font-black text-rose-600 dark:text-rose-400 font-mono tabular-nums mt-0.5 block">
                  {stats.errors}
                </span>
              </div>
            </div>

            {/* Smart Recovery Banner if any rows are invalid or if 0 rows are ready */}
            {(stats.errors > 0 || stats.selectedCount === 0) && (
              <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5 text-amber-900 dark:text-amber-200">
                  <p className="font-bold flex items-center gap-1.5">
                    <Wand2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>
                      {stats.selectedCount === 0
                        ? 'No rows are ready to import yet — edit any Date or Amount directly in the table below!'
                        : `${stats.errors} row(s) have missing dates or zero amounts (such as summary/title rows).`}
                    </span>
                  </p>
                  <p className="text-[11px] text-amber-700/90 dark:text-amber-300/80">
                    {sheets.length > 1
                      ? `Tip: Your workbook has ${sheets.length} worksheets. If your expenses are on another tab, click its tab in the Worksheet bar above.`
                      : 'You can type an amount directly into any row below, or use the quick actions on the right.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleAutoFixDatesAndMerchants}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-amber-100/60 dark:hover:bg-slate-700 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/70 font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Fix Missing Dates</span>
                  </button>
                  {stats.valid > 0 && stats.errors > 0 && (
                    <button
                      type="button"
                      onClick={handleRemoveInvalidRows}
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-slate-700 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove {stats.errors} Summary/Zero Row(s)</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Filter Bar + Options Toggles */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: `All Rows (${stats.total})` },
                  { id: 'ready', label: `Ready (${stats.selectedCount})` },
                  { id: 'duplicate', label: `Duplicates (${stats.duplicates})` },
                  { id: 'error', label: `Needs Attention (${stats.errors})` },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPreviewFilter(tab.id as PreviewFilter)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors font-mono tabular-nums whitespace-nowrap shrink-0 ${
                      previewFilter === tab.id
                        ? 'bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}

                {/* Search within preview */}
                <div className="relative ml-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={previewSearch}
                    onChange={e => setPreviewSearch(e.target.value)}
                    placeholder="Filter preview rows..."
                    className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Add Manual Row Button */}
                <button
                  type="button"
                  onClick={handleAddManualRow}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Add Row</span>
                </button>
              </div>

              {/* Duplicate & Auto-Category Checkboxes */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 dark:text-slate-300">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={e => handleToggleSkipDuplicates(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Skip duplicate transactions</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={createMissingCategories}
                    onChange={e => setCreateMissingCategories(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Create new categories from sheet</span>
                </label>
              </div>
            </div>

            {autoCategorizedCount > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <strong className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  {autoCategorizedCount} uncategorized row(s)
                </strong>{' '}
                were automatically matched to categories based on merchant keywords. You can edit any field inline below.
              </p>
            )}

            {/* High-Density Interactive & Editable Preview Table */}
            <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="max-h-[400px] overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5 w-8">
                        <input
                          type="checkbox"
                          checked={
                            stats.valid > 0 &&
                            stats.selectedCount ===
                              previewRows.filter(r => r.isValid && (!skipDuplicates || !r.isDuplicate)).length
                          }
                          onChange={e => handleToggleSelectAllValid(e.target.checked)}
                          aria-label="Select all valid rows"
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </th>
                      <th className="px-2 py-2.5 w-9 font-mono tabular-nums">#</th>
                      <th className="px-2.5 py-2.5">Date</th>
                      <th className="px-2.5 py-2.5">Merchant / Description</th>
                      <th className="px-2.5 py-2.5">Type</th>
                      <th className="px-2.5 py-2.5">Category</th>
                      <th className="px-2.5 py-2.5">Account</th>
                      <th className="px-2.5 py-2.5 text-right">Amount ({currencySymbol})</th>
                      <th className="px-2.5 py-2.5">Status</th>
                      <th className="px-2 py-2.5 w-8" aria-label="Row actions" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-slate-700 dark:text-slate-300">
                    {filteredPreviewRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                          No rows match the selected filter.
                        </td>
                      </tr>
                    ) : (
                      filteredPreviewRows.map(row => (
                        <tr
                          key={row.rowIndex}
                          className={`transition-colors ${
                            !row.isValid
                              ? 'bg-rose-50/40 dark:bg-rose-950/20'
                              : row.isDuplicate
                              ? 'bg-amber-50/40 dark:bg-amber-950/20'
                              : row.selected
                              ? 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                              : 'opacity-60 bg-slate-50/40 dark:bg-slate-900/40'
                          }`}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={row.selected && row.isValid}
                              onChange={() => handleToggleRowSelect(row.rowIndex)}
                              aria-label={`Select row ${row.rowIndex}`}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="px-2 py-2 font-mono tabular-nums text-slate-400">
                            {row.rowIndex}
                          </td>
                          {/* Inline Editable Date Input */}
                          <td className="px-2.5 py-2 whitespace-nowrap">
                            <input
                              type="date"
                              value={/^\d{4}-\d{2}-\d{2}$/.test(row.date || '') ? row.date : fallbackDate}
                              onChange={e => handleRowDateChange(row.rowIndex, e.target.value)}
                              className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono tabular-nums text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                            />
                          </td>
                          {/* Inline Editable Merchant Input */}
                          <td className="px-2.5 py-2 min-w-[160px]">
                            <input
                              type="text"
                              value={row.merchant}
                              placeholder="Enter merchant or description..."
                              onChange={e => handleRowMerchantChange(row.rowIndex, e.target.value)}
                              className="w-full px-2 py-1 rounded border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-emerald-500 bg-transparent focus:bg-white dark:focus:bg-slate-800 focus:outline-none font-medium text-slate-900 dark:text-white"
                            />
                            {row.notes && (
                              <span className="block text-[10px] text-slate-400 truncate max-w-[200px] px-2">
                                {row.notes}
                              </span>
                            )}
                          </td>
                          <td className="px-2.5 py-2">
                            <select
                              value={row.type}
                              onChange={e =>
                                handleRowTypeChange(row.rowIndex, e.target.value as 'expense' | 'income')
                              }
                              className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                            >
                              <option value="expense">Expense</option>
                              <option value="income">Income</option>
                            </select>
                          </td>
                          <td className="px-2.5 py-2 min-w-[145px]">
                            <select
                              value={row.categoryId || ''}
                              onChange={e => handleRowCategoryChange(row.rowIndex, e.target.value)}
                              className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                            >
                              {row.categorySource === 'new' && row.categoryName && !row.categoryId ? (
                                <option value="">+ New: {row.categoryName}</option>
                              ) : (
                                <option value="">Uncategorized</option>
                              )}
                              {availableCategories.map(c => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2.5 py-2 min-w-[125px]">
                            <select
                              value={row.accountId || defaultAccountId}
                              onChange={e => handleRowAccountChange(row.rowIndex, e.target.value)}
                              className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                            >
                              {accounts.map(a => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          {/* Inline Editable Amount Input */}
                          <td className="px-2.5 py-2 whitespace-nowrap text-right">
                            <div className="inline-flex items-center justify-end gap-1">
                              <span
                                className={`font-mono font-bold ${
                                  row.type === 'income'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {row.type === 'income' ? '+' : '-'}
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={row.amountDisplay > 0 ? row.amountDisplay : ''}
                                onChange={e => handleRowAmountChange(row.rowIndex, e.target.value)}
                                aria-label={`Amount for row ${row.rowIndex}`}
                                className={`w-24 px-2 py-1 rounded border text-right font-mono tabular-nums font-bold text-xs focus:outline-none ${
                                  row.amountMinor <= 0
                                    ? 'border-rose-300 dark:border-rose-700 bg-rose-50/60 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 focus:border-emerald-500'
                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-emerald-500'
                                }`}
                              />
                            </div>
                          </td>
                          <td className="px-2.5 py-2 whitespace-nowrap">
                            {!row.isValid ? (
                              <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{row.errors.join(', ')}</span>
                              </span>
                            ) : row.isDuplicate ? (
                              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>Duplicate</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                                <Check className="w-3.5 h-3.5 shrink-0" />
                                <span>Ready</span>
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(row.rowIndex)}
                              title="Remove row from import"
                              aria-label={`Remove row ${row.rowIndex}`}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Step 3 Footer Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Adjust Column Mapping</span>
              </button>

              <button
                type="button"
                disabled={committing || stats.selectedCount === 0}
                onClick={handleCommitImport}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
              >
                {committing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Importing {stats.selectedCount} Transactions...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Commit {stats.selectedCount} Transaction(s) to Ledger</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* =====================================================================
            STEP 4: IMPORT COMPLETION SUMMARY
           ===================================================================== */}
        {step === 4 && commitSummary && (
          <div className="py-6 text-center space-y-5 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Import Completed Successfully
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                {commitSummary.message}
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              <span>Imported: {commitSummary.importedCount}</span>
              <span aria-hidden="true">·</span>
              <span>Duplicates Skipped: {commitSummary.skippedDuplicateCount}</span>
              {commitSummary.createdCategoriesCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>New Categories: {commitSummary.createdCategoriesCount}</span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleResetWizard}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Import Another File</span>
              </button>

              {onNavigateToLedger && (
                <button
                  type="button"
                  onClick={() => {
                    if (onCloseModal) onCloseModal();
                    onNavigateToLedger();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>View in Transactions Ledger</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {isModal && onCloseModal && !onNavigateToLedger && (
                <button
                  type="button"
                  onClick={onCloseModal}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>Done</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
