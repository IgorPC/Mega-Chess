import {
  Controller, Get, Post, Body, Param, ParseUUIDPipe,
  UseGuards, UseInterceptors, UploadedFile, Res,
  Query, ParseIntPipe, DefaultValuePipe, StreamableFile,
  Logger, InternalServerErrorException, HttpException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { createReadStream, existsSync } from 'fs';
import { Response } from 'express';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { SUPPORT_ENDPOINTS } from './consts/endpoints';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

@UseGuards(JwtAuthGuard)
@Controller(SUPPORT_ENDPOINTS.ROOT)
export class SupportController {
  private readonly logger = new Logger(SupportController.name);

  constructor(private readonly support: SupportService) {}

  @Post(SUPPORT_ENDPOINTS.TICKETS)
  async create(@CurrentUser() user: any, @Body() dto: CreateTicketDto) {
    try {
      return await this.support.createTicket(user.id, dto);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`createTicket failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(SUPPORT_ENDPOINTS.TICKETS)
  async list(
    @CurrentUser() user: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    try {
      return await this.support.getMyTickets(user.id, page, Math.min(limit, 50));
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`listTickets failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(SUPPORT_ENDPOINTS.TICKET_BY_ID)
  async getOne(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
    try {
      return await this.support.getTicket(user.id, id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`getTicket failed userId=${user.id} ticketId=${id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post(SUPPORT_ENDPOINTS.TICKET_MESSAGES)
  async addMessage(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) ticketId: string,
    @Body() dto: CreateMessageDto,
  ) {
    try {
      return await this.support.addMessage(user.id, ticketId, dto);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`addMessage failed userId=${user.id} ticketId=${ticketId}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post(SUPPORT_ENDPOINTS.MESSAGE_ATTACHMENTS)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'tickets'),
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        cb(null, ALLOWED_MIMES.includes(file.mimetype));
      },
      limits: { fileSize: MAX_SIZE_BYTES },
    }),
  )
  async uploadAttachment(
    @CurrentUser() user: any,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    try {
      return await this.support.attachFile(user.id, ticketId, messageId, file);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`uploadAttachment failed userId=${user.id} ticketId=${ticketId} messageId=${messageId}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(SUPPORT_ENDPOINTS.TICKET_ATTACHMENT)
  async downloadAttachment(
    @CurrentUser() user: any,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    try {
      const attachment = await this.support.getAttachment(user.id, ticketId, attachmentId);

      if (!existsSync(attachment.filePath)) {
        res.status(404).json({ message: 'Arquivo não encontrado' });
        return;
      }

      res.set({
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `inline; filename="${attachment.originalName}"`,
      });

      return new StreamableFile(createReadStream(attachment.filePath));
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`downloadAttachment failed userId=${user.id} ticketId=${ticketId} attachmentId=${attachmentId}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
