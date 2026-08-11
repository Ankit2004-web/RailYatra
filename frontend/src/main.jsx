import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './styles/header.css';
import './styles/themes.css';
import './styles/page-layout.css';
import './styles/search-results.css';
import './styles/home.css';
import './styles/booking.css';
import './styles/pnr.css';
import './styles/my-bookings.css';
import './styles/auth.css';
import './styles/login-enterprise.css';
import './styles/profile.css';
import './styles/static-pages.css';
import './styles/offers.css';
import './styles/admin.css';
import './styles/support.css';
import './styles/themes-dark.css';

const storedTheme = localStorage.getItem('railyatra-theme');
if (storedTheme) document.documentElement.setAttribute('data-theme', storedTheme);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
