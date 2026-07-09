import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AsaasRepository } from './asaas.repository';
import {
  ASAAS_BASE_URL_PRODUCTION,
  ASAAS_BASE_URL_SANDBOX,
  ASAAS_MAX_RETRIES,
  ASAAS_RETRY_BACKOFF_BASE_MS,
  ASAAS_PATHS,
  DEPOSIT_DESCRIPTION,
  WITHDRAWAL_DESCRIPTION,
} from './consts/asaas.consts';

interface AsaasPaymentResponse {
  id: string;
  status: string;
}

interface AsaasQrCodeResponse {
  encodedImage: string;
  payload: string;
  expirationDate: string;
}

interface AsaasTransferResponse {
  id: string;
  status: string;
}

@Injectable()
export class AsaasService {
  private readonly logger = new Logger(AsaasService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly isSandbox: boolean;

  constructor(
    config: ConfigService,
    private readonly users: AsaasRepository,
  ) {
    const env = config.get('ASAAS_ENV') ?? 'sandbox';
    this.isSandbox = env !== 'production';
    this.baseUrl = env === 'production'
      ? ASAAS_BASE_URL_PRODUCTION
      : ASAAS_BASE_URL_SANDBOX;
    this.apiKey = config.get('ASAAS_API_KEY') ?? '';
  }

  isSandboxEnv(): boolean {
    return this.isSandbox;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: object,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let attempt = 0;
    const maxRetries = ASAAS_MAX_RETRIES;

    while (attempt < maxRetries) {
      attempt++;
      let res: Response;
      try {
        res = await fetch(url, {
          method,
          headers: {
            'access_token': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (networkErr) {
        // Network-level failure (DNS, connection refused, etc.) — retry
        if (attempt >= maxRetries) throw networkErr;
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * ASAAS_RETRY_BACKOFF_BASE_MS));
        continue;
      }

      // Server errors and rate-limit are retried; client errors (4xx) are not
      if (res.status === 429 || res.status >= 500) {
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * ASAAS_RETRY_BACKOFF_BASE_MS));
          continue;
        }
        throw new InternalServerErrorException('Asaas: máximo de tentativas atingido');
      }

      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Asaas ${method} ${path} → ${res.status}: ${text}`);
        throw new InternalServerErrorException('Erro no gateway de pagamento');
      }

      return res.json() as Promise<T>;
    }
    throw new InternalServerErrorException('Asaas: máximo de tentativas atingido');
  }

  // ─── Customer ─────────────────────────────────────────────────────────────

  async ensureCustomer(userId: string, cpfOverride?: string): Promise<string> {
    const user = await this.users.findById(userId);
    if (!user) throw new InternalServerErrorException('Usuário não encontrado');

    const cpf = cpfOverride ?? user.cpf;
    if (!cpf) throw new BadRequestException('CPF obrigatório para gerar pagamento');

    if (user.asaasCustomerId) {
      // Only update when an override CPF is being provided (differs from stored)
      if (cpfOverride && cpfOverride !== user.cpf) {
        await this.request('PUT', ASAAS_PATHS.CUSTOMER_BY_ID(user.asaasCustomerId), {
          name: user.billingName ?? user.name,
          email: user.email,
          cpfCnpj: cpf,
          externalReference: userId,
        });
      }
      return user.asaasCustomerId;
    }

    const customer = await this.request<{ id: string }>('POST', ASAAS_PATHS.CUSTOMERS, {
      name: user.billingName ?? user.name,
      email: user.email,
      cpfCnpj: cpf,
      externalReference: userId,
    });

    await this.users.updateAsaasCustomerId(userId, customer.id);
    return customer.id;
  }

  // ─── Deposit ──────────────────────────────────────────────────────────────

  async createPixPayment(
    userId: string,
    valueBrl: number,
    depositId: string,
    cpfOverride?: string,
  ): Promise<{ paymentId: string; qrCode: string; copyPaste: string; expiresAt: string }> {
    const customerId = await this.ensureCustomer(userId, cpfOverride);

    // Expire in 3 hours — Asaas only accepts date, so use today; QR expiry from response
    const payment = await this.request<AsaasPaymentResponse>('POST', ASAAS_PATHS.PAYMENTS, {
      customer: customerId,
      billingType: 'PIX',
      value: valueBrl,
      dueDate: new Date().toISOString().split('T')[0],
      description: DEPOSIT_DESCRIPTION,
      externalReference: depositId,
    });

    const qrData = await this.request<AsaasQrCodeResponse>(
      'GET', ASAAS_PATHS.PAYMENT_PIX_QR_CODE(payment.id),
    );

    return {
      paymentId: payment.id,
      qrCode: qrData.encodedImage,
      copyPaste: qrData.payload,
      expiresAt: qrData.expirationDate,
    };
  }

  async cancelPayment(asaasPaymentId: string): Promise<void> {
    await this.request('DELETE', ASAAS_PATHS.PAYMENT_BY_ID(asaasPaymentId));
  }

  // ─── Withdrawal ───────────────────────────────────────────────────────────

  async sendPix(
    valueBrl: number,
    pixKey: string,
    pixKeyType: string,
  ): Promise<AsaasTransferResponse> {
    return this.request<AsaasTransferResponse>('POST', ASAAS_PATHS.TRANSFERS, {
      value: valueBrl,
      operationType: 'PIX',
      pixAddressKey: pixKey,
      pixAddressKeyType: pixKeyType,
      description: WITHDRAWAL_DESCRIPTION,
    });
  }
}
