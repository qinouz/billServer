import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { Bill } from '../bill/entities/bill.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { BillType, Category } from './entities/category.entity';

const SYSTEM_CATEGORIES: Array<Pick<Category, 'name' | 'icon' | 'type' | 'sortOrder'>> = [
  { name: '餐饮', icon: '🍜', type: BillType.Expense, sortOrder: 1 },
  { name: '购物', icon: '🛒', type: BillType.Expense, sortOrder: 2 },
  { name: '日用', icon: '🏠', type: BillType.Expense, sortOrder: 3 },
  { name: '交通', icon: '🚗', type: BillType.Expense, sortOrder: 4 },
  { name: '蔬菜', icon: '🥬', type: BillType.Expense, sortOrder: 5 },
  { name: '水果', icon: '🍎', type: BillType.Expense, sortOrder: 6 },
  { name: '零食', icon: '🍪', type: BillType.Expense, sortOrder: 7 },
  { name: '运动', icon: '⚽', type: BillType.Expense, sortOrder: 8 },
  { name: '娱乐', icon: '🎮', type: BillType.Expense, sortOrder: 9 },
  { name: '通讯', icon: '📱', type: BillType.Expense, sortOrder: 10 },
  { name: '服饰', icon: '👔', type: BillType.Expense, sortOrder: 11 },
  { name: '美容', icon: '💄', type: BillType.Expense, sortOrder: 12 },
  { name: '住房', icon: '🏡', type: BillType.Expense, sortOrder: 13 },
  { name: '居家', icon: '🛋️', type: BillType.Expense, sortOrder: 14 },
  { name: '孩子', icon: '👶', type: BillType.Expense, sortOrder: 15 },
  { name: '长辈', icon: '👴', type: BillType.Expense, sortOrder: 16 },
  { name: '社交', icon: '🤝', type: BillType.Expense, sortOrder: 17 },
  { name: '旅行', icon: '✈️', type: BillType.Expense, sortOrder: 18 },
  { name: '烟酒', icon: '🚬', type: BillType.Expense, sortOrder: 19 },
  { name: '数码', icon: '💻', type: BillType.Expense, sortOrder: 20 },
  { name: '汽车', icon: '🚙', type: BillType.Expense, sortOrder: 21 },
  { name: '医疗', icon: '💊', type: BillType.Expense, sortOrder: 22 },
  { name: '书籍', icon: '📚', type: BillType.Expense, sortOrder: 23 },
  { name: '学习', icon: '📖', type: BillType.Expense, sortOrder: 24 },
  { name: '工资', icon: '💰', type: BillType.Income, sortOrder: 1 },
  { name: '兼职', icon: '💼', type: BillType.Income, sortOrder: 2 },
  { name: '理财', icon: '📈', type: BillType.Income, sortOrder: 3 },
  { name: '礼金', icon: '🧧', type: BillType.Income, sortOrder: 4 },
  { name: '其它', icon: '💵', type: BillType.Income, sortOrder: 5 },
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
    const seedKeys = new Set(
      SYSTEM_CATEGORIES.map((item) => `${item.type}:${item.name}`),
    );

    for (const item of SYSTEM_CATEGORIES) {
      const existed = await this.categoryRepository.findOne({
        where: { userId: IsNull(), name: item.name, type: item.type, isSystem: true },
      });
      if (existed) {
        await this.categoryRepository.update(existed.id, {
          icon: item.icon,
          sortOrder: item.sortOrder,
        });
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

    const removedIds: string[] = [];
    const systemCategories = await this.categoryRepository.find({
      where: { userId: IsNull(), isSystem: true },
    });

    for (const category of systemCategories) {
      if (seedKeys.has(`${category.type}:${category.name}`)) {
        continue;
      }

      const usedCount = await this.billRepository.count({
        where: { categoryId: category.id, isDeleted: false },
      });
      if (usedCount === 0) {
        await this.categoryRepository.remove(category);
        removedIds.push(category.id);
      }
    }

    return { createdIds, removedIds };
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
