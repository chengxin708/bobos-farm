"use client"

import { useState } from 'react'
import { Calendar, Timer, Search, Minus, Plus, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Dish {
  name: string
  nameCn: string
  price: number
  tag: string
  tagColor: string
  tagBg: string
  image: string
  category: string
}

const dishes: Dish[] = [
  {
    name: 'Guo Bao Rou', nameCn: '锅包肉', price: 45,
    tag: '⭐ Signature', tagColor: '#8B6914', tagBg: '#FEF3CD',
    image: 'https://images.unsplash.com/photo-1733412790015-b430cd97edb3?w=200&q=80',
    category: 'Signature',
  },
  {
    name: 'Whole Roast Lamb', nameCn: '烤全羊', price: 388,
    tag: '🔥 Must Try', tagColor: '#C0392B', tagBg: '#FFE0E0',
    image: 'https://images.unsplash.com/photo-1761839258239-2be2146f1605?w=200&q=80',
    category: 'Signature',
  },
  {
    name: 'Farmhouse Dumplings', nameCn: '农家水饺', price: 28,
    tag: '🥬 Homemade', tagColor: '#5B8C3E', tagBg: '#EAF2E3',
    image: 'https://images.unsplash.com/photo-1724436493849-29468c2fc02f?w=200&q=80',
    category: 'Signature',
  },
  {
    name: 'Seasonal Veggie Platter', nameCn: '时令蔬菜拼盘', price: 42,
    tag: '🌿 Farm Fresh', tagColor: '#5B8C3E', tagBg: '#EAF2E3',
    image: 'https://images.unsplash.com/photo-1604835070732-aec3563c26c3?w=200&q=80',
    category: 'Sides',
  },
  {
    name: 'Osmanthus Rice Wine', nameCn: '桂花米酒', price: 18,
    tag: '🍶 Drinks', tagColor: '#7B2D8E', tagBg: '#E8D5F5',
    image: 'https://images.unsplash.com/photo-1699664755204-149b93e717e5?w=200&q=80',
    category: 'Drinks',
  },
  {
    name: 'Scallion Pancakes', nameCn: '葱油饼', price: 22,
    tag: '🥞 Sides', tagColor: '#8B6914', tagBg: '#FEF3CD',
    image: 'https://images.unsplash.com/photo-1609158087212-d493e56884e2?w=200&q=80',
    category: 'Sides',
  },
]

export default function PreOrderPage() {
  const t = useTranslations('preOrder')

  const categories = [
    t('categories.signature'),
    t('categories.appetizers'),
    t('categories.mains'),
    t('categories.sides'),
    t('categories.drinks'),
  ]

  const [activeTab, setActiveTab] = useState(categories[0])
  const [quantities, setQuantities] = useState<Record<string, number>>({
    'Guo Bao Rou': 2,
    'Whole Roast Lamb': 1,
    'Farmhouse Dumplings': 2,
    'Seasonal Veggie Platter': 1,
    'Osmanthus Rice Wine': 3,
    'Scallion Pancakes': 0,
  })

  const updateQty = (name: string, delta: number) => {
    setQuantities((prev) => ({ ...prev, [name]: Math.max(0, (prev[name] || 0) + delta) }))
  }

  const orderItems = Object.entries(quantities)
    .filter(([, qty]) => qty > 0)
    .map(([name, qty]) => {
      const dish = dishes.find((d) => d.name === name)!
      return { name, qty, total: dish.price * qty }
    })

  const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0)
  const totalItems = orderItems.reduce((sum, item) => sum + item.qty, 0)

  return (
    <div className="flex flex-col min-h-screen bg-cream">
      {/* Info Bar */}
      <div className="h-14 bg-white border-b border-beige flex items-center justify-between px-20">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-amber" />
          <span className="text-sm font-medium text-brown">
            {t('infoBar', { date: 'Sat, Mar 15', yurt: 'Golden Meadow', guests: '12' })}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-[#FEF3CD] rounded-lg px-3 py-1.5">
          <Timer size={14} className="text-amber" />
          <span className="text-xs font-semibold text-amber">{t('orderBy', { date: 'Mar 12' })}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1">
        {/* Left Panel */}
        <div className="flex-1 flex flex-col gap-4 py-6 pl-20 pr-10 bg-cream overflow-y-auto">
          {/* Category Tabs */}
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`px-[18px] py-2 rounded-full text-[13px] font-semibold cursor-pointer border-none ${
                  activeTab === cat
                    ? 'bg-amber text-white'
                    : 'bg-white text-brown border border-beige'
                }`}
                style={activeTab !== cat ? { border: '1px solid #E8DFD0' } : {}}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-2.5 h-11 px-3.5 bg-[#F9F6F1] rounded-xl border border-beige">
            <Search size={18} className="text-[#8E8E93]" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              className="flex-1 bg-transparent outline-none text-sm text-brown placeholder:text-[#BFBFBF]"
            />
          </div>

          {/* Dish List */}
          <div className="flex flex-col gap-2">
            {dishes.map((dish) => {
              const qty = quantities[dish.name] || 0
              const isSelected = qty > 0
              return (
                <div
                  key={dish.name}
                  className={`flex items-center gap-3.5 p-3 rounded-xl ${
                    isSelected ? 'bg-[#FEF8EE]' : 'bg-white border border-beige'
                  }`}
                >
                  <img src={dish.image} alt={dish.name} className="w-14 h-14 rounded-lg object-cover" />
                  <div className="flex flex-col gap-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-semibold text-brown">{dish.name}</span>
                      <span className="text-[13px] text-[#8E8E93]">{dish.nameCn}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-bold text-amber">${dish.price}</span>
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ color: dish.tagColor, backgroundColor: dish.tagBg }}
                      >
                        {dish.tag}
                      </span>
                    </div>
                  </div>
                  {/* Quantity Control */}
                  <div className="flex items-center">
                    <button
                      onClick={() => updateQty(dish.name, -1)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer border-none ${
                        qty > 0 ? 'bg-[#F5ECD8]' : 'bg-[#F0F0F0]'
                      }`}
                    >
                      <Minus size={16} className={qty > 0 ? 'text-amber' : 'text-[#C0C0C0]'} />
                    </button>
                    <span
                      className={`w-10 text-center text-lg font-bold ${qty > 0 ? 'text-brown' : 'text-[#C0C0C0]'}`}
                    >
                      {qty}
                    </span>
                    <button
                      onClick={() => updateQty(dish.name, 1)}
                      className="w-8 h-8 rounded-lg bg-amber flex items-center justify-center cursor-pointer border-none"
                    >
                      <Plus size={16} className="text-white" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-[420px] py-6 pr-20 pl-10">
          <div className="bg-white rounded-2xl p-6 shadow-[0_4px_16px_rgba(0,0,0,0.06)] flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="font-playfair text-xl font-bold text-brown">{t('yourOrder')}</h3>
              <div className="w-7 h-7 rounded-full bg-amber text-white text-[13px] font-bold flex items-center justify-center">
                {totalItems}
              </div>
            </div>

            {/* Items List */}
            <div className="flex flex-col">
              {orderItems.map((item, i) => (
                <div key={item.name}>
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-brown">{item.name}</span>
                      <span className="text-sm font-bold text-amber">x{item.qty}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-brown">${item.total}</span>
                      <X
                        size={14}
                        className="text-[#BFBFBF] cursor-pointer"
                        onClick={() => setQuantities((prev) => ({ ...prev, [item.name]: 0 }))}
                      />
                    </div>
                  </div>
                  {i < orderItems.length - 1 && <div className="h-px bg-beige" />}
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-beige pt-4 flex flex-col gap-3">
              <div className="flex justify-between">
                <span className="text-sm text-[#8E8E93]">{t('subtotal')}</span>
                <span className="text-sm text-brown">${subtotal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-brown">{t('estimatedTotal')}</span>
                <span className="font-playfair text-2xl font-bold text-amber">${subtotal}</span>
              </div>
              <span className="text-xs text-green">{t('depositPaid')}</span>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-brown">{t('kitchenNotes')}</span>
              <textarea
                placeholder={t('kitchenNotesPlaceholder')}
                className="h-20 px-3.5 py-3.5 bg-[#F9F6F1] rounded-[10px] border border-beige text-[13px] resize-none outline-none placeholder:text-[#BFBFBF]"
              />
            </div>

            <p className="text-xs text-[#8E8E93] text-center">
              {t('paymentNote')}
            </p>

            {/* Submit */}
            <button className="h-[52px] rounded-2xl bg-gradient-to-r from-[#8B6914] to-[#A67C2E] text-white text-[15px] font-semibold border-none cursor-pointer shadow-[0_4px_16px_rgba(139,105,20,0.2)] w-full">
              {t('submitOrder')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
