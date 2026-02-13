'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Booking {
  id: number;
  user_id: number;
  yurt_id: number;
  booking_date: string;
  time_slot: string;
  status: string;
  zelle_reference: string | null;
  created_at: string;
  yurt_name: string;
  user_name: string;
  user_email: string;
  user_phone: string | null;
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, [statusFilter]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const url = statusFilter !== 'all' 
        ? `/api/admin/bookings?status=${statusFilter}`
        : '/api/admin/bookings';
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings);
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (id: number, status: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setBookings(bookings.map(b => 
          b.id === id ? { ...b, status } : b
        ));
        setSelectedBooking(null);
      }
    } catch (error) {
      console.error('Failed to update booking:', error);
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Bookings</h1>
        
        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-600">Filter:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Yurt</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                  </td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No bookings found
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">#{booking.id}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{booking.user_name}</div>
                      <div className="text-sm text-gray-500">{booking.user_email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{booking.yurt_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{booking.booking_date}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 capitalize">{booking.time_slot}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(booking.status)}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelectedBooking(booking)}
                        className="text-green-600 hover:text-green-800 text-sm font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">
                Booking #{selectedBooking.id}
              </h2>
              <button
                onClick={() => setSelectedBooking(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Customer Name</label>
                  <p className="text-gray-900">{selectedBooking.user_name}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Email</label>
                  <p className="text-gray-900">{selectedBooking.user_email}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Phone</label>
                  <p className="text-gray-900">{selectedBooking.user_phone || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Yurt</label>
                  <p className="text-gray-900">{selectedBooking.yurt_name}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Date</label>
                  <p className="text-gray-900">{selectedBooking.booking_date}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Time</label>
                  <p className="text-gray-900 capitalize">{selectedBooking.time_slot}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Status</label>
                  <p className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedBooking.status)}`}>
                    {selectedBooking.status}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Created</label>
                  <p className="text-gray-900">
                    {new Date(selectedBooking.created_at).toLocaleString()}
                  </p>
                </div>
                {selectedBooking.zelle_reference && (
                  <div className="col-span-2">
                    <label className="text-sm text-gray-500">Zelle Reference</label>
                    <p className="text-gray-900">{selectedBooking.zelle_reference}</p>
                  </div>
                )}
              </div>

              <div className="border-t pt-4 mt-4">
                <label className="text-sm text-gray-500 mb-2 block">Update Status</label>
                <div className="flex gap-2">
                  {['pending', 'confirmed', 'cancelled', 'completed'].map((status) => (
                    <button
                      key={status}
                      onClick={() => updateBookingStatus(selectedBooking.id, status)}
                      disabled={updating || selectedBooking.status === status}
                      className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                        selectedBooking.status === status
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : getStatusColor(status) + ' hover:opacity-80'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
