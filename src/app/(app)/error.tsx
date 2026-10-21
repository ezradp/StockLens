"use client";

import { ErrorState } from "@/components/states/error-state";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Halaman gagal dimuat"
      description="Terjadi kesalahan saat menampilkan halaman. Data pribadi Anda tetap aman di database."
      onRetry={reset}
    />
  );
}
