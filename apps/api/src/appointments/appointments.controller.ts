import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../common/auth';
import { AppointmentListQuery, UpdateAppointmentDto } from './appointments.dto';
import { AppointmentsService } from './appointments.service';

@ApiTags('Admin - Appointments')
@AdminOnly()
@Controller('admin/appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get() list(@Query() q: AppointmentListQuery) { return this.appointments.list(q); }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string) { return this.appointments.get(id); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAppointmentDto) { return this.appointments.update(id, dto); }
}
