// 运单字段定义
export interface Waybill {
  id?: string;
  externalCode: string;    // 外部编码（可选）
  senderName: string;       // 发件人姓名
  senderTel: string;        // 发件人电话
  senderAddress: string;   // 发件人地址
  receiverName: string;     // 收件人姓名
  receiverTel: string;     // 收件人电话
  receiverAddress: string; // 收件人地址
  weight: number;          // 重量(kg)
  quantity: number;        // 件数
  temperatureZone: '常温' | '冷藏' | '冷冻'; // 温层
  note: string;            // 备注（可选）
  createdAt?: string;
  updatedAt?: string;
}

// Excel导入的行数据（原始+解析后）
export interface ParsedRow {
  index: number;           // Excel行号（1-based）
  data: Partial<Waybill>;
  errors: RowError[];
  isValid: boolean;
}

// 单行错误
export interface RowError {
  field: keyof Waybill | 'row';
  message: string;
  code: 'required' | 'format' | 'range' | 'duplicate';
}

// 模板字段映射
export interface FieldMapping {
  [excelColName: string]: keyof Waybill;
}

// 模板配置
export interface TemplateConfig {
  id: string;
  name: string;
  // 基于表头列名的指纹（排序后的key列表）
  fingerprint: string;
  mapping: FieldMapping;
  headerRow: number;  // 表头所在行（1-based）
  skipRows: number[]; // 需跳过的行号
}

// 导入预览数据
export interface ImportPreview {
  fileName: string;
  templateName: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  data: ParsedRow[];
}

// 提交结果
export interface SubmitResult {
  success: number;
  failed: number;
  total: number;
  errors: { row: number; message: string }[];
}

// 运单列表查询参数
export interface WaybillQuery {
  externalCode?: string;
  receiverName?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

// 分页结果
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
