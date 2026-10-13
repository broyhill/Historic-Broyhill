import { PartialType } from '@nestjs/swagger';
import { TenantStatus } from '@prisma/client';
import { IsBoolean, IsDateString, IsEmail, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { PaginationQuery } from '../common/pagination';

export class TenantListQuery extends PaginationQuery {
  @IsOptional() @IsEnum(TenantStatus) status?: TenantStatus;
  @IsOptional() @IsString() search?: string;
}

export class CreateTenantDto {
  @IsString() companyName: string;
  @IsString() contactName: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsUUID() suiteId?: string;
  @IsOptional() @IsDateString() leaseStart?: string;
  @IsOptional() @IsDateString() leaseEnd?: string;
  @IsOptional() @IsNumber() @Min(0) monthlyRent?: number;
  @IsOptional() @IsEnum(TenantStatus) status?: TenantStatus;
  @IsOptional() @IsBoolean() emailOptIn?: boolean;
  @IsOptional() @IsBoolean() smsOptIn?: boolean;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateTenantDto extends PartialType(CreateTenantDto) {}
