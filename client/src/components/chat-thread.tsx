  const handleDownload = async (url: string) => {
    try {
      // Expect URLs like /uploads/filename.ext or absolute http(s)
      const isAbsolute = /^https?:\/\//i.test(url);
      const path = isAbsolute ? new URL(url).pathname : url;
      const downloadUrl = `/api/download?path=${encodeURIComponent(path)}`;
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.target = '_blank';
      a.rel = 'noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      toast({ title: 'Download failed', description: e?.message || 'Unable to download file', variant: 'destructive' });
    }
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Copied', description: 'Link copied to clipboard' });
    } catch {
      toast({ title: 'Copy failed', description: 'Unable to copy link', variant: 'destructive' });
    }
  };
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paperclip, Smile, SendHorizonal, X, Check } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { useMessageThread, useSendMessage, useMarkThreadRead } from "@/hooks/use-messages";
import type { Message } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { apiUploadFile } from "@/lib/queryClient";
import { getAuthHeaders } from "@/lib/auth";

interface ChatThreadProps {
  coachId: string;
  clientId: string;
  currentUserId: string;
  title?: string;
}

export function ChatThread({ coachId, clientId, currentUserId, title = "Messages" }: ChatThreadProps) {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [confirmingMessageId, setConfirmingMessageId] = useState<string | null>(null);
  const { data: messages, isLoading, refetch, isFetching, error } = useMessageThread(coachId, clientId, { limit: 100, refetchIntervalMs: 4000 });
  const sendMutation = useSendMessage();
  const markRead = useMarkThreadRead();
  const listRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const sorted = useMemo(() => {
    const arr = (messages ?? []).slice();
    return arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages]);

  useEffect(() => {
    // Auto scroll to bottom on new messages
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [sorted.length]);

  // When messages load or change, if there are any unread messages from the other user, mark-as-read
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const hasUnreadFromOther = messages.some(m => m.readAt == null && m.senderId !== currentUserId);
    if (hasUnreadFromOther && !markRead.isPending) {
      markRead.mutate({ coachId, clientId });
    }
  }, [messages, coachId, clientId, currentUserId]);

  useEffect(() => {
    // Lightweight debug info to verify IDs and counts
    // Helps diagnose cases where the UI shows empty due to fetch errors vs truly no messages
    // eslint-disable-next-line no-console
    console.debug("ChatThread mount/update", {
      coachId,
      clientId,
      currentUserId,
      messagesCount: messages?.length ?? 0,
      isLoading,
      isFetching,
      hasError: Boolean(error),
    });
  }, [coachId, clientId, currentUserId, messages, isLoading, isFetching, error]);

  const confirmGroupMessage = async (messageId: string) => {
    try {
      setConfirmingMessageId(messageId);
      const response = await fetch(`/api/group-messages/${messageId}/confirm`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error('Failed to confirm message');
      }
      
      toast({
        title: "Confirmed",
        description: "Message confirmation sent",
      });
      
      // Refresh messages to update confirmation status
      refetch();
    } catch (error) {
      console.error("Confirm error:", error);
      toast({
        title: "Error",
        description: "Failed to confirm message",
        variant: "destructive",
      });
    } finally {
      setConfirmingMessageId(null);
    }
  };

  const onSend = async () => {
    if (!text.trim() && !selectedFile) return;
    
    try {
      let attachmentUrl: string | null = null;
      if (selectedFile) {
        const uploadResult = await apiUploadFile(selectedFile);
        attachmentUrl = uploadResult.url;
      }
      const body = [text.trim(), attachmentUrl].filter(Boolean).join("\n");
      
      sendMutation.mutate({
        coachId,
        clientId,
        senderId: currentUserId,
        body
      });
      
      setText("");
      setSelectedFile(null);
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
        setLocalPreviewUrl(null);
      }
    } catch (error) {
      console.error("Send error:", error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  };

  return (
    <GlassCard className="p-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 backdrop-blur">
        <h3 className="font-semibold text-sm sm:text-base">{title}</h3>
        <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Messages */}
      <div ref={listRef} className="h-80 overflow-y-auto space-y-2 px-3 py-3 bg-background/60">
        {isLoading ? (
          <p className="text-xs text-muted-foreground px-2">Loading messages...</p>
        ) : error ? (
          <div className="px-2 space-y-2">
            <p className="text-xs text-red-500">Failed to load messages.</p>
            <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? "Retrying..." : "Retry"}
            </Button>
            <p className="text-[10px] text-muted-foreground">Thread: coach={coachId} client={clientId}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.length === 0 && (
              <p className="text-xs text-muted-foreground px-2">No messages yet. Say hello!</p>
            )}
            {sorted.map((m: Message) => {
              const mine = m.senderId === currentUserId;
              const time = new Date(m.createdAt);
              const timeText = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const dateText = time.toLocaleDateString([], { year: 'numeric', month: 'short', day: '2-digit' });
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-3 py-2 text-sm shadow-sm rounded-2xl ${mine ? "bg-blue-500 text-white rounded-br-sm" : "bg-zinc-800 text-zinc-100 rounded-bl-sm"}`}>
                    <div className="space-y-1">
                      {/* Broadcast title */}
                      {m.groupMessageTitle && (
                        <div className={`font-semibold ${mine ? "text-white" : "text-zinc-100"}`}>
                          {m.groupMessageTitle}
                        </div>
                      )}
                      {m.body.split(/\n+/).map((line, idx) => {
                        const trimmed = line.trim();
                        const isUrl = /^(https?:\/\/|\/uploads\/)/.test(trimmed);
                        const isImage = /\.(png|jpe?g|gif|webp|heic|heif)$/i.test(trimmed);
                        const isVideo = /\.(mp4|webm|mov|qt)$/i.test(trimmed);
                        if (isUrl && isImage) {
                          return (
                            <div key={idx} className="space-y-1">
                              <a href={trimmed} target="_blank" rel="noreferrer">
                                <img src={trimmed} alt="attachment" className="max-h-48 rounded-md" />
                              </a>
                              <div className="flex gap-2 text-[11px]">
                                <Button size="sm" variant="outline" className="h-6 px-2 py-0" onClick={() => window.open(trimmed, '_blank')}>Open</Button>
                                <Button size="sm" variant="outline" className="h-6 px-2 py-0" onClick={() => handleDownload(trimmed)}>Download</Button>
                                <Button size="sm" variant="outline" className="h-6 px-2 py-0" onClick={() => handleCopyLink(trimmed)}>Copy Link</Button>
                              </div>
                            </div>
                          );
                        }
                        if (isUrl && isVideo) {
                          return (
                            <div key={idx} className="space-y-1">
                              <video src={trimmed} controls className="max-h-56 rounded-md" />
                              <div className="flex gap-2 text-[11px]">
                                <Button size="sm" variant="outline" className="h-6 px-2 py-0" onClick={() => window.open(trimmed, '_blank')}>Open</Button>
                                <Button size="sm" variant="outline" className="h-6 px-2 py-0" onClick={() => handleDownload(trimmed)}>Download</Button>
                                <Button size="sm" variant="outline" className="h-6 px-2 py-0" onClick={() => handleCopyLink(trimmed)}>Copy Link</Button>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div key={idx} className="whitespace-pre-wrap break-words leading-snug">
                            {isUrl ? (
                              <div className="space-y-1">
                                <a href={trimmed} className="underline" target="_blank" rel="noreferrer">{trimmed}</a>
                                <div className="flex gap-2 text-[11px]">
                                  <Button size="sm" variant="outline" className="h-6 px-2 py-0" onClick={() => window.open(trimmed, '_blank')}>Open</Button>
                                  <Button size="sm" variant="outline" className="h-6 px-2 py-0" onClick={() => handleDownload(trimmed)}>Download</Button>
                                  <Button size="sm" variant="outline" className="h-6 px-2 py-0" onClick={() => handleCopyLink(trimmed)}>Copy Link</Button>
                                </div>
                              </div>
                            ) : (
                              line
                            )}
                          </div>
                        );
                      })}
                      {/* Attached workout pill */}
                      {m.workoutName && (
                        <div className={`mt-1 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${mine ? "border-white/30 text-white/90" : "border-zinc-500/40 text-zinc-300"}`}>
                          <span>Attached workout:</span>
                          <span className="font-medium">{m.workoutName}</span>
                        </div>
                      )}
                    </div>
                    <div className={`text-[10px] mt-1 ${mine ? "text-white/80" : "text-zinc-400"} text-right`}>{dateText} · {timeText}</div>
                    {/* Group message confirmation button for clients */}
                    {!mine && m.groupMessageId && m.requiresConfirmation && !m.confirmedAt && (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          onClick={() => confirmGroupMessage(m.groupMessageId!)}
                          disabled={confirmingMessageId === m.groupMessageId}
                          className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-400/30 rounded-full px-3 py-1 text-xs flex items-center gap-1"
                        >
                          {confirmingMessageId === m.groupMessageId ? (
                            "Confirming..."
                          ) : (
                            <>
                              <Check className="h-3 w-3" />
                              Got it
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* Input bar */}
      <div className="border-t border-white/10 px-3 py-2 bg-background/80">
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setSelectedFile(f);
              const url = URL.createObjectURL(f);
              if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
              setLocalPreviewUrl(url);
              // reset input so same file can be picked again later
              e.currentTarget.value = "";
            }}
          />
          <Button size="icon" variant="ghost" className="rounded-full" onClick={() => fileRef.current?.click()}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message"
              className="rounded-full"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
            />
          </div>
          <Button size="icon" variant="ghost" className="rounded-full" onClick={() => setShowEmoji((v) => !v)}>
            {showEmoji ? <X className="h-4 w-4" /> : <Smile className="h-4 w-4" />}
          </Button>
          <Button onClick={onSend} disabled={sendMutation.isPending || (!text.trim() && !selectedFile)} className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-3">
            {sendMutation.isPending ? "..." : <SendHorizonal className="h-4 w-4" />}
          </Button>
        </div>
        {selectedFile && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            {localPreviewUrl && selectedFile.type.startsWith("image/") && (
              <img src={localPreviewUrl} alt="preview" className="h-10 w-10 object-cover rounded" />
            )}
            {localPreviewUrl && selectedFile.type.startsWith("video/") && (
              <video src={localPreviewUrl} className="h-10 rounded" muted playsInline />
            )}
            <span className="truncate max-w-[60%]">{selectedFile.name}</span>
            <Button size="sm" variant="ghost" onClick={() => {
              setSelectedFile(null);
              if (localPreviewUrl) { URL.revokeObjectURL(localPreviewUrl); setLocalPreviewUrl(null); }
            }}>Remove</Button>
          </div>
        )}
        {showEmoji && (
          <div className="mt-2 px-1 grid grid-cols-8 gap-1 text-lg">
            {[
              "😀","😁","😂","🤣","😊","😍","🤩","😘","😉","😎","👍","💪","🔥","🙌","👏","🏋️‍♂️","🏋️‍♀️","🏃‍♂️","🏃‍♀️"
            ].map((e, idx) => (
              <button
                key={idx}
                className="hover:bg-muted rounded"
                onClick={() => setText((prev) => prev + e)}
                aria-label={`emoji-${idx}`}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}

export default ChatThread;
