import { ExecutionContext, Injectable } from '@nestjs/common';
import { I18nResolver } from 'nestjs-i18n';

// Highest-priority locale source: the authenticated user's saved preference
// (JwtStrategy attaches `locale` to req.user — see auth/strategies/jwt.strategy.ts).
// Falls through to the next resolver (Accept-Language header) when absent,
// e.g. unauthenticated requests or users who haven't set a locale yet.
@Injectable()
export class AuthenticatedUserLocaleResolver implements I18nResolver {
  resolve(context: ExecutionContext): string | undefined {
    const req = context.switchToHttp().getRequest();
    return req?.user?.locale;
  }
}
