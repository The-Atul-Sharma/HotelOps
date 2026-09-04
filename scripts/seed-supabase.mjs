import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const url = process.env.VITE_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const publishKey = process.env.VITE_SUPABASE_PUBLISH_KEY;

if (!url || (!secretKey && !publishKey)) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SECRET_KEY (or VITE_SUPABASE_PUBLISH_KEY) in .env');
  process.exit(1);
}

const supabase = createClient(url, secretKey ?? publishKey);

const DATE_FIELDS = new Set([
  'checkInDate',
  'checkOutDate',
  'date',
  'dueDate',
  'checkIn',
  'checkOut',
]);

const TIMESTAMP_NONE = new Set(['users', 'inventory']);
const TIMESTAMP_CREATED = new Set(['notifications']);
const AUDIT_TABLE = 'audit_log';

function toSnakeKey(key) {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function prepareRow(table, entity) {
  const row = {};
  for (const [key, value] of Object.entries(entity)) {
    if (value === undefined) continue;
    const snakeKey = toSnakeKey(key);
    row[snakeKey] =
      DATE_FIELDS.has(key) && typeof value === 'string' ? value.slice(0, 10) : value;
  }
  if (TIMESTAMP_NONE.has(table)) {
    delete row.created_at;
    delete row.updated_at;
  }
  if (TIMESTAMP_CREATED.has(table)) {
    delete row.updated_at;
  }
  if (table === AUDIT_TABLE) {
    row.timestamp = entity.timestamp ?? new Date().toISOString();
    delete row.created_at;
    delete row.updated_at;
  }
  return row;
}

async function upsertRows(table, rows, batchSize = 75) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: 'id' });
    if (error) throw error;
    console.log(`  ${table}: ${Math.min(i + batch.length, rows.length)}/${rows.length}`);
  }
}

const augustSeed = JSON.parse(readFileSync(join(root, 'src/services/augustSeed.json'), 'utf8'));

const users = [
  {
    id: 'u1',
    name: 'Atul Sharma',
    username: 'atul',
    mobile: '+91 98765 00001',
    password: 'admin123',
    role: 'Admin',
    active: true,
  },
  {
    id: 'u2',
    name: 'Priya Sharma',
    username: 'manager',
    mobile: '+91 98765 11111',
    password: 'manager123',
    role: 'Manager',
    active: true,
  },
];

const roomDefs = [
  ['101', 'Deluxe', 1, 1800],
  ['102', 'Deluxe', 1, 1800],
  ['103', 'Standard', 1, 1200],
  ['104', 'Standard', 1, 1200],
  ['105', 'Standard', 1, 1200],
  ['106', 'Deluxe', 1, 1800],
  ['107', 'Super Deluxe', 1, 2500],
  ['108', 'Standard', 1, 1200],
  ['201', 'Deluxe', 2, 1900],
  ['202', 'Super Deluxe', 2, 2600],
  ['203', 'Suite', 2, 3500],
  ['204', 'Standard', 2, 1200],
  ['205', 'Standard', 2, 1200],
  ['206', 'Deluxe', 2, 1900],
  ['207', 'Deluxe', 2, 1900],
  ['208', 'Standard', 2, 1200],
];

const rooms = roomDefs.map(([number, type, floor, rate], i) => ({
  id: `r${i + 1}`,
  number,
  type,
  floor,
  rate,
  status: 'Available',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-08-31T00:00:00.000Z',
}));

const tables = [
  { table: 'users', rows: users.map((r) => prepareRow('users', r)) },
  { table: 'rooms', rows: rooms.map((r) => prepareRow('rooms', r)) },
  {
    table: 'suppliers',
    rows: [
      prepareRow('suppliers', {
        id: 's1',
        name: 'Raghavendra',
        mobile: '',
        category: 'Kitchen',
        address: 'Udaipur',
        openingBalance: 0,
        totalPurchases: 0,
        totalPaid: 0,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-31T00:00:00.000Z',
      }),
    ],
  },
  {
    table: 'inventory',
    rows: [
      prepareRow('inventory', {
        id: 'i1',
        name: 'Milk',
        openingStock: 20,
        purchased: 40,
        consumed: 52,
        currentStock: 8,
        minimumStock: 10,
        unit: 'litre',
      }),
      prepareRow('inventory', {
        id: 'i2',
        name: 'Toiletries',
        openingStock: 100,
        purchased: 50,
        consumed: 60,
        currentStock: 90,
        minimumStock: 30,
        unit: 'set',
      }),
      prepareRow('inventory', {
        id: 'i3',
        name: 'Water Bottles',
        openingStock: 200,
        purchased: 100,
        consumed: 240,
        currentStock: 60,
        minimumStock: 50,
        unit: 'bottle',
      }),
    ],
  },
  { table: 'guests', rows: augustSeed.guests.map((r) => prepareRow('guests', r)) },
  {
    table: 'bookings',
    rows: augustSeed.bookings.map((r) =>
      prepareRow('bookings', { ...r, extraCharges: r.extraCharges ?? [], payments: r.payments ?? [] }),
    ),
  },
  { table: 'transactions', rows: augustSeed.transactions.map((r) => prepareRow('transactions', r)) },
  { table: 'expenses', rows: augustSeed.expenses.map((r) => prepareRow('expenses', r)) },
  { table: 'advances', rows: augustSeed.advances.map((r) => prepareRow('advances', r)) },
  {
    table: 'notifications',
    rows: [
      prepareRow('notifications', {
        id: 'n1',
        type: 'Payment Received',
        title: 'Pending cleared',
        message: 'All August register pending payments marked as paid',
        read: false,
        userId: 'u1',
        createdAt: '2026-08-31T12:00:00.000Z',
      }),
      prepareRow('notifications', {
        id: 'n2',
        type: 'Payment Received',
        title: 'Pending cleared',
        message: 'All August register pending payments marked as paid',
        read: false,
        userId: 'u2',
        createdAt: '2026-08-31T12:00:00.000Z',
      }),
    ],
  },
  {
    table: 'audit_log',
    rows: [
      prepareRow('audit_log', {
        id: 'al1',
        user: 'Atul Sharma',
        action: 'create',
        entity: 'Settings',
        entityId: 'settings',
        field: 'Seeded August 2026 cash book',
        newValue: 'Income ₹3,66,670 · Expense ₹1,76,200 · Advance ₹65,340',
        timestamp: '2026-08-31T00:00:00.000Z',
      }),
    ],
  },
];

console.log('Seeding Hotel Decent Inn — August 2026 (last month)...');

const { error: settingsError } = await supabase.from('hotel_settings').upsert({
  id: 1,
  hotel_name: 'Hotel Decent Inn',
  subtitle: 'Hotel Management & Accounts System',
  address: 'Sukher Rd, Shyam Nagar, Chitrakoot Nagar, Sukher, Udaipur, Rajasthan 313001',
  phone: '',
  email: '',
  gst_number: '',
  currency: 'INR',
  tax_percent: 0,
  logo_url: null,
});
if (settingsError) throw settingsError;

for (const { table, rows } of tables) {
  await upsertRows(table, rows);
}

console.log('Done. August 2026 seed loaded.');
