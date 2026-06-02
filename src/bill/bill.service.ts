import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, Repository } from 'typeorm';
import { BillType, Category } from '../category/entities/category.entity';
import { CreateBillDto } from './dto/create-bill.dto';
import { QueryBillDto } from './dto/query-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';
import { Bill } from './entities/bill.entity';

@Injectable()
export class BillService {
  constructor(
    @InjectRepository(Bill)
    private readonly billRepository: Repository<Bill>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async findAll(userId: string, query: QueryBillDto) {
    const { month, pageNo = 1, pageSize = 20 } = query;
    const where: Record<string, unknown> = { userId, isDeleted: false };

    if (month) {
      const [year, mon] = month.split('-').map(Number);
      const lastDay = new Date(year, mon, 0).getDate();
      where.billDate = Between(`${month}-01`, `${month}-${String(lastDay).padStart(2, '0')}`);
    }

    const [bills, total] = await this.billRepository.findAndCount({
      where,
      order: { billDate: 'DESC', createdAt: 'DESC' },
      skip: (pageNo - 1) * pageSize,
      take: pageSize,
      relations: ['category'],
    });

    return {
      bills: bills.map((bill) => this.toListItem(bill)),
      total,
      pageNo,
      pageSize,
    };
  }

  async findOne(userId: string, id: string) {
    const bill = await this.billRepository.findOne({
      where: { id, userId, isDeleted: false },
      relations: ['category'],
    });
    if (!bill) {
      throw new NotFoundException('账单不存在');
    }
    return this.toListItem(bill);
  }

  async create(userId: string, dto: CreateBillDto) {
    await this.ensureCategoryAvailable(userId, dto.categoryId);
    const bill = await this.billRepository.save(
      this.billRepository.create({
        ...dto,
        userId,
        amount: dto.amount.toFixed(2),
      }),
    );
    return { billId: bill.id };
  }

  async createBatch(
    userId: string,
    dtos?: Array<CreateBillDto & { categoryName?: string }>,
  ) {
    if (!Array.isArray(dtos) || dtos.length === 0) {
      throw new BadRequestException('账单列表不能为空');
    }

    for (const dto of dtos) {
      await this.ensureCategoryAvailable(userId, dto.categoryId);
    }

    const bills = await this.billRepository.save(
      dtos.map((dto) => {
        const { categoryId, amount, type, remark, billDate } = dto;
        return this.billRepository.create({
          categoryId,
          amount: Number(amount).toFixed(2),
          type,
          remark,
          billDate,
          userId,
        });
      }),
    );
    return { billIds: bills.map((bill) => bill.id), count: bills.length };
  }

  async update(userId: string, id: string, dto: UpdateBillDto) {
    const bill = await this.billRepository.findOne({
      where: { id, userId, isDeleted: false },
    });
    if (!bill) {
      throw new NotFoundException('账单不存在');
    }
    if (dto.categoryId) {
      await this.ensureCategoryAvailable(userId, dto.categoryId);
    }

    await this.billRepository.save({
      ...bill,
      ...dto,
      amount: dto.amount === undefined ? bill.amount : dto.amount.toFixed(2),
    });
    return { billId: id };
  }

  async remove(userId: string, id: string) {
    const result = await this.billRepository.update(
      { id, userId, isDeleted: false },
      { isDeleted: true },
    );
    if (!result.affected) {
      throw new NotFoundException('账单不存在');
    }
    return { billId: id };
  }

  async getStatistic(userId: string, year: number) {
    if (!year || Number.isNaN(year)) {
      throw new BadRequestException('year 必填');
    }

    const bills = await this.billRepository.find({
      where: {
        userId,
        isDeleted: false,
        billDate: Between(`${year}-01-01`, `${year}-12-31`),
      },
    });

    const monthly: Record<string, { income: number; expense: number }> = {};
    let income = 0;
    let expense = 0;

    for (const bill of bills) {
      const month = bill.billDate.substring(5, 7);
      monthly[month] ??= { income: 0, expense: 0 };
      const amount = Number(bill.amount);

      if (bill.type === BillType.Income) {
        monthly[month].income += amount;
        income += amount;
      } else {
        monthly[month].expense += amount;
        expense += amount;
      }
    }

    return {
      year,
      income,
      expense,
      balance: income - expense,
      monthly,
    };
  }

  private async ensureCategoryAvailable(userId: string, categoryId: string) {
    const category = await this.categoryRepository.findOne({
      where: [
        { id: categoryId, userId },
        { id: categoryId, userId: IsNull(), isSystem: true },
      ],
    });
    if (!category) {
      throw new BadRequestException('分类不存在');
    }
  }

  private toListItem(bill: Bill) {
    return {
      id: bill.id,
      categoryId: bill.categoryId,
      amount: Number(bill.amount),
      type: bill.type,
      remark: bill.remark,
      billDate: bill.billDate,
      categoryName: bill.category?.name,
      categoryIcon: bill.category?.icon,
      createdAt: bill.createdAt,
      updatedAt: bill.updatedAt,
    };
  }
}
