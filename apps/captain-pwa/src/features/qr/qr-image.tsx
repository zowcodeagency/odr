import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { config } from "../../lib/config.ts";

/*
 * Where the diner's phone lands. Served as runtime config by src/server.ts
 * (set DINER_ORIGIN in production); in dev the diner app is the same host on
 * :3003. Printed QR cards outlive a redeploy — get this right before anyone
 * laminates them.
 */
const dinerOrigin = (): string =>
  config().dinerOrigin || window.location.origin.replace(/:\d+$/, ":3003");

export const tableQrUrl = (outletId: string, label: string, token: string): string =>
  `${dinerOrigin()}/#/o/${outletId}/t/${encodeURIComponent(label)}?k=${token}`;

/** Renders a QR as a data-URL <img> — prints cleanly, no canvas quirks. */
export const QrImage = ({
  value,
  size = 160,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    QRCode.toDataURL(value, { margin: 1, width: size * 2, errorCorrectionLevel: "M" })
      .then((d) => live && setSrc(d))
      .catch(() => live && setSrc(null));
    return () => {
      live = false;
    };
  }, [value, size]);

  // width 100% + aspect-ratio, not a fixed height: in a narrow grid cell the
  // reset's max-width would shrink only the width and stretch the code tall.
  const box = { width: "100%", maxWidth: size, aspectRatio: "1 / 1", height: "auto" } as const;

  return src ? (
    <img src={src} alt="" width={size} height={size} className={className} style={box} />
  ) : (
    <div className={className} style={{ ...box, background: "var(--bg-surface-3)" }} />
  );
};
