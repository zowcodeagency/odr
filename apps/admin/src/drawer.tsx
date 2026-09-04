import { useEffect, useState } from "react";
import { api, ApiError, tenantId, type AdminOutlet, type Restaurant, type Topup } from "./api.ts";
import { Button, Field, Note, StatusPill, fmtDate, inputClass } from "./ui.tsx";

const EXAMPLE = `{
  "categories": [
    {
      "name": "Starters",
      "items": [
        { "name": "Paneer Tikka", "price": 240, "taxClass": "GST_5", "isVeg": true,
          "description": "Char-grilled cottage cheese" },
        { "name": "Chicken 65", "price": 260 }
      ]
    },
    { "name": "Breads", "items": [{ "name": "Butter Naan", "price": 60, "isVeg": true }] }
  ]
}`;

const PROMPT_HELP = `Ask ChatGPT or Claude: "Read this menu photo and give me ONLY JSON in exactly this shape — categories is a list, each with a name and a list of items; each item needs name and price in rupees, and may have taxClass (GST_5, GST_12 or GST_18 — default GST_5), isVeg (true/false) and description. No extra text." Then paste its answer below.`;

/**
 * Turn pasted text into a request body, or a message the operator can act on.
 * Auto-detect: "{" → JSON as-is, anything else → CSV wrapper.
 */
function buildImportBody(text: string): { body: unknown } | { error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { error: "Paste the menu JSON or CSV first." };

  if (!trimmed.startsWith("{")) {
    if (!trimmed.includes(","))
      return {
        error:
          "That doesn't look like JSON (it should start with “{”) or CSV (comma-separated columns).",
      };
    return { body: { csv: trimmed } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      error:
        "That JSON couldn't be read — usually a missing comma, quote or closing bracket. Paste it back into ChatGPT/Claude and ask it to fix the JSON.",
    };
  }
  const categories = (parsed as { categories?: unknown }).categories;
  if (!Array.isArray(categories))
    return {
      error:
        'The JSON needs a top-level "categories" list. Check the example shape below.',
    };
  if (categories.length === 0)
    return { error: "The categories list is empty — nothing to import." };

  return { body: parsed };
}

const rupees = (t: Topup) => {
  const raw = t.amount ?? (t.amountMinor === undefined ? undefined : Number(t.amountMinor) / 100);
  return raw === undefined ? "—" : `₹${Number(raw).toLocaleString("en-IN")}`;
};

export function Drawer({
  adminKey,
  restaurant,
  onClose,
  onChanged,
  onUnauthorized,
}: {
  adminKey: string;
  restaurant: Restaurant;
  onClose: () => void;
  onChanged: () => void;
  onUnauthorized: () => void;
}) {
  const id = tenantId(restaurant);
  const [history, setHistory] = useState<Topup[] | null>(null);
  const [historyError, setHistoryError] = useState("");

  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState("3");
  const [note, setNote] = useState("");
  const [topupBusy, setTopupBusy] = useState(false);
  const [topupError, setTopupError] = useState("");
  const [topupOk, setTopupOk] = useState("");

  const [menuText, setMenuText] = useState("");
  const [menuBusy, setMenuBusy] = useState(false);
  const [menuError, setMenuError] = useState("");
  const [menuOk, setMenuOk] = useState("");

  const [outlets, setOutlets] = useState<AdminOutlet[] | null>(null);
  const [outletError, setOutletError] = useState("");
  const [addingOutlet, setAddingOutlet] = useState(false);
  const [outletForm, setOutletForm] = useState({
    name: "", gstin: "", line1: "", city: "", state: "Karnataka", pincode: "", menuMode: "shared" as "shared" | "own",
  });
  const [outletBusy, setOutletBusy] = useState(false);
  const [outletOk, setOutletOk] = useState("");
  const [importTarget, setImportTarget] = useState<string>(""); // "" = shared brand menu

  const [localBilling, setLocalBilling] = useState(restaurant.localBilling ?? false);
  const [featureError, setFeatureError] = useState("");
  const toggleLocalBilling = (on: boolean) => {
    setFeatureError("");
    setLocalBilling(on);
    api
      .setLocalBilling(adminKey, id, on)
      .then(onChanged)
      .catch((e: unknown) => { setLocalBilling(!on); fail(e, setFeatureError); });
  };

  const fail = (err: unknown, set: (m: string) => void) => {
    if (err instanceof ApiError && err.unauthorized) return onUnauthorized();
    set(err instanceof Error ? err.message : "Something went wrong.");
  };

  const loadOutlets = () => {
    setOutletError("");
    api.outlets(adminKey, id).then(setOutlets).catch((e: unknown) => { setOutlets([]); fail(e, setOutletError); });
  };
  useEffect(loadOutlets, [id]);

  async function submitOutlet(e: React.FormEvent) {
    e.preventDefault();
    setOutletError("");
    setOutletOk("");
    if (!outletForm.name.trim()) return setOutletError("Outlet name is required.");
    if (!outletForm.city.trim()) return setOutletError("City is required.");
    setOutletBusy(true);
    try {
      const res = await api.createOutlet(adminKey, id, {
        name: outletForm.name.trim(),
        ...(outletForm.gstin.trim() ? { gstin: outletForm.gstin.trim() } : {}),
        address: {
          line1: outletForm.line1.trim() || "-",
          city: outletForm.city.trim(),
          state: outletForm.state.trim() || "-",
          pincode: outletForm.pincode.trim() || "-",
          country: "IN",
        },
        menuMode: outletForm.menuMode,
      });
      setOutletOk(`Outlet added with code ${res.code}. The owner can now switch to it in the app.`);
      setOutletForm({ ...outletForm, name: "", gstin: "", line1: "", city: "", pincode: "" });
      setAddingOutlet(false);
      loadOutlets();
      onChanged();
    } catch (err) {
      fail(err, setOutletError);
    } finally {
      setOutletBusy(false);
    }
  }

  const toggleOutlet = (o: AdminOutlet) =>
    api.setOutletActive(adminKey, id, o.id, !o.isActive).then(loadOutlets).catch((e: unknown) => fail(e, setOutletError));

  const loadHistory = () => {
    setHistoryError("");
    api
      .topups(adminKey, id)
      .then(setHistory)
      .catch((e: unknown) => {
        setHistory([]);
        fail(e, setHistoryError);
      });
  };

  useEffect(loadHistory, [id]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onEsc);
    return () => removeEventListener("keydown", onEsc);
  }, [onClose]);

  async function submitTopup(e: React.FormEvent) {
    e.preventDefault();
    setTopupError("");
    setTopupOk("");
    const amt = Number(amount);
    const m = Number(months);
    if (!(amt > 0)) return setTopupError("Enter the amount received, in rupees.");
    if (!Number.isInteger(m) || m < 1)
      return setTopupError("Months to add must be a whole number, 1 or more.");

    setTopupBusy(true);
    try {
      const res = await api.addTopup(adminKey, id, {
        amount: amt,
        monthsAdded: m,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setTopupOk(`Recorded. Subscription now runs to ${fmtDate(res.subscriptionEnd)}.`);
      setAmount("");
      setNote("");
      loadHistory();
      onChanged();
    } catch (e) {
      fail(e, setTopupError);
    } finally {
      setTopupBusy(false);
    }
  }

  async function submitMenu(e: React.FormEvent) {
    e.preventDefault();
    setMenuError("");
    setMenuOk("");
    const built = buildImportBody(menuText);
    if ("error" in built) return setMenuError(built.error);

    setMenuBusy(true);
    try {
      const res = await api.importMenu(adminKey, id, built.body, importTarget || undefined);
      const items = res.itemsCreated + res.itemsUpdated;
      setMenuOk(
        `Imported ${items} item${items === 1 ? "" : "s"} across ${res.categoriesCreated} categor${res.categoriesCreated === 1 ? "y" : "ies"}.`,
      );
      setMenuText("");
    } catch (e) {
      fail(e, setMenuError);
    } finally {
      setMenuBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex justify-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />
      <aside className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l bg-bg shadow-panel">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-bg/95 px-6 py-5 backdrop-blur">
          <div>
            <h2 className="text-base font-semibold">{restaurant.name}</h2>
            <p className="mt-1 flex items-center gap-2 text-xs text-muted">
              <StatusPill status={restaurant.status} />
              <span>ends {fmtDate(restaurant.subscriptionEnd)}</span>
            </p>
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </header>

        <div className="space-y-8 px-6 py-6">
          <section>
            <h3 className="text-sm font-semibold">Special features</h3>
            <label className="mt-3 flex items-start gap-3 rounded-lg border bg-surface p-4 text-sm">
              <input type="checkbox" className="mt-1" checked={localBilling} onChange={(e) => toggleLocalBilling(e.target.checked)} />
              <span>
                <span className="font-medium">Bills on the device</span>
                <span className="mt-0.5 block text-xs text-muted">
                  Staff can hold "Settle &amp; bill" for five seconds to keep that invoice on their phone instead of the cloud.
                  Settings shows the space used, with Sync and Clear. Off by default.
                </span>
              </span>
            </label>
            {featureError ? <div className="mt-3"><Note kind="error">{featureError}</Note></div> : null}
          </section>

          <section>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Outlets</h3>
                <p className="mt-0.5 text-xs text-muted">Pricing is per outlet. Closed outlets keep their bills but take no orders.</p>
              </div>
              <Button variant="ghost" onClick={() => setAddingOutlet((v) => !v)}>
                {addingOutlet ? "Cancel" : "Add outlet"}
              </Button>
            </div>

            {addingOutlet ? (
              <form onSubmit={submitOutlet} className="mt-4 space-y-3 rounded-lg border bg-surface p-4">
                <Field label="Outlet name">
                  <input className={inputClass} placeholder="Spice Route – Airport Road" value={outletForm.name} onChange={(e) => setOutletForm({ ...outletForm, name: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="GSTIN" hint="optional">
                    <input className={inputClass} value={outletForm.gstin} onChange={(e) => setOutletForm({ ...outletForm, gstin: e.target.value })} />
                  </Field>
                  <Field label="Address line">
                    <input className={inputClass} value={outletForm.line1} onChange={(e) => setOutletForm({ ...outletForm, line1: e.target.value })} />
                  </Field>
                  <Field label="City">
                    <input className={inputClass} value={outletForm.city} onChange={(e) => setOutletForm({ ...outletForm, city: e.target.value })} />
                  </Field>
                  <Field label="State">
                    <input className={inputClass} value={outletForm.state} onChange={(e) => setOutletForm({ ...outletForm, state: e.target.value })} />
                  </Field>
                  <Field label="PIN code">
                    <input className={inputClass} inputMode="numeric" value={outletForm.pincode} onChange={(e) => setOutletForm({ ...outletForm, pincode: e.target.value })} />
                  </Field>
                </div>
                <fieldset className="space-y-1.5">
                  <legend className="mb-1.5 block text-xs font-medium tracking-wide text-muted">Menu</legend>
                  {([["shared", "Share the brand menu", "One menu for every outlet. Each outlet marks its own sold-out dishes."], ["own", "Own menu", "Starts empty. Import this outlet's menu below."]] as const).map(([v, label, hint]) => (
                    <label key={v} className="flex items-start gap-2 text-sm">
                      <input type="radio" name="menuMode" className="mt-1" checked={outletForm.menuMode === v} onChange={() => setOutletForm({ ...outletForm, menuMode: v })} />
                      <span><span className="font-medium">{label}</span><span className="block text-xs text-muted">{hint}</span></span>
                    </label>
                  ))}
                </fieldset>
                {outletError ? <Note kind="error">{outletError}</Note> : null}
                <Button disabled={outletBusy}>{outletBusy ? "Adding…" : "Add outlet"}</Button>
              </form>
            ) : null}

            {outletOk ? <div className="mt-3"><Note kind="success">{outletOk}</Note></div> : null}
            {!addingOutlet && outletError ? <div className="mt-3"><Note kind="error">{outletError}</Note></div> : null}

            <div className="mt-3 overflow-hidden rounded-lg border">
              {outlets === null ? (
                <p className="px-4 py-4 text-xs text-muted">Loading…</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr className="border-b">
                      <th className="px-4 py-2 font-medium">Outlet</th>
                      <th className="px-4 py-2 font-medium">Code</th>
                      <th className="px-4 py-2 font-medium">Menu</th>
                      <th className="px-4 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {outlets.map((o) => (
                      <tr key={o.id} className={`border-b last:border-0 ${o.isActive ? "" : "opacity-60"}`}>
                        <td className="px-4 py-2.5">
                          <span className="block font-medium">{o.name}</span>
                          <span className="block text-xs text-muted">{o.city === "-" ? "address pending" : o.city}{o.gstin ? ` · ${o.gstin}` : ""}</span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs">{o.code}</td>
                        <td className="px-4 py-2.5 text-xs">{o.menuMode === "own" ? "Own" : "Shared"}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Button variant="ghost" onClick={() => void toggleOutlet(o)}>{o.isActive ? "Close" : "Reopen"}</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold">Record a payment</h3>
            <p className="mt-0.5 text-xs text-muted">
              Extends the subscription from today or the current end date, whichever is later.
            </p>
            <form onSubmit={submitTopup} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount received" hint="₹">
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    placeholder="9000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </Field>
                <Field label="Months to add">
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={months}
                    onChange={(e) => setMonths(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Note" hint="optional">
                <input
                  className={inputClass}
                  placeholder="UPI, ref 8842"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
              {topupError ? <Note kind="error">{topupError}</Note> : null}
              {topupOk ? <Note kind="success">{topupOk}</Note> : null}
              <Button disabled={topupBusy}>
                {topupBusy ? "Recording…" : "Record top-up"}
              </Button>
            </form>
          </section>

          <section>
            <h3 className="text-sm font-semibold">Payment history</h3>
            {historyError ? (
              <div className="mt-3">
                <Note kind="error">{historyError}</Note>
              </div>
            ) : null}
            <div className="mt-3 overflow-hidden rounded-lg border">
              {history === null ? (
                <p className="px-4 py-4 text-xs text-muted">Loading…</p>
              ) : history.length === 0 ? (
                <p className="px-4 py-4 text-xs text-muted">No payments recorded yet.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr className="border-b">
                      <th className="px-4 py-2 font-medium">Date</th>
                      <th className="px-4 py-2 font-medium">Amount</th>
                      <th className="px-4 py-2 font-medium">Months</th>
                      <th className="px-4 py-2 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((t, i) => (
                      <tr key={t.id ?? i} className="border-b last:border-0">
                        <td className="px-4 py-2.5">{fmtDate(t.createdAt)}</td>
                        <td className="px-4 py-2.5 font-mono">{rupees(t)}</td>
                        <td className="px-4 py-2.5">{t.monthsAdded}</td>
                        <td className="px-4 py-2.5 text-muted">{t.note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold">Import menu</h3>
            <p className="mt-0.5 text-xs text-muted">
              Paste menu JSON, or CSV rows: category, name, price, taxClass, isVeg, description.
            </p>

            <details className="mt-3 rounded-lg border bg-surface px-4 py-3 text-xs">
              <summary className="cursor-pointer font-medium">
                How to turn a menu photo into JSON
              </summary>
              <p className="mt-3 leading-relaxed text-muted">{PROMPT_HELP}</p>
              <p className="mt-3 font-medium">The shape it must produce:</p>
              <pre className="mt-2 overflow-x-auto rounded-md border bg-raised p-3 font-mono text-[11px] leading-relaxed">
                {EXAMPLE}
              </pre>
            </details>

            <form onSubmit={submitMenu} className="mt-3 space-y-3">
              {outlets?.some((o) => o.menuMode === "own") ? (
                <Field label="Import into">
                  <select className={inputClass} value={importTarget} onChange={(e) => setImportTarget(e.target.value)}>
                    <option value="">Shared brand menu</option>
                    {outlets.filter((o) => o.menuMode === "own").map((o) => (
                      <option key={o.id} value={o.id}>{o.name} (own menu)</option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <textarea
                className={`${inputClass} min-h-56 resize-y font-mono text-xs`}
                placeholder={'{ "categories": [ … ] }   or   Starters,Paneer Tikka,240,GST_5,true,'}
                value={menuText}
                onChange={(e) => setMenuText(e.target.value)}
                spellCheck={false}
              />
              {menuError ? <Note kind="error">{menuError}</Note> : null}
              {menuOk ? <Note kind="success">{menuOk}</Note> : null}
              <Button disabled={menuBusy}>{menuBusy ? "Importing…" : "Import menu"}</Button>
            </form>
          </section>
        </div>
      </aside>
    </div>
  );
}
