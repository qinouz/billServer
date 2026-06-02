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

export class CreateBillDto {
  @IsString()
  categoryId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
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
