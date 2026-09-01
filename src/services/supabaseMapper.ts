const DATE_FIELDS = new Set([
  'checkInDate',
  'checkOutDate',
  'date',
  'dueDate',
  'checkIn',
  'checkOut',
]);

function toSnakeKey(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toCamelKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function normalizeDateValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  return value.slice(0, 10);
}

export function toRow<T extends Record<string, unknown>>(entity: T): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entity)) {
    if (value === undefined) continue;
    const snakeKey = toSnakeKey(key);
    row[snakeKey] = DATE_FIELDS.has(key) ? normalizeDateValue(value) : value;
  }
  return row;
}

export function fromRow<T>(row: Record<string, unknown>): T {
  const entity: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = toCamelKey(key);
    entity[camelKey] = DATE_FIELDS.has(camelKey) && value != null ? String(value).slice(0, 10) : value;
  }
  return entity as T;
}

export const TABLE_NAMES = {
  rooms: 'rooms',
  guests: 'guests',
  bookings: 'bookings',
  transactions: 'transactions',
  expenses: 'expenses',
  suppliers: 'suppliers',
  advances: 'advances',
  notifications: 'notifications',
  audit: 'audit_log',
  inventory: 'inventory',
  users: 'users',
} as const;

export type SupabaseCollectionKey = keyof typeof TABLE_NAMES;

type TimestampMode = 'full' | 'created' | 'none';

export const TABLE_META: Record<
  SupabaseCollectionKey,
  { timestamps: TimestampMode; timestampField?: string; orderBy: string }
> = {
  rooms: { timestamps: 'full', orderBy: 'created_at' },
  guests: { timestamps: 'full', orderBy: 'created_at' },
  bookings: { timestamps: 'full', orderBy: 'created_at' },
  transactions: { timestamps: 'full', orderBy: 'date' },
  expenses: { timestamps: 'full', orderBy: 'date' },
  suppliers: { timestamps: 'full', orderBy: 'created_at' },
  advances: { timestamps: 'full', orderBy: 'date' },
  notifications: { timestamps: 'created', orderBy: 'created_at' },
  audit: { timestamps: 'none', timestampField: 'timestamp', orderBy: 'timestamp' },
  inventory: { timestamps: 'none', orderBy: 'name' },
  users: { timestamps: 'none', orderBy: 'username' },
};

export function prepareRow(
  key: SupabaseCollectionKey,
  entity: Record<string, unknown>,
): Record<string, unknown> {
  const row = toRow(entity);
  const meta = TABLE_META[key];
  if (meta.timestamps === 'none') {
    delete row.created_at;
    delete row.updated_at;
  }
  if (meta.timestamps === 'created') {
    delete row.updated_at;
  }
  if (meta.timestampField) {
    row[meta.timestampField] = entity.timestamp ?? entity.createdAt ?? new Date().toISOString();
    delete row.timestamp;
  }
  return row;
}
