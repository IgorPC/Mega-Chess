import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service';

jest.mock('nodemailer');

describe('EmailService', () => {
  let sendMailMock: jest.Mock;
  const createTransportMock = nodemailer.createTransport as jest.Mock;

  function configValue(overrides: Record<string, unknown> = {}) {
    const values: Record<string, unknown> = {
      SMTP_HOST: 'smtp.test.com',
      SMTP_USER: 'user@test.com',
      SMTP_PASS: 'secret',
      ...overrides,
    };
    return {
      get: jest.fn((key: string, def?: unknown) => (key in values ? values[key] : def)),
      getOrThrow: jest.fn((key: string) => {
        if (!(key in values) || values[key] === undefined) {
          throw new Error(`Missing required config: ${key}`);
        }
        return values[key];
      }),
    };
  }

  async function buildService(configOverrides: Record<string, unknown> = {}) {
    const module = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: configValue(configOverrides) },
      ],
    }).compile();
    return module.get(EmailService);
  }

  beforeEach(() => {
    sendMailMock = jest.fn().mockResolvedValue({ messageId: 'abc' });
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor / transport setup', () => {
    it('creates the nodemailer transport with the configured SMTP credentials', async () => {
      await buildService({ SMTP_PORT: 587 });

      expect(createTransportMock).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.test.com',
          port: 587,
          secure: true,
          auth: { user: 'user@test.com', pass: 'secret' },
        }),
      );
    });

    it('throws when a required SMTP config value is missing', async () => {
      await expect(buildService({ SMTP_HOST: undefined })).rejects.toThrow('Missing required config: SMTP_HOST');
    });
  });

  describe('sendEmailConfirmation', () => {
    it('sends a confirmation email with the name and confirm link', async () => {
      const service = await buildService();
      service.sendEmailConfirmation('user@test.com', 'Alice', 'https://app/verify?token=xyz');

      expect(sendMailMock).toHaveBeenCalledTimes(1);
      const call = sendMailMock.mock.calls[0][0];
      expect(call.to).toBe('user@test.com');
      expect(call.subject).toContain('Confirme seu email');
      expect(call.html).toContain('Alice');
      expect(call.html).toContain('https://app/verify?token=xyz');
    });

    it('falls back to SMTP_USER when SMTP_FROM is not configured', async () => {
      const service = await buildService();
      service.sendEmailConfirmation('user@test.com', 'Alice', 'https://app/verify');

      expect(sendMailMock.mock.calls[0][0].from).toBe('user@test.com');
    });

    it('uses a configured SMTP_FROM when provided', async () => {
      const service = await buildService({ SMTP_FROM: '"Custom" <no-reply@test.com>' });
      service.sendEmailConfirmation('user@test.com', 'Alice', 'https://app/verify');

      expect(sendMailMock.mock.calls[0][0].from).toBe('"Custom" <no-reply@test.com>');
    });

    it('logs the error instead of throwing when sendMail rejects', async () => {
      sendMailMock.mockRejectedValue(new Error('smtp down'));
      const service = await buildService();

      expect(() => service.sendEmailConfirmation('user@test.com', 'Alice', 'https://app/verify')).not.toThrow();
      await new Promise((r) => setImmediate(r));
    });
  });

  describe('sendDepositCreated', () => {
    it('includes value, deposit id and PIX validity in the email body', async () => {
      const service = await buildService();
      service.sendDepositCreated('user@test.com', 'Bob', 150.5, 'deposit-uuid-1234');

      const call = sendMailMock.mock.calls[0][0];
      expect(call.html).toContain('R$ 150.50');
      expect(call.html).toContain('DEPOSIT-');
      expect(call.html).toContain('3 horas');
    });
  });

  describe('sendDepositConfirmed', () => {
    it('includes the paid value and new balance', async () => {
      const service = await buildService();
      service.sendDepositConfirmed('user@test.com', 'Carol', 100, 250.75);

      const call = sendMailMock.mock.calls[0][0];
      expect(call.html).toContain('R$ 100.00');
      expect(call.html).toContain('250.75 CC');
    });
  });

  describe('sendWithdrawalRequested', () => {
    it('includes withdrawal amount, fee, BRL value and PIX key', async () => {
      const service = await buildService();
      service.sendWithdrawalRequested('user@test.com', 'Dave', 100, 98, 2, 'dave@pix.com');

      const call = sendMailMock.mock.calls[0][0];
      expect(call.html).toContain('100.00 CC');
      expect(call.html).toContain('2.00 CC');
      expect(call.html).toContain('R$ 98.00');
      expect(call.html).toContain('dave@pix.com');
      expect(call.html).toContain('25 minutos');
    });
  });

  describe('sendTicketOpened', () => {
    it('includes the shortened ticket id, title and category', async () => {
      const service = await buildService();
      service.sendTicketOpened('user@test.com', 'Eve', 'ticket-uuid-5678', 'Login issue', 'Conta');

      const call = sendMailMock.mock.calls[0][0];
      expect(call.subject).toContain('TICKET-U');
      expect(call.html).toContain('Login issue');
      expect(call.html).toContain('Conta');
      expect(call.html).toContain('Aberto');
    });
  });

  describe('sendTicketUpdated', () => {
    it('shows the full preview when it is short', async () => {
      const service = await buildService();
      service.sendTicketUpdated('user@test.com', 'Frank', 'ticket-1', 'Bug report', 'Short reply');

      const call = sendMailMock.mock.calls[0][0];
      expect(call.html).toContain('Short reply');
      expect(call.html).not.toContain('…');
    });

    it('truncates the preview to 200 characters with an ellipsis when it is long', async () => {
      const service = await buildService();
      const longPreview = 'x'.repeat(250);
      service.sendTicketUpdated('user@test.com', 'Frank', 'ticket-1', 'Bug report', longPreview);

      const call = sendMailMock.mock.calls[0][0];
      expect(call.html).toContain('x'.repeat(200) + '…');
      expect(call.html).not.toContain('x'.repeat(201));
    });
  });

  describe('sendReportReceived', () => {
    it('includes the reported nickname and reason', async () => {
      const service = await buildService();
      service.sendReportReceived('user@test.com', 'Grace', 'cheater123', 'Uso de engine');

      const call = sendMailMock.mock.calls[0][0];
      expect(call.html).toContain('@cheater123');
      expect(call.html).toContain('Uso de engine');
      expect(call.html).toContain('Em análise');
    });
  });

  describe('sendPasswordReset', () => {
    it('includes the reset link and 1-hour expiry notice', async () => {
      const service = await buildService();
      service.sendPasswordReset('user@test.com', 'Hank', 'https://app/reset?token=abc');

      const call = sendMailMock.mock.calls[0][0];
      expect(call.html).toContain('https://app/reset?token=abc');
      expect(call.html).toContain('1 hora');
    });
  });

  describe('sendAdminOtp', () => {
    it('includes the OTP code and 10-minute validity notice', async () => {
      const service = await buildService();
      service.sendAdminOtp('admin@test.com', 'Iris', '482913');

      const call = sendMailMock.mock.calls[0][0];
      expect(call.html).toContain('482913');
      expect(call.html).toContain('10 minutos');
    });
  });

  describe('sendAdminWelcome', () => {
    it('includes the recipient email, temp password and the configured admin URL', async () => {
      const service = await buildService({ ADMIN_URL: 'https://admin.custom.com' });
      service.sendAdminWelcome('newadmin@test.com', 'Jack', 'Temp!2345');

      const call = sendMailMock.mock.calls[0][0];
      expect(call.html).toContain('newadmin@test.com');
      expect(call.html).toContain('Temp!2345');
      expect(call.html).toContain('https://admin.custom.com');
    });

    it('falls back to the default admin URL when none is configured', async () => {
      const service = await buildService();
      service.sendAdminWelcome('newadmin@test.com', 'Jack', 'Temp!2345');

      const call = sendMailMock.mock.calls[0][0];
      expect(call.html).toContain('http://localhost:5174');
    });
  });
});
