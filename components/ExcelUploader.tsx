'use client';

import React, { useState, useRef, useCallback } from 'react';
import { parseExcel, getFieldAliases } from '@/lib/excel-parser';
import { getSavedMappings, saveMapping } from '@/lib/template-memory';
import type { ParsedRow, Waybill, FieldMapping, ImportPreview } from '@/types';
import { getFieldLabel } from '@/lib/excel-parser';
import * as XLSX from 'xlsx';

interface Props {
  onDataParsed: (preview: ImportPreview) => void;
}

const FIELD_ORDER: (keyof Waybill)[] = [
  'externalCode', 'senderName', 'senderTel', 'senderAddress',
  'receiverName', 'receiverTel', 'receiverAddress',
  'weight', 'quantity', 'temperatureZone', 'note'
];

export default function ExcelUploader({ onDataParsed }: Props) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState('');
  const [parseResult, setParseResult] = useState<Awaited<ReturnType<typeof parseExcel>> | null>(null);
  const [fileName, setFileName] = useState('');
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [manualMapping, setManualMapping] = useState<FieldMapping>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFile = useRef<File | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await processFile(file);
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  }, []);

  const processFile = async (file: File) => {
    setError('');
    setParseResult(null);
    setFileName(file.name);
    
    // 检查文件类型
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls'].includes(ext || '')) {
      setError('请上传 Excel 文件（.xlsx 或 .xls）');
      return;
    }

    setLoading(true);
    setProgress(10);
    setProgressText('正在读取文件...');

    try {
      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 5, 85));
      }, 100);

      // 获取已保存的映射
      const savedMappings = getSavedMappings();

      // 解析Excel
      const result = await parseExcel(file, savedMappings);

      clearInterval(progressInterval);
      setProgress(95);
      setProgressText('正在处理...');

      if (result.totalRows === 0) {
        setError('Excel 文件中没有找到有效数据行');
        setLoading(false);
        return;
      }

      setProgress(100);
      setProgressText('解析完成！');

      // 检测是否需要手动映射
      const autoMappedCount = Object.keys(result.mapping).filter(k => {
        return !['重量(kg)', '件数', '温层', '备注', '外部编码'].includes(k);
      }).length;

      if (autoMappedCount === 0 && result.totalRows > 0) {
        // 自动识别失败，显示手动映射界面
        const headers = Object.keys(result.mapping);
        // 从文件重新读取表头
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        const headerRow: string[] = [];
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
          headerRow.push(cell ? String(cell.v || '').trim() : '');
        }
        setDetectedHeaders(headerRow.filter(h => h));
        setManualMapping(result.mapping);
        setShowMappingModal(true);
        setLoading(false);
        pendingFile.current = file;
        return;
      }

      setParseResult(result);
      setLoading(false);
      onDataParsed({
        fileName: file.name,
        templateName: result.templateName,
        totalRows: result.totalRows,
        validRows: result.validRows,
        errorRows: result.errorRows,
        data: result.data,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '文件解析失败');
      setLoading(false);
    }
  };

  const handleManualMappingConfirm = async () => {
    if (!pendingFile.current) return;
    setShowMappingModal(false);
    setLoading(true);
    setProgress(20);
    setProgressText('使用手动映射重新解析...');

    try {
      const savedMappings = getSavedMappings();
      const result = await parseExcel(pendingFile.current, savedMappings, manualMapping);
      
      setProgress(90);
      
      // 保存映射记忆
      if (Object.keys(manualMapping).length > 0) {
        saveMapping(result.fingerprint, manualMapping, '自定义模板');
      }

      setParseResult(result);
      setLoading(false);
      onDataParsed({
        fileName: fileName,
        templateName: result.templateName,
        totalRows: result.totalRows,
        validRows: result.validRows,
        errorRows: result.errorRows,
        data: result.data,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '重新解析失败');
      setLoading(false);
    }
  };

  const fieldAliases = getFieldAliases();

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* 上传区域 */}
      <div
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
          dragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        } ${loading ? 'opacity-60 pointer-events-none' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !loading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />
        
        {loading ? (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="text-lg font-medium text-gray-700">{progressText}</p>
              <div className="w-64 mx-auto mt-3 bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">{progress}%</p>
            </div>
          </div>
        ) : (
          <div>
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-lg font-medium text-gray-700 mb-1">拖拽 Excel 文件到这里</p>
            <p className="text-sm text-gray-500">或点击选择文件 · 支持 .xlsx / .xls</p>
            <p className="text-xs text-gray-400 mt-3">支持 5 种模板格式 · 最多 1000+ 条数据</p>
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <span className="font-medium">❌ {error}</span>
        </div>
      )}

      {/* 解析结果摘要 */}
      {parseResult && !loading && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-green-800">✅ 解析完成：{fileName}</p>
              <p className="text-sm text-green-600 mt-1">
                模板：{parseResult.templateName} · 共 {parseResult.totalRows} 行
                · 有效 {parseResult.validRows} 行 · 错误 {parseResult.errorRows} 行
              </p>
            </div>
            <button
              onClick={() => {
                setParseResult(null);
                setFileName('');
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 手动映射弹窗 */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-800">🔧 手动映射列名</h3>
              <p className="text-sm text-gray-500 mt-1">自动识别失败，请手动为每列选择对应的字段</p>
            </div>
            <div className="p-6 space-y-3">
              {detectedHeaders.map((header, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-40 text-sm font-mono bg-gray-100 px-3 py-2 rounded truncate" title={header}>
                    {header || <span className="text-gray-400">(空列)</span>}
                  </div>
                  <span className="text-gray-400">→</span>
                  <select
                    value={manualMapping[header] || ''}
                    onChange={(e) => {
                      const newMapping = { ...manualMapping };
                      if (e.target.value) {
                        newMapping[header] = e.target.value as keyof Waybill;
                      } else {
                        delete newMapping[header];
                      }
                      setManualMapping(newMapping);
                    }}
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- 不导入此列 --</option>
                    {FIELD_ORDER.map(field => (
                      <option key={field} value={field}>{getFieldLabel(field)}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowMappingModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleManualMappingConfirm}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
              >
                确认映射并导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
