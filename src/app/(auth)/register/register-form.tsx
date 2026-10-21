"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AUTH_INITIAL_STATE } from "../auth-state";
import { signUpAction } from "../actions";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(signUpAction, AUTH_INITIAL_STATE);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Daftar</CardTitle>
        <CardDescription>Buat akun untuk menyimpan riset & portofolio Anda</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state.message && state.needsEmailConfirm ? (
            <p
              role="status"
              className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs text-success"
            >
              {state.message}
            </p>
          ) : state.message ? (
            <p
              role="alert"
              className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
            >
              {state.message}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
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
            <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="minimal 8 karakter"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Memproses…" : "Buat akun"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Masuk
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
