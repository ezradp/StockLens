"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "./auth-state";

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email wajib diisi")
  .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
    message: "Format email tidak valid",
  });

const passwordSchema = z.string().min(8, "Password minimal 8 karakter");

function parseCredentials(
  formData: FormData,
): { ok: true; email: string; password: string } | { ok: false; message: string } {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = passwordSchema.safeParse(formData.get("password"));

  if (!email.success) return { ok: false, message: email.error.issues[0]?.message ?? "Email tidak valid" };
  if (!password.success) {
    return { ok: false, message: password.error.issues[0]?.message ?? "Password tidak valid" };
  }
  return { ok: true, email: email.data, password: password.data };
}

/** Pesan error tetap generik — jangan membocorkan keberadaan akun (PRD §7). */
const GENERIC_SIGNIN_ERROR =
  "Email atau password salah. Pastikan email Anda sudah dikonfirmasi lalu coba lagi.";

export async function signInAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const creds = parseCredentials(formData);
  if (!creds.ok) return { ok: false, message: creds.message };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });
  if (error) return { ok: false, message: GENERIC_SIGNIN_ERROR };

  redirect("/overview");
}

export async function signUpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const creds = parseCredentials(formData);
  if (!creds.ok) return { ok: false, message: creds.message };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: creds.email,
    password: creds.password,
  });

  if (error) {
    const message = /already|registered/i.test(error.message)
      ? "Email tersebut sudah terdaftar — silakan masuk."
      : "Pendaftaran gagal. Coba lagi beberapa saat.";
    return { ok: false, message };
  }

  // Session langsung ada → email confirmation dinonaktifkan di project Supabase.
  if (data.session) redirect("/overview");

  return {
    ok: true,
    needsEmailConfirm: true,
    message:
      "Pendaftaran berhasil. Cek email Anda untuk tautan konfirmasi, lalu masuk kembali di halaman ini.",
  };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
