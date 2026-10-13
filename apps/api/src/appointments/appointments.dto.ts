import { AppointmentStatus, AppointmentType } from '@prisma/client';
import { IsDateString, IsEmail, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQuery } from '../common/pagination';

export class AppointmentListQuery extends PaginationQuery {
  @IsOptional() @IsEnum(AppointmentStatus) status?: AppointmentStatus;
  @IsOptional() @IsEnum(AppointmentType) type?: AppointmentType;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

/** Public tour / appointment request. */
export class RequestAppointmentDto {
  @IsOptional() @IsEnum(AppointmentType) type?: AppointmentType;
  @IsDateString() startTime: string;
  @IsDateString() endTime: string;
  @IsString() @MaxLength(120) name: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsUUID() suiteId?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateAppointmentDto {
  @IsOptional() @IsEnum(AppointmentStatus) status?: AppointmentStatus;
  @IsOptional() @IsDateString() startTime?: string;
  @IsOptional() @IsDateString() endTime?: string;
  @IsOptional() @IsString() notes?: string;
}
