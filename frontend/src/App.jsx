import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import SearchResultsPage from './pages/SearchResultsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import BookingsPage from './pages/BookingsPage';
import PnrPage from './pages/PnrPage';
import BookingPage from './pages/BookingPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="search" element={<SearchResultsPage />} />
            <Route path="pnr" element={<PnrPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="book" element={<BookingPage />} />
          </Route>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="admin/login" element={<AdminLoginPage />} />
          <Route path="admin" element={<AdminDashboardPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
