import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })

  // Clear any old Supabase auth cookies to prevent REQUEST_HEADER_TOO_LARGE errors.
  // The browser client now uses localStorage instead of cookies, so these are stale.
  const cookiesToClear = request.cookies
    .getAll()
    .filter((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'))

  for (const cookie of cookiesToClear) {
    response.cookies.set(cookie.name, '', { maxAge: 0, path: '/' })
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
