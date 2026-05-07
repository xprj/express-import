'use client';

import React, { useState } from 'react';
import ExcelUploader from '@/components/ExcelUploader';
import DataPreview from '@/components/DataPreview';
import WaybillList from '@/components/WaybillList';
import type { ImportPreview, Waybill } from '@/types';

type View = 'upload' | 'preview' | 'list';

export default function Home() {
  const [view, setView] = useState<View>('upload');
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  const handleDataParsed = (p: ImportPreview) => {
    setPreview(p);
    setView('preview');
  };

  const handleSubmit = async (data: Waybill[]) => {
    const res = await fetch('/api/waybill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waybills: data }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '提交失败');
    }
  };

  const handleBack = () => {
    setPreview(null);
    setView('upload');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-3xl">📦</span>
              万能导入 — 物流批量下单系统
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">支持多模板 Excel 自动识别 · 批量导入 · 在线编辑</p>
          </div>
          <nav className="flex items-center gap-2">
            <button
              onClick={() => setView('upload')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                view === 'upload'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              📤 导入
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                view === 'list'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              📋 运单列表
            </button>
          </nav>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {view === 'upload' && (
          <div className="space-y-6">
            {/* 功能特性 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {[
                { icon: '🔍', title: '多模板自动识别', desc: '支持5种不同格式模板，列名列序不同也能识别' },
                { icon: '🧠', title: '模板记忆学习', desc: '手动映射一次，下次自动应用' },
                { icon: '📝', title: '在线编辑预览', desc: '类Excel表格，单元格直接编辑，错误实时校验' },
                { icon: '🚀', title: '批量提交下单', desc: '支持1000+条数据，实时进度显示' },
              ].map((f, i) => (
                <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="text-2xl mb-2">{f.icon}</div>
                  <h3 className="font-semibold text-gray-800 mb-1">{f.title}</h3>
                  <p className="text-xs text-gray-500">{f.desc}</p>
                </div>
              ))}
            </div>

            {/* 上传区域 */}
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
              <h2 className="text-lg font-semibold text-gray-700 mb-6 text-center">📤 上传 Excel 批量导入</h2>
              <ExcelUploader onDataParsed={handleDataParsed} />
            </div>
          </div>
        )}

        {view === 'preview' && preview && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
            <DataPreview
              preview={preview}
              onSubmit={handleSubmit}
              onBack={handleBack}
            />
          </div>
        )}

        {view === 'list' && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
            <WaybillList />
          </div>
        )}
      </main>

      {/* 底部 */}
      <footer className="text-center py-6 text-sm text-gray-400">
        <p>万能导入下单系统 · 支持 5 种 Excel 模板 · Powered by Next.js</p>
      </footer>
    </div>
  );
}
