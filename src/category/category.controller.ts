import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { BillType } from './entities/category.entity';

@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload, @Query('type') type?: BillType) {
    return this.categoryService.findAll(user.userId, type);
  }

  @Post()
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateCategoryDto) {
    return this.categoryService.create(user.userId, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoryService.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.categoryService.remove(user.userId, id);
  }

  @Post('init')
  init() {
    return this.categoryService.initSystemCategories();
  }
}
