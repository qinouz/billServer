import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, Repository } from 'typeorm';
import { BillType, Category } from '../category/entities/category.entity';
import { MAX_BILL_AMOUNT, MIN_BILL_AMOUNT } from './bill.constants';
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
    const { categoryId, month, pageNo = 1, pageSize = 20, type } = query;
    const where: Record<string, unknown> = { userId, isDeleted: false };

    if (month) {
      const [year, mon] = month.split('-').map(Number);
      const lastDay = new Date(year, mon, 0).getDate();
      where.billDate = Between(`${month}-01`, `${month}-${String(lastDay).padStart(2, '0')}`);
    }
    if (type) {
      where.type = type;
    }
    if (categoryId) {
      where.categoryId = categoryId;
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
    const amount = this.normalizeAmount(dto);
    const { amountCents: _amountCents, ...billFields } = dto;
    const bill = await this.billRepository.save(
      this.billRepository.create({
        ...billFields,
        userId,
        amount,
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
        const { categoryId, type, remark, billDate } = dto;
        return this.billRepository.create({
          categoryId,
          amount: this.normalizeAmount(dto),
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
    const { amountCents: _amountCents, ...changes } = dto;

    await this.billRepository.save({
      ...bill,
      ...changes,
      amount: dto.amountCents === undefined ? bill.amount : this.normalizeAmount(dto),
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

    const monthly: Record<
      string,
      { incomeAmountCents: number; expenseAmountCents: number }
    > = {};
    let incomeAmountCents = 0;
    let expenseAmountCents = 0;

    for (const bill of bills) {
      const month = bill.billDate.substring(5, 7);
      monthly[month] ??= { incomeAmountCents: 0, expenseAmountCents: 0 };
      const amountCents = Number(bill.amount);

      if (bill.type === BillType.Income) {
        monthly[month].incomeAmountCents += amountCents;
        incomeAmountCents += amountCents;
      } else {
        monthly[month].expenseAmountCents += amountCents;
        expenseAmountCents += amountCents;
      }
    }

    return {
      year,
      incomeAmountCents,
      expenseAmountCents,
      balanceAmountCents: incomeAmountCents - expenseAmountCents,
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

  private normalizeAmount(dto: { amountCents?: number }) {
    const amountCents = Number(dto.amountCents);
    if (
      !Number.isFinite(amountCents) ||
      amountCents < MIN_BILL_AMOUNT ||
      amountCents > MAX_BILL_AMOUNT
    ) {
      throw new BadRequestException(
        `amountCents 必须在 ${MIN_BILL_AMOUNT} 到 ${MAX_BILL_AMOUNT} 分之间`,
      );
    }

    if (!Number.isInteger(amountCents)) {
      throw new BadRequestException('amountCents 单位为分，必须传入整数');
    }

    return amountCents.toFixed(2);
  }

  private toListItem(bill: Bill) {
    return {
      id: bill.id,
      categoryId: bill.categoryId,
      // 对外统一使用 amountCents，单位为“分”。
      amountCents: Number(bill.amount),
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
