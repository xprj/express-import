import * as XLSX from 'xlsx';
import type { Waybill, ParsedRow, RowError, FieldMapping, TemplateConfig } from '@/types';

// ==================== 列名别名映射 ====================
// 多种列名 -> 标准字段
const FIELD_ALIASES: Record<string, keyof Waybill> = {
  // 发件人姓名
  '发件人姓名': 'senderName',
  '发件人': 'senderName',
  '寄件人姓名': 'senderName',
  '寄件人': 'senderName',
  '发件人名': 'senderName',
  '发件方': 'senderName',
  'sender': 'senderName',
  'sender name': 'senderName',
  '发件人名字': 'senderName',
  // 发件人电话
  '发件人电话': 'senderTel',
  '寄件人电话': 'senderTel',
  '发件人联系方式': 'senderTel',
  'sender tel': 'senderTel',
  'sender phone': 'senderTel',
  '发件电话': 'senderTel',
  // 发件人地址
  '发件人地址': 'senderAddress',
  '寄件人地址': 'senderAddress',
  '发件人完整地址': 'senderAddress',
  '寄件人完整地址': 'senderAddress',
  'sender address': 'senderAddress',
  '发件地址': 'senderAddress',
  // 收件人姓名
  '收件人姓名': 'receiverName',
  '收件人': 'receiverName',
  '收货人姓名': 'receiverName',
  '收货人': 'receiverName',
  '收件方': 'receiverName',
  '收货方': 'receiverName',
  'receiver': 'receiverName',
  'receiver name': 'receiverName',
  '收方': 'receiverName',
  // 收件人电话
  '收件人电话': 'receiverTel',
  '收件人联系方式': 'receiverTel',
  '收货人电话': 'receiverTel',
  '收货人联系方式': 'receiverTel',
  'receiver tel': 'receiverTel',
  'receiver phone': 'receiverTel',
  '收件电话': 'receiverTel',
  '收货电话': 'receiverTel',
  // 收件人地址
  '收件人地址': 'receiverAddress',
  '收件人完整地址': 'receiverAddress',
  '收货人地址': 'receiverAddress',
  '收货人完整地址': 'receiverAddress',
  'receiver address': 'receiverAddress',
  '收件地址': 'receiverAddress',
  '收货地址': 'receiverAddress',
  // 重量
  '重量(kg)': 'weight',
  '重量(KG)': 'weight',
  '重量': 'weight',
  'weight(kg)': 'weight',
  'weight': 'weight',
  '货品重量': 'weight',
  // 件数
  '件数': 'quantity',
  '件': 'quantity',
  'qty': 'quantity',
  'quantity': 'quantity',
  '包裹数量': 'quantity',
  '商品数量': 'quantity',
  // 温层
  '温层': 'temperatureZone',
  '温度要求': 'temperatureZone',
  '温度层': 'temperatureZone',
  'temp zone': 'temperatureZone',
  'temperature zone': 'temperatureZone',
  '储存温度': 'temperatureZone',
  '温层要求': 'temperatureZone',
  '温度': 'temperatureZone',
  // 外部编码
  '外部编码': 'externalCode',
  '外部单号': 'externalCode',
  '客户单号': 'externalCode',
  '订单号': 'externalCode',
  'ref code': 'externalCode',
  'reference code': 'externalCode',
  '订单编号': 'externalCode',
  'ref. code': 'externalCode',
  // 备注
  '备注': 'note',
  '备注说明': 'note',
  'note': 'note',
  '说明': 'note',
  '附加说明': 'note',
};

// 必填字段列表
const REQUIRED_FIELDS: (keyof Waybill)[] = [
  'senderName', 'senderTel', 'senderAddress',
  'receiverName', 'receiverTel', 'receiverAddress',
  'weight', 'quantity', 'temperatureZone'
];

// 温层可选值
const TEMP_ZONE_VALUES = ['常温', '冷藏', '冷冻'];

// 电话号码正则（宽松匹配：11位数字）
const PHONE_REGEX = /^1[3-9]\d{9}$/;

// ==================== 工具函数 ====================

/** 标准化列名 */
function normalizeColumnName(name: string): string {
  return String(name).trim().replace(/\s+/g, ' ');
}

/** 获取列名指纹 */
function getFingerprint(headers: string[]): string {
  return headers.map(h => normalizeColumnName(h)).sort().join('|');
}

/** 检测真实表头行 */
function findHeaderRow(ws: XLSX.WorkSheet, maxRows = 10): { row: number; headers: string[] } {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let r = 1; r <= maxRows && r <= range.e.r + 1; r++) {
    const row: string[] = [];
    let hasValidHeader = false;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: r - 1, c })];
      const val = cell ? String(cell.v ?? '').trim() : '';
      row.push(val);
      // 判断是否为有效表头行：至少有发件人/收件人相关字段
      if (/(发|寄|收|送|sender|receiver|温|重|件|external|ref)/i.test(val)) {
        hasValidHeader = true;
      }
    }
    if (hasValidHeader && row.some(v => v !== '')) {
      return { row: r, headers: row };
    }
  }
  // 默认第1行
  const firstRow: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    firstRow.push(cell ? String(cell.v ?? '').trim() : '');
  }
  return { row: 1, headers: firstRow };
}

/** 自动映射列名到字段 */
function autoMapColumns(headers: string[]): FieldMapping {
  const mapping: FieldMapping = {};
  headers.forEach((colName, idx) => {
    if (!colName) return;
    const normalized = normalizeColumnName(colName);
    const field = FIELD_ALIASES[normalized] || FIELD_ALIASES[colName] || FIELD_ALIASES[colName.toLowerCase()];
    if (field) {
      mapping[colName] = field;
    }
  });
  return mapping;
}

// ==================== 模板检测与记忆 ====================

// 预定义模板（5种格式）
export const BUILTIN_TEMPLATES: TemplateConfig[] = [
  // 模板1：标准格式（第1行表头）
  {
    id: 'standard',
    name: '标准格式',
    fingerprint: '件数|冷却要求|备注|备注说明|收件人|收件人地址|收件人姓名|收件人电话|收件方|外部编码|对应项目|常温|收货人|收货人地址|收货人姓名|收货人电话|昵称|总行数|备注说明',
    mapping: {
      '外部编码': 'externalCode',
      '发件人姓名': 'senderName',
      '发件人电话': 'senderTel',
      '发件人地址': 'senderAddress',
      '收件人姓名': 'receiverName',
      '收件人电话': 'receiverTel',
      '收件人地址': 'receiverAddress',
      '重量(kg)': 'weight',
      '件数': 'quantity',
      '温层': 'temperatureZone',
      '备注': 'note',
    },
    headerRow: 1,
    skipRows: [],
  },
];

// 生成列名指纹
function generateFingerprint(headers: string[]): string {
  const normalized = headers.map(h => normalizeColumnName(h)).filter(Boolean);
  return normalized.sort().join('|');
}

// ==================== Excel 解析 ====================

export interface ParseResult {
  data: ParsedRow[];
  mapping: FieldMapping;
  templateName: string;
  fingerprint: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
}

export interface SheetInfo {
  name: string;
  maxRow: number;
  maxCol: number;
}

/** 解析Excel文件 */
export async function parseExcel(
  file: File | ArrayBuffer,
  savedMappings?: Record<string, TemplateConfig>,
  manualMapping?: FieldMapping
): Promise<ParseResult> {
  let workbook: XLSX.WorkBook;

  if (file instanceof File) {
    const buffer = await file.arrayBuffer();
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  } else {
    workbook = XLSX.read(file, { type: 'array', cellDates: true });
  }

  // 选择第一个有数据的sheet
  const sheetName = workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];
  if (!ws || !ws['!ref']) {
    throw new Error('Excel文件为空或没有有效Sheet');
  }

  // 找到表头行
  const { row: headerRowIdx, headers } = findHeaderRow(ws);
  const fingerprint = generateFingerprint(headers);

  // 确定映射关系
  let mapping: FieldMapping = {};
  let templateName = '自动识别';

  if (manualMapping && Object.keys(manualMapping).length > 0) {
    // 手动映射优先
    mapping = manualMapping;
    templateName = '手动映射';
  } else if (savedMappings && savedMappings[fingerprint]) {
    // 查找已保存的模板
    mapping = savedMappings[fingerprint].mapping;
    templateName = savedMappings[fingerprint].name + ' (记忆)';
  } else {
    // 自动识别
    mapping = autoMapColumns(headers);
    // 尝试匹配预定义模板
    for (const t of BUILTIN_TEMPLATES) {
      if (fingerprint === t.fingerprint) {
        mapping = t.mapping;
        templateName = t.name;
        break;
      }
    }
  }

  // 解析数据行
  const range = XLSX.utils.decode_range(ws['!ref']);
  const data: ParsedRow[] = [];
  let rowNum = 0;

  for (let r = headerRowIdx; r <= range.e.r; r++) {
    rowNum++;
    // 跳过空白行
    let hasAnyValue = false;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v !== null && cell.v !== undefined && String(cell.v).trim() !== '') {
        hasAnyValue = true;
        break;
      }
    }
    if (!hasAnyValue) continue;

    // 解析每个字段
    const parsedData: Partial<Waybill> = {};
    const errors: RowError[] = [];

    // 按列名映射
    headers.forEach((colName, colIdx) => {
      if (!colName || !mapping[colName]) return;
      const field = mapping[colName];
      const cell = ws[XLSX.utils.encode_cell({ r, c: colIdx })];
      let rawValue = cell ? (cell.v ?? '') : '';
      if (typeof rawValue === 'number' && field === 'weight') {
        rawValue = String(rawValue);
      }
      if (typeof rawValue === 'number' && field === 'quantity') {
        rawValue = String(Math.round(Number(rawValue)));
      }
      if (typeof rawValue === 'string') {
        rawValue = rawValue.trim();
      }

      switch (field) {
        case 'externalCode':
        case 'senderName':
        case 'senderTel':
        case 'senderAddress':
        case 'receiverName':
        case 'receiverTel':
        case 'receiverAddress':
        case 'note':
          (parsedData as Record<string, unknown>)[field] = String(rawValue);
          break;
        case 'weight':
          (parsedData as Record<string, unknown>)[field] = Number(rawValue);
          break;
        case 'quantity':
          (parsedData as Record<string, unknown>)[field] = Number(rawValue);
          break;
        case 'temperatureZone':
          (parsedData as Record<string, unknown>)[field] = String(rawValue);
          break;
      }
    });

    // 校验
    for (const field of REQUIRED_FIELDS) {
      const val = parsedData[field];
      if (val === undefined || val === null || val === '' || (typeof val === 'number' && isNaN(val))) {
        errors.push({
          field,
          message: `${getFieldLabel(field)}不能为空`,
          code: 'required',
        });
      }
    }

    // 电话格式校验
    if (parsedData.senderTel && String(parsedData.senderTel).trim()) {
      if (!PHONE_REGEX.test(String(parsedData.senderTel))) {
        errors.push({ field: 'senderTel', message: '发件人电话格式错误', code: 'format' });
      }
    }
    if (parsedData.receiverTel && String(parsedData.receiverTel).trim()) {
      if (!PHONE_REGEX.test(String(parsedData.receiverTel))) {
        errors.push({ field: 'receiverTel', message: '收件人电话格式错误', code: 'format' });
      }
    }

    // 重量正数校验
    if (parsedData.weight !== undefined && parsedData.weight !== null) {
      if (typeof parsedData.weight === 'number' && (isNaN(parsedData.weight) || parsedData.weight <= 0)) {
        errors.push({ field: 'weight', message: '重量必须为正数', code: 'range' });
      }
    }

    // 件数正整数校验
    if (parsedData.quantity !== undefined && parsedData.quantity !== null) {
      const q = Number(parsedData.quantity);
      if (isNaN(q) || q <= 0 || !Number.isInteger(q)) {
        errors.push({ field: 'quantity', message: '件数必须为正整数', code: 'range' });
      }
    }

    // 温层范围校验
    if (parsedData.temperatureZone && String(parsedData.temperatureZone).trim()) {
      const tz = String(parsedData.temperatureZone).trim();
      if (!TEMP_ZONE_VALUES.includes(tz)) {
        errors.push({
          field: 'temperatureZone',
          message: `温层必须为${TEMP_ZONE_VALUES.join('/')}之一，当前值：${tz}`,
          code: 'range',
        });
      }
    }

    data.push({
      index: r + 1,
      data: parsedData,
      errors,
      isValid: errors.length === 0,
    });
  }

  // 外部编码重复检测
  const codeMap = new Map<string, number>();
  data.forEach((row) => {
    const code = String(row.data.externalCode || '').trim();
    if (code) {
      if (codeMap.has(code)) {
        const prevIdx = codeMap.get(code)!;
        const prevRow = data.find(r => r.index === prevIdx);
        if (prevRow) {
          prevRow.errors.push({
            field: 'externalCode',
            message: `与第${prevIdx}行外部编码重复`,
            code: 'duplicate',
          });
          prevRow.isValid = false;
        }
        row.errors.push({
          field: 'externalCode',
          message: `与第${prevIdx}行外部编码重复`,
          code: 'duplicate',
        });
        row.isValid = false;
      } else {
        codeMap.set(code, row.index);
      }
    }
  });

  const validRows = data.filter(r => r.isValid).length;
  const errorRows = data.length - validRows;

  return {
    data,
    mapping,
    templateName,
    fingerprint,
    totalRows: data.length,
    validRows,
    errorRows,
  };
}

/** 获取字段中文标签 */
export function getFieldLabel(field: keyof Waybill): string {
  const labels: Record<keyof Waybill, string> = {
    externalCode: '外部编码',
    senderName: '发件人姓名',
    senderTel: '发件人电话',
    senderAddress: '发件人地址',
    receiverName: '收件人姓名',
    receiverTel: '收件人电话',
    receiverAddress: '收件人地址',
    weight: '重量(kg)',
    quantity: '件数',
    temperatureZone: '温层',
    note: '备注',
    id: 'ID',
    createdAt: '创建时间',
    updatedAt: '更新时间',
  };
  return labels[field] || field;
}

/** 获取字段别名（用于手动映射选择器） */
export function getFieldAliases(): { field: keyof Waybill; label: string; aliases: string[] }[] {
  const result: { field: keyof Waybill; label: string; aliases: string[] }[] = [];
  const grouped: Record<string, string[]> = {};
  
  for (const [alias, field] of Object.entries(FIELD_ALIASES)) {
    if (!grouped[field]) grouped[field] = [];
    if (!grouped[field].includes(alias)) grouped[field].push(alias);
  }
  
  const fieldLabels: Record<keyof Waybill, string> = {
    externalCode: '外部编码',
    senderName: '发件人姓名',
    senderTel: '发件人电话',
    senderAddress: '发件人地址',
    receiverName: '收件人姓名',
    receiverTel: '收件人电话',
    receiverAddress: '收件人地址',
    weight: '重量(kg)',
    quantity: '件数',
    temperatureZone: '温层',
    note: '备注',
    id: 'ID',
    createdAt: '创建时间',
    updatedAt: '更新时间',
  };
  
  for (const [field, aliases] of Object.entries(grouped)) {
    result.push({
      field: field as keyof Waybill,
      label: fieldLabels[field as keyof Waybill] || field,
      aliases: aliases.sort(),
    });
  }
  return result;
}
