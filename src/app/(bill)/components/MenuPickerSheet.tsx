"use client";

import useSWR from "swr";
import { X } from "lucide-react";

export interface MenuItemLite {
  id: string;
  nameEn: string;
  nameZh: string | null;
  price: number;
  category: { id: string; nameEn: string; nameZh: string | null } | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (m: MenuItemLite) => void;
}

const fetcher = (u: string) => fetch(u).then(r => r.json());

export default function MenuPickerSheet({ open, onClose, onPick }: Props) {
  const { data } = useSWR<MenuItemLite[]>(
    open ? "/api/menu/items?activeOnly=true" : null,
    fetcher,
  );

  if (!open) return null;

  // Group by category
  const groups = new Map<string, { name: string; items: MenuItemLite[] }>();
  for (const m of data ?? []) {
    const key = m.category?.id ?? "_uncat";
    const name = m.category?.nameZh ?? m.category?.nameEn ?? "未分类";
    if (!groups.has(key)) groups.set(key, { name, items: [] });
    groups.get(key)!.items.push(m);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full max-h-[85dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white flex items-center justify-between px-4 py-3 border-b border-[#E8ECE4]">
          <h3 className="font-serif text-base">选择菜品</h3>
          <button onClick={onClose} className="p-1"><X className="w-5 h-5" /></button>
        </div>
        {!data ? (
          <p className="text-sm text-[#8C8478] p-4">加载中...</p>
        ) : (
          <div className="px-4 py-3 space-y-4">
            {[...groups.values()].map(g => (
              <section key={g.name}>
                <h4 className="text-xs font-semibold text-[#8C8478] mb-1 uppercase tracking-wide">{g.name}</h4>
                <ul className="space-y-1">
                  {g.items.map(m => (
                    <li key={m.id}>
                      <button
                        onClick={() => onPick(m)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#F7F4EE] rounded-lg"
                      >
                        <span className="text-sm text-left">{m.nameZh ?? m.nameEn}</span>
                        <span className="text-sm tabular-nums">${m.price.toFixed(2)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
