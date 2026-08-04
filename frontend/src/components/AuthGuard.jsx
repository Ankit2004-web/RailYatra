import { Outlet } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

export default function AuthGuard({ adminOnly = false, staffOnly = false }) {
  return (
    <ProtectedRoute adminOnly={adminOnly} staffOnly={staffOnly}>
      <Outlet />
    </ProtectedRoute>
  );
}
