"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Plus, MoreVertical, Trash2, Copy, Pencil } from "lucide-react";
import { centsToDollarString } from "@/lib/bill/totals";

interface Row {
  id: string;
  token: string;
  customerName: string;
  customerPhone: string | null;
  totalCents: number;
  createdAt: string;
}
interface ListResponse { items: Row[]; nextCursor: string | null }

const fetcher = (u: string) => fetch(u).then(r => {
  if (!r.ok) throw new Error("fetch failed");
  return r.json();
});

function formatTs(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function ListClient() {
  const { data, mutate } = useSWR<ListResponse>("/api/bill/receipts?limit=50", fetcher);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  async function onDelete(id: string) {
    if (!confirm("确认删除这个 receipt?")) return;
    await fetch(`/api/bill/receipts/${id}`, { method: "DELETE" });
    mutate();
    setOpenMenuId(null);
  }

  async function onCopy(token: string) {
    const url = `${location.origin}/r/${token}`;
    await navigator.clipboard.writeText(url);
    setOpenMenuId(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-serif">历史 receipt</h2>
        <Link
          href="/new"
          className="inline-flex items-center gap-1 bg-[#1A1208] text-white px-3 py-2 rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> 新建
        </Link>
      </div>
      {!data ? (
        <p className="text-sm text-[#8C8478]">加载中...</p>
      ) : data.items.length === 0 ? (
        <p className="text-sm text-[#8C8478]">还没有 receipt。</p>
      ) : (
        <ul className="divide-y divide-[#E8ECE4]">
          {data.items.map(row => (
            <li key={row.id} className="py-3 flex items-center gap-3">
              <Link href={`/edit/${row.id}`} className="flex-1 min-w-0">
                <div className="font-medium truncate">{row.customerName}</div>
                <div className="text-xs text-[#8C8478]">{row.customerPhone ?? "—"} · {formatTs(row.createdAt)}</div>
              </Link>
              <div className="text-base font-semibold tabular-nums">${centsToDollarString(row.totalCents)}</div>
              <div className="relative">
                <button onClick={() => setOpenMenuId(openMenuId === row.id ? null : row.id)} className="p-2">
                  <MoreVertical className="w-4 h-4" />
                </button>
                {openMenuId === row.id && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-[#E8ECE4] rounded-lg shadow-lg z-10 w-32">
                    <Link
                      href={`/edit/${row.id}`}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#F7F4EE]"
                    >
                      <Pencil className="w-4 h-4" /> 编辑
                    </Link>
                    <button
                      onClick={() => onCopy(row.token)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#F7F4EE]"
                    >
                      <Copy className="w-4 h-4" /> 复制链接
                    </button>
                    <button
                      onClick={() => onDelete(row.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-[#F7F4EE]"
                    >
                      <Trash2 className="w-4 h-4" /> 删除
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
