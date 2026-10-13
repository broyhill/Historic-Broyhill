import { PartialType } from '@nestjs/swagger';
import { SuiteStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQuery } from '../common/pagination';

export class SuiteListQuery extends PaginationQuery {
  @IsOptional() @IsEnum(SuiteStatus) status?: SuiteStatus;
  @IsOptional() @Type(() => Number) @IsInt() floor?: number;
}

export class CreateSuiteDto {
  @IsString() number: string;
  @IsInt() floor: number;
  @IsInt() @Min(1) squareFeet: number;
  @IsOptional() @IsNumber() @Min(0) monthlyRate?: number;
  @IsOptional() @IsEnum(SuiteStatus) status?: SuiteStatus;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() featured?: boolean;
}

export class UpdateSuiteDto extends PartialType(CreateSuiteDto) {}
