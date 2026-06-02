import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillType } from '../category/entities/category.entity';
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
    });

    return bills.reduce(
      (stats, bill) => {
        const amount = Number(bill.amount);
        stats.total += 1;
        if (bill.type === BillType.Income) {
          stats.income += amount;
        } else {
          stats.expense += amount;
        }
        stats.balance = stats.income - stats.expense;
        return stats;
      },
      { total: 0, income: 0, expense: 0, balance: 0 },
    );
  }
}
