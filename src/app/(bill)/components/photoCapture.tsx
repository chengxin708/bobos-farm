"use client";

import { useCallback, useRef, useState } from "react";
import { Camera, Image as ImageIcon } from "lucide-react";

// Hands a captured order photo from the list page to the editor across a
// client-side navigation (sessionStorage survives the route change).
export const PENDING_RECOGNIZE_IMAGE_KEY = "bill_pending_recognize_image";

// Downscale an image File to a JPEG dataURL whose longest edge is <= 1600px.
// Normalizes HEIC/PNG/etc to JPEG and shrinks the payload to save tokens.
export async function fileToDownscaledJpegDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("图片解码失败"));
      el.src = objectUrl;
    });
    const maxEdge = 1600;
    const longest = Math.max(img.naturalWidth, img.naturalHeight) || 1;
    const scale = Math.min(1, maxEdge / longest);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法处理图片");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

interface PhotoCapture {
  openCamera: () => void;
  openFile: () => void;
  processing: boolean;
  /** Hidden file inputs + processing overlay; render once inside the component. */
  elements: React.ReactNode;
}

export function usePhotoCapture(onImage: (dataUrl: string) => void): PhotoCapture {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);

  const handlePickedFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Reset so picking the same file again still fires onChange.
      e.target.value = "";
      if (!file) return;
      setProcessing(true);
      try {
        const dataUrl = await fileToDownscaledJpegDataUrl(file);
        onImage(dataUrl);
      } catch {
        alert("图片处理失败,请重试");
      } finally {
        setProcessing(false);
      }
    },
    [onImage],
  );

  const elements = (
    <>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePickedFile}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePickedFile}
      />
      {processing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20">
          <div className="bg-white rounded-2xl px-5 py-4 shadow-float text-sm text-[#1A1208]">
            处理图片中…
          </div>
        </div>
      )}
    </>
  );

  return {
    openCamera: () => cameraInputRef.current?.click(),
    openFile: () => fileInputRef.current?.click(),
    processing,
    elements,
  };
}

// 拍照 / 从文件选择 dropdown; render inside a `relative` container under the
// trigger button.
export function PhotoCaptureMenu({
  open,
  onClose,
  onCamera,
  onFile,
}: {
  open: boolean;
  onClose: () => void;
  onCamera: () => void;
  onFile: () => void;
}) {
  if (!open) return null;
  return (
    <>
      {/* backdrop to dismiss */}
      <button
        type="button"
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default"
      />
      <div className="absolute right-0 top-full mt-2 z-50 w-40 bg-white rounded-2xl shadow-float border border-[#E8ECE4] overflow-hidden py-1">
        <button
          type="button"
          onClick={onCamera}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[#1A1208] active:bg-[#F0EDE6] transition-colors"
        >
          <Camera className="w-4 h-4 text-[#6B7F5E]" />
          拍照
        </button>
        <button
          type="button"
          onClick={onFile}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[#1A1208] active:bg-[#F0EDE6] transition-colors"
        >
          <ImageIcon className="w-4 h-4 text-[#6B7F5E]" />
          从文件选择
        </button>
      </div>
    </>
  );
}
