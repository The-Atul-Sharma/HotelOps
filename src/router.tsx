import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { LoadingState } from "@/components/shared/states";
import { RequireAuth } from "@/features/auth/RequireAuth";

const Login = lazy(() => import("@/features/auth/LoginPage"));
const Dashboard = lazy(() => import("@/features/dashboard/DashboardPage"));
const Bookings = lazy(() => import("@/features/bookings/BookingsPage"));
const BookingDetail = lazy(
  () => import("@/features/bookings/BookingDetailPage"),
);
const Rooms = lazy(() => import("@/features/rooms/RoomsPage"));
const Income = lazy(() => import("@/features/accounts/IncomePage"));
const Expenses = lazy(() => import("@/features/expenses/ExpensesPage"));
const Payments = lazy(() => import("@/features/payments/PaymentsPage"));
const Pending = lazy(() => import("@/features/payments/PendingPaymentsPage"));
const Advances = lazy(() => import("@/features/accounts/AdvancesPage"));
const Reports = lazy(() => import("@/features/reports/ReportsPage"));
const Settings = lazy(() => import("@/features/settings/SettingsPage"));

function withSuspense(node: React.ReactNode) {
  return <Suspense fallback={<LoadingState />}>{node}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: withSuspense(<Login />),
  },
  {
    path: "/",
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: withSuspense(<Dashboard />) },
          { path: "bookings", element: withSuspense(<Bookings />) },
          { path: "bookings/:id", element: withSuspense(<BookingDetail />) },
          { path: "rooms", element: withSuspense(<Rooms />) },
          {
            path: "accounts",
            element: <Navigate to="/accounts/income" replace />,
          },
          { path: "accounts/income", element: withSuspense(<Income />) },
          { path: "accounts/expenses", element: withSuspense(<Expenses />) },
          { path: "accounts/payments", element: withSuspense(<Payments />) },
          { path: "accounts/pending", element: withSuspense(<Pending />) },
          { path: "accounts/advances", element: withSuspense(<Advances />) },
          { path: "reports", element: withSuspense(<Reports />) },
          { path: "settings", element: withSuspense(<Settings />) },
        ],
      },
    ],
  },
]);
