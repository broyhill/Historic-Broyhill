import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SuiteStatus } from '@prisma/client';
import { PaginationQuery, pageArgs, paged } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSuiteDto, SuiteListQuery, UpdateSuiteDto } from './suites.dto';

@Injectable()
export class SuitesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: SuiteListQuery) {
    const where: Prisma.SuiteWhereInput = { status: q.status, floor: q.floor };
    const [data, total] = await Promise.all([
      this.prisma.suite.findMany({ where, include: { tenant: { select: { id: true, companyName: true } } }, orderBy: { number: 'asc' }, ...pageArgs(q) }),
      this.prisma.suite.count({ where }),
    ]);
    return paged(data, total, q);
  }

  async get(id: string) {
    const suite = await this.prisma.suite.findUnique({ where: { id }, include: { tenant: true } });
    if (!suite) throw new NotFoundException('Suite not found');
    return suite;
  }

  create(dto: CreateSuiteDto) {
    return this.prisma.suite.create({ data: dto });
  }

  async update(id: string, dto: UpdateSuiteDto) {
    await this.get(id);
    return this.prisma.suite.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.suite.delete({ where: { id } });
    return { deleted: true };
  }

  /** Public view: no tenant details, never exposes occupant information. */
  async listPublic(q: PaginationQuery & { status?: SuiteStatus }) {
    const where: Prisma.SuiteWhereInput = { status: q.status };
    const select = { id: true, number: true, floor: true, squareFeet: true, monthlyRate: true, status: true, description: true, featured: true };
    const [data, total] = await Promise.all([
      this.prisma.suite.findMany({ where, select, orderBy: { number: 'asc' }, ...pageArgs(q) }),
      this.prisma.suite.count({ where }),
    ]);
    return paged(data, total, q);
  }

  async getPublic(id: string) {
    const suite = await this.prisma.suite.findUnique({
      where: { id },
      select: { id: true, number: true, floor: true, squareFeet: true, monthlyRate: true, status: true, description: true, featured: true },
    });
    if (!suite) throw new NotFoundException('Suite not found');
    return suite;
  }
}
