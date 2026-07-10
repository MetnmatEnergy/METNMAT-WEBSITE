"use client";

import * as React from "react";
import { Loader2, Plus, Trash2, Check, MapPin, Pencil, X, LocateFixed, Home, Briefcase } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { TextField, SelectField, Label, FieldError, fieldClass } from "@/frontend/components/ui/field";
import { CountryPicker } from "@/frontend/components/commerce/country-picker";
import { isIndiaName } from "@/frontend/lib/countries";
import { INDIAN_STATES, matchIndianState } from "@/frontend/lib/india-states";
import { cn } from "@/frontend/lib/utils";

// Kept in sync with backend/lib/customer.ts `Address` (line2 = locality).
type Address = {
  id?: string;
  label?: string;
  name?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  landmark?: string;
  altPhone?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  addressType?: "home" | "work" | "";
  isDefault?: boolean;
};

type Editing = number | "new" | null;

const blankAddress = (isDefault: boolean): Address => ({ country: "India", addressType: "home", isDefault });

// ─────────────────────────────────────────────────────────────────────────────
// The add / edit form
// ─────────────────────────────────────────────────────────────────────────────
function AddressForm({
  value,
  forceDefault,
  saving,
  onSave,
  onCancel,
}: {
  value: Address;
  forceDefault: boolean;
  saving: boolean;
  onSave: (a: Address) => void;
  onCancel: () => void;
}) {
  const [f, setF] = React.useState<Address>({ ...value });
  const [errs, setErrs] = React.useState<Record<string, string>>({});
  const [locating, setLocating] = React.useState(false);
  const [locMsg, setLocMsg] = React.useState("");
  const lastPin = React.useRef<string>("");

  const india = isIndiaName(f.country || "India");

  const set = (k: keyof Address, v: string | boolean) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrs((e) => (e[k] ? { ...e, [k]: "" } : e));
  };

  const setCountry = (name: string) => {
    setF((p) => ({ ...p, country: name, state: isIndiaName(name) ? matchIndianState(p.state) : (p.state || "") }));
  };

  // India pincode → city + state (only fills empty fields, so it never clobbers edits).
  const lookupPincode = async (pin: string) => {
    if (!india || !/^\d{6}$/.test(pin) || lastPin.current === pin) return;
    lastPin.current = pin;
    try {
      const res = await fetch(`/api/geocode/pincode?pin=${pin}`);
      const d = await res.json();
      if (res.ok && d?.found) {
        setF((p) => ({
          ...p,
          city: p.city || String(d.city || ""),
          state: p.state || matchIndianState(d.state),
        }));
      }
    } catch {
      /* silent — user can type it manually */
    }
  };

  const onPincode = (raw: string) => {
    const digits = raw.replace(/[^\d]/g, "").slice(0, india ? 6 : 12);
    set("pincode", digits);
    if (india && digits.length === 6) void lookupPincode(digits);
  };

  const useMyLocation = () => {
    setLocMsg("");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocMsg("Location isn't available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`/api/geocode/reverse?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
          const d = await res.json();
          if (res.ok) {
            setF((p) => {
              const isIn = isIndiaName(p.country || "India");
              return {
                ...p,
                pincode: String(d.pincode || p.pincode || ""),
                city: String(d.city || p.city || ""),
                state: (isIn ? matchIndianState(d.state) : String(d.state || "")) || p.state || "",
                line2: p.line2 || String(d.locality || ""),
              };
            });
            setLocMsg("Filled from your location — please double-check the details.");
          } else {
            setLocMsg(d?.error || "Couldn't detect your location.");
          }
        } catch {
          setLocMsg("Couldn't detect your location.");
        }
        setLocating(false);
      },
      (err) => {
        setLocMsg(
          err.code === err.PERMISSION_DENIED ? "Location permission was denied." : "Couldn't get your location.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!f.name?.trim()) e.name = "Enter the recipient's name.";
    const phone = (f.phone || "").replace(/\D/g, "");
    if (!phone) e.phone = "Enter a mobile number.";
    else if (india && phone.length !== 10) e.phone = "Enter a 10-digit mobile number.";
    if (!f.pincode?.trim()) e.pincode = "Enter a pincode.";
    else if (india && !/^\d{6}$/.test(f.pincode.trim())) e.pincode = "Enter a valid 6-digit pincode.";
    if (!f.line2?.trim()) e.line2 = "Enter a locality.";
    if (!f.line1?.trim()) e.line1 = "Enter the address (area & street).";
    if (!f.city?.trim()) e.city = "Enter a city / district / town.";
    if (!f.state?.trim()) e.state = india ? "Select a state." : "Enter a state / province.";
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    onSave({ ...f, isDefault: forceDefault ? true : !!f.isDefault });
  };

  const phoneClean = (v: string) => v.replace(/[^\d\s+-]/g, "");

  return (
    <form onSubmit={submit} noValidate className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
      <button
        type="button"
        onClick={useMyLocation}
        disabled={locating}
        className="inline-flex items-center gap-2 rounded-lg border border-brand/40 bg-brand/5 px-4 py-2.5 text-sm font-medium text-brand transition-colors hover:bg-brand/10 disabled:opacity-60"
      >
        {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
        {locating ? "Detecting…" : "Use my current location"}
      </button>
      {locMsg && <p className="mt-2 text-xs text-muted-foreground">{locMsg}</p>}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <TextField label="Name" value={f.name || ""} onChange={(e) => set("name", e.target.value)} error={errs.name} autoComplete="name" />
        <TextField
          label="Mobile number"
          value={f.phone || ""}
          onChange={(e) => set("phone", phoneClean(e.target.value))}
          error={errs.phone}
          inputMode="tel"
          autoComplete="tel"
          placeholder={india ? "10-digit mobile number" : "Mobile number"}
        />
      </div>

      <div className="mt-4 grid gap-1.5">
        <Label>Country</Label>
        <CountryPicker variant="full" value={f.country || "India"} onChange={setCountry} ariaLabel="Country" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextField
          label="Pincode"
          value={f.pincode || ""}
          onChange={(e) => onPincode(e.target.value)}
          error={errs.pincode}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder={india ? "6-digit pincode" : "PIN / ZIP code"}
        />
        <TextField label="Locality" value={f.line2 || ""} onChange={(e) => set("line2", e.target.value)} error={errs.line2} placeholder="e.g. Andheri West" />
      </div>

      <div className="mt-4 grid gap-1.5">
        <Label htmlFor="addr-street">Address (area &amp; street)</Label>
        <textarea
          id="addr-street"
          rows={3}
          className={cn(fieldClass, errs.line1 && "border-brand focus:border-brand", "resize-y")}
          value={f.line1 || ""}
          onChange={(e) => set("line1", e.target.value)}
          aria-invalid={errs.line1 ? true : undefined}
        />
        {errs.line1 ? <FieldError>{errs.line1}</FieldError> : null}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextField label="City / District / Town" value={f.city || ""} onChange={(e) => set("city", e.target.value)} error={errs.city} autoComplete="address-level2" />
        {india ? (
          <SelectField label="State" value={f.state || ""} onChange={(e) => set("state", e.target.value)} error={errs.state}>
            <option value="">Select State</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectField>
        ) : (
          <TextField label="State / Province" value={f.state || ""} onChange={(e) => set("state", e.target.value)} error={errs.state} autoComplete="address-level1" />
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextField label="Landmark" labelHint="optional" value={f.landmark || ""} onChange={(e) => set("landmark", e.target.value)} placeholder="e.g. Near City Mall" />
        <TextField
          label="Alternate phone"
          labelHint="optional"
          value={f.altPhone || ""}
          onChange={(e) => set("altPhone", phoneClean(e.target.value))}
          inputMode="tel"
        />
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-foreground/90">Address type</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {([
            { v: "home", label: "Home", Icon: Home },
            { v: "work", label: "Work", Icon: Briefcase },
          ] as const).map(({ v, label, Icon }) => (
            <label
              key={v}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors",
                f.addressType === v ? "border-brand bg-brand/5 text-foreground" : "border-input text-muted-foreground hover:border-brand/50",
              )}
            >
              <input type="radio" name="addr-type" checked={f.addressType === v} onChange={() => set("addressType", v)} className="sr-only" />
              <Icon className="h-4 w-4" /> {label}
            </label>
          ))}
        </div>
      </fieldset>

      {!forceDefault && (
        <label className="mt-4 flex items-center gap-2 text-sm text-foreground/90">
          <input type="checkbox" checked={!!f.isDefault} onChange={(e) => set("isDefault", e.target.checked)} className="h-4 w-4 accent-brand" />
          Make this my default address
        </label>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {saving ? "Saving…" : "Save address"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          <X className="h-4 w-4" /> Cancel
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Read-only summary card
// ─────────────────────────────────────────────────────────────────────────────
function AddressCard({
  a,
  busy,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  a: Address;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  const typeLabel = a.addressType === "work" ? "Work" : a.addressType === "home" ? "Home" : null;
  const cityLine = [a.city, a.state, a.pincode].filter(Boolean).join(", ");
  const lines = [a.line1, a.line2, a.landmark ? `Landmark: ${a.landmark}` : "", cityLine, a.country].filter(Boolean);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{a.name || a.label || "Address"}</span>
            {typeLabel && (
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{typeLabel}</span>
            )}
            {a.isDefault && (
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">Default</span>
            )}
          </div>
          {a.phone && <p className="mt-0.5 text-sm text-muted-foreground">{a.phone}</p>}
          <p className="mt-1 text-sm leading-relaxed text-foreground/80">{lines.join(", ")}</p>
          {a.altPhone && <p className="mt-1 text-xs text-muted-foreground">Alt: {a.altPhone}</p>}
          {!a.isDefault && (
            <button type="button" onClick={onSetDefault} disabled={busy} className="mt-3 text-xs font-medium text-brand hover:underline disabled:opacity-50">
              Set as default
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={onEdit} disabled={busy} aria-label="Edit address" className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50">
            <Pencil className="h-4 w-4" />
          </button>
          <button type="button" onClick={onDelete} disabled={busy} aria-label="Delete address" className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-brand disabled:opacity-50">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Container
// ─────────────────────────────────────────────────────────────────────────────
export function AddressBook({ initial }: { initial: Address[] }) {
  const [addrs, setAddrs] = React.useState<Address[]>(initial ?? []);
  const [editing, setEditing] = React.useState<Editing>(null);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const persist = async (next: Address[]): Promise<boolean> => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setAddrs(data.addresses || []);
        setMsg({ ok: true, text: "Addresses saved." });
        return true;
      }
      setMsg({ ok: false, text: data?.error || "Couldn't save your address." });
      return false;
    } catch {
      setMsg({ ok: false, text: "Network error — please try again." });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const onSave = async (addr: Address) => {
    let next = editing === "new" ? [...addrs, addr] : addrs.map((x, i) => (i === editing ? addr : x));
    // Enforce a single default in the UI too (the API also enforces it).
    if (addr.isDefault) next = next.map((x) => (x === addr ? x : { ...x, isDefault: false }));
    if (await persist(next)) setEditing(null);
  };

  const onDelete = async (i: number) => {
    await persist(addrs.filter((_, idx) => idx !== i));
  };

  const onSetDefault = async (i: number) => {
    await persist(addrs.map((x, idx) => ({ ...x, isDefault: idx === i })));
  };

  const busy = editing !== null || saving;

  return (
    <div className="space-y-4">
      {addrs.length === 0 && editing !== "new" && (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
          <MapPin className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No saved addresses yet.</p>
        </div>
      )}

      {addrs.map((a, i) =>
        editing === i ? (
          <AddressForm
            key={`edit-${i}`}
            value={a}
            forceDefault={addrs.length === 1}
            saving={saving}
            onSave={onSave}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <AddressCard
            key={`card-${i}`}
            a={a}
            busy={busy}
            onEdit={() => setEditing(i)}
            onDelete={() => onDelete(i)}
            onSetDefault={() => onSetDefault(i)}
          />
        ),
      )}

      {editing === "new" ? (
        <AddressForm
          key="new"
          value={blankAddress(addrs.length === 0)}
          forceDefault={addrs.length === 0}
          saving={saving}
          onSave={onSave}
          onCancel={() => setEditing(null)}
        />
      ) : editing === null ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Add a new address
          </Button>
          {msg && <span className={`text-sm ${msg.ok ? "text-emerald-600" : "text-brand"}`}>{msg.text}</span>}
        </div>
      ) : null}
    </div>
  );
}
