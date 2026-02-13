'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Booking {
  id: number;
  yurt_id: number;
  yurt_name: string;
  yurt_color: string;
  yurt_image: string;
  date: string;
  time: string;
  status: string;
  created_at: string;
}

export default function MyBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/login?redirect=/my-bookings');
      return;
    }

    fetch('/api/bookings/my', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setBookings(data.bookings);
        }
      })
      .catch(() => setError('Failed to load bookings'))
      .finally(() => setLoading(false));
  }, [router]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTimeName = (time: string) => {
    return time === 'afternoon' ? 'Afternoon' : 'Evening';
  };

  const getTimeRange = (time: string) => {
    return time === 'afternoon' ? '14:00 - 18:00' : '18:00 - 22:00';
  };

  const getYurtBgColor = (color: string) => {
    switch (color) {
      case 'white': return 'bg-gray-100';
      case 'red': return 'bg-red-100';
      case 'yellow': return 'bg-yellow-100';
      default: return 'bg-gray-100';
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
          <h1 className="text-3xl font-bold text-amber-800 mb-2">My Bookings</h1>
          <p className="text-amber-600">View and manage your reservations</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-center">
            {error}
          </div>
        )}

        {/* New Booking Button */}
        <div className="mb-6 flex justify-center gap-4">
          <Link 
            href="/book/new" 
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-lg transition"
          >
            + New Booking
          </Link>
          <Link 
            href="/menu" 
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3 rounded-lg transition"
          >
            🍽️ View Menu
          </Link>
        </div>

        {/* Bookings List */}
        {bookings.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Bookings Yet</h3>
            <p className="text-gray-500 mb-6">You haven't made any reservations yet.</p>
            <Link href="/yurts" className="text-amber-600 hover:text-amber-700 font-medium">
              Browse Yurts →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map(booking => (
              <Link key={booking.id} href={`/book/${booking.id}`}>
                <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition p-6 cursor-pointer">
                  <div className="flex items-center justify-between">
                    {/* Yurt Icon */}
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center ${getYurtBgColor(booking.yurt_color)}`}>
                        <svg className="w-7 h-7 text-amber-800" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2L2 12h3v8h14v-8h3L12 2zm0 2.84L19 12h-2v6H7v-6H5l7-7.16z"/>
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">{booking.yurt_name}</h3>
                        <p className="text-gray-500 text-sm">
                          {getTimeName(booking.time)} • {getTimeRange(booking.time)}
                        </p>
                      </div>
                    </div>

                    {/* Date & Status */}
                    <div className="text-right">
                      <div className="text-gray-800 font-medium mb-1">
                        {new Date(booking.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Back Links */}
        <div className="mt-8 text-center space-x-4">
          <Link href="/yurts" className="text-amber-600 hover:text-amber-700 font-medium">
            View Yurts
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
