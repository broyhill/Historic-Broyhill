import { NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth/password';
import { createSessionToken, SESSION_MAX_AGE_SECONDS } from '@/lib/auth/session';
import { ACTIVE_SILO_COOKIE, SESSION_COOKIE } from '@/lib/config';
import { errorResponse, json, readJson } from '@/lib/api';
import { normalizeEmail } from '@/lib/identity';
import { prisma } from '@/lib/prisma';

const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };

// Staff log in to a silo (Campaign Monitor client sub-account login). Agency admins log in to
// the default silo and switch from the console.
export async function POST(request: Request) {
  try {
    const secret = process.env.WIZARD_SESSION_SECRET;
    if (!secret || secret.length < 32) return json({ error: 'Sign-in is not configured' }, 503);
    const body = await readJson(request);
    const slug = typeof body.siloSlug === 'string' ? body.siloSlug.trim().toLowerCase() : '';
    const email = normalizeEmail(body.email);
    const password = typeof body.password === 'string' ? body.password : '';
    const silo = slug ? await prisma.candidateSilo.findUnique({ where: { slug } }) : null;
    const user = silo && email ? await prisma.candidateUser.findUnique({ where: { candidateId_email: { candidateId: silo.id, email } } }) : null;
    // Same response for unknown silo, unknown user and wrong password.
    if (!user || !silo || !(await verifyPassword(password, user.passwordHash))) return json({ error: 'Invalid credentials' }, 401);

    const token = await createSessionToken({ uid: user.id, cid: user.candidateId, role: user.role, principal: user.isCandidatePrincipal }, secret);
    const response = json({ ok: true, role: user.role, silo: silo.slug });
    response.cookies.set(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_MAX_AGE_SECONDS });
    response.cookies.set(ACTIVE_SILO_COOKIE, silo.slug, { ...cookieOptions, maxAge: SESSION_MAX_AGE_SECONDS });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', { ...cookieOptions, maxAge: 0 });
  response.cookies.set(ACTIVE_SILO_COOKIE, '', { ...cookieOptions, maxAge: 0 });
  return response;
}
