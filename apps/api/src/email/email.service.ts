import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;
  private readonly appUrl: string;
  private readonly adminUrl: string;

  constructor(private config: ConfigService) {
    this.appUrl = config.get<string>('APP_URL', 'http://localhost');
    this.adminUrl = config.get<string>('ADMIN_URL', 'http://localhost:5174');
    this.transporter = nodemailer.createTransport({
      host: config.getOrThrow<string>('SMTP_HOST'),
      port: config.get<number>('SMTP_PORT', 465),
      secure: true,
      auth: {
        user: config.getOrThrow<string>('SMTP_USER'),
        pass: config.getOrThrow<string>('SMTP_PASS'),
      },
    });
  }

  // ─── Base layout ────────────────────────────────────────────────────────────

  // Sub-project 4 (see docs/superpowers/specs/2026-07-09-i18n-foundation-design.md)
  // will translate the actual subject/body copy per locale. For now this only
  // threads the locale through so the HTML lang attribute is correct and every
  // call site has the parameter available — content stays Portuguese either way.
  private layout(title: string, bodyHtml: string, locale: 'pt' | 'en' = 'pt'): string {
    return `<!DOCTYPE html>
<html lang="${locale === 'en' ? 'en' : 'pt-BR'}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background-color:#0C0B13;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0C0B13;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header com logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="36" height="36" rx="8" fill="#3D4AEB"/>
                      <path d="M18 6v3M15 9h6M14 12h8l-1 4h-6l-1-4z" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M13 16l-2 8h14l-2-8" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                      <rect x="11" y="24" width="14" height="3" rx="1" fill="white"/>
                    </svg>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:-0.5px;">Mega Chess</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card principal -->
          <tr>
            <td style="background-color:#1E1D2E;border-radius:16px;padding:40px 40px 32px;border:1px solid #373855;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="margin:0;font-size:12px;color:#8B8CA7;line-height:1.6;">
                Este é um email automático — <strong style="color:#8B8CA7;">não responda a esta mensagem</strong>.
              </p>
              <p style="margin:12px 0 0;font-size:11px;color:#555570;">
                © ${new Date().getFullYear()} Mega Chess. Todos os direitos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private badge(text: string, color = '#3D4AEB'): string {
    return `<span style="display:inline-block;background-color:${color};color:#fff;font-size:11px;font-weight:700;letter-spacing:0.5px;padding:3px 10px;border-radius:20px;text-transform:uppercase;">${text}</span>`;
  }

  private divider(): string {
    return `<div style="height:1px;background-color:#373855;margin:24px 0;"></div>`;
  }

  private infoRow(label: string, value: string): string {
    return `<tr>
      <td style="padding:8px 0;font-size:14px;color:#8B8CA7;width:45%;">${label}</td>
      <td style="padding:8px 0;font-size:14px;color:#FFFFFF;font-weight:500;">${value}</td>
    </tr>`;
  }

  private button(text: string, href: string): string {
    return `<a href="${href}" style="display:inline-block;background-color:#3D4AEB;color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;margin-top:8px;">${text}</a>`;
  }

  private thanks(): string {
    return `<p style="margin:24px 0 0;font-size:14px;color:#8B8CA7;line-height:1.6;">
      Obrigado por fazer parte da comunidade Mega Chess!<br/>
      Até a próxima partida. ♟️
    </p>`;
  }

  // ─── Send helper ────────────────────────────────────────────────────────────

  private send(to: string, subject: string, html: string): void {
    const from = this.config.get<string>('SMTP_FROM') ?? this.config.getOrThrow<string>('SMTP_USER');
    this.transporter
      .sendMail({ from, to, subject, html })
      .catch((err) => this.logger.error(`Falha ao enviar email para ${to}: ${err.message}`));
  }

  // ─── 1. Confirmação de cadastro ─────────────────────────────────────────────

  sendEmailConfirmation(to: string, name: string, confirmUrl: string, locale: 'pt' | 'en' = 'pt'): void {
    const body = `
      <p style="margin:0 0 4px;font-size:13px;color:#8B8CA7;">Bem-vindo ao tabuleiro!</p>
      <h1 style="margin:0 0 24px;font-size:26px;font-weight:700;color:#FFFFFF;line-height:1.2;">
        Confirme seu email, ${name} 👋
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#FFFFFF;line-height:1.7;">
        Sua conta foi criada com sucesso! Para ativá-la e começar a jogar, clique no botão abaixo para confirmar seu endereço de email.
      </p>
      <div style="text-align:center;margin:0 0 32px;">
        ${this.button('Confirmar email', confirmUrl)}
      </div>
      <p style="margin:0;font-size:13px;color:#8B8CA7;line-height:1.6;">
        Este link expira em <strong style="color:#FFFFFF;">24 horas</strong>. Se você não criou uma conta no Mega Chess, ignore este email com segurança.
      </p>
      ${this.divider()}
      ${this.thanks()}
    `;
    this.send(to, 'Confirme seu email — Mega Chess', this.layout('Confirmação de Email', body, locale));
  }

  // ─── 2. Depósito efetuado (PIX gerado, aguardando pagamento) ────────────────

  sendDepositCreated(to: string, name: string, valueBrl: number, depositId: string, locale: 'pt' | 'en' = 'pt'): void {
    const body = `
      <p style="margin:0 0 4px;">${this.badge('Depósito')}</p>
      <h1 style="margin:8px 0 24px;font-size:26px;font-weight:700;color:#FFFFFF;line-height:1.2;">
        PIX gerado com sucesso!
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#FFFFFF;line-height:1.7;">
        Olá, <strong>${name}</strong>! Recebemos sua solicitação de depósito. Use o QR Code ou o código Copia e Cola disponível na plataforma para efetuar o pagamento.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0C0B13;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
        <tbody>
          ${this.infoRow('Valor', `R$ ${valueBrl.toFixed(2)}`)}
          ${this.infoRow('Chess Coins a creditar', `${valueBrl.toFixed(2)} CC`)}
          ${this.infoRow('Validade do PIX', '3 horas')}
          ${this.infoRow('ID do depósito', depositId.slice(0, 8).toUpperCase())}
        </tbody>
      </table>
      <div style="text-align:center;margin:0 0 24px;">
        ${this.button('Ver depósito', `${this.appUrl}/wallet`)}
      </div>
      <p style="margin:0;font-size:13px;color:#8B8CA7;line-height:1.6;">
        Após o pagamento, o crédito é processado automaticamente em instantes.
      </p>
      ${this.divider()}
      ${this.thanks()}
    `;
    this.send(to, 'Depósito PIX gerado — Mega Chess', this.layout('Depósito criado', body, locale));
  }

  // ─── 3. Depósito confirmado (CC creditado na carteira) ──────────────────────

  sendDepositConfirmed(to: string, name: string, valueBrl: number, newBalance: number, locale: 'pt' | 'en' = 'pt'): void {
    const body = `
      <p style="margin:0 0 4px;">${this.badge('Depósito confirmado', '#2D6A4F')}</p>
      <h1 style="margin:8px 0 24px;font-size:26px;font-weight:700;color:#FFFFFF;line-height:1.2;">
        Seus Chess Coins chegaram! 🎉
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#FFFFFF;line-height:1.7;">
        Olá, <strong>${name}</strong>! Seu pagamento PIX foi confirmado e os Chess Coins já estão disponíveis na sua carteira.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0C0B13;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
        <tbody>
          ${this.infoRow('Valor pago', `R$ ${valueBrl.toFixed(2)}`)}
          ${this.infoRow('Chess Coins creditados', `${valueBrl.toFixed(2)} CC`)}
          ${this.infoRow('Novo saldo', `${newBalance.toFixed(2)} CC`)}
        </tbody>
      </table>
      <div style="text-align:center;margin:0 0 24px;">
        ${this.button('Jogar agora', `${this.appUrl}/lobby`)}
      </div>
      ${this.divider()}
      ${this.thanks()}
    `;
    this.send(to, 'Depósito confirmado — Mega Chess', this.layout('Depósito confirmado', body, locale));
  }

  // ─── 4. Saque solicitado ─────────────────────────────────────────────────────

  sendWithdrawalRequested(
    to: string,
    name: string,
    valueCC: number,
    valueBrl: number,
    feeCC: number,
    pixKey: string,
    locale: 'pt' | 'en' = 'pt',
  ): void {
    const body = `
      <p style="margin:0 0 4px;">${this.badge('Saque', '#8B5CF6')}</p>
      <h1 style="margin:8px 0 24px;font-size:26px;font-weight:700;color:#FFFFFF;line-height:1.2;">
        Solicitação de saque recebida
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#FFFFFF;line-height:1.7;">
        Olá, <strong>${name}</strong>! Recebemos sua solicitação de saque. O valor será processado e enviado para sua chave PIX após análise de segurança.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0C0B13;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
        <tbody>
          ${this.infoRow('Chess Coins debitados', `${valueCC.toFixed(2)} CC`)}
          ${this.infoRow('Taxa de saque', `${feeCC.toFixed(2)} CC`)}
          ${this.infoRow('Valor a receber (BRL)', `R$ ${valueBrl.toFixed(2)}`)}
          ${this.infoRow('Chave PIX', pixKey)}
          ${this.infoRow('Prazo de processamento', 'Até 25 minutos')}
        </tbody>
      </table>
      <p style="margin:0 0 24px;font-size:13px;color:#8B8CA7;line-height:1.6;">
        O prazo pode variar dependendo da análise de segurança. Você receberá uma notificação quando o PIX for enviado.
      </p>
      <div style="text-align:center;margin:0 0 24px;">
        ${this.button('Ver minha carteira', `${this.appUrl}/wallet`)}
      </div>
      ${this.divider()}
      ${this.thanks()}
    `;
    this.send(to, 'Solicitação de saque recebida — Mega Chess', this.layout('Saque solicitado', body, locale));
  }

  // ─── 5. Ticket de suporte aberto ────────────────────────────────────────────

  sendTicketOpened(to: string, name: string, ticketId: string, title: string, category: string, locale: 'pt' | 'en' = 'pt'): void {
    const body = `
      <p style="margin:0 0 4px;">${this.badge('Suporte')}</p>
      <h1 style="margin:8px 0 24px;font-size:26px;font-weight:700;color:#FFFFFF;line-height:1.2;">
        Ticket de suporte aberto!
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#FFFFFF;line-height:1.7;">
        Olá, <strong>${name}</strong>! Recebemos seu ticket de suporte e nossa equipe irá analisá-lo em breve.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0C0B13;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
        <tbody>
          ${this.infoRow('Número do ticket', `#${ticketId.slice(0, 8).toUpperCase()}`)}
          ${this.infoRow('Assunto', title)}
          ${this.infoRow('Categoria', category)}
          ${this.infoRow('Status', 'Aberto')}
        </tbody>
      </table>
      <p style="margin:0 0 24px;font-size:13px;color:#8B8CA7;line-height:1.6;">
        Você pode acompanhar o andamento e responder ao ticket diretamente pela plataforma.
      </p>
      <div style="text-align:center;margin:0 0 24px;">
        ${this.button('Ver meu ticket', `${this.appUrl}/support/${ticketId}`)}
      </div>
      ${this.divider()}
      ${this.thanks()}
    `;
    this.send(to, `Ticket #${ticketId.slice(0, 8).toUpperCase()} aberto — Mega Chess`, this.layout('Ticket de suporte', body, locale));
  }

  // ─── 6. Ticket de suporte atualizado (nova resposta do suporte) ─────────────

  sendTicketUpdated(to: string, name: string, ticketId: string, title: string, preview: string, locale: 'pt' | 'en' = 'pt'): void {
    const safePreview = preview.length > 200 ? preview.slice(0, 200) + '…' : preview;
    const body = `
      <p style="margin:0 0 4px;">${this.badge('Suporte — Nova resposta')}</p>
      <h1 style="margin:8px 0 24px;font-size:26px;font-weight:700;color:#FFFFFF;line-height:1.2;">
        Seu ticket recebeu uma resposta
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#FFFFFF;line-height:1.7;">
        Olá, <strong>${name}</strong>! Nossa equipe de suporte respondeu ao seu ticket <strong>"${title}"</strong>.
      </p>
      <div style="background:#0C0B13;border-left:3px solid #3D4AEB;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0;font-size:14px;color:#8B8CA7;font-style:italic;line-height:1.6;">"${safePreview}"</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0C0B13;border-radius:10px;padding:16px 24px;margin-bottom:24px;">
        <tbody>
          ${this.infoRow('Número do ticket', `#${ticketId.slice(0, 8).toUpperCase()}`)}
          ${this.infoRow('Assunto', title)}
        </tbody>
      </table>
      <div style="text-align:center;margin:0 0 24px;">
        ${this.button('Ver resposta completa', `${this.appUrl}/support/${ticketId}`)}
      </div>
      ${this.divider()}
      ${this.thanks()}
    `;
    this.send(to, `Resposta no ticket #${ticketId.slice(0, 8).toUpperCase()} — Mega Chess`, this.layout('Atualização de ticket', body, locale));
  }

  // ─── 7. Report/denúncia enviada ─────────────────────────────────────────────

  sendReportReceived(to: string, name: string, reportedNickname: string, reason: string, locale: 'pt' | 'en' = 'pt'): void {
    const body = `
      <p style="margin:0 0 4px;">${this.badge('Denúncia', '#B15653')}</p>
      <h1 style="margin:8px 0 24px;font-size:26px;font-weight:700;color:#FFFFFF;line-height:1.2;">
        Denúncia recebida
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#FFFFFF;line-height:1.7;">
        Olá, <strong>${name}</strong>! Recebemos sua denúncia e ela será analisada pela nossa equipe de moderação. Agradecemos por ajudar a manter a comunidade saudável.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0C0B13;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
        <tbody>
          ${this.infoRow('Usuário denunciado', `@${reportedNickname}`)}
          ${this.infoRow('Motivo', reason)}
          ${this.infoRow('Status', 'Em análise')}
        </tbody>
      </table>
      <p style="margin:0 0 24px;font-size:13px;color:#8B8CA7;line-height:1.6;">
        Por questões de privacidade, não divulgamos detalhes sobre as ações tomadas. Caso a denúncia seja relevante, as medidas cabíveis serão aplicadas.
      </p>
      <div style="text-align:center;margin:0 0 24px;">
        ${this.button('Voltar ao lobby', `${this.appUrl}/lobby`)}
      </div>
      ${this.divider()}
      ${this.thanks()}
    `;
    this.send(to, 'Denúncia recebida — Mega Chess', this.layout('Denúncia recebida', body, locale));
  }

  // ─── Recuperação de senha ────────────────────────────────────────────────────

  sendPasswordReset(to: string, name: string, resetUrl: string, locale: 'pt' | 'en' = 'pt'): void {
    const body = `
      <p style="margin:0 0 4px;font-size:13px;color:#8B8CA7;">Conta Mega Chess</p>
      <h1 style="margin:0 0 24px;font-size:26px;font-weight:700;color:#FFFFFF;line-height:1.2;">
        Redefinir sua senha
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#FFFFFF;line-height:1.7;">
        Olá, <strong>${name}</strong>! Recebemos uma solicitação de redefinição de senha para sua conta. Clique no botão abaixo para criar uma nova senha.
      </p>
      <div style="text-align:center;margin:0 0 32px;">
        ${this.button('Redefinir senha', resetUrl)}
      </div>
      <p style="margin:0;font-size:13px;color:#8B8CA7;line-height:1.6;">
        Este link expira em <strong style="color:#FFFFFF;">1 hora</strong> e só pode ser usado uma vez. Se você não solicitou a redefinição de senha, ignore este email com segurança — sua senha não será alterada.
      </p>
      ${this.divider()}
      ${this.thanks()}
    `;
    this.send(to, 'Redefinição de senha — Mega Chess', this.layout('Redefinir senha', body, locale));
  }

  // ─── Admin: OTP de acesso ────────────────────────────────────────────────────

  sendAdminOtp(to: string, name: string, code: string): void {
    const body = `
      <p style="margin:0 0 4px;">${this.badge('Painel Admin', '#1a1a2e')}</p>
      <h1 style="margin:8px 0 24px;font-size:26px;font-weight:700;color:#FFFFFF;line-height:1.2;">
        Seu código de acesso
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#FFFFFF;line-height:1.7;">
        Olá, <strong>${name}</strong>. Use o código abaixo para acessar o painel administrativo. Ele é válido por <strong style="color:#FFFFFF;">10 minutos</strong> e pode ser usado apenas uma vez.
      </p>
      <div style="text-align:center;margin:0 0 32px;">
        <div style="display:inline-block;background:#0C0B13;border:2px solid #3D4AEB;border-radius:12px;padding:20px 40px;">
          <span style="font-size:40px;font-weight:700;color:#FFFFFF;letter-spacing:10px;font-family:monospace;">${code}</span>
        </div>
      </div>
      <p style="margin:0;font-size:13px;color:#8B8CA7;line-height:1.6;">
        Se você não solicitou este código, ignore este email. Nunca compartilhe este código com ninguém.
      </p>
      ${this.divider()}
      <p style="margin:0;font-size:13px;color:#8B8CA7;">Equipe Mega Chess</p>
    `;
    this.send(to, 'Código de acesso — Painel Admin Mega Chess', this.layout('Código de acesso', body));
  }

  // ─── Admin: Boas-vindas com senha temporária ─────────────────────────────────

  sendAdminWelcome(to: string, name: string, tempPassword: string): void {
    const adminUrl = this.adminUrl;
    const body = `
      <p style="margin:0 0 4px;">${this.badge('Bem-vindo', '#2E7D32')}</p>
      <h1 style="margin:8px 0 24px;font-size:26px;font-weight:700;color:#FFFFFF;line-height:1.2;">
        Sua conta admin foi criada
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#FFFFFF;line-height:1.7;">
        Olá, <strong>${name}</strong>! Você foi adicionado como administrador no Mega Chess. Abaixo estão suas credenciais de acesso inicial.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0C0B13;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
        <tbody>
          ${this.infoRow('E-mail', to)}
          ${this.infoRow('Senha temporária', `<code style="font-family:monospace;color:#3D4AEB;">${tempPassword}</code>`)}
        </tbody>
      </table>
      <p style="margin:0 0 24px;font-size:14px;color:#8B8CA7;line-height:1.6;">
        O login é feito via código OTP enviado ao seu email. Após o primeiro acesso, você será solicitado a definir uma nova senha.
      </p>
      <div style="text-align:center;margin:0 0 24px;">
        ${this.button('Acessar o Painel', adminUrl)}
      </div>
      ${this.divider()}
      <p style="margin:0;font-size:13px;color:#8B8CA7;">Equipe Mega Chess</p>
    `;
    this.send(to, 'Bem-vindo ao Painel Admin — Mega Chess', this.layout('Conta Admin criada', body));
  }
}
