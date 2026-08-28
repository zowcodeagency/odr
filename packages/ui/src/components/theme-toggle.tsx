import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/cn.ts";

const KEY = "odr.theme";

export type Theme = "light" | "dark";

// No explicit choice means the OS preference is what's on screen — start from
// that, or the first tap on a system-dark phone "changes" to dark and looks dead.
const current = (): Theme => {
  const set = document.documentElement.dataset["theme"];
  if (set === "dark" || set === "light") return set;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

/**
 * Sun/moon theme switch. The pre-paint script in index.html has already
 * resolved localStorage → system preference onto <html data-theme>, so this
 * only has to flip and persist.
 */
export const ThemeToggle = ({ className }: { className?: string }) => {
  const [theme, setTheme] = useState<Theme>(current);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset["theme"] = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode — the choice just won't stick */
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Light theme" : "Dark theme"}
      className={cn(
        "h-8 w-8 grid place-items-center rounded-[var(--radius-2)]",
        "text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)]",
        "hover:bg-[var(--bg-surface-2)] transition-colors duration-[var(--dur-quick)]",
        className,
      )}
    >
      {theme === "dark" ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
    </button>
  );
};
