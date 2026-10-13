import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminOnly, Roles } from '../common/auth';
import { CreateTenantDto, TenantListQuery, UpdateTenantDto } from './tenants.dto';
import { TenantsService } from './tenants.service';

@ApiTags('Admin - Tenants')
@AdminOnly()
@Controller('admin/tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get() list(@Query() q: TenantListQuery) { return this.tenants.list(q); }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string) { return this.tenants.get(id); }
  @Post() create(@Body() dto: CreateTenantDto) { return this.tenants.create(dto); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTenantDto) { return this.tenants.update(id, dto); }
  @Delete(':id') @Roles('ADMIN') remove(@Param('id', ParseUUIDPipe) id: string) { return this.tenants.remove(id); }
}
