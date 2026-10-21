import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const AUTH_PATHS = new Set(["/login", "/register"]);

/**
 * Proxy guard auth (PRD §7) — konvensi Next 16 (pengganti middleware):
 * - refresh session JWT di setiap request (cookie httpOnly),
 * - halaman app wajib login; halaman auth diarahkan ke /overview bila sudah login.
 * Tanpa env Supabase, guard pasif — halaman menampilkan state penyiapan.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => {
          try {
            request.cookies.set(name, value);
          } catch {
            // abaikan: cookie tidak bisa di-set dari proxy pada beberapa case
          }
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthPath = AUTH_PATHS.has(pathname);

  if (!user && !isAuthPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  if (user && isAuthPath) {
    const overviewUrl = request.nextUrl.clone();
    overviewUrl.pathname = "/overview";
    overviewUrl.search = "";
    return NextResponse.redirect(overviewUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
