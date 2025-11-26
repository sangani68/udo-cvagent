import { NextRequest, NextResponse } from 'next/server';
import { maskCV } from '../../../lib/mask';

export async function POST(req: NextRequest){
  const { cv, policy } = await req.json();
  return NextResponse.json({ cv: maskCV(cv, policy) });
}
