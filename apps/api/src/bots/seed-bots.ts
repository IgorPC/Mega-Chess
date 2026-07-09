/**
 * Seed script — creates 10 bot accounts.
 * Run: npx ts-node -r tsconfig-paths/register src/bots/seed-bots.ts
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../entities/user.entity';

const BOTS: { nickname: string; name: string; rating: number; difficulty: 'EASY'|'MEDIUM'|'HARD' }[] = [
  { nickname: 'MagoBranco',        name: 'Mago Branco',        rating: 600,  difficulty: 'EASY'   },
  { nickname: 'PeaoQuente',        name: 'Peão Quente',        rating: 700,  difficulty: 'EASY'   },
  { nickname: 'TorreDoSul',        name: 'Torre do Sul',       rating: 750,  difficulty: 'EASY'   },
  { nickname: 'CavaleiroCaipira',  name: 'Cavaleiro Caipira',  rating: 800,  difficulty: 'EASY'   },
  { nickname: 'GandalfNegro',      name: 'Gandalf Negro',      rating: 900,  difficulty: 'MEDIUM' },
  { nickname: 'GryffinDama',       name: 'Gryffin Dama',       rating: 1000, difficulty: 'MEDIUM' },
  { nickname: 'MerlinXadrez',      name: 'Merlin Xadrez',      rating: 1050, difficulty: 'MEDIUM' },
  { nickname: 'SauronRei',         name: 'Sauron Rei',         rating: 1100, difficulty: 'MEDIUM' },
  { nickname: 'MagnusFischer',     name: 'Magnus Fischer',     rating: 1200, difficulty: 'HARD'   },
  { nickname: 'LordKasparov',      name: 'Lord Kasparov',      rating: 1400, difficulty: 'HARD'   },
];

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [User],
    synchronize: false,
  });
  await ds.initialize();
  const repo = ds.getRepository(User);

  for (const bot of BOTS) {
    const existing = await repo.findOne({ where: { nickname: bot.nickname } });
    if (existing) {
      console.log(`[seed] Bot already exists: ${bot.nickname}`);
      continue;
    }
    const unusableHash = await bcrypt.hash(uuidv4(), 10);
    await repo.save(repo.create({
      email: `bot-${bot.nickname.toLowerCase()}@megachess.internal`,
      name: bot.name,
      nickname: bot.nickname,
      passwordHash: unusableHash,
      rating: bot.rating,
      isBot: true,
      botDifficulty: bot.difficulty,
      emailVerified: true,
      isOnline: false,
    }));
    console.log(`[seed] Created bot: ${bot.nickname} (${bot.difficulty}, ELO ${bot.rating})`);
  }

  await ds.destroy();
  console.log('[seed] Done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
