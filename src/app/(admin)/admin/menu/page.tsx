"use client"

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import TopBar from '@/components/admin/TopBar'
import { Plus, Pencil, Trash2, X, Upload } from 'lucide-react'

const categories = ['Mains', 'Appetizers', 'Sides', 'Drinks', 'Desserts', 'Provisions']

interface MenuItem {
  name: string
  price: string
  description?: string
  tags: string[]
  active: boolean
  image?: string
}

const menuItems: Record<string, MenuItem[]> = {
  Mains: [
    { name: 'Grilled Lamb Chops', price: '$28.00', tags: ['Farm Fresh', 'Signature'], active: true, image: 'lamb' },
    { name: 'Pan-Seared Salmon', price: '$32.00', tags: ['Seasonal', 'Popular'], active: true, image: 'salmon' },
    { name: 'Herb-Crusted Duck', price: '$35.00', tags: ['Limited Batch'], active: true, image: 'duck' },
    { name: 'Rosemary Chicken', price: '$22.00', tags: ['Fan Fave'], active: true, image: 'chicken' },
    { name: 'Braised Pork Belly', price: '$24.00', tags: ['Winter Special'], active: false, image: 'pork' },
  ],
  Appetizers: [],
  Sides: [],
  Drinks: [],
  Desserts: [],
  Provisions: [],
}

const tagColors: Record<string, string> = {
  'Farm Fresh': 'bg-light-green-bg text-green',
  'Signature': 'bg-[#FEF3CD] text-amber',
  'Seasonal': 'bg-light-blue-bg text-blue',
  'Popular': 'bg-[#F3E8FF] text-[#7C3AED]',
  'Limited Batch': 'bg-[#FFF3E0] text-orange',
  'Fan Fave': 'bg-[#FCE7F3] text-[#DB2777]',
  'Winter Special': 'bg-gray-100 text-gray-text',
}

const imagePlaceholders: Record<string, string> = {
  lamb: 'bg-[#8B4513]',
  salmon: 'bg-[#FA8072]',
  duck: 'bg-[#D4A017]',
  chicken: 'bg-[#CD853F]',
  pork: 'bg-[#B22222]',
}

export default function MenuManagement() {
  const t = useTranslations('admin.menu')
  const [activeCategory, setActiveCategory] = useState('Mains')
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [editItem, setEditItem] = useState<MenuItem | null>(null)
  const items = menuItems[activeCategory] || []

  const openEdit = (item: MenuItem) => {
    setEditItem(item)
    setEditDrawerOpen(true)
  }

  return (
    <>
      <TopBar title={t('title')} />
      <div className="flex-1 flex bg-cream-bg overflow-hidden relative">
        {/* Category Sidebar */}
        <div className="w-[180px] bg-white border-r border-beige p-4 flex flex-col gap-2 shrink-0">
          <div className="text-sm font-bold text-brown mb-2">{t('categories')}</div>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-left text-sm px-3 py-2 rounded-md ${
                activeCategory === cat
                  ? 'bg-amber text-white font-semibold'
                  : 'text-brown hover:bg-cream-bg'
              }`}
            >
              {cat}
            </button>
          ))}
          <button className="text-left text-sm text-amber font-medium px-3 py-2 mt-2">
            {t('addCategory')}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-brown">{activeCategory}</span>
              <span className="text-sm text-gray-text">{items.length} {t('dishes')}</span>
            </div>
            <button className="flex items-center gap-1.5 bg-amber text-white text-sm font-semibold px-4 py-2 rounded-md">
              <Plus size={14} /> {t('addDish')}
            </button>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-3 gap-5">
            {items.map((item) => (
              <div key={item.name} className="bg-white rounded-xl border border-beige overflow-hidden shadow-sm">
                {/* Image */}
                <div className={`h-[140px] ${imagePlaceholders[item.image || ''] || 'bg-gray-200'} relative`}>
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button
                      onClick={() => openEdit(item)}
                      className="w-7 h-7 bg-white/90 rounded-md flex items-center justify-center"
                    >
                      <Pencil size={12} />
                    </button>
                    <button className="w-7 h-7 bg-white/90 rounded-md flex items-center justify-center">
                      <Trash2 size={12} className="text-red" />
                    </button>
                  </div>
                </div>
                <div className="p-4 flex flex-col gap-2">
                  <div className="text-sm font-bold text-brown">{item.name}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-amber">{item.price}</span>
                    <div className={`w-9 h-5 rounded-full flex items-center ${item.active ? 'bg-green justify-end' : 'bg-gray-300 justify-start'}`}>
                      <div className="w-4 h-4 bg-white rounded-full mx-0.5" />
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {item.tags.map((tag) => (
                      <span key={tag} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tagColors[tag] || 'bg-gray-100 text-gray-text'}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {/* Add New Dish Card */}
            <div className="bg-cream-bg rounded-xl border-2 border-dashed border-beige flex flex-col items-center justify-center min-h-[260px] cursor-pointer hover:border-amber transition-colors">
              <Plus size={24} className="text-amber mb-2" />
              <span className="text-sm font-semibold text-amber">{t('addNewDish')}</span>
            </div>
          </div>
        </div>

        {/* Edit Drawer */}
        {editDrawerOpen && editItem && (
          <>
            <div className="absolute inset-0 bg-brown/20" onClick={() => setEditDrawerOpen(false)} />
            <div className="absolute right-0 top-0 bottom-0 w-[420px] bg-white border-l border-beige flex flex-col z-10 shadow-xl">
              <div className="flex items-center justify-between p-5 border-b border-beige">
                <span className="text-base font-bold text-brown">{t('editDish.title')}</span>
                <button onClick={() => setEditDrawerOpen(false)}>
                  <X size={20} className="text-gray-text" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-5 flex flex-col gap-4">
                <div>
                  <label className="text-xs font-semibold text-brown mb-1 block">{t('editDish.nameEn')}</label>
                  <input className="w-full border border-beige rounded-md px-3 py-2 text-sm" defaultValue={editItem.name} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-brown mb-1 block">{t('editDish.nameZh')}</label>
                  <input className="w-full border border-beige rounded-md px-3 py-2 text-sm" placeholder="中文名" />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-brown mb-1 block">{t('editDish.category')}</label>
                    <select className="w-full border border-beige rounded-md px-3 py-2 text-sm">
                      {categories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-brown mb-1 block">{t('editDish.price')}</label>
                    <input className="w-full border border-beige rounded-md px-3 py-2 text-sm" defaultValue={editItem.price} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-brown mb-1 block">{t('editDish.descriptionEn')}</label>
                  <textarea className="w-full border border-beige rounded-md px-3 py-2 text-sm h-20 resize-none" placeholder="A tender and perfectly seasoned cut..." />
                </div>
                <div>
                  <label className="text-xs font-semibold text-brown mb-1 block">{t('editDish.descriptionZh')}</label>
                  <textarea className="w-full border border-beige rounded-md px-3 py-2 text-sm h-16 resize-none" placeholder="经典的烤全羊排配上自..." />
                </div>
                <div>
                  <label className="text-xs font-semibold text-brown mb-1 block">{t('editDish.image')}</label>
                  <div className="border border-dashed border-beige rounded-md p-4 flex items-center justify-center text-sm text-gray-text gap-2">
                    <Upload size={16} /> {t('editDish.imageUpload')}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-brown mb-1 block">{t('editDish.tags')}</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {editItem.tags.map((tag) => (
                      <span key={tag} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tagColors[tag] || 'bg-gray-100 text-gray-text'}`}>
                        {tag} ×
                      </span>
                    ))}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-text cursor-pointer">{t('editDish.addTag')}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-brown mb-1 block">{t('editDish.advanceOrder')}</label>
                    <input className="w-full border border-beige rounded-md px-3 py-2 text-sm" defaultValue="3" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-brown mb-1 block">{t('editDish.sortOrder')}</label>
                    <input className="w-full border border-beige rounded-md px-3 py-2 text-sm" defaultValue="1" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-brown">{t('editDish.active')}</span>
                  <div className={`w-10 h-5 rounded-full flex items-center cursor-pointer ${editItem.active ? 'bg-green justify-end' : 'bg-gray-300 justify-start'}`}>
                    <div className="w-4 h-4 bg-white rounded-full mx-0.5" />
                  </div>
                </div>
              </div>
              <div className="p-5 border-t border-beige flex justify-end gap-3">
                <button onClick={() => setEditDrawerOpen(false)} className="px-4 py-2 text-sm text-brown border border-beige rounded-md">
                  Cancel
                </button>
                <button className="px-4 py-2 text-sm bg-green text-white font-semibold rounded-md">
                  {t('editDish.saveChanges')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
