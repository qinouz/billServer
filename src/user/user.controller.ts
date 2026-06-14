import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UserService } from './user.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  profile(@CurrentUser() user: CurrentUserPayload) {
    return this.userService.findById(user.userId);
  }

  @Get('stats')
  stats(@CurrentUser() user: CurrentUserPayload) {
    return this.userService.getStats(user.userId);
  }
}
