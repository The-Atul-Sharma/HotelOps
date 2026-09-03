import { STORAGE_PREFIX } from '@/config/constants';
import {
  DEFAULT_SETTINGS,
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
  MOCK_USERS,
} from './mockData';
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

export interface Database {
  settings: HotelSettings;
  users: User[];
  rooms: Room[];
  guests: Guest[];
  bookings: Booking[];
  transactions: Transaction[];
  expenses: Expense[];
  suppliers: Supplier[];
  advances: Advance[];
  notifications: AppNotification[];
  audit: AuditLogEntry[];
  inventory: InventoryItem[];
}

const KEY = `${STORAGE_PREFIX}:db:v15-aug2026-extras`;

function ensureHotelRooms(db: Database): boolean {
  const existing = new Set(db.rooms.map((r) => r.number.toLowerCase()));
  let added = false;
  const now = new Date().toISOString();
  for (const room of MOCK_ROOMS) {
    if (existing.has(room.number.toLowerCase())) continue;
    db.rooms.push({
      ...room,
      id: `r${Date.now()}-${room.number}`,
      status: 'Available',
      currentGuestId: undefined,
      currentBookingId: undefined,
      createdAt: now,
      updatedAt: now,
    });
    added = true;
  }
  return added;
}

function ensureHotelDetails(db: Database): boolean {
  const legacyAddress = 'Station Road, Near Bus Stand, Nashik, Maharashtra 422001';
  const legacyGst = '27ABCDE1234F1Z5';
  if (db.settings.address !== legacyAddress && db.settings.gstNumber !== legacyGst) {
    return false;
  }
  db.settings = {
    ...db.settings,
    address: DEFAULT_SETTINGS.address,
    phone: DEFAULT_SETTINGS.phone,
    email: DEFAULT_SETTINGS.email,
    gstNumber: DEFAULT_SETTINGS.gstNumber,
  };
  return true;
}

function ensureCollections(db: Database): boolean {
  let changed = false;
  if (!Array.isArray(db.advances)) {
    db.advances = MOCK_ADVANCES.map((a) => ({ ...a }));
    changed = true;
  } else {
    let migrated = false;
    db.advances = db.advances.map((a) => {
      if (a.account != null) return a;
      migrated = true;
      return { ...a, account: 'None' as const };
    });
    if (migrated) changed = true;
  }
  if (!Array.isArray(db.rooms)) {
    db.rooms = MOCK_ROOMS.map((r) => ({ ...r }));
    changed = true;
  }
  if (ensureHotelDetails(db)) changed = true;
  return ensureHotelRooms(db) || changed;
}

function seed(): Database {
  return {
    settings: DEFAULT_SETTINGS,
    users: MOCK_USERS,
    rooms: MOCK_ROOMS,
    guests: MOCK_GUESTS,
    bookings: MOCK_BOOKINGS,
    transactions: MOCK_TRANSACTIONS,
    expenses: MOCK_EXPENSES,
    suppliers: MOCK_SUPPLIERS,
    advances: MOCK_ADVANCES,
    notifications: MOCK_NOTIFICATIONS,
    audit: MOCK_AUDIT,
    inventory: MOCK_INVENTORY,
  };
}

let cache: Database | null = null;

export function loadDb(): Database {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      cache = JSON.parse(raw) as Database;
      if (ensureCollections(cache)) persist();
      return cache;
    }
  } catch {
    // ignore corrupt storage
  }
  cache = seed();
  persist();
  return cache;
}

export function persist(): void {
  if (!cache) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // storage full or unavailable
  }
}

export function resetDb(): Database {
  cache = seed();
  persist();
  return cache;
}

export function getDb(): Database {
  return loadDb();
}
