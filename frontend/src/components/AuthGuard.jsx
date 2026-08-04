import { Outlet } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

export default function AuthGuard({ adminOnly = false }) {
  return (
    <ProtectedRoute adminOnly={adminOnly}>
      <Outlet />
    </ProtectedRoute>
  );
}
