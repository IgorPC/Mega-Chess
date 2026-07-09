export const TOURNAMENTS_ROOT = 'tournaments';

export const TOURNAMENTS_ROUTES = {
  DUEL_INVITE: 'duel/invite',
  DUEL_ACCEPT: 'duel/:tournamentId/accept',
  DUEL_DECLINE: 'duel/:tournamentId/decline',
  MINE: 'mine',
  DETAILS: ':tournamentId',
  JOIN: ':tournamentId/join',
  LEAVE: ':tournamentId/leave',
  START: ':tournamentId/start',
  CANCEL: ':tournamentId',
  INVITE_BY_NICKNAME: ':tournamentId/invite/nickname',
  INVITE_FRIEND: ':tournamentId/invite/friend/:friendId',
  KICK: ':tournamentId/kick',
  HISTORY_ME: 'history/me',
  MATCH_DETAILS: 'match/:matchId/details',
} as const;
