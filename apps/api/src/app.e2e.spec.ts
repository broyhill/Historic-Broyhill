import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { configureApp } from './setup';

// Runs against a real, dedicated PostgreSQL database (set DATABASE_URL). Skipped when it is not set.
const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb('Historic Broyhill API (end to end)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let adminToken: string;
  let staffToken: string;
  const run = Date.now().toString(36);
  const api = '/api/v1';
  const hour = 3_600_000;
  const start = new Date(Date.now() + 30 * 24 * hour);
  start.setUTCMinutes(0, 0, 0);
  const at = (h: number) => new Date(start.getTime() + h * hour).toISOString();

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-test-secret';
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer()) as unknown as ReturnType<typeof request>;

    const passwordHash = await bcrypt.hash('Test-Password-123', 4);
    await prisma.adminUser.create({ data: { email: `admin-${run}@test.dev`, name: 'Admin', role: 'ADMIN', passwordHash } });
    await prisma.adminUser.create({ data: { email: `staff-${run}@test.dev`, name: 'Staff', role: 'STAFF', passwordHash } });
    const login = async (email: string) =>
      (await request(app.getHttpServer()).post(`${api}/auth/login`).send({ email, password: 'Test-Password-123' }).expect(200)).body.accessToken as string;
    adminToken = await login(`admin-${run}@test.dev`);
    staffToken = await login(`staff-${run}@test.dev`);
  });

  afterAll(async () => {
    await prisma.adminUser.deleteMany({ where: { email: { endsWith: `${run}@test.dev` } } });
    await app.close();
  });

  const server = () => request(app.getHttpServer());
  const admin = (t = adminToken) => ({ Authorization: `Bearer ${t}` });

  it('reports health', async () => {
    await server().get(`${api}/health`).expect(200).expect((r) => expect(r.body.status).toBe('ok'));
  });

  describe('auth', () => {
    it('rejects bad credentials and missing tokens', async () => {
      await server().post(`${api}/auth/login`).send({ email: `admin-${run}@test.dev`, password: 'wrong-password' }).expect(401);
      await server().get(`${api}/admin/suites`).expect(401);
      await server().get(`${api}/admin/suites`).set({ Authorization: 'Bearer not-a-real-token' }).expect(401);
    });
    it('returns the current user', async () => {
      const r = await server().get(`${api}/auth/me`).set(admin()).expect(200);
      expect(r.body.email).toBe(`admin-${run}@test.dev`);
      expect(r.body.passwordHash).toBeUndefined();
    });
    it('limits destructive and user-management routes to admins', async () => {
      await server().get(`${api}/admin/users`).set(admin(staffToken)).expect(403);
      await server().get(`${api}/admin/users`).set(admin()).expect(200);
    });
  });

  describe('validation', () => {
    it('rejects unknown and invalid fields', async () => {
      await server().post(`${api}/public/inquiries`).send({ email: 'not-an-email', name: 'x', intentSubject: 'COMMERCIAL_LEASE' }).expect(400);
      await server().post(`${api}/public/inquiries`).send({ email: 'a@b.co', name: 'x', intentSubject: 'COMMERCIAL_LEASE', isAdmin: true }).expect(400);
    });
  });

  describe('suites, tenants and the waitlist', () => {
    let suiteId: string;
    it('staff manage suites', async () => {
      const r = await server().post(`${api}/admin/suites`).set(admin()).send({ number: `T-${run}`, floor: 2, squareFeet: 900, status: 'VACANT' }).expect(201);
      suiteId = r.body.id;
      await server().get(`${api}/public/suites?status=VACANT`).expect(200).expect((res) => {
        expect(res.body.data.some((s: { id: string }) => s.id === suiteId)).toBe(true);
        expect(res.body.data[0].tenant).toBeUndefined();
      });
    });
    it('an office inquiry is not waitlisted while a suite is vacant, and is once none are', async () => {
      const open = await server().post(`${api}/public/inquiries`).send({ email: `lead1-${run}@test.dev`, name: 'Lead One', intentSubject: 'COMMERCIAL_LEASE' }).expect(201);
      expect(open.body.onWaitlist).toBe(false);

      const tenant = await server().post(`${api}/admin/tenants`).set(admin()).send({ companyName: `Acme ${run}`, contactName: 'Ann', email: `ann-${run}@test.dev`, suiteId }).expect(201);
      expect((await prisma.suite.findUnique({ where: { id: suiteId } }))?.status).toBe('OCCUPIED');
      await server().post(`${api}/admin/tenants`).set(admin()).send({ companyName: 'Dup', contactName: 'Bob', email: `bob-${run}@test.dev`, suiteId }).expect(409);

      const full = await server().post(`${api}/public/inquiries`).send({ email: `lead2-${run}@test.dev`, name: 'Lead Two', intentSubject: 'COMMERCIAL_LEASE' }).expect(201);
      expect(full.body.onWaitlist).toBe(true);
      await server().get(`${api}/admin/leads?onWaitlist=true`).set(admin()).expect(200).expect((r) => expect(r.body.meta.total).toBeGreaterThan(0));

      await server().patch(`${api}/admin/tenants/${tenant.body.id}`).set(admin()).send({ status: 'FORMER' }).expect(200);
      expect((await prisma.suite.findUnique({ where: { id: suiteId } }))?.status).toBe('VACANT');
      await server().delete(`${api}/admin/tenants/${tenant.body.id}`).set(admin(staffToken)).expect(403);
      await server().delete(`${api}/admin/tenants/${tenant.body.id}`).set(admin()).expect(200);
      await server().delete(`${api}/admin/suites/${suiteId}`).set(admin()).expect(200);
    });
  });

  describe('tours', () => {
    it('visitors request a tour and staff confirm it', async () => {
      const r = await server().post(`${api}/public/appointments`).send({ name: 'Tour Person', email: `tour-${run}@test.dev`, startTime: at(2), endTime: at(3) }).expect(201);
      await server().post(`${api}/public/appointments`).send({ name: 'Bad', email: `tour-${run}@test.dev`, startTime: at(3), endTime: at(2) }).expect(400);
      await server().patch(`${api}/admin/appointments/${r.body.id}`).set(admin()).send({ status: 'CONFIRMED' }).expect(200).expect((res) => expect(res.body.status).toBe('CONFIRMED'));
    });
  });

  describe('event bookings, deposits and RSVPs', () => {
    let spaceId: string;
    let bookingId: string;
    let reference: string;

    it('lists a new event space publicly', async () => {
      const r = await server().post(`${api}/admin/event-spaces`).set(admin()).send({ name: `Hall ${run}`, capacity: 50, hourlyRate: 100 }).expect(201);
      spaceId = r.body.id;
      await server().get(`${api}/public/event-spaces`).expect(200).expect((res) => expect(res.body.some((s: { id: string }) => s.id === spaceId)).toBe(true));
    });

    it('quotes price and deposit', async () => {
      const r = await server().get(`${api}/public/bookings/quote`).query({ eventSpaceId: spaceId, startTime: at(10), endTime: at(14) }).expect(200);
      expect(r.body.totalAmount).toBe(400);
      expect(r.body.depositAmount).toBe(100);
    });

    it('creates a pending booking and blocks double booking', async () => {
      const body = { eventSpaceId: spaceId, title: 'Chamber Mixer', eventType: 'CHAMBER_OF_COMMERCE', startTime: at(10), endTime: at(14), expectedGuests: 30, contactName: 'Casey', contactEmail: `casey-${run}@test.dev` };
      const r = await server().post(`${api}/public/bookings`).send(body).expect(201);
      bookingId = r.body.id;
      reference = r.body.reference;
      expect(r.body.status).toBe('PENDING');
      await server().post(`${api}/public/bookings`).send({ ...body, startTime: at(12), endTime: at(16) }).expect(409);
      await server().post(`${api}/public/bookings`).send({ ...body, startTime: at(14), endTime: at(16) }).expect(201);
      await server().post(`${api}/public/bookings`).send({ ...body, startTime: at(30), endTime: at(32), expectedGuests: 500 }).expect(400);
    });

    it('exposes availability and limited public status', async () => {
      const a = await server().get(`${api}/public/event-spaces/${spaceId}/availability`).query({ from: at(0), to: at(48) }).expect(200);
      expect(a.body.busy.length).toBe(2);
      const s = await server().get(`${api}/public/bookings/${reference}`).expect(200);
      expect(s.body.contactEmail).toBeUndefined();
      expect(s.body.depositPaid).toBe(false);
    });

    it('does not allow RSVPs until confirmed', async () => {
      await server().post(`${api}/public/bookings/${reference}/rsvps`).send({ name: 'Early', email: `early-${run}@test.dev` }).expect(400);
    });

    it('staff confirm; guests RSVP; check-in works once', async () => {
      await server().post(`${api}/admin/bookings/${bookingId}/confirm`).set(admin()).expect(201).expect((r) => expect(r.body.status).toBe('CONFIRMED'));
      const rsvp = await server().post(`${api}/public/bookings/${reference}/rsvps`).send({ name: 'Guest', email: `guest-${run}@test.dev`, guests: 2 }).expect(201);
      const again = await server().post(`${api}/public/bookings/${reference}/rsvps`).send({ name: 'Guest', email: `guest-${run}@test.dev`, guests: 2 }).expect(201);
      expect(again.body.id).toBe(rsvp.body.id);
      await server().post(`${api}/public/bookings/${reference}/rsvps`).send({ name: 'Crowd', email: `crowd-${run}@test.dev`, guests: 20 }).expect(201);
      await server().post(`${api}/public/bookings/${reference}/rsvps`).send({ name: 'Crowd 2', email: `crowd2-${run}@test.dev`, guests: 20 }).expect(409);
      await server().post(`${api}/admin/rsvps/check-in`).set(admin()).send({ qrCodeToken: rsvp.body.qrCodeToken }).expect(201);
      await server().post(`${api}/admin/rsvps/check-in`).set(admin()).send({ qrCodeToken: rsvp.body.qrCodeToken }).expect(409);
      await server().get(`${api}/admin/bookings/${bookingId}/rsvps`).set(admin()).expect(200).expect((r) => expect(r.body.length).toBe(2));
    });

    it('creates a deposit, records a balance payment, and refunds', async () => {
      const d = await server().post(`${api}/public/bookings/${reference}/deposit`).expect(201);
      expect(d.body.amount).toBe(100);
      expect(d.body.provider).toBe('manual');
      const pay = await server().post(`${api}/admin/bookings/${bookingId}/payments`).set(admin()).send({ amount: 300 }).expect(201);
      await server().post(`${api}/admin/payments/${pay.body.id}/refund`).set(admin()).expect(201).expect((r) => expect(r.body.status).toBe('REFUNDED'));
      await server().get(`${api}/admin/payments`).set(admin()).expect(200);
    });

    it('cancelling frees the time slot', async () => {
      await server().post(`${api}/admin/bookings/${bookingId}/cancel`).set(admin()).expect(201);
      await server().post(`${api}/public/bookings`).send({ eventSpaceId: spaceId, title: 'Retry', startTime: at(10), endTime: at(13), contactName: 'Dee', contactEmail: `dee-${run}@test.dev` }).expect(201);
    });
  });

  describe('messaging and dashboard', () => {
    it('logs messages even when providers are not configured', async () => {
      const r = await server().post(`${api}/admin/messages/send`).set(admin()).send({ channel: 'EMAIL', to: `x-${run}@test.dev`, subject: 'Hi', body: 'Hello' }).expect(201);
      expect(['SKIPPED', 'SENT']).toContain(r.body.status);
      await server().get(`${api}/admin/messages?channel=EMAIL`).set(admin()).expect(200);
      await server().post(`${api}/admin/messages/process-queue`).set(admin()).expect(201);
    });
    it('summarises operations', async () => {
      const r = await server().get(`${api}/admin/dashboard/summary`).set(admin()).expect(200);
      expect(r.body.suites).toHaveProperty('occupancyRate');
      expect(r.body.bookings).toHaveProperty('pendingApproval');
    });
  });
});
