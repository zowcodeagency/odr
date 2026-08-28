import { cn } from "../lib/cn.ts";

/**
 * FSSAI-style veg/non-veg square — required signage motif on Indian menus.
 * Solid dot inside a colored ring, 12px square.
 */
export const VegMark = ({
  veg,
  size = 12,
  className,
}: {
  veg: boolean;
  size?: number;
  className?: string;
}) => {
  const color = veg ? "var(--status-settled)" : "var(--status-voided)";
  return (
    <span
      role="img"
      aria-label={veg ? "vegetarian" : "non-vegetarian"}
      className={cn("inline-grid place-items-center", className)}
      style={{
        width: size,
        height: size,
        border: `1.5px solid ${color}`,
        borderRadius: 2,
      }}
    >
      <span
        style={{
          width: Math.round(size * 0.45),
          height: Math.round(size * 0.45),
          background: color,
          borderRadius: 9999,
        }}
      />
    </span>
  );
};
