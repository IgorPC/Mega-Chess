import {
  Controller, Get, Patch, Post, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: any) {
    return this.users.getMe(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/avatars',
      filename: (_, file, cb) => cb(null, `${uuidv4()}${extname(file.originalname)}`),
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_, file, cb) => cb(null, /\.(jpg|jpeg|png|webp)$/i.test(file.originalname)),
  }))
  uploadAvatar(@CurrentUser() user: any, @UploadedFile() file: Express.Multer.File) {
    return this.users.updateAvatar(user.id, `/uploads/avatars/${file.filename}`);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/stats')
  getMyStats(@CurrentUser() user: any) {
    return this.users.getStats(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/history')
  getMyHistory(
    @CurrentUser() user: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.users.getMatchHistory(user.id, page, limit);
  }

  @Get(':nickname')
  getProfile(@Param('nickname') nickname: string) {
    return this.users.findByNickname(nickname);
  }

  @Get(':nickname/stats')
  async getStats(@Param('nickname') nickname: string) {
    const user = await this.users.findByNickname(nickname);
    return this.users.getStats(user.id);
  }
}
