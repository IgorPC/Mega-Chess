import {
  Controller, Patch, Body, UseGuards, HttpCode,
  Logger, InternalServerErrorException, HttpException,
} from '@nestjs/common';
import { IsString, IsOptional, MinLength } from 'class-validator';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { AdminUser } from '../../entities/admin-user.entity';
import { AdminAuthService } from '../auth/admin-auth.service';
import { ADMIN_PROFILE_CONTROLLER_PATH, ADMIN_PROFILE_MIN_PASSWORD_LENGTH, ADMIN_PROFILE_ROUTES } from './consts/endpoints';

class ChangePasswordDto {
  @IsString() @IsOptional() currentPassword?: string;
  @IsString() @MinLength(ADMIN_PROFILE_MIN_PASSWORD_LENGTH) newPassword: string;
}

@Controller(ADMIN_PROFILE_CONTROLLER_PATH)
@UseGuards(AdminJwtGuard, AdminRolesGuard)
export class AdminProfileController {
  private readonly logger = new Logger(AdminProfileController.name);

  constructor(private readonly authService: AdminAuthService) {}

  @Patch(ADMIN_PROFILE_ROUTES.PASSWORD)
  @HttpCode(204)
  async changePassword(@Body() dto: ChangePasswordDto, @CurrentAdmin() admin: AdminUser) {
    try {
      return await this.authService.changePassword(admin.id, dto.newPassword, dto.currentPassword);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`changePassword failed adminId=${admin?.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
