import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, IntentSubject, Prisma } from '@prisma/client';
import { pageArgs, paged } from '../common/pagination';
import { LeadsService } from '../leads/leads.service';
import { MessagingService } from '../messaging/messaging.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentListQuery, RequestAppointmentDto, UpdateAppointmentDto } from './appointments.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leads: LeadsService,
    private readonly messaging: MessagingService,
  ) {}

  async list(q: AppointmentListQuery) {
    const where: Prisma.AppointmentWhereInput = {
      status: q.status,
      type: q.type,
      startTime: { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(q.to) : undefined },
    };
    const [data, total] = await Promise.all([
      this.prisma.appointment.findMany({ where, include: { suite: { select: { number: true } } }, orderBy: { startTime: 'asc' }, ...pageArgs(q) }),
      this.prisma.appointment.count({ where }),
    ]);
    return paged(data, total, q);
  }

  async get(id: string) {
    const appt = await this.prisma.appointment.findUnique({ where: { id }, include: { suite: true, lead: true } });
    if (!appt) throw new NotFoundException('Appointment not found');
    return appt;
  }

  async request(dto: RequestAppointmentDto) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    if (!(end > start)) throw new BadRequestException('endTime must be after startTime');
    if (start < new Date()) throw new BadRequestException('startTime must be in the future');
    if (dto.suiteId && !(await this.prisma.suite.findUnique({ where: { id: dto.suiteId } }))) throw new NotFoundException('Suite not found');

    const lead = await this.leads.upsertFromContact({ email: dto.email, name: dto.name, phone: dto.phone, intentSubject: IntentSubject.COMMERCIAL_LEASE });
    const appt = await this.prisma.appointment.create({
      data: { type: dto.type, startTime: start, endTime: end, name: dto.name, email: dto.email.toLowerCase(), phone: dto.phone, notes: dto.notes, suiteId: dto.suiteId, leadId: lead.id },
    });
    await this.prisma.leadActivity.create({ data: { leadId: lead.id, activityType: 'SITE_TOUR_REQUEST', scoreModifier: 20, metadata: { appointmentId: appt.id } } });
    await this.prisma.leadProfile.update({ where: { id: lead.id }, data: { leadScore: { increment: 20 } } });
    await this.messaging.notifyContact(
      { email: appt.email, phone: appt.phone, emailOptIn: lead.emailOptIn, smsOptIn: lead.smsOptIn, leadId: lead.id },
      'We received your tour request',
      `Hello ${appt.name}, we received your request for ${start.toUTCString()}. We will confirm your appointment shortly.`,
    );
    return appt;
  }

  async update(id: string, dto: UpdateAppointmentDto) {
    const current = await this.get(id);
    const start = dto.startTime ? new Date(dto.startTime) : current.startTime;
    const end = dto.endTime ? new Date(dto.endTime) : current.endTime;
    if (!(end > start)) throw new BadRequestException('endTime must be after startTime');
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: dto.status, startTime: start, endTime: end, notes: dto.notes },
    });
    if (dto.status === AppointmentStatus.CONFIRMED && current.status !== AppointmentStatus.CONFIRMED) {
      await this.messaging.notifyContact(
        { email: updated.email, phone: updated.phone, emailOptIn: current.lead?.emailOptIn, smsOptIn: current.lead?.smsOptIn, leadId: current.leadId ?? undefined },
        'Your Historic Broyhill appointment is confirmed',
        `Hello ${updated.name}, your appointment on ${updated.startTime.toUTCString()} is confirmed. We look forward to seeing you.`,
        `appointment-confirmed:${updated.id}:${updated.startTime.toISOString()}`,
      );
    }
    return updated;
  }
}
