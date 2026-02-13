'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
}

interface OrderItem {
  menu_item_id: number;
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

function NewOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('booking_id');

  const [categories, setCategories] = useState<any[]>([]);
  const [cart, setCart] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/login?redirect=/order/new');
      return;
    }

    if (!bookingId) {
      setError('Booking ID is required');
      setLoading(false);
      return;
    }

    // Fetch menu items with booking confirmation check
    fetch(`/api/menu/items?booking_id=${bookingId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else if (!data.show_prices) {
          setError('Booking must be confirmed before placing an order');
        } else {
          setCategories(data.categories);
        }
      })
      .catch(() => setError('Failed to load menu'))
      .finally(() => setLoading(false));
  }, [bookingId, router]);

  const updateQuantity = (itemId: number, delta: number) => {
    setCart(prev => {
      const newCart = new Map(prev);
      const currentQty = newCart.get(itemId) || 0;
      const newQty = Math.max(0, currentQty + delta);
      
      if (newQty === 0) {
        newCart.delete(itemId);
      } else {
        newCart.set(itemId, newQty);
      }
      
      return newCart;
    });
  };

  const getTotal = () => {
    let total = 0;
    for (const category of categories) {
      for (const item of category.items) {
        const qty = cart.get(item.id) || 0;
        if (item.price && qty > 0) {
          total += item.price * qty;
        }
      }
    }
    return total;
  };

  const getCartItems = (): any[] => {
    const items: any[] = [];
    for (const category of categories) {
      for (const item of category.items) {
        const qty = cart.get(item.id) || 0;
        if (qty > 0 && item.price) {
          items.push({
            ...item,
            category: category.name,
            quantity: qty
          });
        }
      }
    }
    return items;
  };

  const handleSubmit = async () => {
    if (cart.size === 0) {
      setError('Please add at least one item to your order');
      return;
    }

    const token = localStorage.getItem('auth_token');
    setSubmitting(true);
    setError('');

    const items = Array.from(cart.entries()).map(([menu_item_id, quantity]) => ({
      menu_item_id,
      quantity
    }));

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          booking_id: bookingId,
          items
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create order');
        return;
      }

      setSuccess('Order placed successfully!');
      setTimeout(() => {
        router.push(`/order/${data.order.id}`);
      }, 1000);
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <div className="text-amber-600 text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-amber-800 mb-2">Place Order</h1>
          <p className="text-amber-600">Select items to order</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-600 rounded-lg text-center">
            {success}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Menu Items */}
          <div className="space-y-6">
            {categories.map((category) => (
              <div key={category.id} className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="bg-amber-100 px-4 py-2">
                  <h2 className="font-semibold text-amber-800">{category.name}</h2>
                </div>
                <div className="p-4 space-y-3">
                  {category.items.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{item.name}</p>
                        {item.price !== null && (
                          <p className="text-sm text-amber-600">¥{item.price.toFixed(2)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-medium">
                          {cart.get(item.id) || 0}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-8 h-8 rounded-full bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Cart Summary */}
          <div className="md:sticky md:top-4 h-fit">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Order Summary</h2>
              
              {cart.size === 0 ? (
                <p className="text-gray-500 text-center py-4">Your cart is empty</p>
              ) : (
                <div className="space-y-3 mb-6">
                  {getCartItems().map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {item.name} x{item.quantity}
                      </span>
                      <span className="font-medium">
                        ¥{(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span className="text-amber-600">¥{getTotal().toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting || cart.size === 0}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Placing Order...' : 'Confirm Order'}
              </button>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-8 text-center">
          <Link href={`/menu?booking_id=${bookingId}`} className="text-amber-600 hover:text-amber-700 font-medium">
            ← Back to Menu
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <div className="text-amber-600 text-xl">Loading...</div>
      </div>
    }>
      <NewOrderContent />
    </Suspense>
  );
}
