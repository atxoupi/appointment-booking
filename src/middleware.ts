import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role;
    const path = req.nextUrl.pathname;

    if (path.startsWith("/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (path.startsWith("/worker") && role !== "WORKER") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if ((path.startsWith("/book") || path.startsWith("/my-appointments")) && role !== "CLIENT") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  },
  { callbacks: { authorized: ({ token }) => !!token } }
);

export const config = {
  matcher: ["/admin/:path*", "/worker/:path*", "/book/:path*", "/my-appointments/:path*"],
};
