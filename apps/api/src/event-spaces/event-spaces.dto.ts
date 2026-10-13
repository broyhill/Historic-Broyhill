import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateEventSpaceDto {
  @IsString() name: string;
  @IsInt() @Min(1) capacity: number;
  @IsNumber() @Min(0) hourlyRate: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateEventSpaceDto extends PartialType(CreateEventSpaceDto) {}
