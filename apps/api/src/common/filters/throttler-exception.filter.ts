import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';

@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  catch(exception: ThrottlerException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const retryAfterSeconds = 60;
    res
      .status(429)
      .header('Retry-After', String(retryAfterSeconds))
      .json({
        statusCode: 429,
        message: 'Muitas requisições. Tente novamente em instantes.',
        retryAfter: retryAfterSeconds,
      });
  }
}
