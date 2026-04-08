import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const supabase = await createClient()

  const { data: event } = await supabase
    .from('events')
    .select('id,external_url,source_url')
    .eq('id', id)
    .single()

  if (!event) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const value = event.external_url || event.source_url || ''
  if (!value) {
    return NextResponse.json({ error: 'No URL available for QR' }, { status: 400 })
  }

  const sizeParam = request.nextUrl.searchParams.get('size')
  const size = Math.max(120, Math.min(1024, Number(sizeParam || '256') || 256))

  let svg: string
  try {
    svg = await QRCode.toString(value, {
      type: 'svg',
      margin: 1,
      width: size,
      errorCorrectionLevel: 'M',
    })
  } catch {
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<rect width="100%" height="100%" fill="white"/>` +
      `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="12" fill="#111">` +
      `${escapeXml(value)}` +
      `</text>` +
      `</svg>`
    svg = fallback
  }

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
