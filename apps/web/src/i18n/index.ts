import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import commonPt from '../locales/pt/common.json';
import commonEn from '../locales/en/common.json';
import validationPt from '../locales/pt/validation.json';
import validationEn from '../locales/en/validation.json';
import maintenancePt from '../locales/pt/maintenance.json';
import maintenanceEn from '../locales/en/maintenance.json';
import authPt from '../locales/pt/auth.json';
import authEn from '../locales/en/auth.json';
import rankingPt from '../locales/pt/ranking.json';
import rankingEn from '../locales/en/ranking.json';
import termsPt from '../locales/pt/terms.json';
import termsEn from '../locales/en/terms.json';
import supportPt from '../locales/pt/support.json';
import supportEn from '../locales/en/support.json';
import profilePt from '../locales/pt/profile.json';
import profileEn from '../locales/en/profile.json';
import friendsPt from '../locales/pt/friends.json';
import friendsEn from '../locales/en/friends.json';
import suggestionsPt from '../locales/pt/suggestions.json';
import suggestionsEn from '../locales/en/suggestions.json';
import tournamentsPt from '../locales/pt/tournaments.json';
import tournamentsEn from '../locales/en/tournaments.json';
import notificationsPt from '../locales/pt/notifications.json';
import notificationsEn from '../locales/en/notifications.json';
import historyPt from '../locales/pt/history.json';
import historyEn from '../locales/en/history.json';
import lobbyPt from '../locales/pt/lobby.json';
import lobbyEn from '../locales/en/lobby.json';
import walletPt from '../locales/pt/wallet.json';
import walletEn from '../locales/en/wallet.json';
import gamePt from '../locales/pt/game.json';
import gameEn from '../locales/en/game.json';

export const LOCALE_STORAGE_KEY = 'locale';

const NAMESPACES = [
  'common', 'validation', 'maintenance', 'auth', 'ranking', 'terms', 'support', 'profile',
  'friends', 'suggestions', 'tournaments', 'notifications', 'history', 'lobby',
  'wallet', 'game',
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pt: {
        common: commonPt, validation: validationPt, maintenance: maintenancePt, auth: authPt, ranking: rankingPt,
        terms: termsPt, support: supportPt, profile: profilePt, friends: friendsPt,
        suggestions: suggestionsPt, tournaments: tournamentsPt, notifications: notificationsPt,
        history: historyPt, lobby: lobbyPt, wallet: walletPt, game: gamePt,
      },
      en: {
        common: commonEn, validation: validationEn, maintenance: maintenanceEn, auth: authEn, ranking: rankingEn,
        terms: termsEn, support: supportEn, profile: profileEn, friends: friendsEn,
        suggestions: suggestionsEn, tournaments: tournamentsEn, notifications: notificationsEn,
        history: historyEn, lobby: lobbyEn, wallet: walletEn, game: gameEn,
      },
    },
    ns: NAMESPACES,
    defaultNS: 'common',
    fallbackLng: 'pt',
    supportedLngs: ['pt', 'en'],
    load: 'languageOnly',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
