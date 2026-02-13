'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Booking {
  id: number;
  yurt_id: number;
  yurt_name: string;
  yurt_color: string;
  date: string;
  time: string;
  status: string;
  created_at: string;
}

function BookingDetailContent() {
  const router = useRouter();
  const params = useParams();
  const bookingId = params.id as string;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('user');
    
    if (!token) {
      router.push('/login?redirect=/my-bookings');
      return;
    }

    // Check if user is admin (for demo, just check if email contains 'admin')
    if (userStr) {
      const user = JSON.parse(userStr);
      setIsAdmin(user.email?.includes('admin'));
    }

    // Fetch my bookings and find the specific one
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
          const found = data.bookings.find((b: Booking) => b.id === parseInt(bookingId));
          if (found) {
            setBooking(found);
          } else {
            setError('Booking not found');
          }
        }
      })
      .catch(() => setError('Failed to load booking'))
      .finally(() => setLoading(false));
  }, [bookingId, router]);

  const handleConfirm = async () => {
    const token = localStorage.getItem('auth_token');
    setConfirming(true);

    try {
      const res = await fetch(`/api/bookings/${bookingId}/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to confirm booking');
        return;
      }

      setBooking(prev => prev ? { ...prev, status: 'confirmed' } : null);
    } catch {
      setError('An error occurred');
    } finally {
      setConfirming(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTimeName = (time: string) => {
    return time === 'afternoon' ? 'Afternoon (14:00 - 18:00)' : 'Evening (18:00 - 22:00)';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <div className="text-amber-600 text-xl">Loading...</div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="text-red-500 text-lg mb-4">{error || 'Booking not found'}</div>
          <Link href="/my-bookings" className="text-amber-600 hover:text-amber-700 font-medium">
            ← Back to My Bookings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-amber-800 mb-2">Booking Details</h1>
          <p className="text-amber-600">Your reservation information</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg">
            {error}
          </div>
        )}

        {/* Booking Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Status Badge */}
          <div className="flex items-center justify-between mb-6">
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(booking.status)}`}>
              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
            </span>
            <span className="text-gray-400 text-sm">#{booking.id}</span>
          </div>

          {/* Yurt Info */}
          <div className="mb-6 p-4 bg-amber-50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                booking.yurt_color === 'white' ? 'bg-gray-200' :
                booking.yurt_color === 'red' ? 'bg-red-200' : 'bg-yellow-200'
              }`}>
                <svg className="w-8 h-8 text-amber-800" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 12h3v8h14v-8h3L12 2zm0 2.84L19 12h-2v6H7v-6H5l7-7.16z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">{booking.yurt_name}</h3>
                <p className="text-amber-600 capitalize">{booking.yurt_color} Yurt</p>
              </div>
            </div>
          </div>

          {/* Booking Details */}
          <div className="space-y-4 mb-6">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Date</span>
              <span className="font-medium text-gray-800">
                {new Date(booking.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Time Slot</span>
              <span className="font-medium text-gray-800">{getTimeName(booking.time)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Booked On</span>
              <span className="font-medium text-gray-800">
                {new Date(booking.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Status Message */}
          {booking.status === 'pending' && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800">
                ⏳ Your booking is pending confirmation. We will review it shortly.
              </p>
            </div>
          )}

          {booking.status === 'confirmed' && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800">
                ✅ Your booking is confirmed! We look forward to seeing you.
              </p>
            </div>
          )}

          {/* Admin Confirm Button */}
          {isAdmin && booking.status === 'pending' && (
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
            >
              {confirming ? 'Confirming...' : 'Confirm Booking (Admin)'}
            </button>
          )}

          {/* Order Food Button (only for confirmed bookings) */}
          {booking.status === 'confirmed' && (
            <div className="space-y-3">
              <Link
                href={`/menu?booking_id=${booking.id}`}
                className="block w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-lg text-center transition"
              >
                🍽️ Browse Menu & Order Food
              </Link>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-6 text-center space-x-4">
            <Link href="/my-bookings" className="text-amber-600 hover:text-amber-700 font-medium">
              ← My Bookings
            </Link>
            <span className="text-gray-400">|</span>
            <Link href="/yurts" className="text-amber-600 hover:text-amber-700 font-medium">
              View Yurts
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookingDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <div className="text-amber-600 text-xl">Loading...</div>
      </div>
    }>
      <BookingDetailContent />
    </Suspense>
  );
}
