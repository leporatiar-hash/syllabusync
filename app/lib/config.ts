export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  ''

if (process.env.NODE_ENV === 'production' && !API_BASE_URL) {
  console.error('Missing NEXT_PUBLIC_API_URL or NEXT_PUBLIC_BACKEND_URL')
}
