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

export async function sendVerificationEmail(email: string, token: string) {
  const config = smtpConfig();
  if (!config) throw new Error('SMTP verification email is not configured');
  const transport = nodemailer.createTransport({
    host: config.host, port: config.port, secure: config.port === 465,
    requireTLS: config.port !== 465 && !['localhost', '127.0.0.1', '::1'].includes(config.host),
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 10_000,
  });
  const link = verificationUrl(token);
  const result = await transport.sendMail({
    from: config.from, to: email,
    subject: 'Verify your VinAthletics account',
<<<<<<< HEAD
    text: `Open this link to verify your email and access your member dashboard:\n\n${link}\n\nThis link expires in 24 hours. If you did not register, ignore this message.`,
=======
    text: `Open this link to verify your VinAthletics email address:\n\n${link}\n\nThis link expires in 24 hours. If you did not register, ignore this message.`,
>>>>>>> 9f37355 (fixed login and verified user roles ui and added users in the database)
  });
  if (!result.accepted.some(address => (typeof address === 'string' ? address : address.address).toLowerCase() === email)) {
    throw new Error('SMTP server did not accept the verification recipient');
  }
}
