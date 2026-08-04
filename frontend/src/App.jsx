import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { I18nProvider } from './context/I18nContext';
import Layout from './components/Layout';
import AuthGuard from './components/AuthGuard';
import ErrorBoundary from './components/ErrorBoundary';
import HomePage from './pages/HomePage';
import SearchResultsPage from './pages/SearchResultsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import BookingsPage from './pages/BookingsPage';
import PnrPage from './pages/PnrPage';
import BookingPage from './pages/BookingPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AboutPage from './pages/AboutPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import ContactPage from './pages/ContactPage';
import OffersPage from './pages/OffersPage';
import ProfilePage from './pages/ProfilePage';
import RolePortalPage from './pages/RolePortalPage';
import LiveTrainPage from './pages/LiveTrainPage';
import SupportPage from './pages/SupportPage';
import StationDetailPage from './pages/StationDetailPage';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <I18nProvider>
        <ThemeProvider>
          <BrowserRouter>
            <Routes>
              <Route index element={<Navigate to="/login" replace />} />
              <Route element={<Layout />}>
                <Route path="home" element={<HomePage />} />
                <Route path="search" element={<SearchResultsPage />} />
                <Route path="pnr" element={<PnrPage />} />
                <Route path="live-trains" element={<LiveTrainPage />} />
                <Route path="support" element={<SupportPage />} />
                <Route path="stations/:code" element={<StationDetailPage />} />
                <Route element={<AuthGuard />}>
                  <Route path="bookings" element={<BookingsPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="book" element={<BookingPage />} />
                </Route>
                <Route element={<AuthGuard staffOnly />}>
                  <Route path="portal" element={<RolePortalPage />} />
                </Route>
                <Route path="about" element={<AboutPage />} />
                <Route path="privacy" element={<PrivacyPage />} />
                <Route path="terms" element={<TermsPage />} />
                <Route path="contact" element={<ContactPage />} />
                <Route path="offers" element={<OffersPage />} />
                <Route element={<AuthGuard adminOnly />}>
                  <Route path="admin" element={<AdminDashboardPage />} />
                </Route>
              </Route>
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="forgot-password" element={<ForgotPasswordPage />} />
              <Route path="reset-password" element={<ResetPasswordPage />} />
              <Route path="admin/login" element={<AdminLoginPage />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>
        </ThemeProvider>
        </I18nProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
