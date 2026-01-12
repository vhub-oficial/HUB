import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { Role } from '../../types';

type Props = {
  required: Role;
  children: React.ReactNode;
};

/**
 * Frontend guard (UX/security-in-depth). RLS remains the real enforcement.
 */
export const RequireRole: React.FC<Props> = ({ required, children }) => {
  const { loading, profile, role } = useAuth();

  if (loading) return null;
  if (!profile) return <Navigate to="/login" replace />;

  // admin can do everything
  if (role === 'admin') return <>{children}</>;
  if (required === 'viewer') return <>{children}</>;
  if (required === role) return <>{children}</>;

  // fallback
  return <Navigate to="/dashboard" replace />;
};
