import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SaveReminderDto } from './dto/save-reminder.dto';
import { Reminder } from './entities/reminder.entity';

@Injectable()
export class ReminderService {
  constructor(
    @InjectRepository(Reminder)
    private readonly reminderRepository: Repository<Reminder>,
  ) {}

  findOne(userId: string) {
    return this.reminderRepository.findOne({ where: { userId } });
  }

  async save(userId: string, dto: SaveReminderDto) {
    const existed = await this.findOne(userId);
    const reminder = await this.reminderRepository.save({
      ...existed,
      userId,
      reminderTime: this.normalizeTime(dto.reminderTime),
      isEnabled: dto.isEnabled ?? true,
    });
    return { reminderId: reminder.id };
  }

  private normalizeTime(time: string) {
    return time.length === 5 ? `${time}:00` : time;
  }
}
