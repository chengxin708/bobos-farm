'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface OrderItem {
  id: number;
  menu_item_id: number;
  name: string;
  description: string;
  image_url: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface Order {
  id: number;
  booking_id: number;
  booking_date: string;
  time_slot: string;
  yurt_name: string;
  total_amount: number;
  status: string;
  created_at: string;
  items: OrderItem[];
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id;
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/login?redirect=/order/' + orderId);
      return;
    }

    fetch(`/api/orders/${orderId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setOrder(data.order);
        }
      })
      .catch(() => setError('Failed to load order'))
      .finally(() => setLoading(false));
  }, [router, orderId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <div className="text-amber-600 text-xl">Loading order...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Order Not Found</h2>
            <p className="text-gray-600 mb-6">{error || 'Unable to load order'}</p>
            <Link 
              href="/my-bookings" 
              className="inline-block bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-lg transition"
            >
              My Bookings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-amber-800 mb-2">Order Confirmed!</h1>
          <p className="text-amber-600">Your order has been placed successfully</p>
        </div>

        {/* Order Info Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
          {/* Order Header */}
          <div className="bg-amber-600 px-6 py-4 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-white">Order #{order.id}</h2>
              <p className="text-amber-100 text-sm">
                {new Date(order.created_at).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </p>
            </div>
            <span className={`px-4 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </span>
          </div>

          {/* Booking Details */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-500 text-sm">Yurt</p>
                <p className="text-lg font-semibold text-gray-800">{order.yurt_name}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-500 text-sm">Date & Time</p>
                <p className="text-lg font-semibold text-gray-800">
                  {new Date(order.booking_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })} • {order.time_slot === 'afternoon' ? 'Afternoon' : 'Evening'}
                </p>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Order Items</h3>
            <div className="space-y-3">
              {order.items.map(item => (
                <div key={item.id} className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{item.name}</p>
                    <p className="text-gray-500 text-sm">{item.description}</p>
                    <p className="text-gray-500 text-sm">
                      ${item.unit_price.toFixed(2)} × {item.quantity}
                    </p>
                  </div>
                  <p className="font-semibold text-amber-800">${item.subtotal.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="bg-amber-50 px-6 py-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-gray-800">Total Amount</span>
              <span className="text-2xl font-bold text-amber-800">${order.total_amount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Link
            href="/my-bookings"
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-6 py-3 rounded-lg text-center transition"
          >
            My Bookings
          </Link>
          <Link
            href="/menu"
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-lg text-center transition"
          >
            Order More
          </Link>
        </div>

        {/* Back to Home */}
        <div className="mt-8 text-center">
          <Link href="/" className="text-amber-600 hover:text-amber-700 font-medium">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
