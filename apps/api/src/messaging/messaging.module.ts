import { Global, Module } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';

@Global()
@Module({
  controllers: [MessagingController],
  providers: [MessagingService, AutomationService],
  exports: [MessagingService],
})
export class MessagingModule {}
