"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ShoppingBag, Plus, UtensilsCrossed } from "lucide-react";
import { centsToDollarString } from "@/lib/bill/totals";

export interface MenuItemLite {
  id: string;
  nameEn: string;
  nameZh: string | null;
  price: number;
  category: { id: string; nameEn: string; nameZh: string | null } | null;
}

interface CartItem {
  menuItemId: string;
  nameEnSnap: string;
  nameZhSnap: string | null;
  priceCents: number;
  quantity: number;
}

interface Props {
  mode: "new" | "edit";
  items: CartItem[];
  onAddItem: (m: MenuItemLite) => void;
  onCheckout: () => void;
}

interface CategoryGroup {
  id: string;
  name: string;
  items: MenuItemLite[];
}

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function MenuView({ mode, items, onAddItem, onCheckout }: Props) {
  const { data: menuItems, isLoading } = useSWR<MenuItemLite[]>(
    "/api/menu/items?activeOnly=true",
    fetcher,
  );

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const waterfallScrollRef = useRef<HTMLDivElement>(null);
  const isScrollingByClick = useRef(false);
  const scrollRAF = useRef<number>(0);

  // Build category groups
  const groups: CategoryGroup[] = [];
  const groupMap = new Map<string, CategoryGroup>();
  for (const m of menuItems ?? []) {
    const key = m.category?.id ?? "_uncat";
    const name = m.category?.nameZh ?? m.category?.nameEn ?? "未分类";
    if (!groupMap.has(key)) {
      const g = { id: key, name, items: [] as MenuItemLite[] };
      groupMap.set(key, g);
      groups.push(g);
    }
    groupMap.get(key)!.items.push(m);
  }

  // Init first active category
  useEffect(() => {
    if (groups.length > 0 && !activeCategoryId) {
      setActiveCategoryId(groups[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuItems]);

  // Scroll-spy: track waterfall scroll
  useEffect(() => {
    const container = waterfallScrollRef.current;
    if (!container) return;
    const handleScroll = () => {
      cancelAnimationFrame(scrollRAF.current);
      scrollRAF.current = requestAnimationFrame(() => {
        if (isScrollingByClick.current) return;
        const containerTop = container.getBoundingClientRect().top;
        for (let i = groups.length - 1; i >= 0; i--) {
          const el = sectionRefs.current.get(groups[i].id);
          if (el && el.getBoundingClientRect().top <= containerTop + 20) {
            setActiveCategoryId(groups[i].id);
            return;
          }
        }
        if (groups.length > 0) setActiveCategoryId(groups[0].id);
      });
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(scrollRAF.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.length]);

  // Auto-scroll sidebar active button into view
  useEffect(() => {
    if (sidebarScrollRef.current) {
      const activeBtn = sidebarScrollRef.current.querySelector(
        '[data-active="true"]',
      ) as HTMLElement | null;
      if (activeBtn) {
        const container = sidebarScrollRef.current;
        const scrollTop =
          activeBtn.offsetTop -
          container.offsetHeight / 2 +
          activeBtn.offsetHeight / 2;
        container.scrollTo({ top: scrollTop, behavior: "smooth" });
      }
    }
  }, [activeCategoryId]);

  const scrollToCategory = useCallback(
    (catId: string) => {
      setActiveCategoryId(catId);
      isScrollingByClick.current = true;
      const el = sectionRefs.current.get(catId);
      const container = waterfallScrollRef.current;
      if (el && container) {
        const elTop =
          el.getBoundingClientRect().top -
          container.getBoundingClientRect().top +
          container.scrollTop;
        container.scrollTo({ top: elTop - 4, behavior: "smooth" });
      }
      setTimeout(() => {
        isScrollingByClick.current = false;
      }, 800);
    },
    [],
  );

  // Cart totals
  const cartCount = items.reduce((s, i) => s + i.quantity, 0);
  const cartTotalCents = items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
  const cartQtyMap = new Map<string, number>();
  for (const i of items) cartQtyMap.set(i.menuItemId, i.quantity);

  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-[#FCFAF5]">
      {/* Sticky header */}
      <div className="shrink-0 bg-[#FCFAF5] border-b border-[#E8ECE4] px-4 py-3 flex items-center justify-between">
        <h1 className="text-[17px] font-bold text-[#1A1208]">
          {mode === "new" ? "新建账单" : "编辑账单"}
        </h1>
        <Link
          href="/list"
          className="text-sm text-[#8C8478] press-effect"
        >
          返回
        </Link>
      </div>

      {/* Body: sidebar + waterfall */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar */}
        <div
          ref={sidebarScrollRef}
          className="w-[82px] shrink-0 bg-[#F7F4EE] overflow-y-auto scrollbar-hide border-r border-[#E8ECE4]"
        >
          {isLoading &&
            [1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-2 py-4">
                <div className="h-3 rounded bg-[#E8ECE4] skeleton-warm" />
              </div>
            ))}
          {groups.map((g) => {
            const isActive = activeCategoryId === g.id;
            return (
              <button
                key={g.id}
                data-active={isActive}
                onClick={() => scrollToCategory(g.id)}
                className={`w-full px-2 py-3 text-[12px] leading-tight text-center font-medium transition-colors border-l-[3px] ${
                  isActive
                    ? "bg-white text-[#1A1208] border-[#6B7F5E] font-bold"
                    : "text-[#8C8478] border-transparent"
                }`}
              >
                {g.name}
              </button>
            );
          })}
        </div>

        {/* Right waterfall */}
        <div
          ref={waterfallScrollRef}
          className="flex-1 overflow-y-auto scrollbar-hide px-3 pb-28"
        >
          {isLoading && (
            <div className="space-y-2 pt-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex gap-3 p-3 rounded-2xl bg-white shadow-card"
                >
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 w-3/4 rounded bg-[#E8ECE4] skeleton-warm" />
                    <div className="h-3 w-1/3 rounded bg-[#E8ECE4] skeleton-warm" />
                  </div>
                  <div className="w-[72px] h-[72px] rounded-xl bg-[#E8ECE4] skeleton-warm" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && groups.length === 0 && (
            <div className="flex flex-col items-center justify-center pt-24 gap-3 text-[#8C8478]">
              <UtensilsCrossed className="w-10 h-10 opacity-30" />
              <p className="text-sm">暂无菜品</p>
            </div>
          )}

          {groups.map((g) => (
            <div
              key={g.id}
              ref={(el) => {
                if (el) sectionRefs.current.set(g.id, el);
                else sectionRefs.current.delete(g.id);
              }}
              className="pt-3"
            >
              <h2 className="text-[14px] font-bold text-[#1A1208] mb-2 px-0.5">
                {g.name}
              </h2>
              <div className="space-y-2">
                {g.items.map((m) => {
                  const qty = cartQtyMap.get(m.id) ?? 0;
                  return (
                    <ItemCard
                      key={m.id}
                      item={m}
                      qty={qty}
                      onAdd={() => onAddItem(m)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-safe">
          <div className="pb-3">
            <button
              onClick={onCheckout}
              className="w-full bg-[#1A1208] text-white rounded-2xl py-4 px-5 flex items-center justify-between font-semibold shadow-float press-effect"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingBag className="w-5 h-5" />
                  <span className="absolute -top-1.5 -right-1.5 bg-[#6B7F5E] text-white text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
                    {cartCount}
                  </span>
                </div>
                <span className="text-[15px]">下一步</span>
              </div>
              <span className="text-[15px] font-bold">
                ${centsToDollarString(cartTotalCents)}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Item Card ─── */
function ItemCard({
  item,
  qty,
  onAdd,
}: {
  item: MenuItemLite;
  qty: number;
  onAdd: () => void;
}) {
  return (
    <div
      onClick={onAdd}
      className="relative flex gap-3 p-2.5 rounded-2xl bg-white shadow-card cursor-pointer press-effect hover:shadow-card-hover transition-shadow duration-200"
    >
      <div className="flex-1 min-w-0 py-0.5">
        <p className="text-[13px] font-semibold text-[#1A1208] leading-snug line-clamp-2">
          {item.nameZh ?? item.nameEn}
        </p>
        <p className="text-[13px] font-bold text-[#1A1208] mt-1">
          ${item.price.toFixed(2)}
        </p>
      </div>
      <div className="relative shrink-0">
        {item.nameEn /* placeholder: no imageUrl on MenuItemLite */ ? (
          <div
            className="rounded-xl bg-[#F7F4EE] flex items-center justify-center"
            style={{ width: 72, height: 72 }}
          >
            <UtensilsCrossed className="w-5 h-5 text-[#8C8478]/30" />
          </div>
        ) : null}
        {/* qty badge */}
        {qty > 0 && (
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#6B7F5E] text-white text-[11px] font-bold flex items-center justify-center z-10">
            {qty}
          </div>
        )}
        {/* + button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-[#1A1208] text-white flex items-center justify-center shadow-md press-effect z-10"
          aria-label="添加"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
