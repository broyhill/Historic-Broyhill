import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminOnly, Roles } from '../common/auth';
import { AddActivityDto, CreateLeadDto, LeadListQuery, UpdateLeadDto } from './leads.dto';
import { LeadsService } from './leads.service';

@ApiTags('Admin - Leads (CRM)')
@AdminOnly()
@Controller('admin/leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get() list(@Query() q: LeadListQuery) { return this.leads.list(q); }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string) { return this.leads.get(id); }
  @Post() create(@Body() dto: CreateLeadDto) { return this.leads.create(dto); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadDto) { return this.leads.update(id, dto); }
  @Delete(':id') @Roles('ADMIN') remove(@Param('id', ParseUUIDPipe) id: string) { return this.leads.remove(id); }
  @Post(':id/activities') addActivity(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddActivityDto) { return this.leads.addActivity(id, dto); }
}
