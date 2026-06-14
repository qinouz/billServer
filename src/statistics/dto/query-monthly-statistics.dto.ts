import { Type } from 'class-transformer';
import { IsEnum, IsInt, Max, Min } from 'class-validator';
import { BillType } from '../../category/entities/category.entity';

export class QueryMonthlyStatisticsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1970)
  @Max(9999)
  year: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsEnum(BillType)
  type: BillType;
}
