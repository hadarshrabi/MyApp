import { useLayoutEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
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
import { LoginPage } from "./pages/LoginPage";
import { AttendanceExceptionsPage } from "./pages/AttendanceExceptionsPage";
import { EmployeeHistoryPage } from "./pages/EmployeeHistoryPage";

export default function App() {
  const { isAdmin, user, loading } = useAuth();
  if (loading) return <main className="app-loading" dir="rtl">טוען את המערכת…</main>;
  return <BrowserRouter><RouteEffects /><Routes>
    <Route path="/login" element={<LoginPage />} />
    {!user ? <Route path="*" element={<LoginPage />} /> : <Route element={<AppLayout />}>
    <Route index element={isAdmin ? <OverviewPage /> : <EmployeeHomePage />} />
    <Route path="my-history" element={isAdmin ? <NotFoundPage /> : <EmployeeHistoryPage />} />
    <Route path="employees" element={<AdminRoute><EmployeesPage /></AdminRoute>} />
    <Route path="attendance" element={<AdminRoute><AttendancePage /></AdminRoute>} />
    <Route path="exceptions" element={<AdminRoute><AttendanceExceptionsPage /></AdminRoute>} />
    <Route path="payroll" element={<AdminRoute><PayrollPage /></AdminRoute>} />
    <Route path="stations" element={<AdminRoute><StationsPage /></AdminRoute>} />
    <Route path="products" element={<AdminRoute><ProductsPage /></AdminRoute>} />
    <Route path="map" element={<MapPage />} />
    <Route path="users" element={<AdminRoute><UsersPage /></AdminRoute>} />
    <Route path="audit" element={<AdminRoute><AuditPage /></AdminRoute>} />
    <Route path="settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
    <Route path="*" element={<NotFoundPage />} />
    </Route>}
  </Routes></BrowserRouter>;
}

function RouteEffects() {
  const location = useLocation();
  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";

    const scrollToTop = () => {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement) focused.blur();

      const scrollingElement = document.scrollingElement;
      scrollingElement?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    // Safari can restore the previous position after React has painted or after
    // an async page has changed height. Reset across those browser phases too.
    scrollToTop();
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      scrollToTop();
      secondFrame = window.requestAnimationFrame(scrollToTop);
    });
    const shortDelay = window.setTimeout(scrollToTop, 80);
    const dataDelay = window.setTimeout(scrollToTop, 350);
    window.addEventListener("pageshow", scrollToTop);

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(shortDelay);
      window.clearTimeout(dataDelay);
      window.removeEventListener("pageshow", scrollToTop);
    };
  }, [location.key, location.pathname, location.search, location.hash]);
  return null;
}
