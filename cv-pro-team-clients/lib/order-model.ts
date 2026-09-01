import { z } from 'zod';

import { serviceIds } from '@/lib/order-constants';

export {
  fileCategoryIds,
  fileCategoryLabels,
  serviceIds,
  serviceLabels,
} from '@/lib/order-constants';
export type { FileCategoryId, ServiceId } from '@/lib/order-constants';

export const createOrderSchema = z.object({
  invitationToken: z.string().min(32).max(128),
  clientName: z.string().trim().min(2).max(120),
  email: z.email().trim().max(180),
  phone: z.string().trim().max(40).default(''),
  language: z.enum(['fr', 'en', 'ar']).default('fr'),
  notes: z.string().trim().max(6000).default(''),
  services: z.array(z.enum(serviceIds)).min(1).max(serviceIds.length),
});

export const acceptedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export const acceptedExtensions = new Set([
  'pdf',
  'doc',
  'docx',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'heic',
  'heif',
]);

export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const MAX_ORDER_BYTES = 500 * 1024 * 1024;
export const MAX_ORDER_FILES = 50;

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export function createOrderId(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  const entropy = crypto
    .randomUUID()
    .replaceAll('-', '')
    .slice(0, 6)
    .toUpperCase();
  return `CPT-${date}-${entropy}`;
}

export function createSecretToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToHex(bytes);
}

export async function sha256Hex(value: string | ArrayBuffer) {
  const input =
    typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return bytesToHex(
    new Uint8Array(await crypto.subtle.digest('SHA-256', input)),
  );
}

export function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function safeFileName(name: string) {
  const normalized = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return (normalized || 'document').slice(0, 140);
}

export function fileExtension(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

export function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
