// app/api/setup-indexer/route.ts
import { NextResponse } from 'next/server';
import { createOrUpdateBlobIndexer } from '@/lib/azureSearch';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const r = await createOrUpdateBlobIndexer();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
