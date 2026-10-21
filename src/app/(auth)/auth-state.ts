/**
 * Kontrak state server action auth — dipakai useActionState di form client.
 * Dipisah dari actions.ts karena file "use server" hanya boleh mengekspor
 * async functions (object/type export akan gagal saat build).
 */
export interface AuthActionState {
  ok: boolean;
  message: string | null;
  needsEmailConfirm?: boolean;
}

export const AUTH_INITIAL_STATE: AuthActionState = { ok: false, message: null };
