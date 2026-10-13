import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../common/auth';
import { BookingListQuery, CheckInDto, CreateBookingDto, UpdateBookingDto } from './bookings.dto';
import { BookingsService } from './bookings.service';

@ApiTags('Admin - Bookings')
@AdminOnly()
@Controller('admin')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get('bookings') list(@Query() q: BookingListQuery) { return this.bookings.list(q); }
  @Get('bookings/:id') get(@Param('id', ParseUUIDPipe) id: string) { return this.bookings.get(id); }
  @Post('bookings') create(@Body() dto: CreateBookingDto) { return this.bookings.create(dto, { allowPast: true }); }
  @Patch('bookings/:id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBookingDto) { return this.bookings.update(id, dto); }
  @Post('bookings/:id/confirm') confirm(@Param('id', ParseUUIDPipe) id: string) { return this.bookings.confirm(id); }
  @Post('bookings/:id/cancel') cancel(@Param('id', ParseUUIDPipe) id: string) { return this.bookings.cancel(id); }
  @Get('bookings/:id/rsvps') rsvps(@Param('id', ParseUUIDPipe) id: string) { return this.bookings.listRsvps(id); }
  @Post('rsvps/check-in') checkIn(@Body() dto: CheckInDto) { return this.bookings.checkIn(dto.qrCodeToken); }
}
