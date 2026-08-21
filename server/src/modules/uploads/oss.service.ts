import OSS from 'ali-oss';
import type { Env } from '../../config/env.js';

export type CreateImageUploadTokenInput = {
  objectKey: string;
  mimeType: string;
  size: number;
};

export type ImageUploadToken = {
  host: string;
  objectKey: string;
  policy: string;
  signature: string;
  accessKeyId: string;
  xOssDate: string;
  xOssCredential: string;
  signatureVersion: string;
  successActionStatus: string;
};

type OssClientLike = {
  signPostObjectPolicyV4(policy: Record<string, unknown>, date: Date): string;
  signatureUrl?(objectKey: string, options?: { expires?: number }): string;
  delete(objectKey: string): Promise<unknown>;
};

const trimSlashes = (value: string) => value.replace(/^https?:\/\//, '').replace(/\/+$/, '');
const padDatePart = (value: number) => String(value).padStart(2, '0');
const toOssDate = (date: Date) =>
  `${date.getUTCFullYear()}${padDatePart(date.getUTCMonth() + 1)}${padDatePart(date.getUTCDate())}T${padDatePart(
    date.getUTCHours(),
  )}${padDatePart(date.getUTCMinutes())}${padDatePart(date.getUTCSeconds())}Z`;
const toBase64 = (value: string) => Buffer.from(value, 'utf8').toString('base64');
const getStandardRegion = (region: string) => region.replace(/^oss-/, '');
const ensureHttpsUrl = (url: string) => url.replace(/^http:\/\//i, 'https://');

const getOssDomain = (config: Env['oss']) => {
  const endpoint = config.endpoint.trim();

  if (endpoint) {
    return trimSlashes(endpoint);
  }

  return config.region.includes('.') ? trimSlashes(config.region) : `${config.region}.aliyuncs.com`;
};

export const createOssService = (
  config: Env['oss'],
  createClient: () => OssClientLike = () =>
    new OSS({
      region: config.region,
      endpoint: config.endpoint.trim() || undefined,
      bucket: config.bucket,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      authorizationV4: true,
    }) as unknown as OssClientLike,
  getNow = () => new Date(),
) => {
  const client = createClient();
  const host = `https://${config.bucket}.${getOssDomain(config)}`;
  const publicBaseUrl = config.cdnUrl.trim() || host;

  return {
    async createImageUploadToken(input: CreateImageUploadTokenInput): Promise<ImageUploadToken> {
      const now = getNow();
      const expiration = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
      const xOssDate = toOssDate(now);
      const credentialDate = xOssDate.split('T')[0];
      const xOssCredential = `${config.accessKeyId}/${credentialDate}/${getStandardRegion(
        config.region,
      )}/oss/aliyun_v4_request`;
      const signatureVersion = 'OSS4-HMAC-SHA256';
      const successActionStatus = '200';
      const policy = {
        expiration,
        conditions: [
          { bucket: config.bucket },
          { 'x-oss-credential': xOssCredential },
          { 'x-oss-date': xOssDate },
          { 'x-oss-signature-version': signatureVersion },
          ['eq', '$key', input.objectKey],
          ['eq', '$Content-Type', input.mimeType],
          ['content-length-range', input.size, input.size],
          ['eq', '$success_action_status', successActionStatus],
        ],
      };
      const signature = client.signPostObjectPolicyV4(policy, now);

      return {
        host,
        objectKey: input.objectKey,
        policy: toBase64(JSON.stringify(policy)),
        signature,
        accessKeyId: config.accessKeyId,
        xOssDate,
        xOssCredential,
        signatureVersion,
        successActionStatus,
      };
    },

    getObjectUrl(objectKey: string) {
      if (!config.cdnUrl.trim() && client.signatureUrl) {
        return ensureHttpsUrl(client.signatureUrl(objectKey, { expires: 60 * 60 }));
      }

      return ensureHttpsUrl(`${publicBaseUrl.replace(/\/+$/, '')}/${objectKey}`);
    },

    async deleteObject(objectKey: string) {
      await client.delete(objectKey);
    },
  };
};
