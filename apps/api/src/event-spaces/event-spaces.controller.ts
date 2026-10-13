import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminOnly, Roles } from '../common/auth';
import { CreateEventSpaceDto, UpdateEventSpaceDto } from './event-spaces.dto';
import { EventSpacesService } from './event-spaces.service';

@ApiTags('Admin - Event Spaces')
@AdminOnly()
@Controller('admin/event-spaces')
export class EventSpacesController {
  constructor(private readonly spaces: EventSpacesService) {}

  @Get() list() { return this.spaces.list(); }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string) { return this.spaces.get(id); }
  @Post() create(@Body() dto: CreateEventSpaceDto) { return this.spaces.create(dto); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEventSpaceDto) { return this.spaces.update(id, dto); }
  @Delete(':id') @Roles('ADMIN') remove(@Param('id', ParseUUIDPipe) id: string) { return this.spaces.remove(id); }
}
