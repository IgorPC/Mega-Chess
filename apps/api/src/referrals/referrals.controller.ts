import { Controller, Get, UseGuards } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { REFERRALS_ENDPOINTS } from './consts/endpoints';

@Controller(REFERRALS_ENDPOINTS.ROOT)
@UseGuards(JwtAuthGuard)
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get(REFERRALS_ENDPOINTS.ME)
  getMyReferrals(@CurrentUser() user: { id: string }) {
    return this.referrals.getMyReferrals(user.id);
  }

  @Get(REFERRALS_ENDPOINTS.MY_CODE)
  getMyCode(@CurrentUser() user: { id: string }) {
    return this.referrals.getMyCode(user.id);
  }
}
