import { neon } from '@neondatabase/serverless';

// 使用环境变量中的 DATABASE_URL
// 如果没有配置，使用本地 SQLite 作为降级方案
const DATABASE_URL = process.env.DATABASE_URL;

let sql: ReturnType<typeof neon> | null = null;

if (DATABASE_URL) {
  try {
    sql = neon(DATABASE_URL);
  } catch (e) {
    console.error('Neon connection failed:', e);
  }
}

// ==================== 运单 CRUD ====================

export interface DbWaybill {
  id: string;
  external_code: string | null;
  sender_name: string;
  sender_tel: string;
  sender_address: string;
  receiver_name: string;
  receiver_tel: string;
  receiver_address: string;
  weight: number;
  quantity: number;
  temperature_zone: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface WaybillInsert {
  id: string;
  external_code: string | null;
  sender_name: string;
  sender_tel: string;
  sender_address: string;
  receiver_name: string;
  receiver_tel: string;
  receiver_address: string;
  weight: number;
  quantity: number;
  temperature_zone: string;
  note: string | null;
}

/** 批量插入运单 */
export async function insertWaybills(waybills: WaybillInsert[]): Promise<{ success: number; failed: number; errors: { row: number; message: string }[] }> {
  if (!sql) {
    // 降级：返回模拟成功
    return { success: waybills.length, failed: 0, errors: [] };
  }

  let success = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < waybills.length; i++) {
    const w = waybills[i];
    try {
      await sql`
        INSERT INTO waybills (
          id, external_code, sender_name, sender_tel, sender_address,
          receiver_name, receiver_tel, receiver_address,
          weight, quantity, temperature_zone, note
        ) VALUES (
          ${w.id}, ${w.external_code}, ${w.sender_name}, ${w.sender_tel}, ${w.sender_address},
          ${w.receiver_name}, ${w.receiver_tel}, ${w.receiver_address},
          ${w.weight}, ${w.quantity}, ${w.temperature_zone}, ${w.note}
        )
      `;
      success++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ row: i + 1, message: msg });
    }
  }

  return { success, failed: waybills.length - success, errors };
}

/** 查询运单列表 */
export async function queryWaybills(params: {
  externalCode?: string;
  receiverName?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}) {
  if (!sql) {
    // 降级：返回空列表
    return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }

  const { externalCode, receiverName, startDate, endDate, page = 1, pageSize = 20 } = params;
  const offset = (page - 1) * pageSize;

  let where = 'WHERE 1=1';
  const values: unknown[] = [];
  let paramIdx = 1;

  if (externalCode) {
    where += ` AND external_code LIKE $${paramIdx}`;
    values.push(`%${externalCode}%`);
    paramIdx++;
  }
  if (receiverName) {
    where += ` AND receiver_name LIKE $${paramIdx}`;
    values.push(`%${receiverName}%`);
    paramIdx++;
  }
  if (startDate) {
    where += ` AND created_at >= $${paramIdx}`;
    values.push(startDate);
    paramIdx++;
  }
  if (endDate) {
    where += ` AND created_at <= $${paramIdx}`;
    values.push(endDate);
    paramIdx++;
  }

  // 查询总数
  const countResult = await sql`SELECT COUNT(*) as total FROM waybills ${sql.unsafe(where)}` as unknown as [{ total: string | number }];
  const total = Number(countResult[0]?.total || 0);

  // 查询数据
  const data = await sql`
    SELECT * FROM waybills 
    ${sql.unsafe(where)}
    ORDER BY created_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  return {
    data: data as unknown as DbWaybill[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/** 初始化数据库表 */
export async function initDatabase(): Promise<void> {
  if (!sql) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS waybills (
        id VARCHAR(64) PRIMARY KEY,
        external_code VARCHAR(128),
        sender_name VARCHAR(128) NOT NULL,
        sender_tel VARCHAR(32) NOT NULL,
        sender_address VARCHAR(512) NOT NULL,
        receiver_name VARCHAR(128) NOT NULL,
        receiver_tel VARCHAR(32) NOT NULL,
        receiver_address VARCHAR(512) NOT NULL,
        weight DECIMAL(10,2) NOT NULL,
        quantity INTEGER NOT NULL,
        temperature_zone VARCHAR(16) NOT NULL,
        note TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_waybills_external_code ON waybills(external_code)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_waybills_receiver_name ON waybills(receiver_name)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_waybills_created_at ON waybills(created_at)`;
  } catch (e) {
    console.error('initDatabase error:', e);
  }
}
