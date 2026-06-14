import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { QueryMonthlyStatisticsDto } from './dto/query-monthly-statistics.dto';
import { StatisticsService } from './statistics.service';

@Controller('statistics')
@UseGuards(JwtAuthGuard)
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('monthly')
  monthly(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryMonthlyStatisticsDto,
  ) {
    return this.statisticsService.getMonthlyStatistics(String(user.userId), query);
  }
}
