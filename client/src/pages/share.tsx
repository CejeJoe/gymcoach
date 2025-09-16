import { useEffect, useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Copy, ExternalLink } from "lucide-react";

// Public, unauthenticated page. Use: /share?title=...&video=https://youtu.be/ID
export default function ShareEmbed() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [copied, setCopied] = useState(false);

  const title = params.get("title") || "Shared Workout";
  const video = params.get("video") || ""; // YouTube URL supported
  const notes = params.get("notes") || "";

  const ytId = extractYouTubeId(video);
  const shareUrl = window.location.href;

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <a href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </a>
          <div className="flex items-center gap-2">
            <Input readOnly value={shareUrl} className="h-8 w-44 sm:w-60" />
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(shareUrl);
                setCopied(true);
              }}
              title="Copy link"
            >
              {copied ? "Copied" : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <GlassCard className="overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h1 className="text-lg font-semibold">{title}</h1>
            {notes && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{notes}</p>}
          </div>
          <div className="p-0">
            {ytId ? (
              <div className="aspect-video w-full">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${ytId}`}
                  title={title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : video ? (
              <div className="p-4 space-y-2">
                <p className="text-sm">Preview not available. Open the link:</p>
                <a href={video} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-thrst-accent hover:underline">
                  <ExternalLink className="h-4 w-4" /> {video}
                </a>
              </div>
            ) : (
              <div className="p-6 text-center text-muted-foreground text-sm">No media provided.</div>
            )}
          </div>
        </GlassCard>

        <p className="text-xs text-muted-foreground text-center">
          Tip: Coaches can generate a link like <code className="px-1 py-0.5 rounded bg-muted">/share?title=Leg%20Day&video=https://youtu.be/VIDEO_ID</code>
        </p>
      </div>
    </div>
  );
}

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const vid = u.searchParams.get("v");
      return vid;
    }
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.slice(1) || null;
    }
    return null;
  } catch {
    return null;
  }
}
