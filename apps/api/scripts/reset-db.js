/**
 * Reseta completamente o banco de dados e cria o primeiro admin.
 *
 * ⚠️  ATENÇÃO: apaga TODOS os dados de TODAS as tabelas. Use apenas em
 *     homologação ou quando quiser começar do zero.
 *
 * Uso dentro do container:
 *   node scripts/reset-db.js
 *
 * Variáveis de ambiente (todas opcionais — têm defaults):
 *   DATABASE_URL    postgresql://chess:chess@localhost:5432/megachess
 *   ADMIN_EMAIL     admin@megachess.io
 *   ADMIN_PASSWORD  Admin@123456!
 *   ADMIN_NAME      Admin
 */

const { Client } = require('pg');
const bcrypt = require('bcrypt');

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://chess:chess@localhost:5432/megachess';

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    ?? 'admin@megachess.io';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin@123456!';
const ADMIN_NAME     = process.env.ADMIN_NAME     ?? 'Admin';

// Ordem respeita FK: filhos antes dos pais
const TABLES_TO_TRUNCATE = [
  'admin_audit_logs',
  'ai_usage_logs',
  'asaas_events',
  'ticket_attachments',
  'ticket_messages',
  'support_tickets',
  'match_report_appeals',
  'match_reports',
  'match_chat_messages',
  'tournament_matches',
  'tournament_participants',
  'tournaments',
  'withdrawals',
  'deposits',
  'wallet_transactions',
  'wallets',
  'platform_revenue',
  'reviews',
  'notifications',
  'messages',
  'matches',
  'friendships',
  'refresh_tokens',
  'user_activity_logs',
  'platform_configs',
  'admin_users',
  'users',
];

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('✓ Conectado ao PostgreSQL');

  console.log('\n🗑️  Limpando todas as tabelas...');
  for (const table of TABLES_TO_TRUNCATE) {
    try {
      await client.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
      console.log(`   ✓ ${table}`);
    } catch (err) {
      // Tabela pode não existir ainda — ignora
      if (err.code === '42P01') {
        console.log(`   — ${table} (não existe, pulando)`);
      } else {
        throw err;
      }
    }
  }

  console.log('\n👤 Criando admin inicial...');

  await client.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name                 VARCHAR NOT NULL,
      email                VARCHAR NOT NULL UNIQUE,
      password_hash        VARCHAR NOT NULL,
      role                 VARCHAR NOT NULL DEFAULT 'ADMIN',
      must_change_password BOOLEAN NOT NULL DEFAULT false,
      created_at           TIMESTAMP DEFAULT NOW(),
      updated_at           TIMESTAMP DEFAULT NOW()
    )
  `);

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  await client.query(
    `INSERT INTO admin_users (name, email, password_hash, role, must_change_password)
     VALUES ($1, $2, $3, 'ADMIN', false)`,
    [ADMIN_NAME, ADMIN_EMAIL, passwordHash],
  );

  console.log(`\n✅ Banco resetado e admin criado com sucesso!`);
  console.log(`   Email:  ${ADMIN_EMAIL}`);
  console.log(`   Senha:  ${ADMIN_PASSWORD}`);
  console.log(`\n   Acesse o painel admin e faça login para começar.\n`);

  await client.end();
}

main().catch((err) => {
  console.error('\n❌ Erro:', err.message);
  process.exit(1);
});
