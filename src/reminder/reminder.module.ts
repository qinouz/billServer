import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reminder } from './entities/reminder.entity';
import { ReminderController } from './reminder.controller';
import { ReminderService } from './reminder.service';

@Module({
  imports: [TypeOrmModule.forFeature([Reminder])],
  controllers: [ReminderController],
  providers: [ReminderService],
})
export class ReminderModule {}
