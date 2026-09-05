import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Input } from "@odr/ui";
import { api, errorCode } from "../lib/api.ts";

/** First run of a Box: create the restaurant and its owner. Tables come later, in Settings. */
export const SetupRoute = ({ onDone }: { onDone: (email: string, password: string) => void }) => {
  const [f, setF] = useState({ name: "", gstin: "", ownerFullName: "", ownerEmail: "", ownerPassword: "", setupCode: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.setup({
        name: f.name.trim(),
        ownerFullName: f.ownerFullName.trim(),
        ownerEmail: f.ownerEmail.trim(),
        ownerPassword: f.ownerPassword,
        setupCode: f.setupCode.trim(),
        ...(f.gstin.trim() ? { gstin: f.gstin.trim().toUpperCase() } : {}),
      });
      onDone(f.ownerEmail.trim(), f.ownerPassword);
    } catch (err) {
      // The box is already set up (another tab/device won the race): reload lands on login.
      if (errorCode(err) === "CONFLICT") {
        window.location.reload();
        return;
      }
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, node: React.ReactNode) => (
    <label className="block">
      <span className="block text-[13px] font-medium text-[var(--fg-secondary)] mb-1.5">{label}</span>
      {node}
    </label>
  );

  return (
    <form onSubmit={submit} className="w-full max-w-[340px] mx-auto my-auto py-10 space-y-4">
      <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Set up this restaurant</h2>
      <p className="text-[13px] text-[var(--fg-tertiary)]">Done once, on this machine. You can add tables and staff in Settings afterwards.</p>
      {field("Restaurant name", <Input required value={f.name} onChange={set("name")} className="h-11" />)}
      {field("GSTIN (optional)", <Input value={f.gstin} onChange={set("gstin")} maxLength={15} placeholder="29ABCDE1234F1Z5" className="h-11 font-mono uppercase" />)}
      {field("Your name", <Input required value={f.ownerFullName} onChange={set("ownerFullName")} className="h-11" />)}
      {field("Your email", <Input required type="email" value={f.ownerEmail} onChange={set("ownerEmail")} className="h-11" />)}
      {field("Password (8+ characters)", <Input required type="password" minLength={8} value={f.ownerPassword} onChange={set("ownerPassword")} className="h-11" />)}
      {field(
        "Setup code",
        <>
          <Input required inputMode="numeric" pattern="\d{6}" maxLength={6} value={f.setupCode} onChange={set("setupCode")} className="h-11 font-mono" />
          <span className="mt-1 block text-[12px] text-[var(--fg-tertiary)]">Shown on the Box's screen when it starts</span>
        </>,
      )}
      {error ? <p className="text-[13px] text-[var(--status-voided)]">{error}</p> : null}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : null} Create and sign in
      </Button>
    </form>
  );
};
