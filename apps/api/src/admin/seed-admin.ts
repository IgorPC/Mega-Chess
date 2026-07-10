/**
 * Seed do primeiro admin.
 * Uso: npx ts-node -r tsconfig-paths/register src/admin/seed-admin.ts
 *
 * Ou via Docker:
 *   docker exec -it megachess-api-dev npx ts-node -r tsconfig-paths/register src/admin/seed-admin.ts
 *
 * Variáveis de ambiente necessárias: DATABASE_URL
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AdminUser, AdminRole } from '../entities/admin-user.entity';
import { AdminAuditLog } from '../entities/admin-audit-log.entity';

const ds = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL ?? 'postgresql://chess:chess_secret@localhost:5432/megachess',
  entities: [AdminUser, AdminAuditLog],
  synchronize: true,
});

async function seed() {
  await ds.initialize();

  const email    = process.env.ADMIN_EMAIL    ?? 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD ?? 'Admin@123456!';
  const name     = process.env.ADMIN_NAME     ?? 'Admin';

  const repo = ds.getRepository(AdminUser);
  const existing = await repo.findOne({ where: { email } });
  if (existing) {
    console.log(`✓ Admin já existe: ${email}`);
    await ds.destroy();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await repo.save(repo.create({ name, email, passwordHash, role: AdminRole.ADMIN }));
  console.log(`✅ Admin criado: ${email} / ${password}`);
  await ds.destroy();
}

seed().catch((e) => { console.error(e); process.exit(1); });
