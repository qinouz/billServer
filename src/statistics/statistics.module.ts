import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bill } from '../bill/entities/bill.entity';
import { Category } from '../category/entities/category.entity';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

@Module({
  imports: [TypeOrmModule.forFeature([Bill, Category])],
  controllers: [StatisticsController],
  providers: [StatisticsService],
})
export class StatisticsModule {}
