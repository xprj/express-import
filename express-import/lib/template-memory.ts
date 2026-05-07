// 模板记忆存储（基于 localStorage + localStorage）
// 在服务端使用内存存储，客户端持久化到 localStorage

import type { FieldMapping, TemplateConfig } from '@/types';

const STORAGE_KEY = 'express_template_mappings';
const MAX_SAVED = 50; // 最多保存50个模板

export interface SavedMapping {
  fingerprint: string;
  mapping: FieldMapping;
  name: string;
  createdAt: string;
  hitCount: number;
}

/** 从存储中获取所有已保存的映射 */
export function getSavedMappings(): Record<string, TemplateConfig> {
  if (typeof window === 'undefined') {
    return serverMappings;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SavedMapping[];
    const result: Record<string, TemplateConfig> = {};
    for (const item of parsed) {
      result[item.fingerprint] = {
        id: item.name,
        name: item.name,
        fingerprint: item.fingerprint,
        mapping: item.mapping,
        headerRow: 1,
        skipRows: [],
      };
    }
    return result;
  } catch {
    return {};
  }
}

/** 保存新的映射规则 */
export function saveMapping(
  fingerprint: string,
  mapping: FieldMapping,
  name?: string
): void {
  if (typeof window === 'undefined') {
    const templateName = name || `模板${Object.keys(serverMappings).length + 1}`;
    serverMappings[fingerprint] = {
      id: templateName,
      name: templateName,
      fingerprint,
      mapping,
      headerRow: 1,
      skipRows: [],
    };
    return;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const existing: SavedMapping[] = raw ? JSON.parse(raw) : [];
    
    // 检查是否已存在
    const idx = existing.findIndex(m => m.fingerprint === fingerprint);
    const newEntry: SavedMapping = {
      fingerprint,
      mapping,
      name: name || `模板${existing.length + 1}`,
      createdAt: new Date().toISOString(),
      hitCount: idx >= 0 ? (existing[idx].hitCount || 0) + 1 : 1,
    };

    if (idx >= 0) {
      existing[idx] = newEntry;
    } else {
      existing.unshift(newEntry);
      // 超过限制则删除最旧的
      if (existing.length > MAX_SAVED) {
        existing.pop();
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (e) {
    console.error('saveMapping error:', e);
  }
}

/** 删除指定指纹的映射 */
export function deleteMapping(fingerprint: string): void {
  if (typeof window === 'undefined') {
    delete serverMappings[fingerprint];
    return;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const existing: SavedMapping[] = JSON.parse(raw);
    const filtered = existing.filter(m => m.fingerprint !== fingerprint);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('deleteMapping error:', e);
  }
}

// 服务端内存存储（SSR时使用）
const serverMappings: Record<string, TemplateConfig> = {};

export function getServerMappings(): Record<string, TemplateConfig> {
  return serverMappings;
}

export function setServerMapping(fp: string, config: TemplateConfig): void {
  serverMappings[fp] = config;
}
