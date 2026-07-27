import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { OverviewPage } from "./pages/OverviewPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { AttendancePage } from "./pages/AttendancePage";
import { PayrollPage } from "./pages/PayrollPage";
import { StationsPage } from "./pages/StationsPage";
import { MapPage } from "./pages/MapPage";
import { UsersPage } from "./pages/UsersPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { AdminRoute } from "./components/ProtectedRoute";
import { EmployeeHomePage } from "./pages/EmployeeHomePage";
import { ProductsPage } from "./pages/ProductsPage";
import { AuditPage } from "./pages/AuditPage";
import { useAuth } from "./context/AuthContext";

export default function App() {
  const { isAdmin } = useAuth();
  return <BrowserRouter><Routes><Route element={<AppLayout />}>
    <Route index element={isAdmin ? <OverviewPage /> : <EmployeeHomePage />} />
    <Route path="employees" element={<AdminRoute><EmployeesPage /></AdminRoute>} />
    <Route path="attendance" element={<AdminRoute><AttendancePage /></AdminRoute>} />
    <Route path="payroll" element={<AdminRoute><PayrollPage /></AdminRoute>} />
    <Route path="stations" element={<AdminRoute><StationsPage /></AdminRoute>} />
    <Route path="products" element={<AdminRoute><ProductsPage /></AdminRoute>} />
    <Route path="map" element={<MapPage />} />
    <Route path="users" element={<AdminRoute><UsersPage /></AdminRoute>} />
    <Route path="audit" element={<AdminRoute><AuditPage /></AdminRoute>} />
    <Route path="settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
    <Route path="*" element={<NotFoundPage />} />
  </Route></Routes></BrowserRouter>;
}
