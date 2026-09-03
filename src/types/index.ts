export type ID = string;

export type PaymentMode = 'Cash' | 'UPI' | 'Online' | 'Card' | 'Bank Transfer' | 'Other';

export type PaymentAccount = 'None' | 'Hotel' | 'Hulla';

export type PaymentStatus = 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE';

export type UserRole = 'Admin' | 'Manager';

export interface User {
  id: ID;
  name: string;
  username: string;
  mobile: string;
  password: string;
  role: UserRole;
  active: boolean;
}

export type RoomStatus =
  | 'Available'
  | 'Occupied'
  | 'Reserved'
  | 'Cleaning'
  | 'Maintenance'
  | 'Blocked';

export interface Room {
  id: ID;
  number: string;
  type: string;
  floor: number;
  rate: number;
  status: RoomStatus;
  currentGuestId?: ID;
  currentBookingId?: ID;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type IdType = 'Aadhaar' | 'PAN' | 'Passport' | 'Driving License' | 'Voter ID' | 'Other';

export interface Guest {
  id: ID;
  name: string;
  mobile: string;
  email?: string;
  address?: string;
  idType?: IdType;
  idNumber?: string;
  nationality?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type BookingStatus =
  | 'Inquiry'
  | 'Reserved'
  | 'Checked In'
  | 'Checked Out'
  | 'Cancelled'
  | 'No Show';

export type ExtraChargeItemType =
  | 'Water Bottle'
  | 'Ice Qube'
  | 'Peanut Masala'
  | 'Tea'
  | 'Soda'
  | 'Food'
  | 'Other';

export interface BookingCharge {
  id: ID;
  label: string;
  amount: number;
  itemType?: ExtraChargeItemType;
  quantity?: number;
  unitPrice?: number;
  customName?: string;
  paymentMode: PaymentMode;
  account?: PaymentAccount;
  paidAtOrder?: boolean;
}

export interface BookingPayment {
  id: ID;
  amount: number;
  mode: PaymentMode;
  account?: PaymentAccount;
  date: string;
  note?: string;
}

export interface Booking {
  id: ID;
  code: string;
  guestId: ID;
  guestName: string;
  mobile: string;
  email?: string;
  roomId: ID;
  roomNumber: string;
  roomType: string;
  checkInDate: string;
  checkInTime?: string;
  checkOutDate: string;
  checkOutTime?: string;
  adults: number;
  children: number;
  roomRate: number;
  nights: number;
  roomAmount: number;
  foodAmount: number;
  roomService: number;
  otherCharges: number;
  extraCharges: BookingCharge[];
  discount: number;
  taxPercent: number;
  taxAmount: number;
  totalAmount: number;
  advanceReceived: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMode: PaymentMode;
  payments: BookingPayment[];
  status: BookingStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type TransactionType = 'Income' | 'Expense' | 'Advance Given' | 'Advance Received';

export type TransactionCategory =
  | 'Room Rent'
  | 'Room Service'
  | 'Food/Kitchen'
  | 'Other Income'
  | 'Kitchen'
  | 'Milk'
  | 'Vegetables'
  | 'Potato'
  | 'Grocery'
  | 'Staff'
  | 'Salary'
  | 'STF'
  | 'Maintenance'
  | 'Electricity'
  | 'Water'
  | 'Internet'
  | 'Laundry'
  | 'Housekeeping'
  | 'Supplier'
  | 'Transport'
  | 'Auto Commission'
  | 'Hotel Rent'
  | 'Other';

export interface Transaction {
  id: ID;
  srNo: number;
  date: string;
  category: TransactionCategory;
  particulars: string;
  guest?: string;
  party?: string;
  roomNumber?: string;
  checkIn?: string;
  checkOut?: string;
  advanceGiven: number;
  advanceReceived: number;
  roomRent: number;
  roomService: number;
  foodKitchen: number;
  otherIncome: number;
  expense: number;
  cash: number;
  online: number;
  upi: number;
  card: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  paymentStatus: PaymentStatus;
  dueDate?: string;
  remarks?: string;
  voided?: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: ID;
  date: string;
  category: TransactionCategory;
  description: string;
  supplierId?: ID;
  supplierName?: string;
  amount: number;
  paymentMode: PaymentMode;
  account: PaymentAccount;
  reference?: string;
  receiptUrl?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: ID;
  name: string;
  mobile: string;
  category: string;
  address?: string;
  openingBalance: number;
  totalPurchases: number;
  totalPaid: number;
  createdAt: string;
  updatedAt: string;
}

export type AdvanceType = 'Staff' | 'Owner';
export type AdvanceStatus = 'Open' | 'Partially Recovered' | 'Recovered';

export interface Advance {
  id: ID;
  date: string;
  person: string;
  type: AdvanceType;
  amount: number;
  purpose?: string;
  paymentMode: PaymentMode;
  account: PaymentAccount;
  recoveredAmount: number;
  remainingAmount: number;
  status: AdvanceStatus;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType =
  | 'New Booking'
  | 'Payment Received'
  | 'Payment Pending'
  | 'Payment Overdue'
  | 'Check-in'
  | 'Check-out'
  | 'Room Maintenance'
  | 'Low Inventory'
  | 'Supplier Payment Due';

export interface AppNotification {
  id: ID;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  id: ID;
  user: string;
  action: 'create' | 'update' | 'delete' | 'void';
  entity: string;
  entityId: ID;
  field?: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
}

export interface InventoryItem {
  id: ID;
  name: string;
  openingStock: number;
  purchased: number;
  consumed: number;
  currentStock: number;
  minimumStock: number;
  unit: string;
  supplierName?: string;
}

export interface HotelSettings {
  hotelName: string;
  subtitle: string;
  address: string;
  phone: string;
  email: string;
  gstNumber: string;
  currency: string;
  taxPercent: number;
  logoUrl?: string;
}

export interface DateRange {
  from: string;
  to: string;
}
