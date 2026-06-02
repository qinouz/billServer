import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../category/entities/category.entity';
import { BillController } from './bill.controller';
import { BillService } from './bill.service';
import { Bill } from './entities/bill.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Bill, Category])],
  controllers: [BillController],
  providers: [BillService],
})
export class BillModule {}
