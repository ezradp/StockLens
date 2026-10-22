"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { ResearchNote } from "@/server/notes";
import { createNoteAction, updateNoteAction, deleteNoteAction } from "./actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

const inputClass =
  "h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClass =
  "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface CompanyOption {
  id: string;
  ticker: string;
  name: string;
}

export function ResearchView({
  notes,
  companyOptions,
}: {
  notes: ResearchNote[];
  companyOptions: CompanyOption[];
}) {
  const [form, setForm] = useState({
    title: "",
    companyId: "",
    content: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", content: "" });
  const [editError, setEditError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    setFormError(null);
    startTransition(async () => {
      const result = await createNoteAction(
        form.title,
        form.content,
        form.companyId === "" ? null : form.companyId,
      );
      if (result.ok) setForm({ title: "", companyId: "", content: "" });
      else setFormError(result.error ?? "Gagal menyimpan catatan.");
    });
  }

  function startEdit(note: ResearchNote) {
    setEditError(null);
    setEditingId(note.id);
    setEditForm({ title: note.title, content: note.content });
  }

  function handleSaveEdit(id: string) {
    setEditError(null);
    startTransition(async () => {
      const result = await updateNoteAction(id, editForm.title, editForm.content);
      if (result.ok) setEditingId(null);
      else setEditError(result.error ?? "Gagal memperbarui catatan.");
    });
  }

  function handleDelete(id: string) {
    setFormError(null);
    setEditError(null);
    startTransition(async () => {
      const result = await deleteNoteAction(id);
      if (!result.ok) setFormError(result.error ?? "Gagal menghapus catatan.");
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Catatan riset baru</CardTitle>
          <CardDescription>
            Tersimpan di database milik Anda (RLS: hanya baris Anda sendiri), lengkap
            dengan timestamps dan triggers <code>updated_at</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-muted-foreground">Judul (1–120 karakter)</span>
              <input
                type="text"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="mis. Tesis bull untuk AAAA"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Perusahaan (opsional)</span>
              <select
                value={form.companyId}
                onChange={(event) => setForm((current) => ({ ...current, companyId: event.target.value }))}
                className={inputClass}
              >
                <option value="">— tanpa tautan —</option>
                {companyOptions.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.ticker} — {company.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">
              Isi catatan ({form.content.length.toLocaleString("id-ID")}/8.000 karakter)
            </span>
            <textarea
              value={form.content}
              onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
              rows={5}
              placeholder="Argumen, asumsi, risiko yang Anda pertimbangkan..."
              className={textareaClass}
            />
          </label>
          <button
            type="button"
            onClick={handleCreate}
            disabled={pending || form.title.trim() === ""}
            className={buttonVariants({ size: "sm" })}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Simpan catatan
          </button>
          {formError ? <p className="text-xs text-danger">{formError}</p> : null}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Catatan tersimpan ({notes.length})
        </h2>
        {notes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-8 text-center text-sm text-muted-foreground">
            Belum ada catatan. Wawasan agregat lintas perusahaan tidak di sini — kartu
            wawasan per perusahaan ada di halaman detail explorer.
          </p>
        ) : (
          notes.map((note) => (
            <Card key={note.id}>
              <CardHeader>
                <CardTitle className="text-base">{note.title}</CardTitle>
                <CardDescription>
                  {note.ticker !== null ? (
                    <Link
                      href={`/explorer/${note.ticker}`}
                      className="mr-2 font-medium text-primary hover:underline"
                    >
                      {note.ticker}
                    </Link>
                  ) : null}
                  dibuat {formatDate(note.createdAt)} · diubah {formatDate(note.updatedAt)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {editingId === note.id ? (
                  <div className="space-y-3">
                    <label className="block">
                      <span className="mb-1 block text-xs text-muted-foreground">Judul</span>
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, title: event.target.value }))
                        }
                        className={inputClass}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-muted-foreground">
                        Isi ({editForm.content.length.toLocaleString("id-ID")}/8.000)
                      </span>
                      <textarea
                        value={editForm.content}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, content: event.target.value }))
                        }
                        rows={5}
                        className={textareaClass}
                      />
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(note.id)}
                        disabled={pending || editForm.title.trim() === ""}
                        className={buttonVariants({ size: "sm" })}
                      >
                        Simpan perubahan
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditError(null);
                        }}
                        disabled={pending}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Batal
                      </button>
                      {editError ? <p className="text-xs text-danger">{editError}</p> : null}
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {note.content === "" ? (
                        <span className="text-muted-foreground">(isi kosong)</span>
                      ) : (
                        note.content
                      )}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(note)}
                        disabled={pending}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Ubah
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(note.id)}
                        disabled={pending}
                        className={buttonVariants({ variant: "ghost", size: "sm" })}
                        aria-label={`Hapus catatan ${note.title}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Hapus
                      </button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
