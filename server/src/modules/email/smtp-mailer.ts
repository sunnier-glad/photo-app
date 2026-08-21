import nodemailer from 'nodemailer';
import type { Env } from '../../config/env.js';
import { HttpError } from '../../common/http-error.js';
import type { AuthEmailSender } from '../auth/auth.service.js';

export const createSmtpEmailSender = (config: Env['smtp']): AuthEmailSender => {
  if (!config.user || !config.pass || !config.from) {
    return {
      async sendVerificationCode() {
        throw new HttpError(503, 'SMTP_NOT_CONFIGURED', 'SMTP email service is not configured');
      },
    };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  return {
    async sendVerificationCode(email, code) {
      await transporter.sendMail({
        from: config.from,
        to: email,
        subject: '拾忆相册邮箱验证码',
        text: `你的拾忆相册验证码是 ${code}，10 分钟内有效。`,
        html: `<p>你的拾忆相册验证码是 <strong>${code}</strong>，10 分钟内有效。</p>`,
      });
    },
  };
};
