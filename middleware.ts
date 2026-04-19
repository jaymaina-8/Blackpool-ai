import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublic =
    pathname === "/login" ||
    pathname === "/sign-up" ||
    pathname === "/reset-password" ||
    pathname === "/update-password" ||
    pathname.startsWith("/auth/callback");

  function withSessionCookies(redirect: NextResponse) {
    response.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie.name, cookie.value);
    });
    const cacheControl = response.headers.get("cache-control");
    if (cacheControl) redirect.headers.set("cache-control", cacheControl);
    const expires = response.headers.get("expires");
    if (expires) redirect.headers.set("expires", expires);
    const pragma = response.headers.get("pragma");
    if (pragma) redirect.headers.set("pragma", pragma);
    return redirect;
  }

  if (!user && !isPublic) {
    return withSessionCookies(
      NextResponse.redirect(new URL("/login", request.url)),
    );
  }

  if (
    user &&
    (pathname === "/login" ||
      pathname === "/sign-up" ||
      pathname === "/reset-password")
  ) {
    return withSessionCookies(
      NextResponse.redirect(new URL("/leads", request.url)),
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
