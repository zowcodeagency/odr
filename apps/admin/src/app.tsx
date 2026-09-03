import { useEffect, useState } from "react";
import {
  api,
  ApiError,
  KEY_STORAGE,
  tenantId,
  type Restaurant,
} from "./api.ts";
import { Drawer } from "./drawer.tsx";
import {
  Button,
  Card,
  Field,
  Note,
  StatusPill,
  fmtDate,
  inputClass,
} from "./ui.tsx";

const THEME_STORAGE = "odr.adminTheme";
const today = () => new Date().toISOString().slice(0, 10);

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (document.documentElement.dataset["theme"] as "light" | "dark") ?? "light",
  );
  useEffect(() => {
    document.documentElement.dataset["theme"] = theme;
    localStorage.setItem(THEME_STORAGE, theme);
  }, [theme]);
  return [theme, () => setTheme(theme === "dark" ? "light" : "dark")] as const;
}

function ThemeToggle() {
  const [theme, toggle] = useTheme();
  return (
    <Button variant="ghost" onClick={toggle} title="Switch theme">
      {theme === "dark" ? "Light" : "Dark"}
    </Button>
  );
}

function Gate({ onUnlock }: { onUnlock: (key: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-6">
      <form
        className="w-full max-w-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (!email.trim() || !password || busy) return;
          setBusy(true);
          setError("");
          api
            .signIn(email.trim(), password)
            .then(onUnlock)
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : "Sign-in failed.");
              setBusy(false);
            });
        }}
      >
        <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">Odr</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Internal admin</h1>
        <p className="mt-2 text-sm text-muted">
          Sign in with your team account to manage restaurant subscriptions.
        </p>
        <div className="mt-6 space-y-3">
          <Field label="Email">
            <input
              autoFocus
              type="email"
              className={inputClass}
              placeholder="you@odr.team"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              className={inputClass}
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error ? <Note kind="error">{error}</Note> : null}
          <Button className="w-full" disabled={!email.trim() || !password || busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </div>
      </form>
    </main>
  );
}

function CreateForm({
  adminKey,
  onCreated,
  onUnauthorized,
}: {
  adminKey: string;
  onCreated: () => void;
  onUnauthorized: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    ownerFullName: "",
    ownerEmail: "",
    ownerPassword: "",
    gstin: "",
    startDate: today(),
    months: "3",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Record<string, string> | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreated(null);
    const months = Number(form.months);
    if (!form.name.trim()) return setError("Restaurant name is required.");
    if (!form.ownerFullName.trim()) return setError("Owner's full name is required.");
    if (!form.ownerEmail.includes("@")) return setError("Enter a valid owner email.");
    if (form.ownerPassword.length < 8)
      return setError("Temporary password must be at least 8 characters.");
    if (!Number.isInteger(months) || months < 1)
      return setError("Duration must be a whole number of months, 1 or more.");

    setBusy(true);
    try {
      const res = await api.create(adminKey, {
        name: form.name.trim(),
        ownerFullName: form.ownerFullName.trim(),
        ownerEmail: form.ownerEmail.trim(),
        ownerPassword: form.ownerPassword,
        startDate: form.startDate,
        months,
        ...(form.gstin.trim() ? { gstin: form.gstin.trim() } : {}),
      });
      setCreated(res ?? {});
      setForm({ ...form, name: "", ownerFullName: "", ownerEmail: "", ownerPassword: "", gstin: "" });
      onCreated();
    } catch (err) {
      if (err instanceof ApiError && err.unauthorized) return onUnauthorized();
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Add a restaurant" subtitle="Creates the account, outlet and owner login.">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Restaurant name">
          <input className={inputClass} placeholder="Spice Route" value={form.name} onChange={set("name")} />
        </Field>
        <Field label="Owner's full name">
          <input className={inputClass} placeholder="Ravi Kumar" value={form.ownerFullName} onChange={set("ownerFullName")} />
        </Field>
        <Field label="Owner email">
          <input className={inputClass} type="email" placeholder="ravi@spiceroute.in" value={form.ownerEmail} onChange={set("ownerEmail")} />
        </Field>
        <Field label="Temporary password" hint="share with the owner">
          <input className={inputClass} value={form.ownerPassword} onChange={set("ownerPassword")} placeholder="min 8 characters" />
        </Field>
        <Field label="GSTIN" hint="optional">
          <input className={inputClass} placeholder="29ABCDE1234F1Z5" value={form.gstin} onChange={set("gstin")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input className={inputClass} type="date" value={form.startDate} onChange={set("startDate")} />
          </Field>
          <Field label="Duration" hint="months">
            <input className={inputClass} inputMode="numeric" value={form.months} onChange={set("months")} />
          </Field>
        </div>

        {error ? <Note kind="error">{error}</Note> : null}
        {created ? (
          <Note kind="success">
            <span className="block font-medium">Restaurant created.</span>
            <span className="mt-1 block">
              Share the email and temporary password with the owner — this page won't show the
              password again.
            </span>
            {Object.entries(created).length > 0 ? (
              <span className="mt-2 block font-mono text-[11px] break-all opacity-80">
                {Object.entries(created)
                  .map(([k, v]) => `${k}: ${String(v)}`)
                  .join("\n")}
              </span>
            ) : null}
          </Note>
        ) : null}

        <Button disabled={busy}>{busy ? "Creating…" : "Create restaurant"}</Button>
      </form>
    </Card>
  );
}

function List({
  rows,
  loading,
  error,
  onRefresh,
  onOpen,
}: {
  rows: Restaurant[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onOpen: (r: Restaurant) => void;
}) {
  return (
    <section className="rounded-xl border bg-surface">
      <header className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">Restaurants</h2>
          <p className="mt-0.5 text-xs text-muted">
            {loading ? "Loading…" : `${rows.length} on the books`}
          </p>
        </div>
        <Button variant="ghost" onClick={onRefresh} disabled={loading}>
          Refresh
        </Button>
      </header>

      {error ? (
        <div className="p-5">
          <Note kind="error">{error}</Note>
        </div>
      ) : rows.length === 0 && !loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted">
          No restaurants yet. Add the first one on the right.
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr className="border-b">
              <th className="px-5 py-2.5 font-medium">Restaurant</th>
              <th className="px-5 py-2.5 font-medium">Outlets</th>
              <th className="px-5 py-2.5 font-medium">Ends</th>
              <th className="px-5 py-2.5 font-medium">Days left</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={tenantId(r) || i}
                onClick={() => onOpen(r)}
                className="cursor-pointer border-b last:border-0 hover:bg-raised"
              >
                <td className="px-5 py-3 font-medium">{r.name}</td>
                <td className="px-5 py-3 font-mono">{r.outletCount ?? "—"}</td>
                <td className="px-5 py-3 text-muted">{fmtDate(r.subscriptionEnd)}</td>
                <td className="px-5 py-3 font-mono">
                  {r.daysRemaining === null || r.daysRemaining === undefined
                    ? "—"
                    : r.daysRemaining}
                </td>
                <td className="px-5 py-3">
                  <StatusPill status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function App() {
  const [adminKey, setAdminKey] = useState(
    () => localStorage.getItem(KEY_STORAGE) ?? "",
  );
  const [rows, setRows] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Restaurant | null>(null);

  const lockOut = () => {
    localStorage.removeItem(KEY_STORAGE);
    setAdminKey("");
    setOpen(null);
    setRows([]);
  };

  const refresh = () => {
    if (!adminKey) return;
    setLoading(true);
    setError("");
    api
      .list(adminKey)
      .then((r) => setRows(Array.isArray(r) ? r : []))
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.unauthorized) return lockOut();
        setError(e instanceof Error ? e.message : "Couldn't load restaurants.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(refresh, [adminKey]);

  if (!adminKey)
    return (
      <Gate
        onUnlock={(k) => {
          localStorage.setItem(KEY_STORAGE, k);
          setAdminKey(k);
        }}
      />
    );

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-10 border-b bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-semibold tracking-tight">Odr</span>
            <span className="text-xs text-muted">Internal admin</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" onClick={lockOut}>
              Lock
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1.6fr_1fr]">
        <List
          rows={rows}
          loading={loading}
          error={error}
          onRefresh={refresh}
          onOpen={setOpen}
        />
        <CreateForm adminKey={adminKey} onCreated={refresh} onUnauthorized={lockOut} />
      </main>

      {open ? (
        <Drawer
          adminKey={adminKey}
          restaurant={open}
          onClose={() => setOpen(null)}
          onChanged={refresh}
          onUnauthorized={lockOut}
        />
      ) : null}
    </div>
  );
}
