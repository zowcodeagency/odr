import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@odr/ui";
import { QrImage } from "../features/qr/qr-image.tsx";

/**
 * Box only. Staff scan a QR on the computer's screen and land on the Box from
 * their phone — no typing an IP address. The Box computes the addresses per
 * request, so a wifi change is picked up on the next open.
 */
export const PhoneLink = () => {
  const [open, setOpen] = useState(false);
  const [urls, setUrls] = useState<string[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setUrls(null);
    void fetch("/box/phone-urls")
      .then((r) => r.json() as Promise<{ urls: string[] }>)
      .then((r) => setUrls(r.urls))
      .catch(() => setUrls([]));
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-pill)] text-[13px] font-medium
                   ring-1 ring-[var(--line-default)] text-[var(--fg-secondary)] hover:bg-[var(--bg-surface-2)]"
      >
        <Smartphone size={15} /> <span className="hidden sm:inline">Phone link</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[min(360px,calc(100vw-32px))]">
          <DialogTitle>Open Odr on a phone</DialogTitle>
          <DialogDescription>Scan with the phone's camera. It must be on the same wifi as this computer.</DialogDescription>
          {urls === null ? (
            <p className="mt-6 text-[13px] text-[var(--fg-muted)]">Finding this computer's address…</p>
          ) : urls.length === 0 ? (
            <p className="mt-6 text-[13px] text-[var(--status-voided)]">No wifi address found. Connect this computer to the restaurant wifi and try again.</p>
          ) : (
            <div className="mt-6 space-y-6">
              {urls.map((u) => (
                <div key={u} className="flex flex-col items-center gap-3">
                  <QrImage value={u} size={200} className="rounded-[var(--radius-2)] bg-white p-3" />
                  <code className="text-[14px] font-mono select-all">{u}</code>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
