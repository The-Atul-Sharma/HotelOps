import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  buildSeedRows,
  getSeedSettingsRow,
  SEED_TABLES,
} from './seedPayload';
import type { HotelSettings } from '@/types';

let seeded = false;

async function countRows(table: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from(table)
    .select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

async function upsertRows(
  table: string,
  rows: Record<string, unknown>[],
  batchSize = 100,
): Promise<void> {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await getSupabase().from(table).upsert(batch, { onConflict: 'id' });
    if (error) throw error;
  }
}

export async function seedSupabaseData(): Promise<void> {
  for (const { table, key, rows, batchSize } of SEED_TABLES) {
    await upsertRows(table, buildSeedRows(key, rows), batchSize ?? 100);
  }

  const { error } = await getSupabase()
    .from('hotel_settings')
    .upsert(getSeedSettingsRow());
  if (error) throw error;
}

export async function ensureSupabaseSeed(): Promise<void> {
  if (!isSupabaseConfigured() || seeded) return;

  const transactionCount = await countRows('transactions');
  if (transactionCount > 0) {
    seeded = true;
    return;
  }

  await seedSupabaseData();
  seeded = true;
}

export async function getSupabaseSettings(): Promise<HotelSettings> {
  const { data, error } = await getSupabase().from('hotel_settings').select('*').eq('id', 1).single();
  if (error) throw error;
  return {
    hotelName: data.hotel_name,
    subtitle: data.subtitle,
    address: data.address,
    phone: data.phone,
    email: data.email,
    gstNumber: data.gst_number,
    currency: data.currency,
    taxPercent: Number(data.tax_percent),
    logoUrl: data.logo_url ?? undefined,
  };
}

export async function updateSupabaseSettings(patch: Partial<HotelSettings>): Promise<HotelSettings> {
  const current = await getSupabaseSettings();
  const next = { ...current, ...patch };
  const row = {
    id: 1,
    hotel_name: next.hotelName,
    subtitle: next.subtitle,
    address: next.address,
    phone: next.phone,
    email: next.email,
    gst_number: next.gstNumber,
    currency: next.currency,
    tax_percent: next.taxPercent,
    logo_url: next.logoUrl ?? null,
  };
  const { error } = await getSupabase().from('hotel_settings').upsert(row);
  if (error) throw error;
  return next;
}

export async function resetSupabaseDb(): Promise<void> {
  const tables = [
    'audit_log',
    'notifications',
    'inventory',
    'advances',
    'expenses',
    'transactions',
    'bookings',
    'guests',
    'rooms',
    'suppliers',
    'users',
  ];
  for (const table of tables) {
    const { error } = await getSupabase().from(table).delete().neq('id', '');
    if (error) throw error;
  }
  seeded = false;
  await ensureSupabaseSeed();
}
