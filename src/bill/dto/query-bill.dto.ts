import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class QueryBillDto {
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
