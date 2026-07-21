import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role;
    const path = req.nextUrl.pathname;

    if (path === "/login" && role) {
      if (role === "ADMIN") return NextResponse.redirect(new URL("/admin/appointments", req.url));
      if (role === "WORKER") return NextResponse.redirect(new URL("/worker", req.url));
      return NextResponse.redirect(new URL("/", req.url));
    }
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
  {
    callbacks: { authorized: ({ token, req }) => req.nextUrl.pathname === "/login" || !!token },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: ["/login", "/admin/:path*", "/worker/:path*", "/book/:path*", "/my-appointments/:path*"],
};
