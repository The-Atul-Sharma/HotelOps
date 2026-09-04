import { isSupabaseConfigured } from '@/lib/supabase';
import { Repository, type Entity } from './repository';
import { SupabaseRepository } from './supabaseRepository';
import { getDb, persist, resetDb } from './db';
import { getSessionUserId, getSessionUserName, getUserById } from './auth';
import {
  ensureSupabaseSeed,
  getSupabaseSettings,
  updateSupabaseSettings,
  resetSupabaseDb,
} from './supabaseSeed';
import type {
  Room,
  Guest,
  Booking,
  Transaction,
  Expense,
  Supplier,
  Advance,
  AppNotification,
  AuditLogEntry,
  InventoryItem,
  User,
  HotelSettings,
} from '@/types';

function repo<T extends Entity>(
  key: 'rooms' | 'guests' | 'bookings' | 'transactions' | 'expenses' | 'suppliers' | 'advances' | 'notifications' | 'audit' | 'inventory' | 'users',
  prefix: string,
) {
  if (isSupabaseConfigured()) {
    return new SupabaseRepository<T>(key, prefix);
  }
  return new Repository<T>(key, prefix);
}

export const roomService = repo<Room>('rooms', 'r');
export const guestService = repo<Guest>('guests', 'g');
export const bookingService = repo<Booking>('bookings', 'b');
export const transactionService = repo<Transaction>('transactions', 't');
export const expenseService = repo<Expense>('expenses', 'e');
export const supplierService = repo<Supplier>('suppliers', 's');
export const advanceService = repo<Advance>('advances', 'a');
export const notificationService = repo<AppNotification>('notifications', 'n');
export const inventoryService = repo<InventoryItem>('inventory', 'i');
export const userService = repo<User>('users', 'u');
export const auditRepo = repo<AuditLogEntry>('audit', 'al');

export function getAuditActorName(): string {
  const cachedName = getSessionUserName();
  if (cachedName) return cachedName;
  const id = getSessionUserId();
  if (id) {
    const user = getUserById(id);
    if (user) return user.name;
  }
  return 'System';
}

export const ENTITY_AUDIT_LABELS: Record<string, string> = {
  rooms: 'Room',
  guests: 'Guest',
  bookings: 'Booking',
  transactions: 'Transaction',
  expenses: 'Expense',
  suppliers: 'Supplier',
  advances: 'Advance',
  inventory: 'Inventory',
  users: 'User',
  settings: 'Settings',
};

export const auditService = {
  async list(): Promise<AuditLogEntry[]> {
    const rows = await auditRepo.list();
    return rows.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  },
  log: (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) =>
    auditRepo.create({ ...entry, timestamp: new Date().toISOString() } as AuditLogEntry),
};

export const settingsService = {
  async get(): Promise<HotelSettings> {
    if (isSupabaseConfigured()) {
      return getSupabaseSettings();
    }
    return getDb().settings;
  },
  async update(patch: Partial<HotelSettings>): Promise<HotelSettings> {
    if (isSupabaseConfigured()) {
      return updateSupabaseSettings(patch);
    }
    const db = getDb();
    db.settings = { ...db.settings, ...patch };
    persist();
    return db.settings;
  },
  async reset() {
    if (isSupabaseConfigured()) {
      await resetSupabaseDb();
      return getSupabaseSettings();
    }
    return resetDb().settings;
  },
};

export async function bootstrapDataLayer(): Promise<void> {
  if (isSupabaseConfigured()) {
    await ensureSupabaseSeed();
  }
}

export { resetDb };
