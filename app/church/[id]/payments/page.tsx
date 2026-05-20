"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { useLanguage } from "../../../../lib/useLanguage";

type Method = "paypal" | "mobile_money" | "bank" | "stripe";

type MethodSetting = {
  id: string | null;
  enabled: boolean;
  label: string;
  instructions: string;
  config: Record<string, string>;
};

const METHODS: { key: Method }[] = [
  { key: "paypal" },
  { key: "mobile_money" },
  { key: "bank" },
  { key: "stripe" },
];

const CONFIG_FIELDS: Record<Method, { key: string; i18n: string }[]> = {
  paypal: [
    { key: "email", i18n: "pay_admin_paypal_email" },
    { key: "link",  i18n: "pay_admin_paypal_link" },
  ],
  mobile_money: [
    { key: "provider", i18n: "pay_admin_mobile_provider" },
    { key: "name",     i18n: "pay_admin_mobile_name" },
    { key: "phone",    i18n: "pay_admin_mobile_phone" },
    { key: "country",  i18n: "pay_admin_mobile_country" },
  ],
  bank: [
    { key: "bank_name",      i18n: "pay_admin_bank_name" },
    { key: "account_name",   i18n: "pay_admin_bank_acct_name" },
    { key: "account_number", i18n: "pay_admin_bank_acct_number" },
    { key: "routing_iban",   i18n: "pay_admin_bank_routing" },
    { key: "swift",          i18n: "pay_admin_bank_swift" },
  ],
  stripe: [
    { key: "public_key", i18n: "pay_admin_stripe_key" },
  ],
};

const EMPTY: MethodSetting = { id: null, enabled: false, label: "", instructions: "", config: {} };

type DonationRow = {
  id: string;
  donor_name: string | null;
  give_type: string | null;
  amount: number;
  currency: string;
  method: string;
  status: string;
  reference: string | null;
  note: string | null;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
  rejected:  "bg-red-100 text-red-700",
};

export default function ChurchPaymentsPage() {
  const params   = useParams();
  const router   = useRouter();
  const churchId = params.id as string;
  const { t }    = useLanguage();

  const [verified, setVerified]   = useState<boolean | null>(null);
  const [church, setChurch]       = useState<{ name: string } | null>(null);
  const [isAdmin, setIsAdmin]     = useState(false);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  const [settings, setSettings] = useState<Record<Method, MethodSetting>>({
    paypal:       { ...EMPTY },
    mobile_money: { ...EMPTY },
    bank:         { ...EMPTY },
    stripe:       { ...EMPTY },
  });
  const [expanded, setExpanded] = useState<Method | null>(null);
  const [saving, setSaving]     = useState<Method | null>(null);
  const [saved, setSaved]       = useState<Method | null>(null);

  const [donations, setDonations]   = useState<DonationRow[]>([]);
  const [donFilter, setDonFilter]   = useState<"all" | "pending">("pending");
  const [actionId, setActionId]     = useState<string | null>(null);
  const [notes, setNotes]           = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const me = authData.user?.id;
    if (!me) { router.push("/login"); return; }

    const [churchRes, profileRes, settingsRes] = await Promise.all([
      supabase.from("churches").select("name, verification_status").eq("id", churchId).maybeSingle(),
      supabase.from("profiles").select("role, church_id").eq("id", me).maybeSingle(),
      supabase.from("payment_settings").select("*").eq("owner_type", "church").eq("owner_id", churchId),
    ]);
    const donRes = await supabase.rpc("church_list_donations", { p_church_id: churchId, p_status: "all", p_limit: 100, p_offset: 0 }).then((r) => r, () => ({ data: null, error: null }));

    setChurch(churchRes.data ? { name: churchRes.data.name } : null);
    setVerified(churchRes.data?.verification_status === "approved");

    const admin = profileRes.data?.role === "church_admin" && profileRes.data?.church_id === churchId;
    setIsAdmin(admin);
    if (!admin) { setLoading(false); return; }

    // Populate settings
    const next: Record<Method, MethodSetting> = {
      paypal:       { ...EMPTY },
      mobile_money: { ...EMPTY },
      bank:         { ...EMPTY },
      stripe:       { ...EMPTY },
    };
    for (const row of (settingsRes.data ?? [])) {
      const m = row.method as Method;
      next[m] = {
        id:           row.id,
        enabled:      row.enabled,
        label:        row.label ?? "",
        instructions: row.instructions ?? "",
        config:       (row.config as Record<string, string>) ?? {},
      };
    }
    setSettings(next);

    setDonations((donRes.data as DonationRow[]) ?? []);
    setLoading(false);
  }, [churchId, router]);

  useEffect(() => { load(); }, [load]);

  const updateField = (method: Method, key: string, value: string) =>
    setSettings((prev) => ({
      ...prev,
      [method]: { ...prev[method], config: { ...prev[method].config, [key]: value } },
    }));

  const updateMeta = (method: Method, key: "enabled" | "label" | "instructions", value: string | boolean) =>
    setSettings((prev) => ({ ...prev, [method]: { ...prev[method], [key]: value } }));

  const save = async (method: Method) => {
    if (!verified) return;
    setSaving(method);
    setError("");
    const s = settings[method];
    const { error: err } = await supabase.rpc("upsert_payment_setting", {
      p_owner_type:   "church",
      p_owner_id:     churchId,
      p_method:       method,
      p_enabled:      s.enabled,
      p_label:        s.label || null,
      p_config:       s.config,
      p_instructions: s.instructions || null,
    });
    setSaving(null);
    if (err) { setError(err.message); return; }
    setSaved(method);
    setTimeout(() => setSaved(null), 2500);
    await load();
  };

  const updateDonation = async (id: string, status: "confirmed" | "rejected") => {
    setActionId(id);
    const { error: err } = await supabase.rpc("admin_update_donation", {
      p_donation_id: id,
      p_status:      status,
      p_notes:       notes[id] || null,
    });
    setActionId(null);
    if (err) { setError(err.message); return; }
    await load();
  };

  const methodLabel = (m: Method | string) => {
    const map: Record<string, string> = {
      paypal: t("pay_method_paypal"), mobile_money: t("pay_method_mobile"),
      bank: t("pay_method_bank"), stripe: t("pay_method_card"),
    };
    return map[m] ?? m;
  };

  const fmt = (amt: number, cur: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(amt);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-gray-50">
        <p className="font-semibold text-gray-700">Access denied</p>
        <button onClick={() => router.back()} className="text-sm font-semibold text-amber-600">Go back</button>
      </div>
    );
  }

  const filteredDonations = donFilter === "pending"
    ? donations.filter((d) => d.status === "pending")
    : donations;

  return (
    <main className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 shadow-sm">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div>
          <h1 className="font-bold text-gray-900">{t("pay_admin_title")} — {church?.name}</h1>
          {!verified && (
            <p className="text-xs font-semibold text-amber-600">{t("pay_unverified_short")}</p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-6 space-y-6">
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

        {/* Verification gate notice */}
        {!verified && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-semibold text-amber-800">{t("pay_unverified_short")}</p>
            <p className="mt-1 text-sm text-amber-700">{t("pay_unverified")}</p>
            <button
              onClick={() => router.push(`/church/${churchId}/verify`)}
              className="mt-3 text-sm font-semibold text-amber-700 underline"
            >
              {t("church_verify_cta")}
            </button>
          </div>
        )}

        {/* Payment method config cards */}
        {verified && (
          <>
            <p className="text-sm text-gray-500">{t("pay_pending_notice")}</p>

            {METHODS.map(({ key: method }) => {
              const s = settings[method];
              const isOpen = expanded === method;

              return (
                <div key={method} className="rounded-2xl bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-4">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{methodLabel(method)}</p>
                      <p className="text-xs text-gray-400">{s.enabled ? t("pay_admin_enabled") : t("pay_admin_toggle_off")}</p>
                    </div>

                    <button
                      onClick={() => updateMeta(method, "enabled", !s.enabled)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${s.enabled ? "bg-amber-500" : "bg-gray-200"}`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${s.enabled ? "left-5" : "left-0.5"}`} />
                    </button>

                    <button
                      onClick={() => setExpanded(isOpen ? null : method)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d={isOpen ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
                      </svg>
                    </button>
                  </div>

                  {isOpen && (
                    <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                          {t("pay_admin_label_field")}
                        </label>
                        <input
                          type="text"
                          value={s.label}
                          onChange={(e) => updateMeta(method, "label", e.target.value)}
                          placeholder={methodLabel(method)}
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:bg-white"
                        />
                      </div>

                      {CONFIG_FIELDS[method].map(({ key: fieldKey, i18n }) => (
                        <div key={fieldKey}>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                            {t(i18n as Parameters<typeof t>[0])}
                          </label>
                          <input
                            type={fieldKey === "email" ? "email" : "text"}
                            value={s.config[fieldKey] ?? ""}
                            onChange={(e) => updateField(method, fieldKey, e.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:bg-white"
                          />
                        </div>
                      ))}

                      {method === "stripe" && (
                        <div className="rounded-xl bg-brand-50 px-3 py-2.5 text-xs text-brand-700">
                          {t("pay_admin_stripe_note")}
                        </div>
                      )}

                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                          {t("pay_admin_instr_field")}
                        </label>
                        <textarea
                          value={s.instructions}
                          onChange={(e) => updateMeta(method, "instructions", e.target.value)}
                          rows={3}
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:bg-white"
                        />
                      </div>

                      <button
                        onClick={() => save(method)}
                        disabled={saving === method}
                        className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                      >
                        {saving === method ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : saved === method ? t("pay_admin_saved") : t("pay_admin_save_method")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Donations section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900">{t("pay_donations_title")}</h2>
            <div className="flex gap-2">
              {(["pending", "all"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setDonFilter(v)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    donFilter === v ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {v === "all" ? t("pay_donations_filter_all") : t("pay_donations_filter_pending")}
                </button>
              ))}
            </div>
          </div>

          {filteredDonations.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
              <p className="text-sm text-gray-400">{t("pay_donations_none")}</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white shadow-sm divide-y divide-gray-50">
              {filteredDonations.map((d) => (
                <div key={d.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {d.donor_name ?? "Anonymous"}
                      </p>
                      <p className="text-xs text-gray-400 capitalize">
                        {d.give_type ?? t("pay_give_donation")}
                        {d.reference ? ` · ${d.reference}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-gray-900">{fmt(d.amount, d.currency)}</p>
                      <p className="text-xs text-gray-400">{methodLabel(d.method)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[d.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {d.status === "pending" ? t("pay_status_pending") : d.status === "confirmed" ? t("pay_status_confirmed") : t("pay_status_rejected")}
                    </span>
                  </div>

                  {d.status === "pending" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={notes[d.id] ?? ""}
                        onChange={(e) => setNotes((p) => ({ ...p, [d.id]: e.target.value }))}
                        placeholder={t("pay_donations_notes")}
                        className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs outline-none focus:border-amber-400"
                      />
                      <button
                        onClick={() => updateDonation(d.id, "confirmed")}
                        disabled={actionId === d.id}
                        className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600 disabled:opacity-60"
                      >
                        {t("pay_donations_confirm")}
                      </button>
                      <button
                        onClick={() => updateDonation(d.id, "rejected")}
                        disabled={actionId === d.id}
                        className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-60"
                      >
                        {t("pay_donations_reject")}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
