import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminOnly, Roles } from '../common/auth';
import { CreateSuiteDto, SuiteListQuery, UpdateSuiteDto } from './suites.dto';
import { SuitesService } from './suites.service';

@ApiTags('Admin - Suites')
@AdminOnly()
@Controller('admin/suites')
export class SuitesController {
  constructor(private readonly suites: SuitesService) {}

  @Get() list(@Query() q: SuiteListQuery) { return this.suites.list(q); }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string) { return this.suites.get(id); }
  @Post() create(@Body() dto: CreateSuiteDto) { return this.suites.create(dto); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSuiteDto) { return this.suites.update(id, dto); }
  @Delete(':id') @Roles('ADMIN') remove(@Param('id', ParseUUIDPipe) id: string) { return this.suites.remove(id); }
}
