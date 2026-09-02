import { Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { LoadingState } from "@/components/shared/states";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

const Login = lazyWithRetry(() => import("@/features/auth/LoginPage"));
const Dashboard = lazyWithRetry(() => import("@/features/dashboard/DashboardPage"));
const Bookings = lazyWithRetry(() => import("@/features/bookings/BookingsPage"));
const BookingDetail = lazyWithRetry(
  () => import("@/features/bookings/BookingDetailPage"),
);
const Rooms = lazyWithRetry(() => import("@/features/rooms/RoomsPage"));
const Income = lazyWithRetry(() => import("@/features/accounts/IncomePage"));
const Expenses = lazyWithRetry(() => import("@/features/expenses/ExpensesPage"));
const Payments = lazyWithRetry(() => import("@/features/payments/PaymentsPage"));
const Pending = lazyWithRetry(() => import("@/features/payments/PendingPaymentsPage"));
const Advances = lazyWithRetry(() => import("@/features/accounts/AdvancesPage"));
const Reports = lazyWithRetry(() => import("@/features/reports/ReportsPage"));
const Settings = lazyWithRetry(() => import("@/features/settings/SettingsPage"));

function withSuspense(node: React.ReactNode) {
  return <Suspense fallback={<LoadingState />}>{node}</Suspense>;
}

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorBoundary />,
    children: [
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
    ],
  },
]);
