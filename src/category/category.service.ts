import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { Bill } from '../bill/entities/bill.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { BillType, Category } from './entities/category.entity';

const SYSTEM_CATEGORIES: Array<Pick<Category, 'name' | 'icon' | 'type' | 'sortOrder'>> = [
  { name: '餐饮', icon: 'food', type: BillType.Expense, sortOrder: 10 },
  { name: '交通', icon: 'transport', type: BillType.Expense, sortOrder: 20 },
  { name: '购物', icon: 'shopping', type: BillType.Expense, sortOrder: 30 },
  { name: '住房', icon: 'home', type: BillType.Expense, sortOrder: 40 },
  { name: '工资', icon: 'salary', type: BillType.Income, sortOrder: 10 },
  { name: '奖金', icon: 'bonus', type: BillType.Income, sortOrder: 20 },
];

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Bill)
    private readonly billRepository: Repository<Bill>,
  ) {}

  async findAll(userId: string, type?: BillType) {
    const base: FindOptionsWhere<Category>[] = [
      { userId, ...(type ? { type } : {}) },
      { userId: IsNull(), isSystem: true, ...(type ? { type } : {}) },
    ];

    return this.categoryRepository.find({
      where: base,
      order: { type: 'ASC', sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async create(userId: string, dto: CreateCategoryDto) {
    const category = await this.categoryRepository.save(
      this.categoryRepository.create({
        ...dto,
        userId,
        icon: dto.icon ?? '',
        sortOrder: dto.sortOrder ?? 0,
        isSystem: false,
      }),
    );
    return { categoryId: category.id };
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto) {
    const category = await this.findOwned(userId, id);
    await this.categoryRepository.save({ ...category, ...dto });
    return { categoryId: id };
  }

  async remove(userId: string, id: string) {
    const category = await this.findOwned(userId, id);
    const usedCount = await this.billRepository.count({
      where: { userId, categoryId: id, isDeleted: false },
    });
    if (usedCount > 0) {
      throw new BadRequestException('分类已被账单使用，不能删除');
    }
    await this.categoryRepository.remove(category);
    return { categoryId: id };
  }

  async initSystemCategories() {
    const createdIds: string[] = [];

    for (const item of SYSTEM_CATEGORIES) {
      const existed = await this.categoryRepository.findOne({
        where: { userId: IsNull(), name: item.name, type: item.type, isSystem: true },
      });
      if (existed) {
        continue;
      }
      const category = await this.categoryRepository.save(
        this.categoryRepository.create({
          ...item,
          userId: null,
          isSystem: true,
        }),
      );
      createdIds.push(category.id);
    }

    return { createdIds };
  }

  private async findOwned(userId: string, id: string) {
    const category = await this.categoryRepository.findOne({
      where: { id, userId, isSystem: false },
    });
    if (!category) {
      throw new NotFoundException('分类不存在');
    }
    return category;
  }
}
