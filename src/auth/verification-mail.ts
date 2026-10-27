import nodemailer from 'nodemailer';
import { verificationUrl } from './email-verification';

function smtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM?.trim();
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password || !from) return null;
  return { host, port, user, password, from };
}

export function verificationMailConfigured() {
  return smtpConfig() !== null;
}

async function sendMail(email: string, subject: string, text: string) {
  const config = smtpConfig();
  if (!config) throw new Error('SMTP verification email is not configured');
  const transport = nodemailer.createTransport({
    host: config.host, port: config.port, secure: config.port === 465,
    requireTLS: config.port !== 465 && !['localhost', '127.0.0.1', '::1'].includes(config.host),
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 10_000,
  });
  const result = await transport.sendMail({
    from: config.from, to: email,
    subject, text,
  });
  if (!result.accepted.some(address => (typeof address === 'string' ? address : address.address).toLowerCase() === email)) {
    throw new Error('SMTP server did not accept the verification recipient');
  }
}

export async function sendVerificationEmail(email: string, token: string) {
  const link = verificationUrl(token);
  return sendMail(email, 'Verify your VinAthletics account',
    `Open this link to verify your email and access your member dashboard:\n\n${link}\n\nThis link expires in 24 hours. If you did not register, ignore this message.`);
}

export async function sendEmailChangeVerification(email: string, token: string) {
  const url = new URL('/api/member/email', process.env.NEXTAUTH_URL ?? 'http://localhost:3000');
  url.searchParams.set('token', token);
  return sendMail(email, 'Confirm your new VinAthletics email address',
    `Open this link to confirm your new email address:\n\n${url}\n\nThis link expires in 24 hours. If you did not request this change, ignore this message.`);
}
