import { Controller, Get, Post, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';
import { AdminRoles } from '../decorators/admin-roles.decorator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { AdminRole } from '../../entities/admin-user.entity';
import { AdminReportsService } from './admin-reports.service';
import {
  ADMIN_REPORTS_CONTROLLER_PATH,
  ADMIN_REPORTS_DEFAULT_LIMIT,
  ADMIN_REPORTS_DEFAULT_PAGE,
  ADMIN_REPORTS_ROUTES,
} from './consts/endpoints';

@Controller(ADMIN_REPORTS_CONTROLLER_PATH)
@UseGuards(AdminJwtGuard, AdminRolesGuard)
export class AdminReportsController {
  constructor(private svc: AdminReportsService) {}

  @Get(ADMIN_REPORTS_ROUTES.ROOT)
  @AdminRoles(AdminRole.SUPORTE)
  list(@Query() q: any) {
    return this.svc.list({
      page: q.page ? +q.page : ADMIN_REPORTS_DEFAULT_PAGE,
      limit: q.limit ? +q.limit : ADMIN_REPORTS_DEFAULT_LIMIT,
      status: q.status,
      verdict: q.verdict,
      reportedId: q.reportedId,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
    });
  }

  @Get(ADMIN_REPORTS_ROUTES.BY_ID)
  @AdminRoles(AdminRole.SUPORTE)
  getOne(@Param('id') id: string) {
    return this.svc.getOne(id);
  }

  @Post(ADMIN_REPORTS_ROUTES.RESOLVE)
  @AdminRoles(AdminRole.OPERADOR)
  resolve(
    @Param('id') id: string,
    @Body() body: { resolution: string; adminNote?: string },
    @CurrentAdmin() admin: any,
  ) {
    return this.svc.resolve(id, body, admin);
  }

  @Post(ADMIN_REPORTS_ROUTES.ANALYZE)
  @AdminRoles(AdminRole.OPERADOR)
  analyze(@Param('id') id: string) {
    return this.svc.analyzeWithAi(id);
  }

  @Delete(ADMIN_REPORTS_ROUTES.DELETE_REVIEW)
  @AdminRoles(AdminRole.OPERADOR)
  deleteReview(@Param('id') id: string, @CurrentAdmin() admin: any) {
    return this.svc.deleteReview(id, admin);
  }
}
