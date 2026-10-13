import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentStatus, PaymentType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsPositive } from 'class-validator';
import { AdminOnly } from '../common/auth';
import { PaginationQuery, pageArgs, paged } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';

class PaymentListQuery extends PaginationQuery {
  @IsOptional() @IsEnum(PaymentStatus) status?: PaymentStatus;
}

class RecordPaymentDto {
  @IsNumber() @IsPositive() amount: number;
  @IsOptional() @IsEnum(PaymentType) type: PaymentType = PaymentType.BALANCE;
}

@ApiTags('Admin - Payments')
@AdminOnly()
@Controller('admin')
export class PaymentsController {
  constructor(private readonly prisma: PrismaService, private readonly payments: PaymentsService) {}

  @Get('payments')
  async list(@Query() q: PaymentListQuery) {
    const where = { status: q.status };
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({ where, include: { booking: { select: { reference: true, title: true } } }, orderBy: { createdAt: 'desc' }, ...pageArgs(q) }),
      this.prisma.payment.count({ where }),
    ]);
    return paged(data, total, q);
  }

  @Post('bookings/:id/payments')
  record(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordPaymentDto) {
    return this.payments.recordManual(id, dto.amount, dto.type);
  }

  @Post('payments/:id/refund')
  refund(@Param('id', ParseUUIDPipe) id: string) {
    return this.payments.refund(id);
  }
}
