import { NextRequest, NextResponse } from 'next/server';
import { getServerMappings, setServerMapping } from '@/lib/template-memory';
import type { TemplateConfig } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fingerprint, mapping, name } = body as {
      fingerprint: string;
      mapping: Record<string, string>;
      name?: string;
    };

    if (!fingerprint || !mapping) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    const templateName = name || `模板${Object.keys(getServerMappings()).length + 1}`;
    const config: TemplateConfig = {
      id: templateName,
      name: templateName,
      fingerprint,
      mapping: mapping as Record<string, keyof import('@/types').Waybill>,
      headerRow: 1,
      skipRows: [],
    };

    setServerMapping(fingerprint, config);
    return NextResponse.json({ ok: true, name: templateName });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '保存失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const mappings = getServerMappings();
    return NextResponse.json({ mappings });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '获取失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
