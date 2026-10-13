import { Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventSpaceDto, UpdateEventSpaceDto } from './event-spaces.dto';

@Injectable()
export class EventSpacesService {
  constructor(private readonly prisma: PrismaService) {}

  list(onlyActive = false) {
    return this.prisma.eventSpace.findMany({ where: onlyActive ? { active: true } : {}, orderBy: { name: 'asc' } });
  }

  async get(id: string) {
    const space = await this.prisma.eventSpace.findUnique({ where: { id } });
    if (!space) throw new NotFoundException('Event space not found');
    return space;
  }

  create(dto: CreateEventSpaceDto) { return this.prisma.eventSpace.create({ data: dto }); }

  async update(id: string, dto: UpdateEventSpaceDto) {
    await this.get(id);
    return this.prisma.eventSpace.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.get(id);
    const bookings = await this.prisma.booking.count({ where: { eventSpaceId: id } });
    if (bookings) {
      await this.prisma.eventSpace.update({ where: { id }, data: { active: false } });
      return { deleted: false, deactivated: true };
    }
    await this.prisma.eventSpace.delete({ where: { id } });
    return { deleted: true };
  }

  /** Busy windows (pending and confirmed bookings) for a space within a date range. */
  async availability(id: string, from: Date, to: Date) {
    await this.get(id);
    const busy = await this.prisma.booking.findMany({
      where: { eventSpaceId: id, status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] }, startTime: { lt: to }, endTime: { gt: from } },
      select: { startTime: true, endTime: true, status: true },
      orderBy: { startTime: 'asc' },
    });
    return { eventSpaceId: id, from, to, busy };
  }
}
