# PRYORA — Excel (.xlsx / .xls) & CSV Statement Import Wizard

This update introduces a complete, multi-step Excel and CSV expense import workflow that parses multi-sheet spreadsheets and bank statements, maps custom columns, auto-categorizes uncategorized merchants, flags duplicate charges, and commits verified transactions with double-entry balance updates.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product and design decisions have been aligned based on your input and are ready for your review before implementation begins:

- **Confirmed Decision 1 — Multi-Format & Multi-Sheet Support**: Full support for Excel workbooks (`.xlsx`, `.xls`) alongside `.csv` files, including an interactive worksheet selector when an Excel workbook contains multiple tabs and a downloadable sample template for quick reference.
- **Confirmed Decision 2 — Step-by-Step Import Wizard**: A guided 4-step workflow (**Upload & Sheet Selection → Column Mapping → Interactive Row Preview & Duplicate Resolution → Transactional Commit**) with automatic merchant categorization fallback for rows missing category labels.
- **Confirmed Decision 3 — Dual Launch Entry Points**: Accessible directly from a prominent **Import Excel / CSV** action button in the **Transactions Ledger** header (via a modal wizard) as well as embedded full-bleed inside the **Data Hub** screen.

---

## 1. Overview & Core Concept

- **What It Does**: Enables users to bring historical or monthly expense data from any bank statement (HDFC, ICICI, SBI, Chase, Amex, etc.) or personal Excel tracker into PRYORA without manual re-entry or formatting lock-in.
- **Target Audience / Persona**: Individuals and power users migrating from personal Excel expense sheets or importing monthly bank and credit card statements into their sovereign ledger.
- **Key Value**: Eliminates silent import errors and broken endpoint calls by giving users complete visibility and row-level control—automatically normalizing dates (including Excel serial dates), resolving signed or split Debit/Credit columns, auto-categorizing merchants, and preventing accidental duplicate ledger entries.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Step 1 — File Selection & Worksheet Picker**: Users drag-and-drop or browse for a `.xlsx`, `.xls`, or `.csv` file (or download a sample template). If an Excel workbook has multiple sheets, an inline sheet selector appears immediately with row counts per sheet and a live raw table preview of the first few rows. Users also select their default destination account.
  2. **Step 2 — Intelligent Column Mapping**: PRYORA auto-detects columns (`Date`, `Merchant / Description`, `Amount` or separate `Debit` / `Credit`, `Category`, `Account`, `Type`, `Notes`, and `Date Format`). Users can override any column mapping via dropdowns and see sample values from the first row next to each field.
  3. **Step 3 — Row-Level Preview, Auto-Categorization & Duplicate Check**: Displays a high-density inspection table with summary metrics (Total Rows, Valid & Ready, Potential Duplicates, Invalid Rows). Users can toggle *"Skip duplicate transactions"*, filter the preview by status (All, Valid, Duplicates, Errors), edit individual row categories or transaction types inline, or exclude specific rows via checkboxes before committing.
  4. **Step 4 — Atomic Ledger Commit & Summary**: Commits all selected valid rows in a single ACID database transaction, recalculates account balances in minor currency units, and presents an import completion summary with a one-click jump to the updated Ledger.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Precision financial SaaS workspace with clean hairline borders, high-density tabular data grids, and dual-theme (Light / Dark) parity.
  - *Color Palette & Mood*:
    - **60% Dominant Neutral Canvas**: Crisp slate surfaces (`bg-slate-50` in light mode, `bg-slate-950` in dark mode).
    - **30% Structural Surfaces**: Single-elevation containers (`bg-white/80 dark:bg-slate-900/80`) with subtle hairline borders (`border-slate-200/80 dark:border-white/10`).
    - **10% Semantic Accents**: Emerald (`#10B981`) for primary actions and valid rows, Amber (`#F59E0B`) paired with text labels for duplicate warnings, and Rose (`#F43F5E`) paired with error descriptions for invalid rows.
  - *Typography & Hierarchy*: Crisp geometric sans headings paired with strict tabular numerals (`font-mono tabular-nums`) across all row indices, dates, currency amounts, and summary counters so decimal points and figures align vertically without jitter.
  - *Component Styling & Layout*: Compact data table rows (`36px–44px` height), left-aligned text columns, right-aligned monetary columns, single-line controls (`whitespace-nowrap shrink-0`), and unboxed inline metadata with `·` separators in accordance with anti-slop and zero-pill discipline.

- **Interactive Feedback & Motion**:
  - Instant drag-and-drop border highlight (`<= 150ms` transition).
  - Step progress indicator at the top of the wizard allowing backward navigation to adjust column mappings or switch Excel sheets without re-uploading the file.
  - Clear empty, parsing, and validation states with actionable inline error explanations (e.g., *"Row 14: Invalid date format"*, *"Row 22: Amount must be greater than zero"*).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Client-Side Excel Workbook Parsing + Unified Server Validation Pipeline**
  - *Chosen Approach*: Parse `.xlsx` and `.xls` binary workbooks in the browser using SheetJS (`xlsx`) to extract sheet names and convert the active worksheet into normalized tabular rows/CSV, then pass the structured data through the unified `/api/data/import/csv/preview` and `/api/data/import/csv/commit` validation pipeline (also supporting Excel serial date numbers on both client and server).
  - *Why*: Allows instantaneous sheet switching and zero-latency workbook inspection in the UI without uploading multi-megabyte binary blobs repeatedly on every sheet toggle, while keeping all financial math, duplicate detection, and ACID balance updates strictly enforced on the backend.
  - *Alternatives Considered*: Server-only binary upload via `multer` was passed over because it adds extra round-trip latency just to list worksheet names in multi-tab Excel files.

- **Decision 2 — Automatic Heuristic Categorization for Uncategorized Import Rows**
  - *Chosen Approach*: When an imported Excel/CSV row lacks a category column or its category name does not match an existing user category, automatically run PRYORA's merchant categorization rules during preview so rows like *"Swiggy"*, *"Uber"*, *"Shell"*, or *"Netflix"* are pre-assigned to their matching category (`Food & Dining`, `Transportation`, `Subscriptions`, etc.) before the user even clicks commit.
  - *Why*: Bank statements almost never include a "Category" column. Pre-populating categories saves users from manually categorizing hundreds of imported expenses while still letting them override any row in the preview table.
  - *Alternatives Considered*: Leaving all bank statement rows as `Uncategorized` was rejected because it degrades budget pacing and analytics charts immediately after import.

- **Decision 3 — Fixing & Replacing the Legacy Direct Import Call in Data Hub**
  - *Chosen Approach*: Replace the legacy one-shot `/api/data/import/csv` call in Data Hub with the shared multi-step Import Wizard component, and mount the same wizard inside a modal triggered from the Transactions Ledger header.
  - *Why*: Ensures consistent behavior, eliminates the broken legacy endpoint mismatch, and honors the user's request to launch imports from both locations.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                        PRYORA Frontend Workspace                           │
│                                                                            │
│  ┌──────────────────────────────┐        ┌──────────────────────────────┐  │
│  │   Transactions Ledger View   │        │        Data Hub View         │  │
│  │  [Import Excel / CSV Button] │        │  [Embedded Import Workspace] │  │
│  └──────────────┬───────────────┘        └──────────────┬───────────────┘  │
│                 │ Opens Modal                           │ Mounts Inline    │
│                 ▼                                       ▼                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                 SpreadsheetImportWizard Component                    │  │
│  │                                                                      │  │
│  │  Step 1: File & Sheet   ──► Parses .xlsx / .xls / .csv (SheetJS)     │  │
│  │  Step 2: Column Map     ──► Maps Date, Merchant, Debit/Credit/Amount │  │
│  │  Step 3: Row Preview    ──► Inline Category/Type Edit & Dup Toggle   │  │
│  │  Step 4: Commit Ledger  ──► Dispatches Verified Rows + Refreshes UI  │  │
│  └──────────────────────────────┬───────────────────────────────────────┘  │
└─────────────────────────────────┼──────────────────────────────────────────┘
                                  │ HTTP JSON (/api/data/import/csv/*)
                                  ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                        PRYORA Express + SQLite Server                      │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ POST /api/data/import/csv/preview                                    │  │
│  │  • RFC-4180 & tabular parser + Excel serial date normalization       │  │
│  │  • Signed amount & split Debit/Credit minor-unit conversion          │  │
│  │  • Auto-categorization matching (exact + merchant keyword heuristic) │  │
│  │  • Duplicate signature check (date + merchant + amount_minor)        │  │
│  └──────────────────────────────┬───────────────────────────────────────┘  │
│                                 ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ POST /api/data/import/csv/commit                                     │  │
│  │  • ACID SQLite transaction block                                     │  │
│  │  • Optional auto-creation of new categories from spreadsheet         │  │
│  │  • Inserts verified rows & applies double-entry account deltas       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State

- **Workbook Parse State**: Holds the uploaded filename, file type (`xlsx` | `xls` | `csv`), list of worksheet names and row counts, active sheet selection, extracted headers, and raw 2D string rows.
- **Column Mapping State (`CsvColumnMapping`)**: Tracks mapped header names for `dateCol`, `merchantCol`, `amountMode` (`single` vs `split` Debit/Credit), `amountCol`, `debitCol`, `creditCol`, `categoryCol`, `accountCol`, `typeCol`, `notesCol`, and `dateFormat` (`auto`, `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`).
- **Preview Row State (`PreviewRow`)**: Represents each parsed transaction with `rowIndex`, `selected` (boolean checkbox), `date` (normalized `YYYY-MM-DD`), `merchant`, `type` (`expense` | `income`), `amountMinor` (integer minor units), `amountDisplay`, `categoryId`, `categoryName`, `accountId`, `notes`, `isValid`, `errors[]`, and `isDuplicate`.

### Interactive Component & State Mapping

- **File Upload & Sheet Switcher**: Dropping or selecting an `.xlsx`/`.xls` file reads the binary buffer via `FileReader.readAsArrayBuffer`, extracts all sheets, defaults to the first non-empty sheet, and populates the sheet dropdown. Switching sheets immediately updates the raw preview and re-runs column header detection.
- **Template Downloader**: Clicking *"Download Sample Template"* generates and downloads a clean `.xlsx` or `.csv` sample file with standard `Date`, `Merchant`, `Category`, `Type`, `Amount`, and `Notes` columns so users have a ready-to-use reference.
- **Column Mapping Controls**: Changing any column selector or switching between *Single Amount Column* and *Separate Debit / Credit Columns* triggers a re-preview request to `/api/data/import/csv/preview` with the custom mapping so users see updated validation counts in real time.
- **Interactive Preview Table**:
  - Users can filter preview rows by `All`, `Ready to Import`, `Duplicates`, or `Invalid`.
  - Users can toggle individual row selection checkboxes, change a row's assigned `Category` or `Account` inline via compact dropdowns, or flip `Expense` / `Income` before committing.
  - Clicking **Commit Import** sends all selected valid rows to `/api/data/import/csv/commit`, refreshes global dashboard/ledger/account states via `onDataChanged()`, and displays the completion summary.
