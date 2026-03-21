"use client";
import { useRef, useState } from "react";
import { Upload, X, Loader2, ImageIcon, FileVideo, FileAudio, FileText, File } from "lucide-react";
import { useUploadThing } from "../lib/uploadthing";
import type { OurFileRouter } from "../app/api/uploadthing/core";

type Endpoint = keyof OurFileRouter;

interface FileUploadProps {
  endpoint: Endpoint;
  value?: string;           // current URL
  onChange: (url: string) => void;
  onTypeDetected?: (type: string) => void;
  label?: string;
  hint?: string;
  shape?: "circle" | "rect"; // circle = avatar, rect = content
}

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["mp4", "mov", "webm", "avi"].includes(ext)) return FileVideo;
  if (["mp3", "wav", "ogg", "m4a", "aac"].includes(ext)) return FileAudio;
  if (["pdf", "txt", "doc", "docx"].includes(ext)) return FileText;
  return File;
}

function mimeToContentType(mime: string): string {
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime.startsWith("audio/")) return "AUDIO";
  if (mime === "application/pdf") return "FILE";
  return "FILE";
}

export function FileUpload({
  endpoint,
  value,
  onChange,
  onTypeDetected,
  label,
  hint,
  shape = "rect",
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState(0);
  const [filename, setFilename] = useState<string | null>(null);

  const { startUpload, isUploading } = useUploadThing(endpoint, {
    onUploadProgress: setProgress,
    onClientUploadComplete: (res) => {
      if (res?.[0]?.url) {
        onChange(res[0].url);
        setProgress(0);
      }
    },
    onUploadError: (err) => {
      alert(`Upload failed: ${err.message}`);
      setProgress(0);
    },
  });

  const handleFile = (file: File) => {
    setFilename(file.name);
    if (onTypeDetected) onTypeDetected(mimeToContentType(file.type));
    startUpload([file]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const isImage = value && /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(value);
  const Icon = filename ? fileIcon(filename) : ImageIcon;

  /* ── CIRCLE variant (avatar) ─────────────────────────────────────────── */
  if (shape === "circle") {
    return (
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="relative w-20 h-20 rounded-full overflow-hidden bg-surface ring-[3px] ring-sep flex items-center justify-center active:opacity-80"
        >
          {value ? (
            <img src={value} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <Upload size={22} className="text-label2" />
          )}
          {isUploading && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
              <Loader2 size={20} className="text-white animate-spin" />
              <span className="text-white text-[10px] mt-1">{progress}%</span>
            </div>
          )}
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="text-tg-blue text-[14px] disabled:opacity-40"
        >
          {value ? "Change photo" : "Upload photo"}
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      </div>
    );
  }

  /* ── RECT variant (post content / preview) ───────────────────────────── */
  return (
    <div className="mx-4">
      {label && (
        <p className="text-[13px] font-semibold text-label2 uppercase tracking-wide mb-1">{label}</p>
      )}

      {/* Upload area */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className="w-full bg-surface rounded-2xl overflow-hidden active:opacity-80 disabled:opacity-60"
      >
        {/* Preview for images */}
        {isImage && !isUploading && (
          <div className="relative">
            <img src={value} alt="Preview" className="w-full max-h-48 object-cover" />
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <Upload size={24} className="text-white" />
            </div>
          </div>
        )}

        {/* Non-image file or no file */}
        {(!isImage || isUploading) && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            {isUploading ? (
              <>
                <Loader2 size={28} className="text-tg-blue animate-spin" />
                <p className="text-[13px] text-label2">{filename}</p>
                <div className="w-32 h-1.5 bg-elevated rounded-full overflow-hidden">
                  <div className="h-full bg-tg-blue rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-[12px] text-label2">{progress}%</p>
              </>
            ) : value ? (
              <>
                <Icon size={28} className="text-tg-blue" />
                <p className="text-[13px] text-white truncate max-w-[200px]">{filename ?? "File uploaded"}</p>
                <p className="text-[12px] text-tg-blue">Tap to replace</p>
              </>
            ) : (
              <>
                <Upload size={28} className="text-label2" />
                <p className="text-[14px] text-white font-medium">Tap to upload</p>
                {hint && <p className="text-[12px] text-label2">{hint}</p>}
              </>
            )}
          </div>
        )}
      </button>

      {/* Show URL fallback below the upload area */}
      <div className="mt-2 bg-surface rounded-2xl overflow-hidden">
        <input
          type="url"
          value={isImage || (!isUploading && value) ? (isImage ? "" : value ?? "") : value ?? ""}
          placeholder="Or paste a URL"
          onChange={(e) => { onChange(e.target.value); setFilename(null); }}
          className="w-full bg-transparent px-4 py-3 text-[14px] text-white placeholder-label2 focus:outline-none"
        />
      </div>

      {/* Clear button */}
      {value && !isUploading && (
        <button
          type="button"
          onClick={() => { onChange(""); setFilename(null); }}
          className="mt-2 flex items-center gap-1 text-[13px] text-red-400 px-1"
        >
          <X size={13} /> Remove file
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={endpoint === "preview" ? "image/*" : "image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"}
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
