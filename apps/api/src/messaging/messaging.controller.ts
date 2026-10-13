import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MessageChannel, MessageStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { AdminOnly } from '../common/auth';
import { PaginationQuery, pageArgs, paged } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingService } from './messaging.service';

class MessageListQuery extends PaginationQuery {
  @IsOptional() @IsEnum(MessageChannel) channel?: MessageChannel;
  @IsOptional() @IsEnum(MessageStatus) status?: MessageStatus;
}

class SendMessageDto {
  @IsEnum(MessageChannel) channel: MessageChannel;
  @IsString() to: string;
  @IsOptional() @IsString() subject?: string;
  @IsString() body: string;
  @IsOptional() @IsDateString() scheduledFor?: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsOptional() @IsUUID() tenantId?: string;
}

@ApiTags('Admin - Messages')
@AdminOnly()
@Controller('admin/messages')
export class MessagingController {
  constructor(private readonly prisma: PrismaService, private readonly messaging: MessagingService) {}

  @Get()
  async list(@Query() q: MessageListQuery) {
    const where = { channel: q.channel, status: q.status };
    const [data, total] = await Promise.all([
      this.prisma.messageLog.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(q) }),
      this.prisma.messageLog.count({ where }),
    ]);
    return paged(data, total, q);
  }

  @Post('send')
  send(@Body() dto: SendMessageDto) {
    return this.messaging.send({ ...dto, scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : undefined });
  }

  @Post('process-queue')
  processQueue() {
    return this.messaging.processQueue();
  }
}
