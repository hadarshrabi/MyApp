import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import type { Permission } from "../types/models";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can } = useAuth();
  return can(permission) ? children : <Navigate to="/" replace />;
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/" replace />;
}
