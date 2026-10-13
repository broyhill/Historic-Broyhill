import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';

@ApiTags('Public - Webhooks')
@Controller('public/webhooks')
export class StripeWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('stripe')
  @HttpCode(200)
  @SkipThrottle()
  stripe(@Req() req: { rawBody?: Buffer }, @Headers('stripe-signature') signature?: string) {
    return this.payments.handleStripeWebhook(req.rawBody, signature);
  }
}
