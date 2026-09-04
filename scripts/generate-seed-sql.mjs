import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const augustSeed = JSON.parse(
  readFileSync(join(root, 'src/services/augustSeed.json'), 'utf8'),
);

const DATE_FIELDS = new Set([
  'checkInDate',
  'checkOutDate',
  'date',
  'dueDate',
  'checkIn',
  'checkOut',
]);

function toSnakeKey(key) {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toRow(entity) {
  const row = {};
  for (const [key, value] of Object.entries(entity)) {
    if (value === undefined) continue;
    const snakeKey = toSnakeKey(key);
    row[snakeKey] =
      DATE_FIELDS.has(key) && typeof value === 'string' ? value.slice(0, 10) : value;
  }
  return row;
}

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

const QUOTED_COLUMNS = new Set(['user', 'read', 'timestamp']);

function quoteColumn(col) {
  return QUOTED_COLUMNS.has(col) ? `"${col}"` : col;
}

function insertSql(table, rows, jsonbColumns = []) {
  if (!rows.length) return '';
  const columns = Object.keys(rows[0]);
  const lines = rows.map((row) => {
    const values = columns.map((col) => {
      const value = row[col];
      if (jsonbColumns.includes(col) && value != null && typeof value !== 'object') {
        return sqlValue(value);
      }
      return sqlValue(value);
    });
    return `  (${values.join(', ')})`;
  });
  return `insert into ${table} (${columns.map(quoteColumn).join(', ')})\nvalues\n${lines.join(',\n')}\non conflict (id) do nothing;\n`;
}

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

const rooms = roomDefs.map(([number, type, floor, rate], i) =>
  toRow({
    id: `r${i + 1}`,
    number,
    type,
    floor,
    rate,
    status: 'Available',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  }),
);

const guests = augustSeed.guests.map((g) => toRow(g));
const bookings = augustSeed.bookings.map((b) =>
  toRow({
    ...b,
    extraCharges: b.extraCharges ?? [],
    payments: b.payments ?? [],
  }),
);
const transactions = augustSeed.transactions.map((t) => toRow(t));
const expenses = augustSeed.expenses.map((e) => toRow(e));
const advances = augustSeed.advances.map((a) => toRow(a));

const suppliers = [
  toRow({
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
];

const notifications = [
  toRow({
    id: 'n1',
    type: 'Payment Received',
    title: 'Pending cleared',
    message: 'All August register pending payments marked as paid',
    read: false,
    userId: 'u1',
    createdAt: '2026-08-31T12:00:00.000Z',
  }),
  toRow({
    id: 'n2',
    type: 'Payment Received',
    title: 'Pending cleared',
    message: 'All August register pending payments marked as paid',
    read: false,
    userId: 'u2',
    createdAt: '2026-08-31T12:00:00.000Z',
  }),
];

const audit = [
  {
    id: 'al1',
    user: 'Atul Sharma',
    action: 'create',
    entity: 'Settings',
    entity_id: 'settings',
    field: 'Seeded August 2026 cash book',
    new_value: 'Income ₹3,66,670 · Expense ₹1,76,200 · Advance ₹65,340',
    timestamp: '2026-08-31T00:00:00.000Z',
  },
];

const inventory = [
  toRow({
    id: 'i1',
    name: 'Milk',
    openingStock: 20,
    purchased: 40,
    consumed: 52,
    currentStock: 8,
    minimumStock: 10,
    unit: 'litre',
  }),
  toRow({
    id: 'i2',
    name: 'Toiletries',
    openingStock: 100,
    purchased: 50,
    consumed: 60,
    currentStock: 90,
    minimumStock: 30,
    unit: 'set',
  }),
  toRow({
    id: 'i3',
    name: 'Water Bottles',
    openingStock: 200,
    purchased: 100,
    consumed: 240,
    currentStock: 60,
    minimumStock: 50,
    unit: 'bottle',
  }),
];

function chunkInsert(table, rows, size = 50) {
  const parts = [];
  for (let i = 0; i < rows.length; i += size) {
    parts.push(insertSql(table, rows.slice(i, i + size)));
  }
  return parts.join('\n');
}

const sql = `-- August 2026 (last month) operational seed for Hotel Decent Inn
-- Run after 001_initial_schema.sql

update hotel_settings set
  hotel_name = 'Hotel Decent Inn',
  subtitle = 'Hotel Management & Accounts System',
  address = 'Sukher Rd, Shyam Nagar, Chitrakoot Nagar, Sukher, Udaipur, Rajasthan 313001'
where id = 1;

${insertSql('users', users)}

${insertSql('rooms', rooms)}

${insertSql('suppliers', suppliers)}

${insertSql('inventory', inventory)}

${chunkInsert('guests', guests)}

${chunkInsert('bookings', bookings)}

${chunkInsert('transactions', transactions)}

${chunkInsert('expenses', expenses)}

${insertSql('advances', advances)}

${insertSql('notifications', notifications)}

${insertSql('audit_log', audit)}
`;

const outPath = join(root, 'supabase/migrations/002_seed_august_2026.sql');
writeFileSync(outPath, sql);
console.log(`Wrote ${outPath}`);
console.log({
  guests: guests.length,
  bookings: bookings.length,
  transactions: transactions.length,
  expenses: expenses.length,
  advances: advances.length,
});
