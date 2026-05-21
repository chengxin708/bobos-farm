"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function PasswordForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bill/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.status === 429) {
        setError("尝试次数过多,请稍后再试");
        return;
      }
      if (!res.ok) {
        setError("密码错误");
        return;
      }
      router.replace("/list");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        autoComplete="current-password"
        autoFocus
        className="w-full border border-[#E8ECE4] rounded-lg px-3 py-2 text-base focus:outline-none focus:border-[#6B7F5E]"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !password}
        className="w-full bg-[#1A1208] text-white py-2.5 rounded-lg font-medium disabled:opacity-50"
      >
        {submitting ? "验证中..." : "进入"}
      </button>
    </form>
  );
}
