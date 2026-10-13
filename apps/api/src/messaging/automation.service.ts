import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingStatus, TenantStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingService } from './messaging.service';

const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(private readonly prisma: PrismaService, private readonly messaging: MessagingService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async deliverQueued() {
    const { processed } = await this.messaging.processQueue();
    if (processed) this.logger.log(`Delivered ${processed} queued message(s)`);
  }

  /** Reminds booking contacts about confirmed events starting in the next 48 hours. */
  @Cron(CronExpression.EVERY_HOUR)
  async bookingReminders() {
    const now = new Date();
    const bookings = await this.prisma.booking.findMany({
      where: { status: BookingStatus.CONFIRMED, startTime: { gte: now, lte: new Date(now.getTime() + 2 * DAY) } },
      include: { eventSpace: true },
    });
    for (const b of bookings) {
      await this.messaging.notifyContact(
        { email: b.contactEmail, phone: b.contactPhone, emailOptIn: true, smsOptIn: !!b.contactPhone },
        `Reminder: ${b.title} at Historic Broyhill`,
        `Hello ${b.contactName}, this is a reminder that ${b.title} (${b.reference}) is booked in ${b.eventSpace.name} on ${b.startTime.toUTCString()}.`,
        `booking-reminder:${b.reference}`,
      );
    }
  }

  /** Check-in message to tenants whose lease ends within 90 days. */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async tenantLeaseCheckIns() {
    const now = new Date();
    const tenants = await this.prisma.tenant.findMany({
      where: { status: TenantStatus.ACTIVE, leaseEnd: { gte: now, lte: new Date(now.getTime() + 90 * DAY) } },
    });
    for (const t of tenants) {
      await this.messaging.notifyContact(
        { email: t.email, phone: t.phone, emailOptIn: t.emailOptIn, smsOptIn: t.smsOptIn, tenantId: t.id },
        'Checking in on your lease at Historic Broyhill',
        `Hello ${t.contactName}, your lease for ${t.companyName} ends on ${t.leaseEnd!.toDateString()}. Please contact us to discuss renewal or any needs.`,
        `lease-checkin:${t.id}:${t.leaseEnd!.toISOString().slice(0, 10)}`,
      );
    }
  }
}
