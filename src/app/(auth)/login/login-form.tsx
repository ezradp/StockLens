"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AUTH_INITIAL_STATE } from "../auth-state";
import { signInAction } from "../actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, AUTH_INITIAL_STATE);

  return (
    <div>
      <p className="text-[11px] text-muted-foreground">Akun</p>
      <h1 className="mt-1.5 text-[26px] font-bold leading-8 tracking-[-0.02em]">Masuk</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">Gunakan akun StockLens Anda.</p>

      <form action={formAction} className="mt-6 space-y-4">
        {state.message && !state.ok ? (
          <p
            role="alert"
            className="border border-negative/30 bg-[var(--pill-negative-bg)] px-3 py-2 text-xs text-[color:var(--pill-negative-ink)]"
          >
            {state.message}
          </p>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-[11px] text-muted-foreground">
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="nama@email.com"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-[11px] text-muted-foreground">
            Password
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Memproses…" : "Masuk"}
        </Button>
      </form>

      <p className="mt-6 border-t border-rule pt-4 text-xs text-muted-foreground">
        Belum punya akun?{" "}
        <Link
          href="/register"
          className="text-foreground underline decoration-control underline-offset-4 hover:decoration-accent"
        >
          Daftar
        </Link>
      </p>
    </div>
  );
}
