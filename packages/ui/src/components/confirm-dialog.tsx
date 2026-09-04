import { Loader2 } from "lucide-react";
import { Button } from "../primitives/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../primitives/dialog.tsx";

/**
 * Themed replacement for window.confirm — the native one shows the browser's
 * chrome and origin URL in the middle of an owner-branded app.
 */
export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = true,
  busy = false,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="w-[min(420px,calc(100vw-32px))]">
      <DialogTitle>{title}</DialogTitle>
      {description ? <DialogDescription>{description}</DialogDescription> : null}
      <div className="mt-6 grid grid-cols-2 gap-2">
        <Button type="button" size="lg" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </Button>
        <Button type="button" size="lg" variant={danger ? "danger" : "primary"} disabled={busy} onClick={onConfirm} autoFocus>
          {busy ? <Loader2 size={16} className="animate-spin" /> : null} {confirmLabel}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
);
