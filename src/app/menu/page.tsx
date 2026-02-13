'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number | null;
  image_url: string | null;
}

interface MenuCategory {
  id: number;
  name: string;
  items: MenuItem[];
}

function MenuContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('booking_id');

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [showPrices, setShowPrices] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/login?redirect=/menu');
      return;
    }

    // Fetch menu items
    const url = bookingId ? `/api/menu/items?booking_id=${bookingId}` : '/api/menu/items';
    fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setCategories(data.categories);
          setShowPrices(data.show_prices);
        }
      })
      .catch(() => setError('Failed to load menu'))
      .finally(() => setLoading(false));
  }, [bookingId, router]);

  const getCategoryIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'appetizers':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13 18.477 5.754 18 7.5 18C4.168s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        );
      case 'main courses':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
      case 'desserts':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" />
          </svg>
        );
      case 'beverages':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <div className="text-amber-600 text-xl">Loading menu...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-amber-800 mb-2">Menu</h1>
          <p className="text-amber-600">
            {showPrices 
              ? 'Browse our delicious offerings' 
              : 'Confirm your booking to see prices'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-center">
            {error}
          </div>
        )}

        {!showPrices && bookingId && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg text-center">
            <p className="font-medium">Booking not confirmed yet</p>
            <p className="text-sm">Please confirm your booking to see prices and place orders</p>
          </div>
        )}

        {categories.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Menu Available</h3>
            <p className="text-gray-500 mb-6">Please check back later.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {categories.map((category) => (
              <div key={category.id} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                {/* Category Header */}
                <div className="bg-amber-600 px-6 py-4 flex items-center gap-3">
                  <div className="text-white">
                    {getCategoryIcon(category.name)}
                  </div>
                  <h2 className="text-xl font-bold text-white">{category.name}</h2>
                </div>

                {/* Items */}
                <div className="p-6">
                  <div className="grid gap-4">
                    {category.items.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-amber-200 hover:bg-amber-50 transition"
                      >
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800">{item.name}</h3>
                          {item.description && (
                            <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          {showPrices && item.price !== null ? (
                            <span className="text-lg font-bold text-amber-600">
                              ¥{item.price.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400 italic">
                              {showPrices ? 'N/A' : 'Confirm booking to see price'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        {showPrices && bookingId && (
          <div className="mt-8 text-center">
            <Link
              href={`/order/new?booking_id=${bookingId}`}
              className="inline-block bg-amber-600 hover:bg-amber-700 text-white font-semibold px-8 py-3 rounded-lg transition"
            >
              Place Order
            </Link>
          </div>
        )}

        {/* Back Links */}
        <div className="mt-8 text-center space-x-4">
          <Link href="/my-bookings" className="text-amber-600 hover:text-amber-700 font-medium">
            My Bookings
          </Link>
          <span className="text-gray-400">|</span>
          <Link href="/" className="text-amber-600 hover:text-amber-700 font-medium">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function MenuPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <div className="text-amber-600 text-xl">Loading...</div>
      </div>
    }>
      <MenuContent />
    </Suspense>
  );
}
