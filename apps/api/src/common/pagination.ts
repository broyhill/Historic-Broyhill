import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQuery {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 25;
}

export const pageArgs = (q: PaginationQuery) => ({ skip: (q.page - 1) * q.limit, take: q.limit });

export const paged = <T>(data: T[], total: number, q: PaginationQuery) => ({
  data,
  meta: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) },
});
