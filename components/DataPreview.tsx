'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { ParsedRow, Waybill, ImportPreview } from '@/types';
import { getFieldLabel } from '@/lib/excel-parser';
import * as XLSX from 'xlsx';

interface Props {
  preview: ImportPreview;
  onSubmit: (data: Waybill[]) => Promise<void>;
  onBack: () => void;
}

type EditingCell = { rowIdx: number; field: keyof Waybill } | null;

const DISPLAY_FIELDS: { field: keyof Waybill; width: number }[] = [
  { field: 'externalCode', width: 140 },
  { field: 'senderName', width: 100 },
  { field: 'senderTel', width: 130 },
  { field: 'senderAddress', width: 220 },
  { field: 'receiverName', width: 100 },
  { field: 'receiverTel', width: 130 },
  { field: 'receiverAddress', width: 220 },
  { field: 'weight', width: 90 },
  { field: 'quantity', width: 70 },
  { field: 'temperatureZone', width: 90 },
  { field: 'note', width: 140 },
];

const TEMP_ZONE_OPTIONS = ['常温', '冷藏', '冷冻'];

// 电话校验
function isValidPhone(val: string): boolean {
  return /^1[3-9]\d{9}$/.test(val.trim());
}

export default function DataPreview({ preview, onSubmit, onBack }: Props) {
  const [rows, setRows] = useState<ParsedRow[]>(preview.data);
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [editValue, setEditValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [showAllErrors, setShowAllErrors] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 统计
  const totalRows = rows.length;
  const errorRows = rows.filter(r => !r.isValid).length;
  const validRows = rows.filter(r => r.isValid).length;

  // 显示 Toast
  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  // 重新校验单行
  const revalidateRow = useCallback((idx: number, field: keyof Waybill, newValue: string) => {
    setRows(prev => {
      const newRows = [...prev];
      const row = { ...newRows[idx] };
      const data = { ...row.data, [field]: newValue };
      const errors = row.errors.filter(e => e.field !== field);

      // 必填校验
      const requiredFields: (keyof Waybill)[] = [
        'senderName', 'senderTel', 'senderAddress',
        'receiverName', 'receiverTel', 'receiverAddress',
        'weight', 'quantity', 'temperatureZone'
      ];

      for (const f of requiredFields) {
        const v = data[f];
        if (!v || (typeof v === 'string' && !v.trim()) || v === '') {
          errors.push({ field: f, message: `${getFieldLabel(f)}不能为空`, code: 'required' });
        }
      }

      // 电话格式
      if (data.senderTel && !isValidPhone(String(data.senderTel))) {
        errors.push({ field: 'senderTel', message: '发件人电话格式错误', code: 'format' });
      }
      if (data.receiverTel && !isValidPhone(String(data.receiverTel))) {
        errors.push({ field: 'receiverTel', message: '收件人电话格式错误', code: 'format' });
      }

      // 重量
      const w = Number(data.weight);
      if (isNaN(w) || w <= 0) {
        if (!errors.find(e => e.field === 'weight')) {
          errors.push({ field: 'weight', message: '重量必须为正数', code: 'range' });
        }
      }

      // 件数
      const q = Number(data.quantity);
      if (isNaN(q) || q <= 0 || !Number.isInteger(q)) {
        if (!errors.find(e => e.field === 'quantity')) {
          errors.push({ field: 'quantity', message: '件数必须为正整数', code: 'range' });
        }
      }

      // 温层
      if (data.temperatureZone && !TEMP_ZONE_OPTIONS.includes(String(data.temperatureZone))) {
        errors.push({ field: 'temperatureZone', message: `温层必须为${TEMP_ZONE_OPTIONS.join('/')}之一`, code: 'range' });
      }

      newRows[idx] = {
        ...row,
        data,
        errors,
        isValid: errors.length === 0,
      };
      return newRows;
    });
  }, []);

  // 点击开始编辑
  const startEdit = (rowIdx: number, field: keyof Waybill, currentValue: unknown) => {
    setEditingCell({ rowIdx, field });
    setEditValue(currentValue !== null && currentValue !== undefined ? String(currentValue) : '');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // 确认编辑
  const confirmEdit = () => {
    if (!editingCell) return;
    const { rowIdx, field } = editingCell;
    const value = editValue;

    // 数值字段转换
    if (field === 'weight') {
      const num = parseFloat(value);
      setRows(prev => {
        const newRows = [...prev];
        newRows[rowIdx] = { ...newRows[rowIdx], data: { ...newRows[rowIdx].data, weight: isNaN(num) ? 0 : num } };
        return newRows;
      });
    } else if (field === 'quantity') {
      const num = parseInt(value);
      setRows(prev => {
        const newRows = [...prev];
        newRows[rowIdx] = { ...newRows[rowIdx], data: { ...newRows[rowIdx].data, quantity: isNaN(num) ? 0 : num } };
        return newRows;
      });
    } else {
      setRows(prev => {
        const newRows = [...prev];
        newRows[rowIdx] = { ...newRows[rowIdx], data: { ...newRows[rowIdx].data, [field]: value } };
        return newRows;
      });
    }

    setEditingCell(null);
    revalidateRow(rowIdx, field, value);
  };

  // 键盘事件
  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmEdit();
      // 移动到下一行
      if (editingCell && editingCell.rowIdx < rows.length - 1) {
        const nextFieldIdx = DISPLAY_FIELDS.findIndex(f => f.field === editingCell!.field);
        const nextField = DISPLAY_FIELDS[nextFieldIdx]?.field || 'senderName';
        const val = rows[editingCell.rowIdx + 1]?.data[nextField];
        startEdit(editingCell.rowIdx + 1, nextField, val);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      confirmEdit();
      // 移动到下一列
      if (editingCell) {
        const curIdx = DISPLAY_FIELDS.findIndex(f => f.field === editingCell.field);
        const nextIdx = e.shiftKey ? curIdx - 1 : curIdx + 1;
        if (nextIdx >= 0 && nextIdx < DISPLAY_FIELDS.length) {
          const nextField = DISPLAY_FIELDS[nextIdx].field;
          const val = rows[editingCell.rowIdx]?.data[nextField];
          startEdit(editingCell.rowIdx, nextField, val);
        }
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  // 删除行
  const deleteRow = (rowIdx: number) => {
    setRows(prev => prev.filter((_, i) => i !== rowIdx));
  };

  // 新增空行
  const addRow = () => {
    const newRow: ParsedRow = {
      index: rows.length + 1,
      data: {
        externalCode: '', senderName: '', senderTel: '', senderAddress: '',
        receiverName: '', receiverTel: '', receiverAddress: '',
        weight: 0, quantity: 0, temperatureZone: '' as Waybill['temperatureZone'], note: '',
      },
      errors: [],
      isValid: false,
    };
    setRows(prev => [...prev, newRow]);
  };

  // 导出 Excel
  const exportExcel = () => {
    const exportData = rows.map(r => {
      const row: Record<string, unknown> = {};
      DISPLAY_FIELDS.forEach(({ field }) => {
        row[getFieldLabel(field)] = r.data[field] ?? '';
      });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '运单数据');
    XLSX.writeFile(wb, `运单导出_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('success', '导出成功！');
  };

  // 提交下单
  const handleSubmit = async () => {
    if (errorRows > 0) {
      showToast('error', `仍有 ${errorRows} 行数据存在错误，请先修正后再提交`);
      return;
    }

    setSubmitting(true);
    setSubmitProgress(0);

    try {
      const validData: Waybill[] = rows.filter(r => r.isValid).map(r => ({
        externalCode: String(r.data.externalCode || ''),
        senderName: String(r.data.senderName || ''),
        senderTel: String(r.data.senderTel || ''),
        senderAddress: String(r.data.senderAddress || ''),
        receiverName: String(r.data.receiverName || ''),
        receiverTel: String(r.data.receiverTel || ''),
        receiverAddress: String(r.data.receiverAddress || ''),
        weight: Number(r.data.weight),
        quantity: Number(r.data.quantity),
        temperatureZone: String(r.data.temperatureZone) as Waybill['temperatureZone'],
        note: String(r.data.note || ''),
      }));

      // 模拟进度
      const progressInterval = setInterval(() => {
        setSubmitProgress(p => Math.min(p + 10, 90));
      }, 200);

      await onSubmit(validData);

      clearInterval(progressInterval);
      setSubmitProgress(100);
      showToast('success', `提交成功！共 ${validData.length} 条运单`);
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 导入修改后的文件
  const handleReimport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 简化的重导入：通知用户手动重新上传
    showToast('error', '请重新上传修改后的 Excel 文件');
  };

  // 获取单元格样式
  const getCellStyle = (row: ParsedRow, field: keyof Waybill): string => {
    const hasError = row.errors.some(e => e.field === field);
    if (hasError) return 'bg-red-50 border border-red-300 text-red-700';
    return 'border border-gray-200 hover:bg-blue-50';
  };

  // 获取行的错误提示
  const getRowErrors = (row: ParsedRow): string[] => {
    return row.errors.map(e => {
      const fieldLabel = e.field === 'row' ? '整行' : getFieldLabel(e.field as keyof Waybill);
      return `第${row.index}行，${fieldLabel}：${e.message}`;
    });
  };

  return (
    <div className="w-full">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium transition-all ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2">
            ← 返回
          </button>
          <div className="text-sm text-gray-600">
            <span className="font-medium">{preview.templateName}</span>
            <span className="mx-2">·</span>
            <span className="text-green-600 font-medium">{validRows} 有效</span>
            <span className="mx-1">/</span>
            <span className="text-red-600 font-medium">{errorRows} 错误</span>
            <span className="mx-2">·</span>
            <span>共 {totalRows} 行</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={addRow} className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">
            + 新增行
          </button>
          <button onClick={exportExcel} className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">
            📥 导出 Excel
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleReimport} />
          <button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">
            🔄 重新导入
          </button>
          {errorRows > 0 && (
            <button
              onClick={() => setShowAllErrors(v => !v)}
              className="px-3 py-2 text-sm bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg"
            >
              {showAllErrors ? '隐藏' : '显示'}所有错误 ({errorRows})
            </button>
          )}
        </div>
      </div>

      {/* 提交按钮 */}
      <div className="mb-4">
        {submitting ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-blue-700">正在提交... {submitProgress}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${submitProgress}%` }} />
            </div>
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={errorRows > 0}
            className={`px-8 py-3 rounded-lg font-semibold text-white transition-all ${
              errorRows > 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl'
            }`}
          >
            {errorRows > 0 ? `尚有 ${errorRows} 行错误，请先修正` : '🚀 提交下单'}
          </button>
        )}
      </div>

      {/* 错误汇总 */}
      {showAllErrors && errorRows > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 max-h-48 overflow-y-auto">
          <h4 className="font-medium text-red-700 mb-2">⚠️ 错误汇总（共 {errorRows} 行）</h4>
          <ul className="text-sm text-red-600 space-y-1">
            {rows.filter(r => !r.isValid).flatMap(r => getRowErrors(r)).map((err, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-red-400">•</span>
                <span>{err}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 数据表格 */}
      <div className="border border-gray-300 rounded-xl overflow-hidden shadow-sm">
        {/* 表头 */}
        <div className="flex bg-gray-100 border-b border-gray-300 overflow-x-auto" style={{ minWidth: '100%' }}>
          {/* 操作列 */}
          <div className="flex-shrink-0 w-20 bg-gray-100 border-r border-gray-300 flex items-center justify-center">
            <span className="text-xs font-medium text-gray-500 px-2 py-3">操作</span>
          </div>
          {DISPLAY_FIELDS.map(({ field, width }) => (
            <div
              key={field}
              className="flex-shrink-0 bg-gray-100 border-r border-gray-300 px-3 py-3"
              style={{ width }}
            >
              <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">
                {getFieldLabel(field)}
                {['senderName', 'senderTel', 'senderAddress', 'receiverName', 'receiverTel', 'receiverAddress', 'weight', 'quantity', 'temperatureZone'].includes(field) && (
                  <span className="text-red-500 ml-0.5">*</span>
                )}
              </span>
            </div>
          ))}
          {/* 行号 */}
          <div className="flex-shrink-0 w-16 bg-gray-100 px-3 py-3 flex items-center justify-center">
            <span className="text-xs font-medium text-gray-500">#</span>
          </div>
        </div>

        {/* 数据行 */}
        <div ref={tableRef} className="overflow-x-auto" style={{ maxHeight: '60vh' }}>
          {rows.map((row, rowIdx) => (
            <div
              key={rowIdx}
              className={`flex border-b border-gray-200 ${
                row.isValid ? 'hover:bg-gray-50' : 'bg-red-50 hover:bg-red-100'
              }`}
            >
              {/* 操作 */}
              <div className="flex-shrink-0 w-20 flex items-center justify-center gap-1 px-1">
                <button
                  onClick={() => deleteRow(rowIdx)}
                  className="text-gray-400 hover:text-red-500 p-1 rounded"
                  title="删除此行"
                >
                  🗑
                </button>
              </div>

              {/* 数据列 */}
              {DISPLAY_FIELDS.map(({ field, width }) => {
                const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.field === field;
                const hasError = row.errors.some(e => e.field === field);
                const errorMsg = row.errors.find(e => e.field === field)?.message;

                return (
                  <div
                    key={field}
                    className={`flex-shrink-0 relative ${getCellStyle(row, field)}`}
                    style={{ width }}
                    onClick={() => !isEditing && startEdit(rowIdx, field, row.data[field])}
                    title={hasError ? errorMsg : undefined}
                  >
                    {isEditing ? (
                      field === 'temperatureZone' ? (
                        <select
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={confirmEdit}
                          onKeyDown={handleCellKeyDown}
                          className="w-full h-full px-2 py-1 border-none outline-none bg-white text-sm"
                          autoFocus
                        >
                          <option value="">请选择</option>
                          {TEMP_ZONE_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          ref={inputRef}
                          type={field === 'weight' || field === 'quantity' ? 'number' : 'text'}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={confirmEdit}
                          onKeyDown={handleCellKeyDown}
                          className="w-full h-full px-2 py-1 border-none outline-none bg-white text-sm"
                        />
                      )
                    ) : (
                      <div className={`px-2 py-1 text-sm truncate ${hasError ? 'text-red-600 font-medium' : 'text-gray-800'}`}>
                        {row.data[field] !== undefined && row.data[field] !== null && row.data[field] !== ''
                          ? String(row.data[field])
                          : <span className="text-gray-400 italic">—</span>
                        }
                      </div>
                    )}
                    {hasError && !isEditing && (
                      <span className="absolute top-0 right-0 text-red-500 text-xs">⚠</span>
                    )}
                  </div>
                );
              })}

              {/* 行号 */}
              <div className="flex-shrink-0 w-16 px-2 py-1 flex items-center justify-center">
                <span className={`text-xs ${row.isValid ? 'text-gray-400' : 'text-red-400 font-medium'}`}>
                  {row.index}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 底部提示 */}
      <div className="mt-4 text-xs text-gray-500 flex items-center gap-4">
        <span>💡 点击单元格可直接编辑</span>
        <span>💡 Tab / Enter 切换单元格</span>
        <span>💡 红色单元格表示存在错误</span>
      </div>
    </div>
  );
}
