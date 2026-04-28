// Read by both the global TestingBanner and the booking/confirm payment UI.
// Default-off (fail-safe): if the env var is missing or anything other than
// the literal string "true", payments stay disabled and the testing notice
// is shown. To go live, set NEXT_PUBLIC_PAYMENTS_ENABLED=true in Vercel and
// redeploy.
export const paymentsEnabled =
  process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true'
