import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { toUnixMillis } from '../common/utils/time.util';
import { SaveReminderDto } from './dto/save-reminder.dto';
import { Reminder } from './entities/reminder.entity';

@Injectable()
export class ReminderService {
  constructor(
    @InjectRepository(Reminder)
    private readonly reminderRepository: Repository<Reminder>,
  ) {}

  async findOne(userId: string) {
    const reminder = await this.reminderRepository.findOne({ where: { userId } });
    return reminder
      ? this.toResponse(reminder)
      : {
          reminderId: null,
          reminderTime: '20:00',
          isEnabled: false,
          createdAt: null,
        };
  }

  async save(userId: string, dto: SaveReminderDto) {
    const existed = await this.reminderRepository.findOne({ where: { userId } });
    const reminder = await this.reminderRepository.save({
      ...existed,
      userId,
      reminderTime: this.normalizeTime(dto.reminderTime),
      isEnabled: dto.isEnabled ?? existed?.isEnabled ?? true,
    });
    return this.toResponse(reminder);
  }

  private normalizeTime(time: string) {
    return time.length === 5 ? `${time}:00` : time;
  }

  private toResponse(reminder: Reminder) {
    return {
      reminderId: reminder.id,
      reminderTime: this.formatTime(reminder.reminderTime),
      isEnabled: reminder.isEnabled,
      createdAt: toUnixMillis(reminder.createdAt),
    };
  }

  private formatTime(time: string) {
    return time.length >= 5 ? time.slice(0, 5) : time;
  }
}
