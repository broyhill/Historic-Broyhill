import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'crypto';
import { BookingStatus, IntentSubject, PaymentStatus, Prisma, RsvpStatus } from '@prisma/client';
import { pageArgs, paged } from '../common/pagination';
import { LeadsService } from '../leads/leads.service';
import { MessagingService } from '../messaging/messaging.service';
import { PrismaService } from '../prisma/prisma.service';
import { BookingListQuery, CreateBookingDto, CreateRsvpDto, UpdateBookingDto } from './bookings.dto';

const ACTIVE: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.CONFIRMED];

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly leads: LeadsService,
    private readonly messaging: MessagingService,
  ) {}

  private validateWindow(start: Date, end: Date, allowPast = false) {
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new BadRequestException('Invalid dates');
    if (!(end > start)) throw new BadRequestException('endTime must be after startTime');
    if (!allowPast && start < new Date()) throw new BadRequestException('startTime must be in the future');
  }

  private price(hourlyRate: number, start: Date, end: Date) {
    const hours = (end.getTime() - start.getTime()) / 3_600_000;
    const percent = Number(this.config.get('DEPOSIT_PERCENT') ?? 25);
    const totalAmount = Math.round(hours * hourlyRate * 100) / 100;
    const depositAmount = Math.round(totalAmount * percent) / 100;
    return { hours, totalAmount, depositAmount };
  }

  async quote(eventSpaceId: string, startTime: string, endTime: string) {
    const space = await this.prisma.eventSpace.findUnique({ where: { id: eventSpaceId } });
    if (!space || !space.active) throw new NotFoundException('Event space not found');
    const start = new Date(startTime);
    const end = new Date(endTime);
    this.validateWindow(start, end);
    return { eventSpaceId, startTime: start, endTime: end, hourlyRate: space.hourlyRate, ...this.price(space.hourlyRate, start, end) };
  }

  private async assertAvailable(tx: Prisma.TransactionClient, eventSpaceId: string, start: Date, end: Date, excludeId?: string) {
    const clash = await tx.booking.findFirst({
      where: { eventSpaceId, status: { in: ACTIVE }, startTime: { lt: end }, endTime: { gt: start }, ...(excludeId && { id: { not: excludeId } }) },
    });
    if (clash) throw new ConflictException('That space is already booked for the requested time');
  }

  /** Creates a PENDING reservation after checking space, capacity and availability. */
  async create(dto: CreateBookingDto, { allowPast = false } = {}) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    this.validateWindow(start, end, allowPast);
    const space = await this.prisma.eventSpace.findUnique({ where: { id: dto.eventSpaceId } });
    if (!space || !space.active) throw new NotFoundException('Event space not found');
    if (dto.expectedGuests && dto.expectedGuests > space.capacity) {
      throw new BadRequestException(`${space.name} holds at most ${space.capacity} guests`);
    }
    const lead = await this.leads.upsertFromContact({
      email: dto.contactEmail, name: dto.contactName, phone: dto.contactPhone, intentSubject: IntentSubject.CONFERENCE_EVENT, eventType: dto.eventType,
    });
    const { totalAmount, depositAmount } = this.price(space.hourlyRate, start, end);
    const reference = `HB-${randomBytes(4).toString('hex').toUpperCase()}`;

    let booking;
    try {
      booking = await this.prisma.$transaction(async (tx) => {
        await this.assertAvailable(tx, dto.eventSpaceId, start, end);
        return tx.booking.create({
          data: {
            reference, title: dto.title, eventType: dto.eventType, startTime: start, endTime: end, expectedGuests: dto.expectedGuests,
            contactName: dto.contactName, contactEmail: dto.contactEmail.toLowerCase(), contactPhone: dto.contactPhone, notes: dto.notes,
            totalAmount, depositAmount, eventSpaceId: dto.eventSpaceId, leadId: lead.id,
          },
          include: { eventSpace: { select: { name: true } } },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') {
        throw new ConflictException('That space was just booked. Please try again.');
      }
      throw e;
    }
    await this.prisma.leadActivity.create({ data: { leadId: lead.id, activityType: 'EVENT_BOOKING_REQUEST', scoreModifier: 30, metadata: { reference } } });
    await this.prisma.leadProfile.update({ where: { id: lead.id }, data: { leadScore: { increment: 30 } } });
    await this.messaging.notifyContact(
      { email: booking.contactEmail, phone: booking.contactPhone, emailOptIn: lead.emailOptIn, smsOptIn: lead.smsOptIn, leadId: lead.id },
      `Booking request received: ${booking.title}`,
      `Hello ${booking.contactName}, we received your request for ${booking.eventSpace.name} on ${start.toUTCString()}. Your reference is ${reference}. A deposit of $${depositAmount.toFixed(2)} secures the date once we confirm.`,
    );
    return booking;
  }

  async list(q: BookingListQuery) {
    const where: Prisma.BookingWhereInput = {
      status: q.status,
      eventSpaceId: q.eventSpaceId,
      startTime: { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(q.to) : undefined },
    };
    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({ where, include: { eventSpace: { select: { name: true } } }, orderBy: { startTime: 'asc' }, ...pageArgs(q) }),
      this.prisma.booking.count({ where }),
    ]);
    return paged(data, total, q);
  }

  async get(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { eventSpace: true, payments: { orderBy: { createdAt: 'asc' } }, rsvps: { orderBy: { createdAt: 'asc' } }, lead: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  /** Public status lookup: only data the booker already knows or needs. */
  async getPublic(reference: string) {
    const b = await this.prisma.booking.findUnique({
      where: { reference },
      include: { eventSpace: { select: { name: true, capacity: true } }, payments: { select: { type: true, status: true, amount: true } } },
    });
    if (!b) throw new NotFoundException('Booking not found');
    return {
      reference: b.reference, title: b.title, status: b.status, startTime: b.startTime, endTime: b.endTime,
      eventSpace: b.eventSpace, totalAmount: b.totalAmount, depositAmount: b.depositAmount,
      depositPaid: b.payments.some((p) => p.type === 'DEPOSIT' && p.status === PaymentStatus.SUCCEEDED),
    };
  }

  async update(id: string, dto: UpdateBookingDto) {
    const current = await this.get(id);
    const start = dto.startTime ? new Date(dto.startTime) : current.startTime;
    const end = dto.endTime ? new Date(dto.endTime) : current.endTime;
    const spaceId = dto.eventSpaceId ?? current.eventSpaceId;
    this.validateWindow(start, end, true);
    const status = dto.status ?? current.status;
    const { status: _s, startTime: _a, endTime: _b, ...rest } = dto;
    return this.prisma.$transaction(async (tx) => {
      if (ACTIVE.includes(status) && (dto.startTime || dto.endTime || dto.eventSpaceId || !ACTIVE.includes(current.status))) {
        await this.assertAvailable(tx, spaceId, start, end, id);
      }
      return tx.booking.update({ where: { id }, data: { ...rest, status, startTime: start, endTime: end } });
    });
  }

  async confirm(id: string) {
    const booking = await this.update(id, { status: BookingStatus.CONFIRMED });
    await this.messaging.notifyContact(
      { email: booking.contactEmail, phone: booking.contactPhone, smsOptIn: !!booking.contactPhone },
      `Booking confirmed: ${booking.title}`,
      `Hello ${booking.contactName}, your booking ${booking.reference} for ${booking.startTime.toUTCString()} is confirmed.`,
      `booking-confirmed:${booking.reference}`,
    );
    return booking;
  }

  async cancel(id: string) {
    const booking = await this.update(id, { status: BookingStatus.CANCELLED });
    await this.messaging.notifyContact(
      { email: booking.contactEmail, phone: booking.contactPhone, smsOptIn: !!booking.contactPhone },
      `Booking cancelled: ${booking.title}`,
      `Hello ${booking.contactName}, your booking ${booking.reference} has been cancelled. Contact us with any questions.`,
      `booking-cancelled:${booking.reference}`,
    );
    return booking;
  }

  // ----- RSVPs -----

  async rsvp(reference: string, dto: CreateRsvpDto) {
    const booking = await this.prisma.booking.findUnique({ where: { reference }, include: { eventSpace: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== BookingStatus.CONFIRMED) throw new BadRequestException('RSVPs are only open for confirmed events');
    const guests = dto.guests ?? 1;
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.rsvp.findFirst({ where: { bookingId: booking.id, email, status: RsvpStatus.ATTENDING } });
    if (existing) return existing;
    const attending = await this.prisma.rsvp.aggregate({ where: { bookingId: booking.id, status: RsvpStatus.ATTENDING }, _sum: { guests: true } });
    const limit = Math.min(booking.expectedGuests ?? booking.eventSpace.capacity, booking.eventSpace.capacity);
    if ((attending._sum.guests ?? 0) + guests > limit) throw new ConflictException('This event is at capacity');
    const rsvp = await this.prisma.rsvp.create({ data: { bookingId: booking.id, name: dto.name, email, guests, qrCodeToken: randomUUID() } });
    await this.messaging.send({
      channel: 'EMAIL', to: email, subject: `You're registered: ${booking.title}`,
      body: `Hello ${dto.name}, you're registered for ${booking.title} on ${booking.startTime.toUTCString()} (${guests} guest${guests > 1 ? 's' : ''}). Your check-in code: ${rsvp.qrCodeToken}`,
      template: `rsvp:${rsvp.id}`,
    });
    return rsvp;
  }

  async cancelRsvp(reference: string, qrCodeToken: string) {
    const rsvp = await this.prisma.rsvp.findFirst({ where: { qrCodeToken, booking: { reference } } });
    if (!rsvp) throw new NotFoundException('RSVP not found');
    return this.prisma.rsvp.update({ where: { id: rsvp.id }, data: { status: RsvpStatus.CANCELLED } });
  }

  listRsvps(bookingId: string) {
    return this.prisma.rsvp.findMany({ where: { bookingId }, orderBy: { createdAt: 'asc' } });
  }

  async checkIn(qrCodeToken: string) {
    const rsvp = await this.prisma.rsvp.findUnique({ where: { qrCodeToken }, include: { booking: { select: { title: true } } } });
    if (!rsvp || rsvp.status !== RsvpStatus.ATTENDING) throw new NotFoundException('No active RSVP for that code');
    if (rsvp.checkedIn) throw new ConflictException('Already checked in');
    return this.prisma.rsvp.update({ where: { id: rsvp.id }, data: { checkedIn: true } });
  }
}
