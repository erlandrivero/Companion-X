import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Public routes that don't require authentication
  const publicRoutes = ["/login", "/api/auth"];
  
  // Check if the current path is public
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));
  
  // For now, allow all routes since we need to set up auth first
  // This will be updated once environment variables are configured
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
