import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SuiteStatus, TenantStatus } from '@prisma/client';
import { pageArgs, paged } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto, TenantListQuery, UpdateTenantDto } from './tenants.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: TenantListQuery) {
    const where: Prisma.TenantWhereInput = {
      status: q.status,
      ...(q.search && { OR: [
        { companyName: { contains: q.search, mode: 'insensitive' } },
        { contactName: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
      ] }),
    };
    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({ where, include: { suite: true }, orderBy: { companyName: 'asc' }, ...pageArgs(q) }),
      this.prisma.tenant.count({ where }),
    ]);
    return paged(data, total, q);
  }

  async get(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id }, include: { suite: true, messages: { orderBy: { createdAt: 'desc' }, take: 20 } } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  private dates(dto: { leaseStart?: string; leaseEnd?: string }) {
    return {
      leaseStart: dto.leaseStart ? new Date(dto.leaseStart) : undefined,
      leaseEnd: dto.leaseEnd ? new Date(dto.leaseEnd) : undefined,
    };
  }

  /** Assigns a suite to a tenant, marks it occupied, and frees the tenant's previous suite. */
  private async assignSuite(tx: Prisma.TransactionClient, tenantId: string | null, suiteId: string) {
    const suite = await tx.suite.findUnique({ where: { id: suiteId }, include: { tenant: true } });
    if (!suite) throw new NotFoundException('Suite not found');
    if (suite.tenant && suite.tenant.id !== tenantId) throw new ConflictException(`Suite ${suite.number} already has a tenant`);
    await tx.suite.update({ where: { id: suiteId }, data: { status: SuiteStatus.OCCUPIED } });
  }

  create(dto: CreateTenantDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.suiteId) await this.assignSuite(tx, null, dto.suiteId);
      return tx.tenant.create({ data: { ...dto, ...this.dates(dto) } });
    });
  }

  async update(id: string, dto: UpdateTenantDto) {
    const current = await this.get(id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.suiteId && dto.suiteId !== current.suiteId) {
        await this.assignSuite(tx, id, dto.suiteId);
        if (current.suiteId) await tx.suite.update({ where: { id: current.suiteId }, data: { status: SuiteStatus.VACANT } });
      }
      const data = { ...dto, ...this.dates(dto) };
      const updated = await tx.tenant.update({ where: { id }, data });
      if (dto.status === TenantStatus.FORMER && updated.suiteId) {
        await tx.suite.update({ where: { id: updated.suiteId }, data: { status: SuiteStatus.VACANT } });
        await tx.tenant.update({ where: { id }, data: { suiteId: null } });
      }
      return tx.tenant.findUnique({ where: { id }, include: { suite: true } });
    });
  }

  async remove(id: string) {
    const tenant = await this.get(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.messageLog.updateMany({ where: { tenantId: id }, data: { tenantId: null } });
      await tx.tenant.delete({ where: { id } });
      if (tenant.suiteId) await tx.suite.update({ where: { id: tenant.suiteId }, data: { status: SuiteStatus.VACANT } });
    });
    return { deleted: true };
  }
}
