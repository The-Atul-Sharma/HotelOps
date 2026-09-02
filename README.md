**Hotel Management & Accounts System** — a modern, responsive web app (and installable PWA) that replaces an Excel-based hotel register while keeping the familiar spreadsheet workflow.

## Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **Supabase** (optional PostgreSQL backend) or **localStorage** fallback
- **PWA** — installable as **Hotel Decent Inn** on mobile and desktop
- **Tailwind CSS v4** + **shadcn/ui** (component library)
- **TanStack Table** + **TanStack Virtual** (Excel-like data grid, virtualized)
- **TanStack Query** (server state)
- **React Router** (routing, lazy-loaded pages)
- **React Hook Form** + **Zod** (forms & validation)
- **Recharts** (analytics)
- **SheetJS (xlsx)** (Excel/CSV import & export)
- **dayjs**, **lucide-react**, **sonner**

## Getting Started

```bash
npm install
cp .env.example .env   # add your Supabase URL + publish key (optional)
npm run dev            # start dev server
npm run build          # type-check + production build
npm run lint           # oxlint
```

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run migrations in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_seed_august_2026.sql` (August 2026 / last month sample data)
3. Copy **Project URL**, **publishable key**, and **secret key** from **Settings → API** (new key format).
4. Create `.env` in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISH_KEY=your-publish-key
SUPABASE_SECRET_KEY=your-secret-key
```

The app uses only the **publish key** in the browser. Keep `SUPABASE_SECRET_KEY` without the `VITE_` prefix so it is never bundled into the client.

5. Restart the dev server. If you skipped step 2’s seed migration, the app auto-seeds August 2026 data on first load when `transactions` is empty.

**Alternative:** seed from the CLI (uses your `.env` keys):

```bash
npm run db:seed
```

This loads the same August 2026 register: 215 bookings, 295 cash-book rows, 75 expenses, 21 guests, and more.

Without Supabase env vars, the app uses browser **localStorage** (same as before).

## PWA (install app)

After `npm run build` and serving the `dist` folder (or deploying to HTTPS):

- **Chrome / Edge** — address bar install icon or menu → _Install Hotel Decent Inn_
- **Safari (iOS)** — Share → _Add to Home Screen_
- **Android** — browser prompt to install the app

The installed app name is **Hotel Decent Inn** (short name: **Decent Inn**).

## Architecture

The UI never talks to APIs directly. Everything flows through a service/repository layer, so swapping the mock backend for a real one is a localized change.

```
src/
  components/     # shared UI + shadcn/ui primitives
  layouts/        # app shell, sidebar, topbar, global search
  features/       # dashboard, bookings, rooms, guests, accounts,
                  # expenses, payments, suppliers, reports, settings
  services/       # repository layer, api services, mock DB
  hooks/          # TanStack Query hooks, theme, debounce
  types/          # domain model
  utils/          # centralized finance calcs, formatting, excel, date ranges
  config/         # constants, navigation
```

### Data layer

- `services/db.ts` — localStorage-backed mock database (used when Supabase is not configured).
- `services/supabaseRepository.ts` — Supabase CRUD when `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISH_KEY` are set.
- `services/repository.ts` — generic CRUD repository with simulated latency.
- `services/api.ts` — typed services per entity; auto-selects Supabase or local storage.
- `supabase/migrations/001_initial_schema.sql` — PostgreSQL schema for Supabase.

### Financial calculations

All money math is centralized and deterministic in `utils/finance.ts`:
`calculateBookingTotal`, `calculatePendingAmount`, `calculatePaymentStatus`, `calculateProfit`, `summarizeTransactions`, `calculateDailyCollection`, `calculateAdvanceBalance`, and more.

## Key Features

- **Dashboard** — 12 KPI cards, 6 charts (revenue vs expenses, monthly profit, category, payment methods, occupancy, pending), "Attention Required" red flags, date-range filtering.
- **Cash Book** — Excel-like virtualized spreadsheet with inline editing, keyboard navigation (arrows/Tab/Enter), copy/paste, add/duplicate/delete rows, column show/hide, freeze, search, filters, Excel/CSV import & export, print. Toggle between **Spreadsheet** and **Table** views.
- **Red-row logic** — pending/overdue rows are subtly highlighted red **and** carry a status badge (color-blind safe) showing the pending amount.
- **Bookings** — full form with live bill calculation, double-booking prevention, check-in/out, payment recording, printable invoice.
- **Rooms** — visual color-coded board with status management and CRUD.
- **Guests, Suppliers, Advances, Expenses, Payments, Pending Payments** — full modules.
- **Reports** — 7 report types with date range, Excel/CSV export, print.
- **Settings** — hotel profile, tax, users & roles, audit log; reset to sample data.
- **Dark mode** with saved preference, fully responsive (sidebar → drawer on mobile).

## Notes

- Data is stored in **Supabase** (when configured) or **localStorage** otherwise. Use **Settings → Reset Data** to restore the sample seed.
- The `xlsx` package has a known advisory with no upstream fix; it is used only for client-side import/export.
