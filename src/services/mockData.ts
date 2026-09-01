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
import { calculateNights } from '@/utils/finance';

export const DEFAULT_SETTINGS: HotelSettings = {
  hotelName: 'Hotel Decent Inn',
  subtitle: 'Hotel Management & Accounts System',
  address: 'Sukher Rd, Shyam Nagar, Chitrakoot Nagar, Sukher, Udaipur, Rajasthan 313001',
  phone: '',
  email: '',
  gstNumber: '',
  currency: 'INR',
  taxPercent: 0,
};

export const MOCK_USERS: User[] = [
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

const roomDefs: Array<[string, string, number, number]> = [
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

export const MOCK_ROOMS: Room[] = roomDefs.map(([number, type, floor, rate], i) => ({
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

export const MOCK_GUESTS: Guest[] = [];

export const MOCK_BOOKINGS: Booking[] = [];

export const MOCK_TRANSACTIONS: Transaction[] = [];

export const MOCK_EXPENSES: Expense[] = [];

export const MOCK_ADVANCES: Advance[] = [];

export const MOCK_SUPPLIERS: Supplier[] = [
  {
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
  },
];

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    type: 'Payment Received',
    title: 'Pending cleared',
    message: 'All August register pending payments marked as paid',
    read: false,
    createdAt: '2026-08-31T12:00:00.000Z',
  },
];

export const MOCK_AUDIT: AuditLogEntry[] = [
  {
    id: 'al1',
    user: 'Atul Sharma',
    action: 'create',
    entity: 'Settings',
    entityId: 'settings',
    field: 'Seeded August 2026 cash book',
    newValue: 'Income ₹3,66,670 · Expense ₹1,76,200 · Advance ₹65,340',
    timestamp: '2026-08-31T00:00:00.000Z',
  },
];

export const MOCK_INVENTORY: InventoryItem[] = [
  {
    id: 'i1',
    name: 'Milk',
    openingStock: 20,
    purchased: 40,
    consumed: 52,
    currentStock: 8,
    minimumStock: 10,
    unit: 'litre',
  },
  {
    id: 'i2',
    name: 'Toiletries',
    openingStock: 100,
    purchased: 50,
    consumed: 60,
    currentStock: 90,
    minimumStock: 30,
    unit: 'set',
  },
  {
    id: 'i3',
    name: 'Water Bottles',
    openingStock: 200,
    purchased: 100,
    consumed: 240,
    currentStock: 60,
    minimumStock: 50,
    unit: 'bottle',
  },
];

export const nextBookingCode = (existing: Booking[]) => {
  const max = existing.reduce((m, b) => {
    const n = parseInt(b.code.replace(/\D/g, ''), 10);
    return Number.isNaN(n) ? m : Math.max(m, n);
  }, 1000);
  return `BKG-${max + 1}`;
};

export { calculateNights };
