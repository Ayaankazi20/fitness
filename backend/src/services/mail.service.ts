import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

export interface Mailer { send(to: string, subject: string, text: string): Promise<void> }

/** Real delivery through any SMTP provider (SMTP_URL=smtps://user:pass@host:465). */
export class SmtpMailer implements Mailer {
  private t = nodemailer.createTransport(env.SMTP_URL!);
  async send(to: string, subject: string, text: string) { await this.t.sendMail({ from: env.MAIL_FROM, to, subject, text }); }
}
/** DEVELOPMENT ONLY: prints the email to the server log instead of sending it. Used when SMTP_URL is unset (production refuses to start without SMTP_URL). */
export class ConsoleMailer implements Mailer {
  async send(to: string, subject: string, text: string) { console.log(`\n[dev mail] to=${to} subject="${subject}"\n${text}\n`); }
}

let mailer: Mailer | null = null;
export const getMailer = (): Mailer => (mailer ??= env.SMTP_URL ? new SmtpMailer() : new ConsoleMailer());
export const setMailer = (m: Mailer | null) => { mailer = m; };
