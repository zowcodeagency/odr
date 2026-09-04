import { useMemo, useState } from "react";
import { ChevronDown, ImagePlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Money,
  VegMark,
  cn,
} from "@odr/ui";
import {
  api,
  decimalToMinor,
  type ItemImage,
  type MenuCategory,
  type MenuItem,
} from "../lib/api.ts";
import { useAsync } from "../lib/use-async.ts";
import { toast } from "../lib/toast.tsx";
import { canManage, type Session } from "../lib/session.ts";

// Mirrors @odr/tax IN rates — the API rejects anything outside that list.
const TAX_CLASSES = ["GST_0", "GST_5", "GST_12", "GST_18", "GST_28"];
const taxLabel = (t: string) => (t === "GST_0" ? "No GST" : `${t.replace("GST_", "")}%`);

type Draft = {
  id?: string;
  categoryId: string;
  name: string;
  basePrice: string;
  description: string;
  taxClass: string;
  isVeg: boolean;
  /** Photo already saved on the server for this dish. */
  hasImage: boolean;
  /** undefined = untouched, ItemImage = new upload, null = remove. */
  image?: ItemImage | null;
};

const blank = (categoryId: string): Draft => ({
  categoryId,
  name: "",
  basePrice: "",
  description: "",
  taxClass: "GST_5",
  isVeg: true,
  hasImage: false,
});

/** Downscale to ≤800px JPEG on the phone so uploads stay small (~50-150KB). */
const readImage = (file: File): Promise<ItemImage> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 800 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      resolve({ data: dataUrl.slice(dataUrl.indexOf(",") + 1), type: "image/jpeg" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image"));
    };
    img.src = url;
  });

/** Photo URL for a saved dish; `v` busts the browser cache after edits. */
const imageUrl = (id: string, v: number) => `/public/menu-images/${id}?v=${v}`;

/** Off the board here: 86'd at this outlet or retired from the brand menu. */
const isOff = (i: MenuItem) => i.soldOutHere === true || i.isActive === false;

/**
 * The menu board. One horizontal lane per category so it reads like the board
 * on the wall, not a spreadsheet. Sold-out dishes stay on the board, muted —
 * the cook needs to see what is off, not have it disappear.
 */
export const MenuRoute = ({ session }: { session: Session }) => {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [newCat, setNewCat] = useState("");

  const outletId = session.outletId;
  const q = useAsync(async () => {
    const [categories, items] = await Promise.all([
      api.categories(outletId),
      api.items(outletId, true), // sold-out included: this is the editor
    ]);
    return { categories, items };
  }, [outletId]);

  // Bumped only after a save or delete here — those are the mutations that can
  // change a photo. Polls and remounts keep the browser cache warm.
  const [imgVer, setImgVer] = useState(() => Date.now());

  const lanes = useMemo(() => {
    const items = q.data?.items ?? [];
    return (q.data?.categories ?? []).map((c) => ({
      category: c,
      items: items.filter((i) => i.categoryId === c.id),
    }));
  }, [q.data]);

  if (!canManage(session.role)) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-[15px] font-medium">The menu is edited by owners and managers</p>
        <p className="mt-1.5 text-[13px] text-[var(--fg-tertiary)]">
          Ask them to change a price or mark something sold out.
        </p>
      </div>
    );
  }

  const run = async (fn: () => Promise<unknown>, ok?: string, touchesPhoto = false) => {
    setBusy(true);
    try {
      await fn();
      q.reload();
      if (touchesPhoto) setImgVer(Date.now());
      if (ok) toast(ok);
    } catch (e) {
      toast(e instanceof Error ? e.message : "That didn't work");
    } finally {
      setBusy(false);
    }
  };

  // The one action that happens every day — kept to a single tap. Per outlet:
  // 86'ing a dish here leaves the other outlets selling it.
  const toggleSoldOut = (i: MenuItem) =>
    run(
      () => api.setSoldOut(i.id, outletId, !i.soldOutHere),
      i.soldOutHere ? `${i.name} is back on` : `${i.name} marked sold out`,
    );

  const save = (d: Draft) =>
    run(async () => {
      const payload = {
        name: d.name.trim(),
        basePrice: d.basePrice.trim(),
        taxClass: d.taxClass,
        isVeg: d.isVeg,
        description: d.description.trim() || null,
        ...(d.image !== undefined ? { image: d.image } : {}),
      };
      if (d.id) await api.updateMenuItem(d.id, payload);
      else
        await api.createMenuItem({
          categoryId: d.categoryId,
          ...payload,
          description: payload.description ?? "",
        });
      setDraft(null);
    }, d.id ? "Saved" : "Dish added", true);

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-7 lg:px-10 max-w-[1440px] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[20px] sm:text-[22px] font-semibold tracking-[-0.02em]">Menu</h1>
          <p className="mt-1 text-[13px] text-[var(--fg-tertiary)]">
            {session.outletName} ·{" "}
            {session.menuMode === "own"
              ? "this outlet's own menu"
              : session.outlets.length > 1
                ? "shared brand menu · sold out is per outlet"
                : "changes are live for waiters and diners at once"}
          </p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newCat.trim()) return;
            void run(() => api.createCategory(outletId, newCat.trim()), "Section added").then(() =>
              setNewCat(""),
            );
          }}
        >
          <Input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="New section, e.g. Desserts"
            className="h-11 w-[210px]"
          />
          <Button type="submit" size="lg" disabled={busy || !newCat.trim()}>
            <Plus size={15} /> Section
          </Button>
        </form>
      </header>

      {q.loading && !q.data ? (
        <p className="text-[14px] text-[var(--fg-tertiary)]">Loading the menu…</p>
      ) : q.error ? (
        <p className="text-[14px] text-[var(--status-voided)]">{q.error}</p>
      ) : lanes.length === 0 ? (
        <div className="rounded-[var(--radius-3)] ring-1 ring-[var(--line-default)] bg-[var(--bg-surface)] p-8 text-center">
          <p className="text-[15px] font-medium">No sections yet</p>
          <p className="mt-1.5 text-[13px] text-[var(--fg-tertiary)]">
            Add one above — "Dosa", "Drinks", "Snacks" — then add dishes to it.
          </p>
        </div>
      ) : (
        <div className="space-y-6 pb-24">
          {lanes.map(({ category, items }) => (
            <MenuSection
              key={category.id}
              category={category}
              items={items}
              busy={busy}
              imgVer={imgVer}
              onEdit={(i) =>
                setDraft({
                  id: i.id,
                  categoryId: i.categoryId,
                  name: i.name,
                  basePrice: i.basePrice,
                  description: i.description ?? "",
                  taxClass: i.taxClass,
                  isVeg: i.isVeg,
                  hasImage: i.hasImage === true,
                })
              }
              onToggle={toggleSoldOut}
              onRename={(name) => run(() => api.renameCategory(category.id, name), "Renamed")}
              onDelete={() =>
                run(() => api.deleteCategory(category.id), `${category.name} removed`)
              }
            />
          ))}
        </div>
      )}

      {/* One add point for the whole board — the dialog asks for the section. */}
      {lanes.length > 0 ? (
        <button
          onClick={() => setDraft(blank(lanes[0]!.category.id))}
          aria-label="Add dish"
          className="fixed z-10 right-4 md:right-8 bottom-[calc(88px+env(safe-area-inset-bottom))] md:bottom-8
                     inline-flex items-center gap-2 min-h-[52px] px-5 rounded-[var(--radius-pill)]
                     bg-[var(--accent)] text-[var(--fg-on-accent)] text-[15px] font-medium
                     shadow-[var(--shadow-3)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-pressed)]"
        >
          <Plus size={18} /> Item
        </button>
      ) : null}

      <DishDialog
        draft={draft}
        busy={busy}
        imgVer={imgVer}
        categories={q.data?.categories ?? []}
        onClose={() => setDraft(null)}
        onSave={save}
        onDelete={(id, name) =>
          run(async () => {
            await api.deleteMenuItem(id);
            setDraft(null);
          }, `${name} deleted`, true)
        }
      />
    </div>
  );
};

/* ------------------------------------------------------------------ lane -- */

/** iOS-style switch, sized around the 44px touch floor. */
const Toggle = ({
  on,
  disabled,
  label,
  onChange,
}: {
  on: boolean;
  disabled: boolean;
  label: string;
  onChange: () => void;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    onClick={onChange}
    className="shrink-0 h-11 w-14 grid place-items-center disabled:opacity-50"
  >
    <span
      className={cn(
        "relative block h-7 w-12 rounded-[var(--radius-pill)] transition-colors duration-[var(--dur-quick)]",
        on ? "bg-[var(--accent)]" : "bg-[var(--bg-surface-3)] ring-1 ring-[var(--line-default)]",
      )}
    >
      <span
        className={cn(
          "absolute top-1 h-5 w-5 rounded-full bg-white shadow-[var(--shadow-2)]",
          "transition-[left] duration-[var(--dur-quick)]",
          on ? "left-6" : "left-1",
        )}
      />
    </span>
  </button>
);

const MenuSection = ({
  category,
  items,
  busy,
  imgVer,
  onEdit,
  onToggle,
  onRename,
  onDelete,
}: {
  category: MenuCategory;
  items: MenuItem[];
  busy: boolean;
  imgVer: number;
  onEdit: (i: MenuItem) => void;
  onToggle: (i: MenuItem) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) => {
  const [open, setOpen] = useState(true);
  // null = showing the name; a string = the rename draft.
  const [editing, setEditing] = useState<string | null>(null);
  const soldOut = items.filter(isOff).length;

  return (
    <section>
      <header className="group flex items-center gap-1.5 mb-2.5">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${category.name}`}
          className="h-11 w-9 -ml-2 grid place-items-center text-[var(--fg-muted)]"
        >
          <ChevronDown
            size={16}
            className={cn("transition-transform duration-[var(--dur-quick)]", !open && "-rotate-90")}
          />
        </button>
        {editing !== null ? (
          <Input
            autoFocus
            aria-label="Section name"
            value={editing}
            onChange={(e) => setEditing(e.target.value)}
            onBlur={() => setEditing(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(null);
              if (e.key === "Enter") {
                const next = editing.trim();
                if (next && next !== category.name) onRename(next);
                setEditing(null);
              }
            }}
            className="h-11 w-[220px] text-[16px] font-semibold"
          />
        ) : (
          // Rename in place — no dialog for a one-word change.
          <button
            type="button"
            onClick={() => setEditing(category.name)}
            aria-label={`Rename ${category.name}`}
            className="inline-flex items-center gap-1.5 min-h-11 px-1 -mx-1 rounded text-left
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{category.name}</h2>
            <Pencil
              size={14}
              className="text-[var(--fg-muted)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100
                         [@media(pointer:coarse)]:opacity-100 transition-opacity duration-[var(--dur-quick)]"
            />
          </button>
        )}
        <span className="text-[12px] text-[var(--fg-muted)] font-mono">
          {items.length}
          {soldOut > 0 ? ` · ${soldOut} off` : ""}
        </span>
        <div className="flex-1" />
        {items.length > 0 ? (
          <span className="hidden sm:group-hover:inline text-[12px] text-[var(--fg-muted)]">
            Move or delete its dishes to remove this section
          </span>
        ) : null}
        {items.length === 0 ? (
          <button
            onClick={onDelete}
            disabled={busy}
            aria-label={`Delete ${category.name}`}
            className="h-11 w-11 grid place-items-center text-[var(--fg-muted)] hover:text-[var(--status-voided)]"
          >
            <Trash2 size={15} />
          </button>
        ) : null}
      </header>

      {open ? (
        <div
          className="rounded-[var(--radius-4)] bg-[var(--bg-surface)] ring-1 ring-[var(--line-default)]
                     divide-y divide-[var(--line-subtle)] overflow-hidden"
        >
          {items.map((i) => (
            <DishRow
              key={i.id}
              item={i}
              busy={busy}
              imgVer={imgVer}
              onEdit={() => onEdit(i)}
              onToggle={() => onToggle(i)}
            />
          ))}
          {items.length === 0 ? (
            <p className="p-4 text-[13px] text-[var(--fg-muted)]">No dishes yet — tap + Item.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};

const DishRow = ({
  item,
  busy,
  imgVer,
  onEdit,
  onToggle,
}: {
  item: MenuItem;
  busy: boolean;
  imgVer: number;
  onEdit: () => void;
  onToggle: () => void;
}) => {
  const off = isOff(item);
  return (
    <div className="flex items-center gap-2 pr-2">
      <button
        onClick={onEdit}
        className={cn("flex items-center gap-3 flex-1 min-w-0 p-3 text-left", off && "opacity-55")}
      >
        {item.hasImage ? (
          <img
            src={imageUrl(item.id, imgVer)}
            alt=""
            loading="lazy"
            className="h-14 w-14 shrink-0 rounded-[var(--radius-3)] object-cover"
          />
        ) : (
          <span className="h-14 w-14 shrink-0 grid place-items-center rounded-[var(--radius-3)] bg-[var(--bg-surface-2)] text-[var(--fg-muted)]">
            <ImagePlus size={18} strokeWidth={1.6} />
          </span>
        )}
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <VegMark veg={item.isVeg} />
            <span className="text-[14px] font-medium truncate">{item.name}</span>
          </span>
          <Money
            minor={decimalToMinor(item.basePrice)}
            mono
            className="mt-0.5 block text-[13px] text-[var(--fg-secondary)]"
          />
          {off ? (
            <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[var(--status-voided)]">
              Sold out
            </span>
          ) : null}
        </span>
      </button>

      {/* The daily action — flip availability without opening the dish. */}
      <Toggle
        on={!off}
        disabled={busy}
        label={off ? `Put ${item.name} back on` : `Mark ${item.name} sold out`}
        onChange={onToggle}
      />
    </div>
  );
};

/* ---------------------------------------------------------------- dialog -- */

const DishDialog = ({
  draft,
  busy,
  imgVer,
  categories,
  onClose,
  onSave,
  onDelete,
}: {
  draft: Draft | null;
  busy: boolean;
  imgVer: number;
  categories: MenuCategory[];
  onClose: () => void;
  onSave: (d: Draft) => void;
  onDelete: (id: string, name: string) => void;
}) => {
  const [d, setD] = useState<Draft | null>(draft);
  // Re-seed whenever open/close hands us a new draft object. Compared by
  // reference, not id — a fresh "new dish" draft has no id to compare.
  const [seeded, setSeeded] = useState(draft);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (draft !== seeded) {
    setSeeded(draft);
    setD(draft);
    setConfirmDelete(false);
  }
  if (!d) return null;

  // Preview: a fresh pick wins; otherwise the saved photo; null = removed.
  const preview =
    d.image != null
      ? `data:${d.image.type};base64,${d.image.data}`
      : d.image === undefined && d.hasImage && d.id
        ? imageUrl(d.id, imgVer)
        : null;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogTitle>{d.id ? "Edit dish" : "New dish"}</DialogTitle>
        <DialogDescription>
          Waiters and diners see this the moment you save.
        </DialogDescription>

        <form
          className="mt-5 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(d);
          }}
        >
          {/* The API can't move a dish between sections, so edit hides this. */}
          {!d.id ? (
            <label className="block sm:col-span-2">
              <span className="block text-[13px] font-medium text-[var(--fg-secondary)] mb-1.5">Section</span>
              <span className="relative block">
                <select
                  value={d.categoryId}
                  onChange={(e) => setD({ ...d, categoryId: e.target.value })}
                  className="appearance-none h-11 w-full pl-3 pr-9 text-[14px] rounded-[var(--radius-2)]
                             bg-[var(--bg-surface)] ring-1 ring-[var(--line-default)]
                             focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
              </span>
            </label>
          ) : null}

          <label className="block sm:col-span-2">
            <span className="block text-[13px] font-medium text-[var(--fg-secondary)] mb-1.5">Name</span>
            <Input
              required
              // New dish: jump straight to typing. Edit: focus nothing — on a
              // phone the keyboard would pop over fields the user came to tap.
              autoFocus={!d.id}
              value={d.name}
              onChange={(e) => setD({ ...d, name: e.target.value })}
              className="h-11"
            />
          </label>

          <label className="block">
            <span className="block text-[13px] font-medium text-[var(--fg-secondary)] mb-1.5">Price ₹</span>
            <Input
              required
              inputMode="decimal"
              pattern="\d+(\.\d{1,2})?"
              placeholder="120.00"
              value={d.basePrice}
              onChange={(e) => setD({ ...d, basePrice: e.target.value })}
              className="h-11"
            />
          </label>

          <label className="block">
            <span className="block text-[13px] font-medium text-[var(--fg-secondary)] mb-1.5">GST</span>
            <span className="relative block">
              <select
                value={d.taxClass}
                onChange={(e) => setD({ ...d, taxClass: e.target.value })}
                className="appearance-none h-11 w-full pl-3 pr-9 text-[14px] rounded-[var(--radius-2)]
                           bg-[var(--bg-surface)] ring-1 ring-[var(--line-default)]
                           focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                {TAX_CLASSES.map((t) => (
                  <option key={t} value={t}>
                    {taxLabel(t)}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
            </span>
          </label>

          <label className="block sm:col-span-2">
            <span className="block text-[13px] font-medium text-[var(--fg-secondary)] mb-1.5">
              Description <span className="text-[var(--fg-muted)]">(optional)</span>
            </span>
            <Input
              value={d.description}
              onChange={(e) => setD({ ...d, description: e.target.value })}
              className="h-11"
            />
          </label>

          <div className="sm:col-span-2">
            <span className="block text-[13px] font-medium text-[var(--fg-secondary)] mb-1.5">
              Photo <span className="text-[var(--fg-muted)]">(optional)</span>
            </span>
            <div className="flex items-center gap-3">
              {preview ? (
                <img
                  src={preview}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-[var(--radius-3)] object-cover ring-1 ring-[var(--line-default)]"
                />
              ) : (
                <span className="h-16 w-16 shrink-0 grid place-items-center rounded-[var(--radius-3)] bg-[var(--bg-surface-2)] text-[var(--fg-muted)]">
                  <ImagePlus size={20} strokeWidth={1.6} />
                </span>
              )}
              <label
                className="min-h-11 px-4 inline-flex items-center rounded-[var(--radius-2)] text-[14px]
                           ring-1 ring-[var(--line-default)] cursor-pointer hover:bg-[var(--bg-surface-2)]"
              >
                {preview ? "Replace" : "Add photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    readImage(file).then(
                      (image) => setD({ ...d, image }),
                      () => toast("Could not read that image"),
                    );
                  }}
                />
              </label>
              {preview ? (
                <button
                  type="button"
                  onClick={() => setD({ ...d, image: d.hasImage ? null : undefined })}
                  className="min-h-11 px-3 text-[13px] text-[var(--fg-muted)] hover:text-[var(--status-voided)]"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>

          <div className="sm:col-span-2 flex gap-2">
            {[
              { veg: true, label: "Veg" },
              { veg: false, label: "Non-veg" },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => setD({ ...d, isVeg: o.veg })}
                className={cn(
                  "flex-1 min-h-11 rounded-[var(--radius-2)] text-[14px] inline-flex items-center justify-center gap-2",
                  d.isVeg === o.veg
                    ? "bg-[var(--accent)] text-[var(--fg-on-accent)] font-medium"
                    : "ring-1 ring-[var(--line-default)]",
                )}
              >
                <VegMark veg={o.veg} /> {o.label}
              </button>
            ))}
          </div>

          <Button type="submit" size="lg" disabled={busy} className="sm:col-span-2">
            {busy ? <Loader2 size={16} className="animate-spin" /> : null} Save
          </Button>

          {d.id ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
              className="sm:col-span-2 min-h-11 text-[13px] text-[var(--fg-muted)] hover:text-[var(--status-voided)]"
            >
              Delete this dish
            </button>
          ) : null}
        </form>
      </DialogContent>
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${d.name}?`}
        description="Past bills are not affected."
        confirmLabel="Delete"
        busy={busy}
        onConfirm={() => d.id && onDelete(d.id, d.name)}
        onOpenChange={setConfirmDelete}
      />
    </Dialog>
  );
};
