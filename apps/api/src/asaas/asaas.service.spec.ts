import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AsaasService } from './asaas.service';
import { AsaasRepository } from './asaas.repository';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

describe('AsaasService', () => {
  let service: AsaasService;
  let repo: jest.Mocked<AsaasRepository>;
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;

    const module = await Test.createTestingModule({
      providers: [
        AsaasService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => (key === 'ASAAS_ENV' ? 'sandbox' : 'test-api-key')) },
        },
        {
          provide: AsaasRepository,
          useValue: { findById: jest.fn(), updateAsaasCustomerId: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AsaasService);
    repo = module.get(AsaasRepository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('ensureCustomer', () => {
    it('throws when the user does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.ensureCustomer('missing-user')).rejects.toBeInstanceOf(InternalServerErrorException);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when there is no CPF at all', async () => {
      repo.findById.mockResolvedValue({ id: 'u1', cpf: null } as any);

      await expect(service.ensureCustomer('u1')).rejects.toBeInstanceOf(BadRequestException);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns the existing Asaas customer id without any request when no CPF override is given', async () => {
      repo.findById.mockResolvedValue({ id: 'u1', cpf: '11111111111', asaasCustomerId: 'cus_existing' } as any);

      const result = await service.ensureCustomer('u1');

      expect(result).toBe('cus_existing');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('updates the existing customer on Asaas when an override CPF differs from the stored one', async () => {
      repo.findById.mockResolvedValue({
        id: 'u1', cpf: '11111111111', asaasCustomerId: 'cus_existing', name: 'Foo', email: 'foo@test.com',
      } as any);
      fetchMock.mockResolvedValue(jsonResponse({}));

      const result = await service.ensureCustomer('u1', '22222222222');

      expect(result).toBe('cus_existing');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/customers/cus_existing'),
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    it('does not call Asaas again when the override CPF is identical to the stored one', async () => {
      repo.findById.mockResolvedValue({
        id: 'u1', cpf: '11111111111', asaasCustomerId: 'cus_existing',
      } as any);

      await service.ensureCustomer('u1', '11111111111');

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('creates a brand-new Asaas customer and persists its id when the user has none yet', async () => {
      repo.findById.mockResolvedValue({ id: 'u1', cpf: '11111111111', name: 'Foo', email: 'foo@test.com' } as any);
      fetchMock.mockResolvedValue(jsonResponse({ id: 'cus_new' }));

      const result = await service.ensureCustomer('u1');

      expect(result).toBe('cus_new');
      expect(repo.updateAsaasCustomerId).toHaveBeenCalledWith('u1', 'cus_new');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/customers'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('createPixPayment', () => {
    it('creates the payment then fetches its PIX QR code', async () => {
      repo.findById.mockResolvedValue({ id: 'u1', cpf: '11111111111', asaasCustomerId: 'cus_1' } as any);
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ id: 'pay_1', status: 'PENDING' }))
        .mockResolvedValueOnce(jsonResponse({ encodedImage: 'img', payload: 'copy-paste', expirationDate: '2026-01-01' }));

      const result = await service.createPixPayment('u1', 100, 'deposit-1');

      expect(result).toEqual({
        paymentId: 'pay_1',
        qrCode: 'img',
        copyPaste: 'copy-paste',
        expiresAt: '2026-01-01',
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('isSandboxEnv', () => {
    it('returns true when ASAAS_ENV is sandbox (the default in this suite)', () => {
      expect(service.isSandboxEnv()).toBe(true);
    });

    it('returns false when ASAAS_ENV is production', async () => {
      const prodModule = await Test.createTestingModule({
        providers: [
          AsaasService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn((key: string) => (key === 'ASAAS_ENV' ? 'production' : 'test-api-key')) },
          },
          {
            provide: AsaasRepository,
            useValue: { findById: jest.fn(), updateAsaasCustomerId: jest.fn() },
          },
        ],
      }).compile();
      const prodService = prodModule.get(AsaasService);

      expect(prodService.isSandboxEnv()).toBe(false);
    });
  });

  describe('cancelPayment', () => {
    it('sends a DELETE request for the given payment id', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));

      await service.cancelPayment('pay_1');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/payments/pay_1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('sendPix', () => {
    it('sends a transfer request with the PIX key details', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ id: 'transfer_1', status: 'PENDING' }));

      const result = await service.sendPix(50, 'user@pix.com', 'EMAIL');

      expect(result).toEqual({ id: 'transfer_1', status: 'PENDING' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/transfers');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({
        value: 50,
        operationType: 'PIX',
        pixAddressKey: 'user@pix.com',
        pixAddressKeyType: 'EMAIL',
        description: expect.any(String),
      });
    });
  });

  describe('retry / error handling (via sendPix as a representative request)', () => {
    it('retries on a network failure and succeeds on a later attempt', async () => {
      jest.useFakeTimers();
      fetchMock
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce(jsonResponse({ id: 't1', status: 'DONE' }));

      const promise = service.sendPix(10, 'key', 'CPF');
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual({ id: 't1', status: 'DONE' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('retries on 429 and on 5xx before eventually succeeding', async () => {
      jest.useFakeTimers();
      fetchMock
        .mockResolvedValueOnce(jsonResponse({}, 429))
        .mockResolvedValueOnce(jsonResponse({}, 503))
        .mockResolvedValueOnce(jsonResponse({ id: 't1', status: 'DONE' }));

      const promise = service.sendPix(10, 'key', 'CPF');
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual({ id: 't1', status: 'DONE' });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('gives up after the maximum number of retries on repeated network failures', async () => {
      jest.useFakeTimers();
      fetchMock.mockRejectedValue(new Error('ECONNRESET'));

      const promise = service.sendPix(10, 'key', 'CPF');
      const assertion = expect(promise).rejects.toThrow('ECONNRESET');
      await jest.runAllTimersAsync();
      await assertion;

      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('gives up after the maximum number of retries on repeated 5xx responses', async () => {
      jest.useFakeTimers();
      fetchMock.mockResolvedValue(jsonResponse({}, 500));

      const promise = service.sendPix(10, 'key', 'CPF');
      const assertion = expect(promise).rejects.toBeInstanceOf(InternalServerErrorException);
      await jest.runAllTimersAsync();
      await assertion;

      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('does not retry a 4xx client error and fails immediately', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ message: 'invalid pix key' }, 400));

      await expect(service.sendPix(10, 'bad-key', 'CPF')).rejects.toBeInstanceOf(InternalServerErrorException);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
