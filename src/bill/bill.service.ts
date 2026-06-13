import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, Repository } from 'typeorm';
import { BillType, Category } from '../category/entities/category.entity';
import { toUnixMillis } from '../common/utils/time.util';
import { MAX_BILL_AMOUNT_CENTS, MIN_BILL_AMOUNT_CENTS } from './bill.constants';
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
      ...(month ? { summary: await this.getBillSummary(where) } : {}),
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
    const amountCents = this.normalizeAmountCents(dto.amountCents);
    const bill = await this.billRepository.save(
      this.billRepository.create({
        ...dto,
        userId,
        amountCents,
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
        const { categoryId, amountCents, type, remark, billDate } = dto;
        return this.billRepository.create({
          categoryId,
          amountCents: this.normalizeAmountCents(amountCents),
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
      amountCents:
        dto.amountCents === undefined
          ? bill.amountCents
          : this.normalizeAmountCents(dto.amountCents),
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

    const monthly: Record<string, { incomeCents: number; expenseCents: number }> = {};
    let incomeCents = 0;
    let expenseCents = 0;

    for (const bill of bills) {
      const month = bill.billDate.substring(5, 7);
      monthly[month] ??= { incomeCents: 0, expenseCents: 0 };
      const amountCents = Number(bill.amountCents);

      if (bill.type === BillType.Income) {
        monthly[month].incomeCents += amountCents;
        incomeCents += amountCents;
      } else {
        monthly[month].expenseCents += amountCents;
        expenseCents += amountCents;
      }
    }

    return {
      year,
      incomeCents,
      expenseCents,
      balanceCents: incomeCents - expenseCents,
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

  private async getBillSummary(where: Record<string, unknown>) {
    const bills = await this.billRepository.find({ where });
    let incomeCents = 0;
    let expenseCents = 0;

    for (const bill of bills) {
      const amountCents = Number(bill.amountCents);
      if (bill.type === BillType.Income) {
        incomeCents += amountCents;
      } else {
        expenseCents += amountCents;
      }
    }

    return {
      incomeCents,
      expenseCents,
      balanceCents: incomeCents - expenseCents,
    };
  }

  private normalizeAmountCents(value: unknown) {
    const amountCents = Number(value);
    if (
      !Number.isInteger(amountCents) ||
      amountCents < MIN_BILL_AMOUNT_CENTS ||
      amountCents > MAX_BILL_AMOUNT_CENTS
    ) {
      throw new BadRequestException(
        `金额必须在 ${MIN_BILL_AMOUNT_CENTS} 到 ${MAX_BILL_AMOUNT_CENTS} 分之间`,
      );
    }

    return String(amountCents);
  }

  private toListItem(bill: Bill) {
    return {
      id: bill.id,
      categoryId: bill.categoryId,
      amountCents: Number(bill.amountCents),
      type: bill.type,
      remark: bill.remark,
      billDate: bill.billDate,
      categoryName: bill.category?.name,
      categoryIcon: bill.category?.icon,
      createdAt: toUnixMillis(bill.createdAt),
      updatedAt: toUnixMillis(bill.updatedAt),
    };
  }
}
