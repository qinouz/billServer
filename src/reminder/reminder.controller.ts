import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SaveReminderDto } from './dto/save-reminder.dto';
import { ReminderService } from './reminder.service';

@Controller('reminders')
@UseGuards(JwtAuthGuard)
export class ReminderController {
  constructor(private readonly reminderService: ReminderService) {}

  @Get()
  findOne(@CurrentUser() user: CurrentUserPayload) {
    return this.reminderService.findOne(String(user.userId));
  }

  @Post()
  save(@CurrentUser() user: CurrentUserPayload, @Body() dto: SaveReminderDto) {
    return this.reminderService.save(String(user.userId), dto);
  }
}
