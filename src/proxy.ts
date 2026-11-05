import { NextResponse, type NextRequest } from 'next/server'

// The server binds to loopback, but DNS rebinding lets any website point its own domain at 127.0.0.1
// and read the API same-origin. Such a request still carries the attacker's domain in Host, so only
// loopback names are served (an SSH tunnel keeps Host as localhost, so remote viewing still works).
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]'])

function isLoopbackHost(host: string | null): boolean {
  if (!host) return false
  try {
    return LOOPBACK.has(new URL(`http://${host}`).hostname)
  } catch {
    return false
  }
}

export function proxy(request: NextRequest) {
  if (isLoopbackHost(request.headers.get('host'))) return NextResponse.next()

  return new NextResponse('Forbidden host', { status: 403 })
}
