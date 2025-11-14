import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';

// Get saved language preference from localStorage, default to 'en'
const getSavedLanguage = (): string => {
  try {
    const saved = localStorage.getItem('i18nextLng');
    return saved && (saved === 'en' || saved === 'ar') ? saved : 'en';
  } catch {
    return 'en';
  }
};

i18n
  .use(Backend)
  .use(initReactI18next)
  .init({
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },
    lng: getSavedLanguage(),
    fallbackLng: 'en',
    supportedLngs: ['en', 'ar'],
    interpolation: {
      escapeValue: false,
    },
    // Save language preference to localStorage when changed
    detection: {
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    // Add fallback to prevent crashes if backend fails
    react: {
      useSuspense: false,
    },
    // Return key if translation is missing (for debugging)
    returnEmptyString: false,
    returnNull: false,
  });

// Listen for language changes and save to localStorage
i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem('i18nextLng', lng);
  } catch (error) {
    console.error('Failed to save language preference:', error);
  }
});

export default i18n;
