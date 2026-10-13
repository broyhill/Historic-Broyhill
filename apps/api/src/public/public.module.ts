import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { BookingsModule } from '../bookings/bookings.module';
import { EventSpacesModule } from '../event-spaces/event-spaces.module';
import { LeadsModule } from '../leads/leads.module';
import { SuitesModule } from '../suites/suites.module';
import {
  PublicAppointmentsController, PublicBookingsController, PublicEventSpacesController, PublicInquiriesController, PublicSuitesController,
} from './public.controller';

@Module({
  imports: [SuitesModule, EventSpacesModule, LeadsModule, AppointmentsModule, BookingsModule],
  controllers: [PublicSuitesController, PublicEventSpacesController, PublicInquiriesController, PublicAppointmentsController, PublicBookingsController],
})
export class PublicModule {}
