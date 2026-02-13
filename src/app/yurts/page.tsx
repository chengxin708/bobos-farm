'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Yurt {
  id: number;
  name: string;
  color: string;
  description: string;
  capacity: number;
  price: number;
  image_url: string;
}

export default function YurtsPage() {
  const [yurts, setYurts] = useState<Yurt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/yurts')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setYurts(data.yurts);
        }
      })
      .catch(() => setError('Failed to load yurts'))
      .finally(() => setLoading(false));
  }, []);

  const getColorClass = (color: string) => {
    switch (color) {
      case 'white': return 'bg-white border-2 border-gray-200';
      case 'red': return 'bg-red-50 border-2 border-red-200';
      case 'yellow': return 'bg-yellow-50 border-2 border-yellow-200';
      default: return 'bg-white';
    }
  };

  const getAccentColor = (color: string) => {
    switch (color) {
      case 'white': return 'text-gray-600';
      case 'red': return 'text-red-600';
      case 'yellow': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getButtonColor = (color: string) => {
    switch (color) {
      case 'white': return 'bg-gray-800 hover:bg-gray-900';
      case 'red': return 'bg-red-600 hover:bg-red-700';
      case 'yellow': return 'bg-yellow-500 hover:bg-yellow-600';
      default: return 'bg-amber-600 hover:bg-amber-700';
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
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-amber-800 mb-4">Our Yurts 蒙古包</h1>
          <p className="text-amber-600 text-lg max-w-2xl mx-auto">
            Experience authentic Mongolian glamping in our traditional yurts. 
            Each yurt offers a unique experience for your farm stay.
          </p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-center">
            {error}
          </div>
        )}

        {/* Yurts Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {yurts.map((yurt) => (
            <div 
              key={yurt.id}
              className={`rounded-2xl shadow-xl overflow-hidden ${getColorClass(yurt.color)}`}
            >
              {/* Yurt Image Placeholder */}
              <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <div className={`w-24 h-24 rounded-full ${getAccentColor(yurt.color)} bg-white shadow-lg flex items-center justify-center`}>
                  <svg className={`w-12 h-12 ${getAccentColor(yurt.color)}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 12h3v8h14v-8h3L12 2zm0 2.84L19 12h-2v6H7v-6H5l7-7.16z"/>
                  </svg>
                </div>
              </div>

              {/* Yurt Info */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-bold text-gray-800">{yurt.name}</h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getAccentColor(yurt.color)} bg-white`}>
                    {yurt.color}
                  </span>
                </div>

                <p className="text-gray-600 mb-4 text-sm">{yurt.description}</p>

                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <span>👥 Capacity: {yurt.capacity} guests</span>
                  <span className="font-semibold text-amber-600">¥{yurt.price}/night</span>
                </div>

                <Link href={`/book/new?yurt_id=${yurt.id}`}>
                  <button className={`w-full text-white font-semibold py-3 rounded-lg transition ${getButtonColor(yurt.color)}`}>
                    Book This Yurt
                  </button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Back to Home */}
        <div className="mt-12 text-center">
          <Link href="/" className="text-amber-600 hover:text-amber-700 font-medium">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
