import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BillType } from '../../category/entities/category.entity';
import { MAX_BILL_AMOUNT, MIN_BILL_AMOUNT } from '../bill.constants';

export class CreateBillDto {
  @IsString()
  categoryId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(MIN_BILL_AMOUNT)
  @Max(MAX_BILL_AMOUNT)
  amount: number;

  @IsEnum(BillType)
  type: BillType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;

  @IsDateString()
  billDate: string;
}
