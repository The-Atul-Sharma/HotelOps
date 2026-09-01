import {
  LayoutDashboard,
  CalendarCheck,
  BedDouble,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Wallet,
  Clock,
  HandCoins,
  FileBarChart,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  children?: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Bookings", to: "/bookings", icon: CalendarCheck },
  { label: "Rooms", to: "/rooms", icon: BedDouble },
  {
    label: "Accounts",
    to: "/accounts",
    icon: BookOpen,
    children: [
      { label: "Income", to: "/accounts/income", icon: TrendingUp },
      { label: "Expenses", to: "/accounts/expenses", icon: TrendingDown },
      { label: "Payments", to: "/accounts/payments", icon: Wallet },
      { label: "Pending Payments", to: "/accounts/pending", icon: Clock },
      { label: "Advances", to: "/accounts/advances", icon: HandCoins },
    ],
  },
  { label: "Reports", to: "/reports", icon: FileBarChart },
  { label: "Settings", to: "/settings", icon: Settings },
];
