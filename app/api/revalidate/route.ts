import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createHash, timingSafeEqual } from 'node:crypto';

// Strapi webhook target. Configure Strapi to POST here (with the shared secret in
// the `x-webhook-secret` header) on any content publish/update/delete. We
// revalidate the root layout so every page rebuilds with fresh CMS data on the
// next visit — keeping the site current without waiting for the fetch revalidate
// TTL (lib/*-data.ts fetches cache for 1h as a fallback).

/**
 * Compares in constant time, so the number of leading characters a guess got
 * right can't be read off the response time.
 *
 * Hashing first is what makes that possible: timingSafeEqual requires equal
 * lengths and throws otherwise, and the throw would itself leak the secret's
 * length. Two SHA-256 digests are always 32 bytes.
 */
function secretMatches(provided: string | null, expected: string): boolean {
  if (provided === null) return false;

  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();

  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected) {
    console.error('revalidate: WEBHOOK_SECRET is not set — refusing every webhook.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!secretMatches(req.headers.get('x-webhook-secret'), expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  revalidatePath('/', 'layout');

  return NextResponse.json({ revalidated: true, now: Date.now() });
}
