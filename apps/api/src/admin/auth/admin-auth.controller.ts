import {
  Controller, Post, Get, Body, UseGuards, Req, HttpCode,
  Logger, InternalServerErrorException, HttpException,
} from '@nestjs/common';
import { IsEmail, IsString, Length } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { AdminUser } from '../../entities/admin-user.entity';

class RequestOtpDto {
  @IsEmail() email: string;
  @IsString() password: string;
}

class VerifyOtpDto {
  @IsEmail() email: string;
  @IsString() @Length(6, 6) code: string;
}

@Controller('admin/auth')
export class AdminAuthController {
  private readonly logger = new Logger(AdminAuthController.name);

  constructor(private readonly service: AdminAuthService) {}

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('request-otp')
  @HttpCode(200)
  async requestOtp(@Body() dto: RequestOtpDto, @Req() req: any) {
    try {
      await this.service.requestOtp(dto.email, dto.password, req.ip);
      return { sent: true };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('requestOtp failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('verify-otp')
  @HttpCode(200)
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: any) {
    try {
      return await this.service.verifyOtp(dto.email, dto.code, req.ip);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('verifyOtp failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post('logout')
  @UseGuards(AdminJwtGuard)
  @HttpCode(204)
  async logout(@CurrentAdmin() admin: AdminUser) {
    await this.service.deleteSession(admin.id);
  }

  @Get('me')
  @UseGuards(AdminJwtGuard)
  async me(@CurrentAdmin() admin: AdminUser) {
    try {
      return await this.service.serialize(admin);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin me failed adminId=${admin?.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
