import type {
  ExtraChargeItemType,
  PaymentAccount,
  PaymentMode,
  PaymentStatus,
  RoomStatus,
  BookingStatus,
  TransactionCategory,
  AdvanceType,
  AdvanceStatus,
  UserRole,
} from '@/types';

export const EXTRA_CHARGE_ITEM_TYPES: ExtraChargeItemType[] = [
  'Water Bottle',
  'Ice Qube',
  'Peanut Masala',
  'Tea',
  'Soda',
  'Food',
  'Other',
];

export const PAYMENT_MODES: PaymentMode[] = [
  'Cash',
  'UPI',
  'Online',
  'Card',
  'Bank Transfer',
  'Other',
];

export const PAYMENT_ACCOUNTS: PaymentAccount[] = ['None', 'Hotel', 'Hulla'];

export const PAYMENT_ACCOUNT_LABELS: Record<PaymentAccount, string> = {
  None: 'None',
  Hotel: 'Hotel Account',
  Hulla: 'Hulla Account',
};

export function formatPaymentAccount(account?: PaymentAccount | null): string {
  return PAYMENT_ACCOUNT_LABELS[account ?? 'None'];
}

export const PAYMENT_STATUSES: PaymentStatus[] = ['PAID', 'PARTIAL', 'PENDING', 'OVERDUE'];

export const ROOM_STATUSES: RoomStatus[] = ['Available', 'Occupied', 'Reserved'];

export const BOOKING_STATUSES: BookingStatus[] = [
  'Inquiry',
  'Reserved',
  'Checked In',
  'Checked Out',
  'Cancelled',
  'No Show',
];

export const INCOME_CATEGORIES: TransactionCategory[] = [
  'Room Rent',
  'Room Service',
  'Food/Kitchen',
  'Other Income',
];

export const EXPENSE_CATEGORIES: TransactionCategory[] = [
  'Kitchen',
  'Grocery',
  'Staff',
  'Salary',
  'STF',
  'Electricity',
  'Hotel Rent',
  'Internet',
  'Laundry',
  'Housekeeping',
  'Water',
  'Maintenance',
  'Auto Commission',
  'Other',
];

export const ALL_CATEGORIES: TransactionCategory[] = [
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
];

export const ADVANCE_TYPES: AdvanceType[] = ['Staff', 'Owner'];

export const ADVANCE_STATUSES: AdvanceStatus[] = [
  'Open',
  'Partially Recovered',
  'Recovered',
];

export const USER_ROLES: UserRole[] = ['Admin', 'Manager'];

export const ROOM_STATUS_COLORS: Record<RoomStatus, string> = {
  Available: 'green',
  Occupied: 'blue',
  Reserved: 'yellow',
  Cleaning: 'gray',
  Maintenance: 'red',
  Blocked: 'dark',
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  PAID: 'green',
  PARTIAL: 'yellow',
  PENDING: 'red',
  OVERDUE: 'red',
};

export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  Inquiry: 'gray',
  Reserved: 'yellow',
  'Checked In': 'blue',
  'Checked Out': 'green',
  Cancelled: 'red',
  'No Show': 'orange',
};

export const STORAGE_PREFIX = 'hotelflow';

export const ACCOUNT_BALANCE_FROM = '2026-09-01';

export const ACCOUNT_BALANCE_MESSAGE = 'From September 2026 onwards';
