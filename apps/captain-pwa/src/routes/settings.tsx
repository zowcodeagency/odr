import { useEffect, useState, type ReactNode } from "react";
import { Loader2, Printer, QrCode, Trash2, UserPlus, Wifi } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input } from "@odr/ui";
import { ApiError, api, errorCode, type Staff, type Table } from "../lib/api.ts";
import { navigate } from "../lib/router.ts";
import { useAsync, type Async } from "../lib/use-async.ts";
import { toast } from "../lib/toast.tsx";
import { parseLabels } from "../features/tables/labels.ts";
import { QrImage, tableQrUrl } from "../features/qr/qr-image.tsx";
import { canManage, outletPatch, patchSession, type Session } from "../lib/session.ts";

const Section = ({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) => (
  <section className="rounded-[var(--radius-3)] ring-1 ring-[var(--line-default)] bg-[var(--bg-surface)] overflow-hidden">
    <header className="px-5 py-3.5 border-b border-[var(--line-subtle)]">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
      {hint ? <p className="mt-0.5 text-[13px] text-[var(--fg-tertiary)]">{hint}</p> : null}
    </header>
    <div className="p-5">{children}</div>
  </section>
);

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block">
    <span className="block text-[13px] font-medium text-[var(--fg-secondary)] mb-1.5">
      {label}
    </span>
    {children}
  </label>
);

/* ---------------------------------------------------------------- outlet -- */

const OutletSection = ({ session }: { session: Session }) => {
  // Fetch the full row: the session only carries the address as one line.
  const q = useAsync(() => api.outlets().then((all) => all.find((o) => o.id === session.outletId) ?? null), [session.outletId]);
  const [form, setForm] = useState<{
    name: string; gstin: string; line1: string; line2: string; city: string; state: string; pincode: string; invoicePrefix: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const o = q.data;
  useEffect(() => {
    if (o && form === null) {
      setForm({
        name: o.name,
        gstin: o.gstin ?? "",
        line1: o.address?.line1 === "-" ? "" : (o.address?.line1 ?? ""),
        line2: o.address?.line2 ?? "",
        city: o.address?.city === "-" ? "" : (o.address?.city ?? ""),
        state: o.address?.state === "-" ? "" : (o.address?.state ?? ""),
        pincode: o.address?.pincode === "-" ? "" : (o.address?.pincode ?? ""),
        invoicePrefix: o.invoicePrefix ?? "INV",
      });
    }
  }, [o, form]);

  const save = async () => {
    if (!form || !o) return;
    setBusy(true);
    try {
      const updated = await api.patchOutlet(o.id, {
        name: form.name.trim(),
        gstin: form.gstin.trim() || null,
        address: {
          line1: form.line1.trim() || "-",
          ...(form.line2.trim() ? { line2: form.line2.trim() } : {}),
          city: form.city.trim() || "-",
          state: form.state.trim() || "-",
          pincode: form.pincode.trim() || "-",
          country: o.address?.country ?? "IN",
        },
        invoicePrefix: form.invoicePrefix.trim().toUpperCase() || "INV",
      });
      // Bills print the header from the session — keep it current.
      patchSession(outletPatch(updated));
      toast("Outlet details saved");
      q.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof NonNullable<typeof form>) => (e: { target: { value: string } }) =>
    setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  return (
    <Section
      title="Outlet"
      hint={
        session.menuMode === "own"
          ? "This outlet has its own menu."
          : session.outlets.length > 1
            ? "Shares the brand menu with your other outlets."
            : "Name, GSTIN and address as printed on every bill."
      }
    >
      {!form ? (
        <p className="text-[13px] text-[var(--fg-muted)]">{q.error ?? "Loading…"}</p>
      ) : (
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => { e.preventDefault(); void save(); }}
        >
          <Field label="Outlet name"><Input required value={form.name} onChange={set("name")} className="h-11" /></Field>
          <Field label="GSTIN"><Input value={form.gstin} onChange={set("gstin")} placeholder="29ABCDE1234F1Z5" maxLength={15} className="h-11 font-mono uppercase" /></Field>
          <Field label="Address line 1"><Input value={form.line1} onChange={set("line1")} className="h-11" /></Field>
          <Field label="Address line 2"><Input value={form.line2} onChange={set("line2")} className="h-11" /></Field>
          <Field label="City"><Input value={form.city} onChange={set("city")} className="h-11" /></Field>
          <Field label="State"><Input value={form.state} onChange={set("state")} className="h-11" /></Field>
          <Field label="PIN code"><Input value={form.pincode} onChange={set("pincode")} inputMode="numeric" className="h-11" /></Field>
          <Field label="Invoice prefix"><Input value={form.invoicePrefix} onChange={set("invoicePrefix")} maxLength={8} className="h-11 font-mono uppercase" /></Field>
          <Button type="submit" size="lg" disabled={busy} className="sm:col-span-2 sm:w-auto sm:justify-self-start">
            {busy ? <Loader2 size={16} className="animate-spin" /> : null} Save
          </Button>
        </form>
      )}
    </Section>
  );
};

type SettingsTab = "outlet" | "tables" | "printing" | "staff";

const TABS: { key: SettingsTab; label: string }[] = [
  { key: "outlet", label: "Outlet" },
  { key: "tables", label: "Tables" },
  { key: "printing", label: "Printing" },
  { key: "staff", label: "Staff" },
];

export const SettingsRoute = ({ session }: { session: Session }) => {
  const [tab, setTab] = useState<SettingsTab>("outlet");
  // One tables query for both sections — the QR grid must never lag behind
  // the list the owner just edited.
  const tablesQ = useAsync(() => api.tables(session.outletId), [session.outletId]);

  if (!canManage(session.role)) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-[15px] font-medium">Settings are for owners and managers</p>
        <p className="mt-1.5 text-[13px] text-[var(--fg-tertiary)]">
          Ask the owner to add tables, staff or printers.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-7 lg:px-10 max-w-[900px] mx-auto grid gap-5">
      <header>
        <h1 className="text-[20px] sm:text-[22px] font-semibold tracking-[-0.02em]">Settings</h1>
        <p className="mt-1 text-[13px] text-[var(--fg-tertiary)]">{session.outletName}</p>
      </header>

      <nav
        aria-label="settings sections"
        className="flex p-1 gap-1 rounded-[var(--radius-pill)] bg-[var(--bg-surface-2)]
                   ring-1 ring-[var(--line-subtle)] self-start w-full sm:w-auto"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? "page" : undefined}
            className={`flex-1 sm:flex-none sm:px-6 min-h-11 rounded-[var(--radius-pill)] text-[14px]
                        transition-colors duration-[var(--dur-quick)] ${
                          tab === t.key
                            ? "bg-[var(--bg-surface)] font-medium shadow-[var(--shadow-1)]"
                            : "text-[var(--fg-muted)]"
                        }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "outlet" ? <OutletSection key={session.outletId} session={session} /> : null}
      {tab === "tables" ? (
        <>
          <TablesSection session={session} q={tablesQ} />
          <QrSection session={session} q={tablesQ} />
        </>
      ) : null}
      {tab === "printing" ? <PrinterSection session={session} /> : null}
      {tab === "staff" ? <StaffSection session={session} /> : null}
    </div>
  );
};

/* ---------------------------------------------------------------- tables -- */

const TablesSection = ({ session, q }: { session: Session; q: Async<Table[]> }) => {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const tables = q.data ?? [];
  const preview = parseLabels(input);

  const add = async () => {
    if (preview.length === 0) return;
    setBusy(true);
    try {
      await api.addTables(session.outletId, preview);
      setInput("");
      q.reload();
      toast(`${preview.length} table${preview.length === 1 ? "" : "s"} saved`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not add tables");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: Table) => {
    try {
      await api.deleteTable(t.id);
      q.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not remove the table");
    }
  };

  return (
    <Section title="Tables" hint="What the floor screen shows. Type a range to add many.">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="T-1 to T-12   ·   or  Bar-1, Win-2"
          className="h-11 flex-1 min-w-[220px]"
        />
        <Button type="submit" size="lg" disabled={busy || preview.length === 0}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          Add {preview.length > 0 ? preview.length : ""}
        </Button>
      </form>
      {preview.length > 1 ? (
        <p className="mt-2 text-[12px] text-[var(--fg-tertiary)]">
          Will add: {preview.slice(0, 6).join(", ")}
          {preview.length > 6 ? ` … +${preview.length - 6}` : ""}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {q.loading && tables.length === 0 ? (
          <p className="text-[13px] text-[var(--fg-muted)]">Loading…</p>
        ) : q.error ? (
          <p className="text-[13px] text-[var(--status-voided)]">{q.error}</p>
        ) : tables.length === 0 ? (
          <p className="text-[13px] text-[var(--fg-muted)]">
            No tables yet — add them above and the floor screen fills in.
          </p>
        ) : (
          tables.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 h-11 pl-3.5 pr-1 rounded-[var(--radius-2)]
                         ring-1 ring-[var(--line-default)] text-[14px]"
            >
              {t.label}
              <button
                onClick={() => void remove(t)}
                aria-label={`Remove ${t.label}`}
                className="h-11 w-11 grid place-items-center text-[var(--fg-muted)] hover:text-[var(--status-voided)]"
              >
                <Trash2 size={14} />
              </button>
            </span>
          ))
        )}
      </div>
    </Section>
  );
};

/* -------------------------------------------------------------------- QR -- */

const QrSection = ({ session, q }: { session: Session; q: Async<Table[]> }) => {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tables = q.data ?? [];

  const generate = async () => {
    setBusy(true);
    try {
      const { publicToken } = await api.qrToken(session.outletId);
      setToken(publicToken);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not create the QR token");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Table QR codes" hint="Diners scan, browse the menu and order — no app, no login.">
      <div className="flex flex-wrap gap-2">
        <Button size="lg" onClick={() => void generate()} disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
          {token ? "Refresh codes" : "Generate codes"}
        </Button>
        {token ? (
          <Button size="lg" variant="outline" onClick={() => navigate({ name: "qr" })}>
            <Printer size={16} /> Print sheet
          </Button>
        ) : null}
      </div>

      {token ? (
        tables.length === 0 ? (
          <p className="mt-4 text-[13px] text-[var(--fg-muted)]">Add tables first.</p>
        ) : (
          <div className="mt-5 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
            {tables.map((t) => (
              <div
                key={t.id}
                className="p-3 text-center rounded-[var(--radius-2)] ring-1 ring-[var(--line-default)] bg-white"
              >
                <QrImage
                  value={tableQrUrl(session.outletId, t.label, token)}
                  size={104}
                  className="mx-auto"
                />
                <p className="mt-2 text-[13px] font-medium text-black">{t.label}</p>
              </div>
            ))}
          </div>
        )
      ) : null}
    </Section>
  );
};

/* --------------------------------------------------------------- printer -- */

const PrinterSection = ({ session }: { session: Session }) => {
  const [paperWidth, setPaperWidth] = useState(session.paperWidth);
  const [ip, setIp] = useState(session.printerIp ?? "");
  const [port, setPort] = useState(String(session.printerPort ?? 9100));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api.patchOutlet(session.outletId, {
        paperWidth,
        printerIp: ip.trim() || null,
        printerPort: Number(port) || 9100,
      });
      patchSession({
        paperWidth,
        printerIp: ip.trim() || null,
        printerPort: Number(port) || 9100,
      });
      toast("Printer settings saved");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    try {
      await api.printTest(session.outletId);
      toast("Test slip sent to the printer");
    } catch (e) {
      toast(
        errorCode(e) === "NO_PRINTER"
          ? "No printer answered — check the IP and that it's on the same Wi-Fi"
          : e instanceof ApiError && e.status === 404
            ? "Test print isn't available on this API build yet"
            : e instanceof Error
              ? e.message
              : "Test print failed",
      );
    }
  };

  return (
    <Section title="Printing" hint="Paper size shapes every bill and KOT the browser prints.">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Paper width">
          <div className="flex gap-2">
            {[58, 80].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setPaperWidth(w)}
                className={
                  paperWidth === w
                    ? "flex-1 h-11 text-[14px] font-medium rounded-[var(--radius-2)] bg-[var(--accent)] text-[var(--fg-on-accent)]"
                    : "flex-1 h-11 text-[14px] rounded-[var(--radius-2)] ring-1 ring-[var(--line-default)]"
                }
              >
                {w}mm
              </button>
            ))}
          </div>
        </Field>
        <Field label="Kitchen printer IP">
          <Input
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="192.168.1.50"
            inputMode="decimal"
            className="h-11"
          />
        </Field>
        <Field label="Port">
          <Input
            value={port}
            onChange={(e) => setPort(e.target.value)}
            inputMode="numeric"
            className="h-11"
          />
        </Field>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="lg" onClick={() => void save()} disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : null} Save
        </Button>
        <Button size="lg" variant="outline" onClick={() => void test()}>
          <Wifi size={16} /> Test print
        </Button>
      </div>
    </Section>
  );
};

/* ----------------------------------------------------------------- staff -- */

const ROLES = ["captain", "cashier", "kitchen", "manager", "owner"];

const BLANK_MEMBER = { fullName: "", email: "", password: "", role: "captain", outletId: "" };

const StaffSection = ({ session }: { session: Session }) => {
  const q = useAsync(() => api.staff(), []);
  const [form, setForm] = useState(BLANK_MEMBER);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const staff: Staff[] = q.data ?? [];
  // Only owners hold user:write — a manager sees the list, read-only.
  const isOwner = session.role === "owner";
  const owners = staff.filter((s) => s.role === "owner").length;

  const remove = async (s: Staff) => {
    if (!window.confirm(`Remove ${s.fullName}? They will no longer be able to sign in.`)) return;
    try {
      await api.removeStaff(s.id);
      q.reload();
      toast(`${s.fullName} removed`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not remove them");
    }
  };

  const add = async () => {
    setBusy(true);
    try {
      const pinned = form.role !== "owner" && form.role !== "manager";
      await api.addStaff({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        role: form.role,
        ...(pinned ? { outletId: form.outletId } : {}),
      });
      setOpen(false);
      q.reload();
      toast(`${form.fullName} can now sign in`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not add the staff member");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Staff" hint="Everyone who can sign in to this restaurant.">
      {q.loading && staff.length === 0 ? (
        <p className="text-[13px] text-[var(--fg-muted)]">Loading…</p>
      ) : q.error ? (
        <p className="text-[13px] text-[var(--status-voided)]">{q.error}</p>
      ) : (
        <ul className="mb-5 divide-y divide-[var(--line-subtle)]">
          {staff.map((s) => (
            <li key={s.id} className="py-2.5 flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-[14px] font-medium truncate">{s.fullName}</span>
                <span className="block text-[12px] text-[var(--fg-tertiary)] truncate">
                  {s.email}{s.outletName ? ` · ${s.outletName}` : session.outlets.length > 1 ? " · all outlets" : ""}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--fg-muted)] font-mono">
                  {s.role}
                </span>
                {/* Never offer the two removals the API would refuse anyway. */}
                {isOwner && s.id !== session.userId && !(s.role === "owner" && owners === 1) ? (
                  <button
                    onClick={() => void remove(s)}
                    aria-label={`Remove ${s.fullName}`}
                    className="h-11 w-11 grid place-items-center text-[var(--fg-muted)] hover:text-[var(--status-voided)]"
                  >
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!isOwner ? (
        <p className="text-[13px] text-[var(--fg-tertiary)]">
          Only the owner can add or remove staff.
        </p>
      ) : (
        <Button
          size="lg"
          className="w-full sm:w-auto"
          onClick={() => {
            setForm({ ...BLANK_MEMBER, outletId: session.outletId });
            setOpen(true);
          }}
        >
          <UserPlus size={16} /> Add member
        </Button>
      )}

      {open ? (
        <Dialog open onOpenChange={(v) => !v && setOpen(false)}>
          <DialogContent>
            <DialogTitle>Add member</DialogTitle>
            <DialogDescription>
              They sign in with this email and password right away.
            </DialogDescription>

            <form
              className="mt-5 grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                void add();
              }}
            >
              <Field label="Name">
                <Input
                  required
                  autoFocus
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="h-11"
                />
              </Field>
              <Field label="Email">
                <Input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="h-11"
                />
              </Field>
              <Field label="Password">
                <Input
                  required
                  minLength={8}
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="h-11"
                />
              </Field>
              <Field label="Role">
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="h-11 w-full px-3 text-[14px] rounded-[var(--radius-2)]
                             bg-[var(--bg-surface)] ring-1 ring-[var(--line-default)]
                             focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </Field>
              {form.role !== "owner" && form.role !== "manager" ? (
                <Field label="Works at">
                  <select
                    value={form.outletId}
                    onChange={(e) => setForm({ ...form, outletId: e.target.value })}
                    className="h-11 w-full px-3 text-[14px] rounded-[var(--radius-2)]
                               bg-[var(--bg-surface)] ring-1 ring-[var(--line-default)]
                               focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  >
                    {session.outlets.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </Field>
              ) : (
                <p className="self-end pb-3 text-[12px] text-[var(--fg-tertiary)]">Sees every outlet.</p>
              )}
              <Button type="submit" size="lg" disabled={busy} className="sm:col-span-2">
                {busy ? <Loader2 size={16} className="animate-spin" /> : null} Add member
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </Section>
  );
};
