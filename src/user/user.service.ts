import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bill } from '../bill/entities/bill.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Bill)
    private readonly billRepository: Repository<Bill>,
  ) {}

  findByOpenid(openid: string) {
    return this.userRepository.findOne({ where: { openid } });
  }

  async findById(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return user;
  }

  create(dto: CreateUserDto) {
    return this.userRepository.save(this.userRepository.create(dto));
  }

  async getStats(userId: string) {
    const bills = await this.billRepository.find({
      where: { userId, isDeleted: false },
      select: ['billDate'],
      order: { billDate: 'DESC' },
    });

    const dates = [...new Set(bills.map((bill) => bill.billDate))].sort().reverse();
    const dateSet = new Set(dates);
    const billCount = bills.length;
    const recordDays = dates.length;
    let consecutiveDays = 0;

    if (dates.length > 0) {
      const today = this.startOfLocalDay(new Date());
      const latestRecordDate = this.startOfLocalDay(new Date(dates[0]));
      const diffToday = Math.floor(
        (today.getTime() - latestRecordDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffToday <= 1) {
        for (let i = 0; i < 365; i += 1) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);

          if (dateSet.has(this.formatLocalDate(date))) {
            consecutiveDays += 1;
          } else if (i > 0) {
            break;
          }
        }
      }
    }

    return { consecutiveDays, recordDays, billCount };
  }

  private startOfLocalDay(date: Date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  private formatLocalDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
