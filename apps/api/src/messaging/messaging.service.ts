import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageChannel, MessageLog, MessageStatus } from '@prisma/client';
import * as sgMail from '@sendgrid/mail';
import twilio from 'twilio';
import { PrismaService } from '../prisma/prisma.service';

export interface OutgoingMessage {
  channel: MessageChannel;
  to: string;
  subject?: string;
  body: string;
  template?: string;
  scheduledFor?: Date;
  leadId?: string;
  tenantId?: string;
}

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  private smsClient?: ReturnType<typeof twilio>;

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {
    const sendgridKey = config.get<string>('SENDGRID_API_KEY');
    if (sendgridKey) sgMail.setApiKey(sendgridKey);
    const sid = config.get<string>('TWILIO_ACCOUNT_SID');
    const token = config.get<string>('TWILIO_AUTH_TOKEN');
    if (sid && token) this.smsClient = twilio(sid, token);
  }

  /** Records the message and sends it right away unless it is scheduled for later. */
  async send(msg: OutgoingMessage): Promise<MessageLog> {
    const log = await this.prisma.messageLog.create({
      data: { ...msg, scheduledFor: msg.scheduledFor ?? new Date(), status: MessageStatus.QUEUED },
    });
    return log.scheduledFor <= new Date() ? this.deliver(log) : log;
  }

  /** Same as send, but a no-op if a message with this template key was already sent to the recipient. */
  async sendOnce(msg: OutgoingMessage & { template: string }): Promise<MessageLog | null> {
    const existing = await this.prisma.messageLog.findFirst({
      where: { template: msg.template, to: msg.to, status: { in: [MessageStatus.QUEUED, MessageStatus.SENT] } },
    });
    return existing ? null : this.send(msg);
  }

  async deliver(log: MessageLog): Promise<MessageLog> {
    let status: MessageStatus = MessageStatus.SENT;
    let error: string | null = null;
    try {
      if (log.channel === MessageChannel.EMAIL) {
        const from = this.config.get<string>('MAIL_FROM');
        if (!this.config.get('SENDGRID_API_KEY') || !from) {
          status = MessageStatus.SKIPPED;
          error = 'Email provider not configured (SENDGRID_API_KEY, MAIL_FROM)';
        } else {
          await sgMail.send({ to: log.to, from, subject: log.subject ?? 'Historic Broyhill', text: log.body });
        }
      } else {
        const from = this.config.get<string>('TWILIO_FROM_NUMBER');
        if (!this.smsClient || !from) {
          status = MessageStatus.SKIPPED;
          error = 'SMS provider not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)';
        } else {
          await this.smsClient.messages.create({ to: log.to, from, body: log.body });
        }
      }
    } catch (e) {
      status = MessageStatus.FAILED;
      error = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Message ${log.id} failed: ${error}`);
    }
    return this.prisma.messageLog.update({
      where: { id: log.id },
      data: { status, error, sentAt: status === MessageStatus.SENT ? new Date() : null },
    });
  }

  /** Delivers every queued message that is due. */
  async processQueue(): Promise<{ processed: number }> {
    const due = await this.prisma.messageLog.findMany({
      where: { status: MessageStatus.QUEUED, scheduledFor: { lte: new Date() } },
      take: 200,
      orderBy: { scheduledFor: 'asc' },
    });
    for (const log of due) await this.deliver(log);
    return { processed: due.length };
  }

  /** Email (and SMS when opted in) to a contact, using a shared subject/body. */
  async notifyContact(
    c: { email: string; phone?: string | null; emailOptIn?: boolean; smsOptIn?: boolean; leadId?: string; tenantId?: string },
    subject: string,
    body: string,
    template?: string,
  ) {
    const base = { leadId: c.leadId, tenantId: c.tenantId };
    const send = (m: OutgoingMessage) => (template ? this.sendOnce({ ...m, template: `${template}:${m.channel}` }) : this.send(m));
    if (c.emailOptIn !== false) await send({ ...base, channel: MessageChannel.EMAIL, to: c.email, subject, body });
    if (c.smsOptIn && c.phone) await send({ ...base, channel: MessageChannel.SMS, to: c.phone, body });
  }
}
