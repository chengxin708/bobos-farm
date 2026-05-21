"use client";

import { useState } from "react";
import { Copy, Send, ExternalLink, Check } from "lucide-react";

interface Props {
  token: string;
  phone: string | null;
  totalLabel: string;
  onClose: () => void;
}

export default function ShareDialog({ token, phone, totalLabel }: Props) {
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/r/${token}`;
  const [copied, setCopied] = useState(false);
  const smsBody = `Bobo's Farm receipt (${totalLabel}): ${url}`;
  const smsHref = phone
    ? `sms:${phone}?&body=${encodeURIComponent(smsBody)}`
    : `sms:?&body=${encodeURIComponent(smsBody)}`;

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="bg-[#FCFAF5] border border-[#E8ECE4] rounded-lg p-3 space-y-2">
      <div className="text-xs text-[#8C8478]">分享 receipt</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-white border border-[#E8ECE4] rounded px-2 py-1 truncate">{url}</code>
        <button onClick={copy} className="p-2 border border-[#E8ECE4] rounded-lg" aria-label="copy">
          {copied ? <Check className="w-4 h-4 text-[#6B7F5E]" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <div className="flex gap-2">
        <a
          href={smsHref}
          className="flex-1 inline-flex items-center justify-center gap-1 bg-[#1A1208] text-white py-2 rounded-lg text-sm font-medium"
        >
          <Send className="w-4 h-4" /> 发送短信
        </a>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1 border border-[#E8ECE4] text-sm py-2 px-3 rounded-lg"
        >
          <ExternalLink className="w-4 h-4" /> 预览
        </a>
      </div>
    </div>
  );
}
