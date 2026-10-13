import { Module } from '@nestjs/common';
import { EventSpacesController } from './event-spaces.controller';
import { EventSpacesService } from './event-spaces.service';

@Module({ controllers: [EventSpacesController], providers: [EventSpacesService], exports: [EventSpacesService] })
export class EventSpacesModule {}
