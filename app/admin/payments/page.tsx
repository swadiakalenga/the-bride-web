"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../lib/useLanguage";

type Method = "paypal" | "mobile_money" | "bank" | "stripe";

type MethodSetting = {
  id: string | null;
  enabled: boolean;
  label: string;
  instructions: string;
  config: Record<string, string>;
};

const METHODS: { key: Method; icon: string }[] = [
  { key: "paypal",       icon: "M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.27 8.27 0 004.84 1.55V6.79a4.84 4.84 0 01-1.07-.1z" },
  { key: "mobile_money", icon: "M12 2a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2h6zm-1 14a1 1 0 100 2 1 1 0 000-2z" },
  { key: "bank",         icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10" },
  { key: "stripe",       icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
];

const EMPTY: MethodSetting = { id: null, enabled: false, label: "", instructions: "", config: {} };

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
    { key: "bank_name",       i18n: "pay_admin_bank_name" },
    { key: "account_name",    i18n: "pay_admin_bank_acct_name" },
    { key: "account_number",  i18n: "pay_admin_bank_acct_number" },
    { key: "routing_iban",    i18n: "pay_admin_bank_routing" },
    { key: "swift",           i18n: "pay_admin_bank_swift" },
  ],
  stripe: [
    { key: "public_key", i18n: "pay_admin_stripe_key" },
  ],
};

export default function AdminPaymentsPage() {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<Record<Method, MethodSetting>>({
    paypal:       { ...EMPTY },
    mobile_money: { ...EMPTY },
    bank:         { ...EMPTY },
    stripe:       { ...EMPTY },
  });
  const [expanded, setExpanded] = useState<Method | null>(null);
  const [saving, setSaving]     = useState<Method | null>(null);
  const [saved, setSaved]       = useState<Method | null>(null);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("payment_settings")
      .select("*")
      .eq("owner_type", "platform");

    if (err) { setError(err.message); setLoading(false); return; }

    const next: Record<Method, MethodSetting> = {
      paypal:       { ...EMPTY },
      mobile_money: { ...EMPTY },
      bank:         { ...EMPTY },
      stripe:       { ...EMPTY },
    };
    for (const row of data ?? []) {
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
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateField = (method: Method, key: string, value: string) =>
    setSettings((prev) => ({
      ...prev,
      [method]: { ...prev[method], config: { ...prev[method].config, [key]: value } },
    }));

  const updateMeta = (method: Method, key: "enabled" | "label" | "instructions", value: string | boolean) =>
    setSettings((prev) => ({ ...prev, [method]: { ...prev[method], [key]: value } }));

  const save = async (method: Method) => {
    setSaving(method);
    setError("");
    const s = settings[method];
    const { error: err } = await supabase.rpc("upsert_payment_setting", {
      p_owner_type:   "platform",
      p_owner_id:     null,
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

  const methodLabel = (m: Method) => {
    const map: Record<Method, string> = {
      paypal:       t("pay_method_paypal"),
      mobile_money: t("pay_method_mobile"),
      bank:         t("pay_method_bank"),
      stripe:       t("pay_method_card"),
    };
    return map[m];
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">{t("pay_admin_title")}</h1>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      <p className="text-sm text-gray-500">
        {t("pay_pending_notice")}
      </p>

      {METHODS.map(({ key: method, icon }) => {
        const s = settings[method];
        const isOpen = expanded === method;

        return (
          <div key={method} className="rounded-2xl bg-white shadow-sm overflow-hidden">
            {/* Method header row */}
            <div className="flex items-center gap-3 px-5 py-4">
              {/* Icon */}
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${s.enabled ? "bg-amber-100" : "bg-gray-100"}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.enabled ? "#d97706" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={icon} />
                </svg>
              </div>

              {/* Name + toggle */}
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{methodLabel(method)}</p>
                <p className="text-xs text-gray-400">{s.enabled ? t("pay_admin_enabled") : t("pay_admin_toggle_off")}</p>
              </div>

              {/* Enable toggle */}
              <button
                onClick={() => updateMeta(method, "enabled", !s.enabled)}
                className={`relative h-6 w-11 rounded-full transition-colors ${s.enabled ? "bg-amber-500" : "bg-gray-200"}`}
                aria-label={s.enabled ? t("pay_admin_toggle_off") : t("pay_admin_toggle_on")}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${s.enabled ? "left-5" : "left-0.5"}`} />
              </button>

              {/* Expand/collapse */}
              <button
                onClick={() => setExpanded(isOpen ? null : method)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={isOpen ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
                </svg>
              </button>
            </div>

            {/* Expanded config */}
            {isOpen && (
              <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">
                {/* Label */}
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

                {/* Method-specific config fields */}
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

                {/* Stripe notice */}
                {method === "stripe" && (
                  <div className="rounded-xl bg-blue-50 px-3 py-2.5 text-xs text-blue-700">
                    {t("pay_admin_stripe_note")}
                  </div>
                )}

                {/* Instructions */}
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
                  ) : saved === method ? (
                    t("pay_admin_saved")
                  ) : (
                    t("pay_admin_save_method")
                  )}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
