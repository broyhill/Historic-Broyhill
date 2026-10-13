import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SuiteStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AppointmentsService } from '../appointments/appointments.service';
import { RequestAppointmentDto } from '../appointments/appointments.dto';
import { AvailabilityQuery, CreateBookingDto, CreateRsvpDto, QuoteQuery } from '../bookings/bookings.dto';
import { BookingsService } from '../bookings/bookings.service';
import { PaginationQuery } from '../common/pagination';
import { EventSpacesService } from '../event-spaces/event-spaces.service';
import { InquiryDto } from '../leads/leads.dto';
import { LeadsService } from '../leads/leads.service';
import { PaymentsService } from '../payments/payments.service';
import { SuitesService } from '../suites/suites.service';

class PublicSuiteQuery extends PaginationQuery {
  @IsOptional() @IsEnum(SuiteStatus) status?: SuiteStatus;
}

class CancelRsvpDto {
  @IsString() qrCodeToken: string;
}

@ApiTags('Public - Suites')
@Controller('public/suites')
export class PublicSuitesController {
  constructor(private readonly suites: SuitesService) {}
  @Get() list(@Query() q: PublicSuiteQuery) { return this.suites.listPublic(q); }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string) { return this.suites.getPublic(id); }
}

@ApiTags('Public - Event Spaces')
@Controller('public/event-spaces')
export class PublicEventSpacesController {
  constructor(private readonly spaces: EventSpacesService) {}
  @Get() list() { return this.spaces.list(true); }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string) { return this.spaces.get(id); }
  @Get(':id/availability')
  availability(@Param('id', ParseUUIDPipe) id: string, @Query() q: AvailabilityQuery) {
    return this.spaces.availability(id, new Date(q.from), new Date(q.to));
  }
}

@ApiTags('Public - Inquiries')
@Controller('public/inquiries')
export class PublicInquiriesController {
  constructor(private readonly leads: LeadsService) {}
  /** Office space inquiry (auto-waitlists when fully leased) or event inquiry. */
  @Post() submit(@Body() dto: InquiryDto) { return this.leads.submitInquiry(dto); }
}

@ApiTags('Public - Appointments')
@Controller('public/appointments')
export class PublicAppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}
  @Post() request(@Body() dto: RequestAppointmentDto) { return this.appointments.request(dto); }
}

@ApiTags('Public - Bookings')
@Controller('public/bookings')
export class PublicBookingsController {
  constructor(private readonly bookings: BookingsService, private readonly payments: PaymentsService) {}

  @Get('quote') quote(@Query() q: QuoteQuery) { return this.bookings.quote(q.eventSpaceId, q.startTime, q.endTime); }
  @Post() create(@Body() dto: CreateBookingDto) { return this.bookings.create(dto); }
  @Get(':reference') get(@Param('reference') reference: string) { return this.bookings.getPublic(reference); }
  @Post(':reference/deposit') deposit(@Param('reference') reference: string) { return this.payments.createDeposit(reference); }
  @Post(':reference/rsvps') rsvp(@Param('reference') reference: string, @Body() dto: CreateRsvpDto) { return this.bookings.rsvp(reference, dto); }
  @Delete(':reference/rsvps') cancelRsvp(@Param('reference') reference: string, @Body() dto: CancelRsvpDto) { return this.bookings.cancelRsvp(reference, dto.qrCodeToken); }
}
