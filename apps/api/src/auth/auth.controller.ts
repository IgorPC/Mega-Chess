import {
  Controller, Post, Get, Body, HttpCode, UseGuards, Req, Query,
  Logger, InternalServerErrorException, HttpException,
} from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';

class ForgotPasswordDto { @IsEmail() email: string; }
class ResetPasswordDto {
  @IsString() token: string;
  @IsString() @MinLength(8) newPassword: string;
}
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private auth: AuthService) {}

  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: any) {
    try {
      return await this.auth.register(dto, req);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('register failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: any) {
    try {
      return await this.auth.login(dto, req);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('login failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    try {
      return await this.auth.verifyEmail(token);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('verifyEmail failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Throttle({ default: { ttl: 60_000, limit: 2 } })
  @Post('resend-verification')
  @HttpCode(200)
  async resendVerification(@Body('email') email: string) {
    try {
      return await this.auth.resendVerification(email);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('resendVerification failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body('refreshToken') token: string) {
    try {
      return await this.auth.refresh(token);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('refresh failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    try {
      return await this.auth.forgotPassword(dto.email);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('forgotPassword failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    try {
      return await this.auth.resetPassword(dto.token, dto.newPassword);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('resetPassword failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(200)
  async logout(@CurrentUser() user: any, @Body('refreshToken') token: string, @Req() req: any) {
    try {
      return await this.auth.logout(user?.id, token, req);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('logout failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
