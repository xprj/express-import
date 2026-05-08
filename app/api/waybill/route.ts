import { NextRequest, NextResponse } from 'next/server';
import { insertWaybills, initDatabase, type WaybillInsert } from '@/lib/db';
import type { Waybill } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// 初始化数据库
initDatabase().catch(console.error);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { waybills } = body as { waybills: Waybill[] };

    if (!waybills || !Array.isArray(waybills) || waybills.length === 0) {
      return NextResponse.json({ error: '没有可提交的数据' }, { status: 400 });
    }

    // 转换 camelCase -> snake_case 并过滤有效数据
    const validWaybills: WaybillInsert[] = waybills
      .filter(w => {
        return w.senderName && w.senderTel && w.senderAddress &&
               w.receiverName && w.receiverTel && w.receiverAddress &&
               w.weight > 0 && w.quantity > 0 &&
               ['常温', '冷藏', '冷冻'].includes(w.temperatureZone);
      })
      .map(w => ({
        id: uuidv4(),
        external_code: w.externalCode || null,
        sender_name: w.senderName,
        sender_tel: w.senderTel,
        sender_address: w.senderAddress,
        receiver_name: w.receiverName,
        receiver_tel: w.receiverTel,
        receiver_address: w.receiverAddress,
        weight: w.weight,
        quantity: w.quantity,
        temperature_zone: w.temperatureZone,
        note: w.note || null,
      }));

    const result = await insertWaybills(validWaybills);

    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '提交失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
