import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bill } from '../bill/entities/bill.entity';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { Category } from './entities/category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Bill])],
  controllers: [CategoryController],
  providers: [CategoryService],
})
export class CategoryModule {}
