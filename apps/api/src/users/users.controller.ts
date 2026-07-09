import {
  Controller, Get, Patch, Post, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, ParseIntPipe, DefaultValuePipe,
  BadRequestException, Logger, InternalServerErrorException, HttpException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private users: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: any) {
    try {
      return await this.users.getMe(user.id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`getMe failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    try {
      return await this.users.updateProfile(user.id, dto);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`updateProfile failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/avatars',
      // Use mimetype-derived extension to prevent extension spoofing
      filename: (_, file, cb) => cb(null, `${uuidv4()}${MIME_TO_EXT[file.mimetype] ?? '.jpg'}`),
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
      if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Only JPEG, PNG and WebP images are allowed'), false);
      }
    },
  }))
  async uploadAvatar(@CurrentUser() user: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No valid image file provided');
    try {
      return await this.users.updateAvatar(user.id, `/uploads/avatars/${file.filename}`);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`uploadAvatar failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/billing')
  async updateBilling(
    @CurrentUser() user: any,
    @Body() dto: { cpf?: string; billingName?: string; birthDate?: string },
  ) {
    try {
      return await this.users.updateBilling(user.id, dto);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`updateBilling failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/stats')
  async getMyStats(@CurrentUser() user: any) {
    try {
      return await this.users.getStats(user.id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`getMyStats failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/history')
  async getMyHistory(
    @CurrentUser() user: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    try {
      return await this.users.getMatchHistory(user.id, page, limit);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`getMyHistory failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/accept-terms')
  async acceptTerms(@CurrentUser() user: any) {
    try {
      return await this.users.acceptTerms(user.id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`acceptTerms failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  async deleteAccount(
    @CurrentUser() user: any,
    @Body() dto: { acknowledgeBalanceLoss?: boolean },
  ) {
    try {
      return await this.users.deleteAccount(user.id, dto?.acknowledgeBalanceLoss ?? false);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`deleteAccount failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(':nickname')
  async getProfile(@Param('nickname') nickname: string) {
    try {
      return await this.users.findByNickname(nickname);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`getProfile failed nickname=${nickname}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(':nickname/stats')
  async getStats(@Param('nickname') nickname: string) {
    try {
      const user = await this.users.findByNickname(nickname);
      return await this.users.getStats(user.id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`getStats failed nickname=${nickname}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(':nickname/reviews')
  async getReviews(
    @Param('nickname') nickname: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    try {
      return await this.users.getReviews(nickname, page, limit);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`getReviews failed nickname=${nickname}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
