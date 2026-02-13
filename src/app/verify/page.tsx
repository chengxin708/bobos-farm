'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function VerifyContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const error = searchParams.get('error');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 px-4">
      <div className="max-w-md w-full text-center">
        {/* Logo/Brand */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-amber-800 mb-2">Bobos Farm</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {success === 'true' ? (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">Email Verified!</h2>
              <p className="text-gray-600 mb-6">
                Your email has been successfully verified. You can now sign in to your account.
              </p>
              <Link
                href="/login"
                className="inline-block bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-lg transition"
              >
                Sign In
              </Link>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">Verification Failed</h2>
              <p className="text-gray-600 mb-6">
                {error === 'missing_token' && 'Missing verification token.'}
                {error === 'invalid_token' && 'Invalid verification token.'}
                {error === 'already_verified' && 'This email has already been verified.'}
                {error === 'expired_token' && 'Verification token has expired. Please request a new one.'}
                {error === 'server_error' && 'An error occurred. Please try again later.'}
              </p>
              <div className="space-y-3">
                <Link
                  href="/login"
                  className="block bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 rounded-lg transition"
                >
                  Go to Login
                </Link>
                <Link
                  href="/register"
                  className="block text-amber-600 hover:text-amber-700 font-medium"
                >
                  Create new account
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-amber-800 mb-2">Bobos Farm</h1>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="animate-pulse">
            <div className="h-16 bg-gray-200 rounded-full mx-auto mb-4 w-16"></div>
            <div className="h-8 bg-gray-200 rounded mx-auto mb-4 w-48"></div>
            <div className="h-4 bg-gray-200 rounded mx-auto w-64"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <VerifyContent />
    </Suspense>
  );
}
