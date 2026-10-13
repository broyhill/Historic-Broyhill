import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus, PaymentType } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingService } from '../messaging/messaging.service';

@Injectable()
export class PaymentsService {
  private readonly stripe?: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly messaging: MessagingService,
  ) {
    const key = config.get<string>('STRIPE_SECRET_KEY');
    if (key) this.stripe = new Stripe(key);
  }

  /** Creates a pending deposit payment for the booking; returns a Stripe client secret when Stripe is configured. */
  async createDeposit(reference: string) {
    const booking = await this.prisma.booking.findUnique({ where: { reference } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status === 'CANCELLED') throw new BadRequestException('Booking is cancelled');
    if (booking.depositAmount <= 0) throw new BadRequestException('This booking has no deposit due');

    const paid = await this.prisma.payment.findFirst({
      where: { bookingId: booking.id, type: PaymentType.DEPOSIT, status: PaymentStatus.SUCCEEDED },
    });
    if (paid) throw new BadRequestException('Deposit already paid');

    let providerRef: string | null = null;
    let clientSecret: string | null = null;
    if (this.stripe) {
      const intent = await this.stripe.paymentIntents.create({
        amount: Math.round(booking.depositAmount * 100),
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        receipt_email: booking.contactEmail,
        metadata: { bookingReference: booking.reference },
      });
      providerRef = intent.id;
      clientSecret = intent.client_secret;
    }
    const payment = await this.prisma.payment.create({
      data: {
        bookingId: booking.id,
        type: PaymentType.DEPOSIT,
        amount: booking.depositAmount,
        provider: this.stripe ? 'stripe' : 'manual',
        providerRef,
      },
    });
    return { paymentId: payment.id, amount: payment.amount, currency: payment.currency, provider: payment.provider, clientSecret };
  }

  /** Verifies and applies a Stripe webhook event. */
  async handleStripeWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!this.stripe || !secret) throw new BadRequestException('Stripe webhooks are not configured');
    if (!rawBody || !signature) throw new BadRequestException('Missing payload or signature');
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      throw new BadRequestException('Invalid Stripe signature');
    }
    if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const status = event.type === 'payment_intent.succeeded' ? PaymentStatus.SUCCEEDED : PaymentStatus.FAILED;
      const payment = await this.prisma.payment.findFirst({ where: { providerRef: intent.id }, include: { booking: true } });
      if (payment && payment.status !== status) {
        await this.prisma.payment.update({ where: { id: payment.id }, data: { status } });
        if (status === PaymentStatus.SUCCEEDED) {
          await this.messaging.notifyContact(
            { email: payment.booking.contactEmail, phone: payment.booking.contactPhone, smsOptIn: !!payment.booking.contactPhone },
            `Payment received for ${payment.booking.title}`,
            `Thank you ${payment.booking.contactName}. We received your ${payment.type.toLowerCase()} of $${payment.amount.toFixed(2)} for booking ${payment.booking.reference}.`,
            `payment-received:${payment.id}`,
          );
        }
      }
    }
    return { received: true };
  }

  /** Staff records a payment taken outside the website (check, cash, card on site). */
  async recordManual(bookingId: string, amount: number, type: PaymentType) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    return this.prisma.payment.create({
      data: { bookingId, amount, type, status: PaymentStatus.SUCCEEDED, provider: 'manual' },
    });
  }

  async refund(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentStatus.SUCCEEDED) throw new BadRequestException('Only succeeded payments can be refunded');
    if (payment.provider === 'stripe' && payment.providerRef) {
      if (!this.stripe) throw new BadRequestException('Stripe is not configured');
      await this.stripe.refunds.create({ payment_intent: payment.providerRef });
    }
    return this.prisma.payment.update({ where: { id: paymentId }, data: { status: PaymentStatus.REFUNDED } });
  }
}
