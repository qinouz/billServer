import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, Repository } from 'typeorm';
import { Bill } from '../bill/entities/bill.entity';
import { BillType, Category } from '../category/entities/category.entity';
import { QueryMonthlyStatisticsDto } from './dto/query-monthly-statistics.dto';

interface MonthPoint {
  year: number;
  month: number;
}

interface CategoryAggregation {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  sortOrder: number;
  // 内部聚合金额，单位为“分”。
  amountCents: number;
  count: number;
}

const OTHER_CATEGORY_ID = 'other';
const OTHER_CATEGORY_NAME = '其他';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(Bill)
    private readonly billRepository: Repository<Bill>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async getMonthlyStatistics(userId: string, query: QueryMonthlyStatisticsDto) {
    this.ensureNotFutureMonth(query.year, query.month);

    const monthRange = this.getMonthRange(query.year, query.month);
    const recentMonths = this.getRecentMonths(query.year, query.month);
    const trendRange = this.getMonthRange(
      recentMonths[0].year,
      recentMonths[0].month,
    );

    const [monthlyBills, trendBills, recentBills] = await Promise.all([
      this.billRepository.find({
        where: {
          userId,
          isDeleted: false,
          billDate: Between(monthRange.start, monthRange.end),
        },
        relations: ['category'],
      }),
      this.billRepository.find({
        where: {
          userId,
          isDeleted: false,
          type: query.type,
          billDate: Between(trendRange.start, monthRange.end),
        },
      }),
      this.billRepository.find({
        where: {
          userId,
          isDeleted: false,
          type: query.type,
          billDate: Between(monthRange.start, monthRange.end),
        },
        relations: ['category'],
        order: { billDate: 'DESC', createdAt: 'DESC' },
        take: 5,
      }),
    ]);

    const summary = this.buildSummary(monthlyBills, query.type);
    const currentTypeAmountCents =
      query.type === BillType.Income
        ? summary.incomeAmountCents
        : summary.expenseAmountCents;

    return {
      year: query.year,
      month: query.month,
      type: query.type,
      // summary 内所有 amountCents 字段单位都是“分”，前端展示时再除以 100。
      summary,
      // trend[].amountCents 单位是“分”，不是“元”。
      trend: this.buildTrend(recentMonths, trendBills),
      // categories[].amountCents 单位是“分”，percentage 是百分比数值。
      categories: await this.buildCategories(
        userId,
        query.type,
        monthlyBills.filter((bill) => bill.type === query.type),
        currentTypeAmountCents,
      ),
      // recentBills[].amountCents 单位是“分”，前端根据 type 显示正负号。
      recentBills: recentBills.map((bill) => this.toRecentBill(bill)),
    };
  }

  private buildSummary(bills: Bill[], currentType: BillType) {
    let incomeCents = 0;
    let expenseCents = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    for (const bill of bills) {
      const amountCents = this.amountToCents(bill.amountCents);
      if (bill.type === BillType.Income) {
        incomeCents += amountCents;
        incomeCount += 1;
      } else {
        expenseCents += amountCents;
        expenseCount += 1;
      }
    }

    const currentTypeAmountCents =
      currentType === BillType.Income ? incomeCents : expenseCents;
    const currentTypeCount =
      currentType === BillType.Income ? incomeCount : expenseCount;

    return {
      currentTypeAmountCents: this.toResponseAmountCents(currentTypeAmountCents),
      currentTypeCount,
      expenseAmountCents: this.toResponseAmountCents(expenseCents),
      expenseCount,
      incomeAmountCents: this.toResponseAmountCents(incomeCents),
      incomeCount,
    };
  }

  private buildTrend(months: MonthPoint[], bills: Bill[]) {
    const monthly = new Map<string, { amountCents: number; count: number }>();

    for (const month of months) {
      monthly.set(this.getMonthKey(month.year, month.month), {
        amountCents: 0,
        count: 0,
      });
    }

    for (const bill of bills) {
      const [year, month] = bill.billDate.split('-').map(Number);
      const key = this.getMonthKey(year, month);
      const current = monthly.get(key);
      if (!current) {
        continue;
      }
      current.amountCents += this.amountToCents(bill.amountCents);
      current.count += 1;
    }

    return months.map((month) => {
      const current = monthly.get(this.getMonthKey(month.year, month.month));
      return {
        year: month.year,
        month: month.month,
        amountCents: this.toResponseAmountCents(current?.amountCents ?? 0),
        count: current?.count ?? 0,
      };
    });
  }

  private async buildCategories(
    userId: string,
    type: BillType,
    bills: Bill[],
    currentTypeAmountCents: number,
  ) {
    const categoryMap = await this.getCategoryMap(userId, type);
    const aggregation = new Map<string, CategoryAggregation>();

    for (const bill of bills) {
      const category = categoryMap.get(bill.categoryId) ?? bill.category;
      const key = category?.id ?? OTHER_CATEGORY_ID;
      const current = aggregation.get(key) ?? {
        categoryId: key,
        categoryName: category?.name ?? OTHER_CATEGORY_NAME,
        categoryIcon: category?.icon ?? '',
        sortOrder: category?.sortOrder ?? Number.MAX_SAFE_INTEGER,
        amountCents: 0,
        count: 0,
      };

      current.amountCents += this.amountToCents(bill.amountCents);
      current.count += 1;
      aggregation.set(key, current);
    }

    return [...aggregation.values()]
      .sort((left, right) => {
        if (right.amountCents !== left.amountCents) {
          return right.amountCents - left.amountCents;
        }
        if (right.count !== left.count) {
          return right.count - left.count;
        }
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }
        return left.categoryId.localeCompare(right.categoryId, 'en-US', {
          numeric: true,
        });
      })
      .map((item) => ({
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        categoryIcon: item.categoryIcon,
        amountCents: this.toResponseAmountCents(item.amountCents),
        count: item.count,
        percentage: this.getPercentage(item.amountCents, currentTypeAmountCents),
      }));
  }

  private async getCategoryMap(userId: string, type: BillType) {
    const categories = await this.categoryRepository.find({
      where: [
        { userId, type },
        { userId: IsNull(), isSystem: true, type },
      ],
    });

    return new Map(categories.map((category) => [category.id, category]));
  }

  private toRecentBill(bill: Bill) {
    const categoryName = bill.category?.name ?? OTHER_CATEGORY_NAME;

    return {
      id: bill.id,
      type: bill.type,
      amountCents: this.toResponseAmountCents(this.amountToCents(bill.amountCents)),
      categoryId: bill.category?.id ?? OTHER_CATEGORY_ID,
      categoryName,
      categoryIcon: bill.category?.icon ?? '',
      title: categoryName,
      remark: bill.remark ?? '',
      occurredAt: bill.billDate,
      billDate: bill.billDate,
      createdAt: bill.createdAt,
    };
  }

  private getRecentMonths(year: number, month: number): MonthPoint[] {
    const months: MonthPoint[] = [];

    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(year, month - 1 - offset, 1);
      months.push({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
      });
    }

    return months;
  }

  private getMonthRange(year: number, month: number) {
    const lastDay = new Date(year, month, 0).getDate();
    return {
      start: `${year}-${this.padMonth(month)}-01`,
      end: `${year}-${this.padMonth(month)}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  private getMonthKey(year: number, month: number) {
    return `${year}-${this.padMonth(month)}`;
  }

  private padMonth(month: number) {
    return String(month).padStart(2, '0');
  }

  private ensureNotFutureMonth(year: number, month: number) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (year > currentYear || (year === currentYear && month > currentMonth)) {
      throw new BadRequestException('不能查询未来月份');
    }
  }

  private amountToCents(value: string | number) {
    // 现有接口金额单位是“分”，数据库字段 amount_cents 也是分。
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
      return 0;
    }

    return Math.round(amount);
  }

  private toResponseAmountCents(cents: number) {
    return cents;
  }

  private getPercentage(amountCents: number, totalCents: number) {
    if (totalCents <= 0) {
      return 0;
    }

    return Number(((amountCents / totalCents) * 100).toFixed(2));
  }
}
