import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppointmentStatus, BookingStatus, MessageStatus, PaymentStatus, SuiteStatus, TenantStatus } from '@prisma/client';
import { AdminOnly } from '../common/auth';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const now = new Date();
    const in90 = new Date(now.getTime() + 90 * 86_400_000);
    const [suitesByStatus, activeTenants, leaseEndingSoon, newLeads, waitlist, pendingTours, upcomingTours, pendingBookings, upcomingBookings, deposits, failedMessages] =
      await Promise.all([
        this.prisma.suite.groupBy({ by: ['status'], _count: true }),
        this.prisma.tenant.count({ where: { status: TenantStatus.ACTIVE } }),
        this.prisma.tenant.count({ where: { status: TenantStatus.ACTIVE, leaseEnd: { gte: now, lte: in90 } } }),
        this.prisma.leadProfile.count({ where: { createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } } }),
        this.prisma.leadProfile.count({ where: { onWaitlist: true } }),
        this.prisma.appointment.count({ where: { status: AppointmentStatus.REQUESTED } }),
        this.prisma.appointment.findMany({ where: { status: AppointmentStatus.CONFIRMED, startTime: { gte: now } }, orderBy: { startTime: 'asc' }, take: 5 }),
        this.prisma.booking.count({ where: { status: BookingStatus.PENDING } }),
        this.prisma.booking.findMany({
          where: { status: BookingStatus.CONFIRMED, startTime: { gte: now } }, orderBy: { startTime: 'asc' }, take: 5,
          include: { eventSpace: { select: { name: true } } },
        }),
        this.prisma.payment.aggregate({ where: { status: PaymentStatus.SUCCEEDED, type: { not: 'REFUND' } }, _sum: { amount: true } }),
        this.prisma.messageLog.count({ where: { status: MessageStatus.FAILED } }),
      ]);
    const counts = Object.fromEntries(Object.values(SuiteStatus).map((s) => [s, suitesByStatus.find((x) => x.status === s)?._count ?? 0]));
    const totalSuites = Object.values(counts).reduce((a, b) => a + b, 0);
    return {
      suites: { total: totalSuites, ...counts, occupancyRate: totalSuites ? Math.round(((counts.OCCUPIED as number) / totalSuites) * 1000) / 10 : 0 },
      tenants: { active: activeTenants, leasesEndingWithin90Days: leaseEndingSoon },
      leads: { newLast30Days: newLeads, waitlist },
      appointments: { pendingRequests: pendingTours, upcoming: upcomingTours },
      bookings: { pendingApproval: pendingBookings, upcoming: upcomingBookings },
      payments: { totalCollected: deposits._sum.amount ?? 0 },
      messages: { failed: failedMessages },
    };
  }
}

@ApiTags('Admin - Dashboard')
@AdminOnly()
@Controller('admin/dashboard')
class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get('summary') summary() { return this.dashboard.summary(); }
}

@Module({ controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
