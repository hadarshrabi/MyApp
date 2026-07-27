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
import { ProtectedRoute } from "./components/ProtectedRoute";

export default function App() {
  return <BrowserRouter><Routes><Route element={<AppLayout />}>
    <Route index element={<OverviewPage />} />
    <Route path="employees" element={<ProtectedRoute permission="manage_employees"><EmployeesPage /></ProtectedRoute>} />
    <Route path="attendance" element={<ProtectedRoute permission="clock_attendance"><AttendancePage /></ProtectedRoute>} />
    <Route path="payroll" element={<ProtectedRoute permission="view_payroll"><PayrollPage /></ProtectedRoute>} />
    <Route path="stations" element={<ProtectedRoute permission="manage_inventory"><StationsPage /></ProtectedRoute>} />
    <Route path="map" element={<MapPage />} />
    <Route path="users" element={<ProtectedRoute permission="manage_users"><UsersPage /></ProtectedRoute>} />
    <Route path="settings" element={<SettingsPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Route></Routes></BrowserRouter>;
}
