import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  SERVER_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  OSS_REGION: z.string().min(1),
  OSS_BUCKET: z.string().min(1),
  OSS_ENDPOINT: z.string().optional(),
  OSS_ACCESS_KEY_ID: z.string().min(1),
  OSS_ACCESS_KEY_SECRET: z.string().min(1),
  OSS_CDN_URL: z.string().optional(),
  SMTP_HOST: z.string().min(1).default('smtp.qq.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  MIMO_API_KEY: z.string().optional(),
  MIMO_BASE_URL: z.string().default('https://token-plan-cn.xiaomimimo.com/anthropic'),
  MIMO_MODEL: z.string().default('mimo-v2.5-pro'),
});

export type Env = {
  serverPort: number;
  databaseUrl: string;
  jwtSecret: string;
  oss: {
    region: string;
    bucket: string;
    endpoint: string;
    accessKeyId: string;
    accessKeySecret: string;
    cdnUrl: string;
  };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  };
  mimo: {
    apiKey: string;
    baseUrl: string;
    model: string;
  };
};

export const parseEnv = (rawEnv: NodeJS.ProcessEnv): Env => {
  const parsed = envSchema.parse(rawEnv);

  return {
    serverPort: parsed.SERVER_PORT,
    databaseUrl: parsed.DATABASE_URL,
    jwtSecret: parsed.JWT_SECRET,
    oss: {
      region: parsed.OSS_REGION,
      bucket: parsed.OSS_BUCKET,
      endpoint: parsed.OSS_ENDPOINT ?? '',
      accessKeyId: parsed.OSS_ACCESS_KEY_ID,
      accessKeySecret: parsed.OSS_ACCESS_KEY_SECRET,
      cdnUrl: parsed.OSS_CDN_URL ?? '',
    },
    smtp: {
      host: parsed.SMTP_HOST,
      port: parsed.SMTP_PORT,
      secure: parsed.SMTP_SECURE,
      user: parsed.SMTP_USER ?? '',
      pass: parsed.SMTP_PASS ?? '',
      from: parsed.SMTP_FROM ?? parsed.SMTP_USER ?? '',
    },
    mimo: {
      apiKey: parsed.MIMO_API_KEY ?? '',
      baseUrl: parsed.MIMO_BASE_URL,
      model: parsed.MIMO_MODEL,
    },
  };
};

export const env = parseEnv(process.env);
