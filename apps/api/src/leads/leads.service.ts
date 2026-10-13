import { Injectable, NotFoundException } from '@nestjs/common';
import { IntentSubject, Prisma, SuiteStatus } from '@prisma/client';
import { pageArgs, paged } from '../common/pagination';
import { MessagingService } from '../messaging/messaging.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddActivityDto, CreateLeadDto, InquiryDto, LeadListQuery, UpdateLeadDto } from './leads.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService, private readonly messaging: MessagingService) {}

  async list(q: LeadListQuery) {
    const where: Prisma.LeadProfileWhereInput = {
      leadStatus: q.status,
      intentSubject: q.intentSubject,
      onWaitlist: q.onWaitlist,
      ...(q.search && { OR: [
        { name: { contains: q.search, mode: 'insensitive' } },
        { companyName: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
      ] }),
    };
    const [data, total] = await Promise.all([
      this.prisma.leadProfile.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(q) }),
      this.prisma.leadProfile.count({ where }),
    ]);
    return paged(data, total, q);
  }

  async get(id: string) {
    const lead = await this.prisma.leadProfile.findUnique({
      where: { id },
      include: {
        activities: { orderBy: { createdAt: 'desc' }, take: 50 },
        appointments: { orderBy: { startTime: 'desc' }, take: 20 },
        bookings: { orderBy: { startTime: 'desc' }, take: 20 },
        messages: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  create(dto: CreateLeadDto) {
    return this.prisma.leadProfile.create({ data: { ...dto, email: dto.email.toLowerCase() } });
  }

  async update(id: string, dto: UpdateLeadDto) {
    await this.get(id);
    return this.prisma.leadProfile.update({ where: { id }, data: { ...dto, ...(dto.email && { email: dto.email.toLowerCase() }) } });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.$transaction([
      this.prisma.messageLog.updateMany({ where: { leadId: id }, data: { leadId: null } }),
      this.prisma.appointment.updateMany({ where: { leadId: id }, data: { leadId: null } }),
      this.prisma.booking.updateMany({ where: { leadId: id }, data: { leadId: null } }),
      this.prisma.leadProfile.delete({ where: { id } }),
    ]);
    return { deleted: true };
  }

  async addActivity(id: string, dto: AddActivityDto) {
    await this.get(id);
    const [activity] = await this.prisma.$transaction([
      this.prisma.leadActivity.create({ data: { leadId: id, activityType: dto.activityType, scoreModifier: dto.scoreModifier, metadata: dto.metadata as Prisma.InputJsonValue | undefined } }),
      this.prisma.leadProfile.update({ where: { id }, data: { leadScore: { increment: dto.scoreModifier } } }),
    ]);
    return activity;
  }

  /** Creates or refreshes the lead for an email address (used by inquiries, tours and bookings). */
  async upsertFromContact(c: { email: string; name?: string; phone?: string; companyName?: string; intentSubject: IntentSubject; eventType?: string; source?: string }) {
    const email = c.email.toLowerCase();
    return this.prisma.leadProfile.upsert({
      where: { email },
      create: { email, name: c.name, phone: c.phone, companyName: c.companyName, intentSubject: c.intentSubject, eventType: c.eventType, leadSource: c.source ?? 'INBOUND_PORTAL' },
      update: { name: c.name ?? undefined, phone: c.phone ?? undefined, companyName: c.companyName ?? undefined },
    });
  }

  /** Public inquiry form: stores the lead, waitlists office inquiries when nothing is vacant, and acknowledges by email/SMS. */
  async submitInquiry(dto: InquiryDto) {
    const email = dto.email.toLowerCase();
    let onWaitlist = false;
    if (dto.intentSubject === IntentSubject.COMMERCIAL_LEASE) {
      onWaitlist = (await this.prisma.suite.count({ where: { status: SuiteStatus.VACANT } })) === 0;
    }
    const data = {
      name: dto.name, companyName: dto.companyName, phone: dto.phone, intentSubject: dto.intentSubject,
      eventType: dto.eventType, targetSquareFt: dto.targetSquareFt, targetBudget: dto.targetBudget,
      message: dto.message, emailOptIn: dto.emailOptIn ?? true, smsOptIn: dto.smsOptIn ?? false, onWaitlist,
    };
    const lead = await this.prisma.leadProfile.upsert({
      where: { email },
      create: { email, ...data },
      update: { ...data, leadScore: { increment: 10 } },
    });
    await this.prisma.leadActivity.create({
      data: { leadId: lead.id, activityType: dto.intentSubject === 'COMMERCIAL_LEASE' ? 'LEASE_INQUIRY' : 'EVENT_INQUIRY', scoreModifier: 10, metadata: { onWaitlist } },
    });
    const body = onWaitlist
      ? `Hello ${dto.name}, thank you for your interest in Historic Broyhill. Our suites are currently fully leased, so we have added you to our waitlist and will contact you as soon as one becomes available.`
      : `Hello ${dto.name}, thank you for contacting Historic Broyhill. A member of our team will be in touch shortly.`;
    await this.messaging.notifyContact(
      { email, phone: lead.phone, emailOptIn: lead.emailOptIn, smsOptIn: lead.smsOptIn, leadId: lead.id },
      'Thank you for contacting Historic Broyhill',
      body,
    );
    return { id: lead.id, onWaitlist, message: body };
  }
}
