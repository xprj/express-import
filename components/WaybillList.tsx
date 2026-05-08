'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { DbWaybill } from '@/lib/db';
import type { PaginatedResult } from '@/types';

interface QueryParams {
  externalCode?: string;
  receiverName?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}

export default function WaybillList() {
  const [waybills, setWaybills] = useState<DbWaybill[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState({ externalCode: '', receiverName: '', startDate: '', endDate: '' });
  const [hasMore, setHasMore] = useState(false);

  const fetchWaybills = useCallback(async (params: QueryParams) => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (params.externalCode) sp.set('externalCode', params.externalCode);
      if (params.receiverName) sp.set('receiverName', params.receiverName);
      if (params.startDate) sp.set('startDate', params.startDate);
      if (params.endDate) sp.set('endDate', params.endDate);
      sp.set('page', String(params.page));
      sp.set('pageSize', String(params.pageSize));

      const res = await fetch(`/api/waybills?${sp.toString()}`);
      if (!res.ok) throw new Error('获取失败');
      const result: PaginatedResult<DbWaybill> = await res.json();
      setWaybills(result.data);
      setTotal(result.total);
      setHasMore(result.page < result.totalPages);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWaybills({
      externalCode: search.externalCode || undefined,
      receiverName: search.receiverName || undefined,
      startDate: search.startDate || undefined,
      endDate: search.endDate || undefined,
      page,
      pageSize,
    });
  }, [page, fetchWaybills, search.externalCode, search.receiverName, search.startDate, search.endDate, pageSize]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchWaybills({
      externalCode: search.externalCode || undefined,
      receiverName: search.receiverName || undefined,
      startDate: search.startDate || undefined,
      endDate: search.endDate || undefined,
      page: 1,
      pageSize,
    });
  };

  const totalPages = Math.ceil(total / pageSize);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">📋 已导入运单列表</h2>

      {/* 搜索表单 */}
      <form onSubmit={handleSearch} className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder="外部编码"
            value={search.externalCode}
            onChange={e => setSearch(s => ({ ...s, externalCode: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="收件人姓名"
            value={search.receiverName}
            onChange={e => setSearch(s => ({ ...s, receiverName: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            value={search.startDate}
            onChange={e => setSearch(s => ({ ...s, startDate: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            value={search.endDate}
            onChange={e => setSearch(s => ({ ...s, endDate: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium"
          >
            🔍 搜索
          </button>
        </div>
      </form>

      {/* 结果统计 */}
      <div className="text-sm text-gray-500 mb-3">
        共找到 <span className="font-semibold text-gray-700">{total}</span> 条运单记录
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* 表格 */}
      {!loading && waybills.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-2">📭</div>
          <p>暂无运单数据</p>
        </div>
      )}

      {!loading && waybills.length > 0 && (
        <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                {['外部编码', '收件人', '收件电话', '收件地址', '重量', '件数', '温层', '备注', '导入时间'].map(h => (
                  <th key={h} className="px-3 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {waybills.map((w, i) => (
                <tr key={w.id || i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs text-gray-600">{w.external_code || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{w.receiver_name}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{w.receiver_tel}</td>
                  <td className="px-3 py-2 max-w-xs truncate" title={w.receiver_address}>{w.receiver_address}</td>
                  <td className="px-3 py-2">{w.weight} kg</td>
                  <td className="px-3 py-2">{w.quantity}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      w.temperature_zone === '冷藏' ? 'bg-blue-100 text-blue-700' :
                      w.temperature_zone === '冷冻' ? 'bg-cyan-100 text-cyan-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {w.temperature_zone}
                    </span>
                  </td>
                  <td className="px-3 py-2 max-w-32 truncate text-gray-500" title={w.note || ''}>{w.note || '—'}</td>
                  <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{formatDate(w.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 分页 */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-100"
          >
            上一页
          </button>
          <span className="text-sm text-gray-600">
            第 {page} / {totalPages} 页
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={!hasMore}
            className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-100"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
