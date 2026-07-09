export const FRIENDS_ENDPOINTS = {
  BASE: 'friends',
  REQUESTS: 'requests',
  REQUEST: 'request',
  REQUEST_ACCEPT: 'request/:id/accept',
  REQUEST_DECLINE: 'request/:id/decline',
  BY_FRIEND_ID: ':friendId',
} as const;
