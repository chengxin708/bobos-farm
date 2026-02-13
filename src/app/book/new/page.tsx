'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Yurt {
  id: number;
  name: string;
  color: string;
  price: number;
}

interface TimeSlot {
  id: string;
  name: string;
  time: string;
}

function BookingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const yurtId = searchParams.get('yurt_id');

  const [yurts, setYurts] = useState<Yurt[]>([]);
  const [selectedYurt, setSelectedYurt] = useState<string>(yurtId || '');
  const [date, setDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Get today's date in YYYY-MM-DD format for min date
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    // Check auth
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/login?redirect=/book/new');
      return;
    }

    // Fetch yurts
    fetch('/api/yurts')
      .then(res => res.json())
      .then(data => {
        if (data.yurts) {
          setYurts(data.yurts);
          if (yurtId) setSelectedYurt(yurtId);
        }
      });
  }, [yurtId, router]);

  useEffect(() => {
    if (selectedYurt && date) {
      setChecking(true);
      setAvailableSlots([]);
      setSelectedSlot('');
      
      fetch(`/api/bookings/available?yurt_id=${selectedYurt}&date=${date}`)
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            setError(data.error);
          } else {
            setAvailableSlots(data.available_slots);
          }
        })
        .catch(() => setError('Failed to check availability'))
        .finally(() => setChecking(false));
    }
  }, [selectedYurt, date]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedYurt || !date || !selectedSlot) {
      setError('Please fill in all fields');
      return;
    }

    const token = localStorage.getItem('auth_token');
    setLoading(true);

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          yurt_id: selectedYurt,
          date,
          time: selectedSlot
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create booking');
        return;
      }

      setSuccess('Booking created successfully!');
      setTimeout(() => {
        router.push(`/book/${data.booking.id}`);
      }, 1000);
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-amber-800 mb-2">Book Your Stay</h1>
          <p className="text-amber-600">Select your yurt, date, and time slot</p>
        </div>

        {/* Booking Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-600 rounded-lg">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Yurt Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Yurt
              </label>
              <select
                value={selectedYurt}
                onChange={(e) => setSelectedYurt(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              >
                <option value="">Choose a yurt...</option>
                {yurts.map(yurt => (
                  <option key={yurt.id} value={yurt.id}>
                    {yurt.name} - ¥{yurt.price}/night
                  </option>
                ))}
              </select>
            </div>

            {/* Date Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={today}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              />
            </div>

            {/* Time Slot Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Time Slot
              </label>
              {checking ? (
                <div className="text-gray-500 py-2">Checking availability...</div>
              ) : selectedYurt && date ? (
                availableSlots.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {availableSlots.map(slot => (
                      <label
                        key={slot.id}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                          selectedSlot === slot.id
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-gray-200 hover:border-amber-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="time_slot"
                          value={slot.id}
                          checked={selectedSlot === slot.id}
                          onChange={(e) => setSelectedSlot(e.target.value)}
                          className="sr-only"
                        />
                        <div className="font-medium text-gray-800">{slot.name}</div>
                        <div className="text-sm text-gray-500">{slot.time}</div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="text-red-500 py-2">
                    No available slots for this date. Please select another date.
                  </div>
                )
              ) : (
                <div className="text-gray-500 py-2">Select yurt and date to see available time slots</div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !selectedYurt || !date || !selectedSlot}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Booking...' : 'Confirm Booking'}
            </button>
          </form>

          {/* Back Links */}
          <div className="mt-6 text-center space-x-4">
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
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <div className="text-amber-600 text-xl">Loading...</div>
      </div>
    }>
      <BookingContent />
    </Suspense>
  );
}
