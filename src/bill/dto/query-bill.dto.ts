import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { BillType } from '../../category/entities/category.entity';

export class QueryBillDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === 'undefined' || value === 'null') {
      return undefined;
    }
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? value.slice(0, 7)
      : value;
  })
  @Matches(/^\d{4}-\d{2}$/)
  month?: string;

  @IsOptional()
  @IsEnum(BillType)
  type?: BillType;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageNo = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
