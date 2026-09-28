# PRYORA — Personal Finance OS

**PRYORA** is an intuitive, all-in-one personal finance operating system designed to give you complete visibility, control, and clarity over your financial health. Built with modern web technologies, PRYORA handles everything from multi-account tracking and budget envelopes to smart receipt parsing, subscription monitoring, and savings goals.

---

## 🌟 Key Features

### 1. 📊 Executive Financial Dashboard
- **Net Worth & Cash Flow Summary:** Real-time calculation of total assets, liabilities, liquid cash, and monthly burn rate.
- **Financial Health Pulse:** At-a-glance status indicators for monthly savings rate and budget burn.
- **Recent Transactions & Alerts:** Instant access to latest activity, upcoming bill renewals, and budget overages.

### 2. 💳 Smart Transaction Engine & Search
- **Instant Search & Filters:** Real-time filtering by merchant name, category, accounts, tags, or custom transaction notes.
- **Receipt Attachment & Viewer:** View attached receipts directly with an accessible full-preview modal (`ReceiptViewerModal`).
- **AI Receipt Parsing:** Server-side AI intelligence powered by Google Gemini to extract merchant, date, total, tax, and line items automatically.
- **Inline & Modal Editing:** Seamless creation, editing, and categorizing of single or split transactions.

### 3. 🏦 Multi-Account Portfolio
- **Account Types:** Supports Checking, Savings, Credit Cards, Cash, and Investment portfolios.
- **Balance Tracking & Reconciliation:** Automatic balance calculation based on cleared and pending entries.

### 4. 🎯 Category Budgets & Envelope Tracking
- **Category Caps:** Set flexible spending thresholds per category (Dining, Housing, Transport, Utilities, etc.).
- **Visual Progress Bars:** Color-coded alert thresholds (safe, warning, exceeded) to prevent overspending.

### 5. 🔁 Subscription & Recurring Expense Manager
- **Renewal Alerts:** Track recurring subscriptions (monthly, annual, quarterly) with renewal dates and upcoming charge notices.
- **Waste Identification:** Easily audit forgotten recurring memberships and calculate annualized subscription costs.

### 6. 🏆 Financial Goals & Savings Milestones
- **Target Milestones:** Define targets for emergency funds, vacations, down payments, or debt payoffs.
- **Progress Projections:** Monitor funded percentage and calculated time-to-goal based on contribution rates.

### 7. 📈 Visual Analytics & Insights
- **Cash Flow Trends:** Income vs. expense comparisons over custom date ranges.
- **Expense Breakdown:** Interactive breakdown charts by category and spending type.

### 8. 💾 Data Hub (Import / Export / Portability)
- **Data Sovereignty:** Export full financial reports in CSV and JSON formats.
- **Import Support:** Import historical transaction statements seamlessly.

### 9. 🌓 Theme System (Light & Dark Mode)
- **Fluid Visual Hierarchy:** Modern liquid glass design with tailored contrast for daylight and dark workspaces.
- **Persistent Preferences:** Automatically respects system theme preference with one-click desktop and mobile toggle.

---

## 🛠️ Tech Stack

- **Frontend:** [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/), [Motion](https://motion.dev/)
- **Backend / API:** [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/), [TypeScript (tsx)](https://github.com/privatenumber/tsx), [esbuild](https://esbuild.github.io/)
- **Database & Storage:** In-memory / persistent SQLite via `sql.js`, [Firebase Authentication & Firestore](https://firebase.google.com/)
- **AI Intelligence:** [@google/genai SDK](https://github.com/google-gemini/generative-ai-js) for intelligent document & receipt extraction
- **Bundler & Tooling:** [Vite 6](https://vitejs.dev/)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (version 20+ recommended)
- npm or bun

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/pryora.git
cd pryora
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in any optional configuration keys:
```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | *(Optional)* Google Gemini API key for automated receipt OCR parsing |
| `PORT` | Local server port (defaults to `3000`) |

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to start using PRYORA.

---

## 📜 Available Scripts

| Command | Action |
|---|---|
| `npm run dev` | Starts full-stack development server with tsx & Vite middleware on port 3000 |
| `npm run build` | Builds Vite client assets and bundles server to `dist/server.cjs` |
| `npm run start` | Runs the compiled production server (`dist/server.cjs`) |
| `npm run lint` | Runs TypeScript type checking across client and server (`tsc --noEmit`) |
| `npm run test` | Runs unit & integration test suites |
| `npm run clean` | Removes compiled distribution artifacts |

---

## 📁 Project Structure

```
├── api/                  # Serverless function handlers (Vercel deployment)
├── data/                 # Local data storage & database migrations
├── public/               # Static assets & icons
├── server/               # Express backend controllers, routes, and DB layers
│   ├── routes/           # API routes (accounts, transactions, analytics, budgets)
│   └── services/         # Gemini receipt parser, SQLite & Firestore sync
├── src/                  # React client application
│   ├── components/       # Views (Dashboard, Accounts, Budgets, Analytics, Goals)
│   │   └── common/       # UI elements (Modals, Dialogs, Charts, Cards)
│   ├── context/          # React Contexts (AuthContext, ThemeContext)
│   ├── lib/              # API fetchers, formatters, utilities
│   ├── types/            # TypeScript type definitions
│   ├── App.tsx           # Main application state and view router
│   └── index.css         # Tailwind CSS styling and theme tokens
├── server.ts             # Express server entry point with Vite middleware
├── metadata.json         # AI Studio Applet configuration
└── vite.config.ts        # Vite configuration
```

---

## 🔒 Security & Privacy

- All financial calculations are evaluated securely and can be hosted locally or cloud-synced.
- Receipts and personal transactions are kept private to your authenticated user account.
- In-app modals replace disruptive browser alerts to ensure sandboxed iframe and privacy compliance.

---

## 📄 License
This project is licensed under the MIT License.
