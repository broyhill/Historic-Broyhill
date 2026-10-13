import { PartialType } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEmail, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { PaginationQuery } from '../common/pagination';

export class BookingListQuery extends PaginationQuery {
  @IsOptional() @IsEnum(BookingStatus) status?: BookingStatus;
  @IsOptional() @IsUUID() eventSpaceId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class QuoteQuery {
  @IsUUID() eventSpaceId: string;
  @IsDateString() startTime: string;
  @IsDateString() endTime: string;
}

export class AvailabilityQuery {
  @IsDateString() from: string;
  @IsDateString() to: string;
}

/** Event space reservation request (public website or staff entry). */
export class CreateBookingDto {
  @IsUUID() eventSpaceId: string;
  @IsString() @MaxLength(160) title: string;
  @IsOptional() @IsString() @MaxLength(60) eventType?: string;
  @IsDateString() startTime: string;
  @IsDateString() endTime: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5000) expectedGuests?: number;
  @IsString() @MaxLength(120) contactName: string;
  @IsEmail() contactEmail: string;
  @IsOptional() @IsString() @MaxLength(40) contactPhone?: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
}

export class UpdateBookingDto extends PartialType(CreateBookingDto) {
  @IsOptional() @IsEnum(BookingStatus) status?: BookingStatus;
  @IsOptional() @IsNumber() @Min(0) totalAmount?: number;
  @IsOptional() @IsNumber() @Min(0) depositAmount?: number;
}

export class CreateRsvpDto {
  @IsString() @MaxLength(120) name: string;
  @IsEmail() email: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(20) guests?: number;
}

export class CheckInDto {
  @IsString() qrCodeToken: string;
}
