import {
  DEFAULT_SETTINGS,
  MOCK_USERS,
  MOCK_ROOMS,
  MOCK_GUESTS,
  MOCK_BOOKINGS,
  MOCK_TRANSACTIONS,
  MOCK_EXPENSES,
  MOCK_SUPPLIERS,
  MOCK_ADVANCES,
  MOCK_NOTIFICATIONS,
  MOCK_AUDIT,
  MOCK_INVENTORY,
} from './mockData';
import { prepareRow, type SupabaseCollectionKey } from './supabaseMapper';

export const SEED_TABLES: Array<{
  table: string;
  key: SupabaseCollectionKey;
  rows: Record<string, unknown>[];
  batchSize?: number;
}> = [
  {
    table: 'users',
    key: 'users',
    rows: MOCK_USERS.map((r) => r as unknown as Record<string, unknown>),
  },
  {
    table: 'rooms',
    key: 'rooms',
    rows: MOCK_ROOMS.map((r) => r as unknown as Record<string, unknown>),
  },
  {
    table: 'suppliers',
    key: 'suppliers',
    rows: MOCK_SUPPLIERS.map((r) => r as unknown as Record<string, unknown>),
  },
  {
    table: 'inventory',
    key: 'inventory',
    rows: MOCK_INVENTORY.map((r) => r as unknown as Record<string, unknown>),
  },
  {
    table: 'guests',
    key: 'guests',
    rows: MOCK_GUESTS.map((r) => r as unknown as Record<string, unknown>),
    batchSize: 50,
  },
  {
    table: 'bookings',
    key: 'bookings',
    rows: MOCK_BOOKINGS.map((r) => r as unknown as Record<string, unknown>),
    batchSize: 50,
  },
  {
    table: 'transactions',
    key: 'transactions',
    rows: MOCK_TRANSACTIONS.map((r) => r as unknown as Record<string, unknown>),
    batchSize: 75,
  },
  {
    table: 'expenses',
    key: 'expenses',
    rows: MOCK_EXPENSES.map((r) => r as unknown as Record<string, unknown>),
    batchSize: 50,
  },
  {
    table: 'advances',
    key: 'advances',
    rows: MOCK_ADVANCES.map((r) => r as unknown as Record<string, unknown>),
  },
  {
    table: 'notifications',
    key: 'notifications',
    rows: MOCK_NOTIFICATIONS.map((r) => r as unknown as Record<string, unknown>),
  },
  {
    table: 'audit_log',
    key: 'audit',
    rows: MOCK_AUDIT.map((r) => r as unknown as Record<string, unknown>),
  },
];

export function buildSeedRows(
  key: SupabaseCollectionKey,
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  return rows.map((row) => prepareRow(key, row));
}

export function getSeedSettingsRow(): Record<string, unknown> {
  return {
    id: 1,
    hotel_name: DEFAULT_SETTINGS.hotelName,
    subtitle: DEFAULT_SETTINGS.subtitle,
    address: DEFAULT_SETTINGS.address,
    phone: DEFAULT_SETTINGS.phone,
    email: DEFAULT_SETTINGS.email,
    gst_number: DEFAULT_SETTINGS.gstNumber,
    currency: DEFAULT_SETTINGS.currency,
    tax_percent: DEFAULT_SETTINGS.taxPercent,
    logo_url: DEFAULT_SETTINGS.logoUrl ?? null,
  };
}
