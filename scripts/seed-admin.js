/**
 * Cria o primeiro admin no painel e (opcionalmente) reseta o banco.
 *
 * Uso:
 *   node scripts/seed-admin.js
 *
 * Variáveis de ambiente (todas opcionais — têm defaults):
 *   DATABASE_URL    postgresql://chess:chess@localhost:5432/megachess
 *   ADMIN_EMAIL     admin@example.com
 *   ADMIN_PASSWORD  Admin@123456!
 *   ADMIN_NAME      Admin
 *
 * Para rodar dentro do container da API em produção:
 *   docker exec -it <container-api> node scripts/seed-admin.js
 */

const { Client } = require('pg');
const bcrypt = require('bcrypt');

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://chess:chess@localhost:5432/megachess';

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin@123456!';
const ADMIN_NAME     = process.env.ADMIN_NAME     ?? 'Admin';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('✓ Conectado ao PostgreSQL');

  // Garante que a tabela existe (caso rode antes do TypeORM sincronizar)
  await client.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name             VARCHAR NOT NULL,
      email            VARCHAR NOT NULL UNIQUE,
      password_hash    VARCHAR NOT NULL,
      role             VARCHAR NOT NULL DEFAULT 'ADMIN',
      must_change_password BOOLEAN NOT NULL DEFAULT false,
      created_at       TIMESTAMP DEFAULT NOW(),
      updated_at       TIMESTAMP DEFAULT NOW()
    )
  `);

  const { rows } = await client.query(
    'SELECT id FROM admin_users WHERE email = $1',
    [ADMIN_EMAIL],
  );

  if (rows.length > 0) {
    console.log(`✓ Admin já existe: ${ADMIN_EMAIL}`);
    await client.end();
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  await client.query(
    `INSERT INTO admin_users (name, email, password_hash, role, must_change_password)
     VALUES ($1, $2, $3, 'ADMIN', false)`,
    [ADMIN_NAME, ADMIN_EMAIL, passwordHash],
  );

  console.log(`✅ Admin criado com sucesso!`);
  console.log(`   Email:  ${ADMIN_EMAIL}`);
  console.log(`   Senha:  ${ADMIN_PASSWORD}`);
  await client.end();
}

main().catch((err) => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
