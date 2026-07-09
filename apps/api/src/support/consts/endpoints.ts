export const SUPPORT_ENDPOINTS = {
  ROOT: 'support',
  TICKETS: 'tickets',
  TICKET_BY_ID: 'tickets/:id',
  TICKET_MESSAGES: 'tickets/:id/messages',
  MESSAGE_ATTACHMENTS: 'tickets/:ticketId/messages/:messageId/attachments',
  TICKET_ATTACHMENT: 'tickets/:ticketId/attachments/:attachmentId',
} as const;
