import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BillType } from '../../category/entities/category.entity';
import { MAX_BILL_AMOUNT_CENTS, MIN_BILL_AMOUNT_CENTS } from '../bill.constants';

export class CreateBillDto {
  @IsString()
  categoryId: string;

  @Type(() => Number)
  @IsInt()
  @Min(MIN_BILL_AMOUNT_CENTS)
  @Max(MAX_BILL_AMOUNT_CENTS)
  amountCents: number;

  @IsEnum(BillType)
  type: BillType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;

  @IsDateString()
  billDate: string;
}
