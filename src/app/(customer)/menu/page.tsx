"use client"

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface MenuItem {
  name: string
  nameZh: string
  price: string
  desc: string
  tags: { label: string; bg: string }[]
  notice?: string
  image: string
}

const menuItems: Record<string, MenuItem[]> = {
  'Whole Lamb': [
    { name: 'Roasted Whole Lamb', nameZh: '烤全羊', price: '$880', desc: 'Slow-roasted whole lamb with traditional Mongolian spices, serves 8-15', tags: [{ label: '🔥 Signature', bg: 'bg-amber-light' }, { label: '⏰ Pre-order', bg: 'bg-[#FEF3CD]' }], notice: 'advanceNotice3', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80' },
    { name: 'Half Lamb Roast', nameZh: '烤半只羊', price: '$480', desc: 'Half portion of our signature roasted lamb, perfect for groups of 4-8', tags: [{ label: '🔥 Signature', bg: 'bg-amber-light' }], notice: 'advanceNotice2', image: 'https://images.unsplash.com/photo-1529694157872-4e0c0f3b238b?w=400&q=80' },
    { name: 'Lamb Rack', nameZh: '羊排', price: '$48', desc: 'Grilled rack of lamb with cumin and chili flakes', tags: [{ label: '🌶️ Spicy', bg: 'bg-terracotta-light' }], image: 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=400&q=80' },
  ],
  'Signature Dishes': [
    { name: 'Iron Pot Lamb Stew', nameZh: '铁锅炖羊肉', price: '$65', desc: 'Hearty iron pot lamb stew with glass noodles, tofu, and fresh vegetables', tags: [{ label: '🔥 Popular', bg: 'bg-amber-light' }], image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80' },
    { name: 'Big Plate Chicken', nameZh: '大盘鸡', price: '$38', desc: 'Spicy braised chicken with potatoes and hand-pulled noodles', tags: [{ label: '🌶️ Spicy', bg: 'bg-terracotta-light' }], image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&q=80' },
    { name: 'Cold Sesame Noodles', nameZh: '凉面', price: '$16', desc: 'Chilled noodles with sesame paste, cucumber, and spicy chili oil', tags: [{ label: '❄️ Cold', bg: 'bg-[#E8F4FD]' }], image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&q=80' },
  ],
  'Iron Pot Stews': [
    { name: 'Lamb Dumplings', nameZh: '羊肉饺子', price: '$18', desc: 'Hand-made dumplings filled with lamb, scallion, and ginger', tags: [{ label: '🥟 Homemade', bg: 'bg-green-light' }], image: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400&q=80' },
    { name: 'Scallion Pancakes', nameZh: '葱油饼', price: '$12', desc: 'Crispy pan-fried scallion pancakes', tags: [{ label: '🥟 Homemade', bg: 'bg-green-light' }], image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=400&q=80' },
    { name: 'House Plum Juice', nameZh: '酸梅汤', price: '$8', desc: 'Traditional Chinese sour plum drink, refreshing and sweet', tags: [{ label: '🥤 Drink', bg: 'bg-[#E8F4FD]' }], image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&q=80' },
  ],
}

export default function MenuPage() {
  const t = useTranslations('menu')
  const [activeTab, setActiveTab] = useState('Whole Lamb')

  const categories = [
    { emoji: '&#x1f411;', label: t('categories.wholeLamb'), key: 'Whole Lamb' },
    { emoji: '&#x1f372;', label: t('categories.signatureDishes'), key: 'Signature Dishes' },
    { emoji: '&#x1f958;', label: t('categories.ironPotStews'), key: 'Iron Pot Stews' },
    { emoji: '&#x1f957;', label: t('categories.coldDishes'), key: 'Cold Dishes' },
    { emoji: '&#x1f35a;', label: t('categories.staples'), key: 'Staples' },
    { emoji: '&#x1f964;', label: t('categories.beverages'), key: 'Beverages' },
  ]

  const items = menuItems[activeTab] || menuItems['Whole Lamb']

  return (
    <div className="flex flex-col min-h-screen bg-cream">
      {/* Header */}
      <div className="flex flex-col items-center gap-3 pt-12 pb-8 px-20">
        <h1 className="font-playfair text-[40px] font-bold text-brown text-center">{t('title')}</h1>
        <div className="w-20 h-[3px] rounded bg-gradient-to-r from-amber to-terracotta" />
        <p className="text-base text-brown/53 text-center">{t('subtitle')}</p>
      </div>

      {/* Category Tabs */}
      <div className="flex items-end px-20 bg-white shadow-sm h-[52px]">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveTab(cat.key)}
            className={`flex items-center gap-2 px-6 py-3.5 text-sm cursor-pointer bg-transparent border-none ${
              activeTab === cat.key
                ? 'font-semibold text-amber border-b-[3px] border-amber'
                : 'text-brown/47'
            }`}
          >
            <span dangerouslySetInnerHTML={{ __html: cat.emoji }} />
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-7 px-20 py-6 pb-16">
        {/* Info Banner for Whole Lamb */}
        {activeTab === 'Whole Lamb' && (
          <div className="flex items-center gap-3 bg-[#FEF3CD] rounded-xl px-5 py-4 border-l-4 border-amber">
            <span className="text-lg">&#x1f411;</span>
            <p className="text-[13px] text-[#7A5D10] leading-relaxed">
              {t('lambNotice')}
            </p>
          </div>
        )}

        {/* Card Grid */}
        <div className="grid grid-cols-3 gap-6">
          {items.map((item) => (
            <div key={item.name} className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.03)]">
              <div className="h-[200px] overflow-hidden">
                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
              </div>
              <div className="p-4 flex flex-col gap-2">
                <div className="text-base font-bold text-brown">{item.name}</div>
                <div className="text-sm text-brown/53">{item.nameZh}</div>
                <div className="text-xl font-bold text-amber">{item.price}</div>
                <p className="text-[13px] text-brown/47 leading-snug">{item.desc}</p>
                <div className="flex gap-1.5 flex-wrap">
                  {item.tags.map((tag) => (
                    <span key={tag.label} className={`text-[11px] font-medium px-2 py-0.5 rounded-[10px] ${tag.bg} text-brown/80`}>
                      {tag.label}
                    </span>
                  ))}
                </div>
              </div>
              {item.notice && (
                <div className="bg-[#FEF3CD] h-8 flex items-center justify-center">
                  <span className="text-[11px] font-medium text-[#7A5D10]">{t(item.notice as 'advanceNotice3' | 'advanceNotice2')}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
