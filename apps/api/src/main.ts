import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { MaintenanceGuard } from './common/guards/maintenance.guard';
import { ThrottlerExceptionFilter } from './common/filters/throttler-exception.filter';
import { PlatformConfigService } from './platform-config/platform-config.service';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Production has two proxy hops in front of the API (Traefik, then nginx
  // inside the `web`/`admin` container — see apps/docs/HANDOFF.md). A fixed
  // hop count is fragile if that topology ever changes (and was previously
  // wrong: set to 1 hop when there are actually 2), which can make req.ip
  // resolve to an internal Docker IP shared by every request instead of the
  // real client. Trusting all private-range hops instead makes Express walk
  // past any number of internal reverse proxies and stop at the first public
  // IP in the chain — correct regardless of how many private hops precede it.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');

  // Ensure upload directories exist
  mkdirSync(join(process.cwd(), 'uploads', 'tickets'), { recursive: true });

  app.use(helmet());
  app.useGlobalFilters(new ThrottlerExceptionFilter());
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost')
    .split(',')
    .map(o => o.trim());
  app.enableCors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
  });
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });

  const configService = app.get(PlatformConfigService);
  app.useGlobalGuards(new MaintenanceGuard(configService));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
