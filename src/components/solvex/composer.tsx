import { useRef, useState, useEffect, type ChangeEvent, type KeyboardEvent, type DragEvent, type ClipboardEvent } from "react";
import { ImagePlus, Camera, ArrowUp, X, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ComposerAttachment = {
  url: string; // data URL
  mediaType: string;
  filename: string;
};

export function Composer({
  onSubmit,
  disabled,
  status,
  uploadsLeft,
  onUploadAccepted,
  onUploadDenied,
}: {
  onSubmit: (text: string, attachments: ComposerAttachment[]) => void;
  disabled?: boolean;
  status?: "submitted" | "streaming" | "ready" | "error";
  uploadsLeft?: number; // Infinity for Pro, undefined disables limit
  onUploadAccepted?: (count: number) => void;
  onUploadDenied?: () => void;
}) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = async (incoming: File[]) => {
    let files = incoming.filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    let trimmed = false;
    if (uploadsLeft !== undefined && Number.isFinite(uploadsLeft)) {
      const remaining = (uploadsLeft as number) - attachments.length;
      if (remaining <= 0) {
        onUploadDenied?.();
        return;
      }
      if (files.length > remaining) {
        files = files.slice(0, remaining);
        trimmed = true;
      }
    }
    const loaded: ComposerAttachment[] = [];
    for (const f of files) {
      const url = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.readAsDataURL(f);
      });
      loaded.push({ url, mediaType: f.type, filename: f.name || `pasted-${Date.now()}.png` });
    }
    setAttachments((a) => [...a, ...loaded]);
    if (loaded.length > 0) onUploadAccepted?.(loaded.length);
    if (trimmed) {
      // Soft notice via title attribute on next denied click; modal will appear
      // when they try to add more after hitting the cap.
    }
  };

  const handleFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    await addFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  };

  const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const files = items
      .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
      .map((it) => it.getAsFile())
      .filter((f): f is File => !!f);
    if (files.length > 0) {
      e.preventDefault();
      await addFiles(files);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    await addFiles(Array.from(e.dataTransfer?.files ?? []));
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (Array.from(e.dataTransfer?.types ?? []).includes("Files")) {
      e.preventDefault();
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  useEffect(() => {
    const onWindowPaste = async (e: globalThis.ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const files = items
        .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
        .map((it) => it.getAsFile())
        .filter((f): f is File => !!f);
      if (files.length > 0 && document.activeElement !== textareaRef.current) {
        e.preventDefault();
        await addFiles(files);
      }
    };
    window.addEventListener("paste", onWindowPaste);
    return () => window.removeEventListener("paste", onWindowPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments.length, uploadsLeft]);

  const send = () => {
    if (disabled) return;
    if (!text.trim() && attachments.length === 0) return;
    onSubmit(text.trim(), attachments);
    setText("");
    setAttachments([]);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const busy = status === "submitted" || status === "streaming";
  const noUploadsLeft =
    uploadsLeft !== undefined && Number.isFinite(uploadsLeft) && uploadsLeft <= 0;

  const tryUpload = (which: "file" | "camera") => {
    if (noUploadsLeft) {
      onUploadDenied?.();
      return;
    }
    (which === "file" ? fileRef : cameraRef).current?.click();
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-6 pt-2">
      <div
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative rounded-3xl border border-border bg-card shadow-soft transition focus-within:border-primary/40 focus-within:shadow-glow",
          isDragging && "border-primary ring-2 ring-primary/30",
        )}
      >
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-primary/5 backdrop-blur-sm">
            <div className="flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-medium text-primary shadow-soft">
              <ImagePlus className="h-4 w-4" /> Drop images to attach
            </div>
          </div>
        )}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {attachments.map((a, i) => (
              <div key={i} className="relative">
                <img
                  src={a.url}
                  alt={a.filename}
                  className="h-16 w-16 rounded-xl border border-border object-cover"
                />
                <button
                  onClick={() => setAttachments((arr) => arr.filter((_, j) => j !== i))}
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-foreground text-background"
                  aria-label="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          onPaste={handlePaste}
          rows={1}
          autoFocus
          placeholder="Ask SolveX anything... (drag, paste, or upload images)"
          className="block max-h-48 min-h-[56px] w-full resize-none bg-transparent px-5 py-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <div className="flex items-center justify-between gap-2 px-3 pb-3">
          <div className="flex items-center gap-1">
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFiles} />
            <ComposerIcon label="Upload image" onClick={() => tryUpload("file")}>
              <ImagePlus className="h-4 w-4" />
            </ComposerIcon>
            <ComposerIcon label="Open camera" onClick={() => tryUpload("camera")}>
              <Camera className="h-4 w-4" />
            </ComposerIcon>
            {uploadsLeft !== undefined && Number.isFinite(uploadsLeft) && (
              <span className="ml-1 text-[11px] font-medium text-muted-foreground">
                {uploadsLeft}/5 uploads left today
              </span>
            )}
            {uploadsLeft === Infinity && (
              <span className="ml-1 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                <Sparkles className="h-3 w-3" /> Pro
              </span>
            )}
          </div>
          <Button
            onClick={send}
            disabled={disabled || (!text.trim() && attachments.length === 0)}
            size="icon"
            className={cn(
              "h-10 w-10 rounded-full bg-gradient-primary text-primary-foreground shadow-glow transition hover:opacity-90",
              "disabled:opacity-40 disabled:shadow-none"
            )}
            aria-label="Send"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        SolveX may make mistakes. Verify important results.
      </p>
    </div>
  );
}

function ComposerIcon({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      type="button"
      className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-primary"
    >
      {children}
    </button>
  );
}
