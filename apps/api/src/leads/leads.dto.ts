import { PartialType } from '@nestjs/swagger';
import { IntentSubject } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsIn, Min, MaxLength } from 'class-validator';
import { PaginationQuery } from '../common/pagination';

export const LEAD_STATUSES = ['PROSPECT', 'ENGAGED', 'HOT_LEAD', 'CONVERTED', 'ARCHIVED'] as const;

export class LeadListQuery extends PaginationQuery {
  @IsOptional() @IsIn(LEAD_STATUSES) status?: string;
  @IsOptional() @IsEnum(IntentSubject) intentSubject?: IntentSubject;
  @IsOptional() @Type(() => Boolean) @IsBoolean() onWaitlist?: boolean;
  @IsOptional() @IsString() search?: string;
}

/** Public website inquiry form (office space or event). */
export class InquiryDto {
  @IsEmail() email: string;
  @IsString() @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(160) companyName?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsEnum(IntentSubject) intentSubject: IntentSubject;
  @IsOptional() @IsString() @MaxLength(60) eventType?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) targetSquareFt?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) targetBudget?: number;
  @IsOptional() @IsString() @MaxLength(4000) message?: string;
  @IsOptional() @IsBoolean() emailOptIn?: boolean;
  @IsOptional() @IsBoolean() smsOptIn?: boolean;
}

export class CreateLeadDto extends InquiryDto {
  @IsOptional() @IsIn(LEAD_STATUSES) leadStatus?: string;
  @IsOptional() @IsString() leadSource?: string;
}

export class UpdateLeadDto extends PartialType(CreateLeadDto) {
  @IsOptional() @IsBoolean() onWaitlist?: boolean;
}

export class AddActivityDto {
  @IsString() @MaxLength(60) activityType: string;
  @IsInt() scoreModifier: number;
  @IsOptional() metadata?: Record<string, unknown>;
}
