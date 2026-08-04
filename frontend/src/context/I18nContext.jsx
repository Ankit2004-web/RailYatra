import { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  en: {
    search: 'Search',
    pnr: 'PNR Status',
    bookings: 'My Bookings',
    login: 'Login',
    book: 'Book Ticket'
  },
  hi: {
    search: 'खोजें',
    pnr: 'PNR स्थिति',
    bookings: 'मेरी बुकिंग',
    login: 'लॉगिन',
    book: 'टिकट बुक करें'
  }
};

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('railyatra_lang') || 'en');

  useEffect(() => {
    localStorage.setItem('railyatra_lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key) => translations[lang]?.[key] || translations.en[key] || key;

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
