"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../lib/useLanguage";

type StripeSetting = {
  id: string | null;
  enabled: boolean;
};

export default function AdminPaymentsPage() {
  const { t } = useLanguage();
  const [setting, setSetting]   = useState<StripeSetting>({ id: null, enabled: false });
  const [saving,  setSaving]    = useState(false);
  const [saved,   setSaved]     = useState(false);
  const [error,   setError]     = useState("");
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("payment_settings")
      .select("id, enabled")
      .eq("owner_type", "platform")
      .eq("method", "stripe")
      .maybeSingle();

    if (err) { setError(err.message); }
    setSetting(data ? { id: data.id, enabled: data.enabled } : { id: null, enabled: false });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setError("");
    const { error: err } = await supabase.rpc("upsert_payment_setting", {
      p_owner_type:   "platform",
      p_owner_id:     null,
      p_method:       "stripe",
      p_enabled:      setting.enabled,
      p_label:        "Card (Stripe)",
      p_config:       {},
      p_instructions: null,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    await load();
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  const pubKey   = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const liveMode = pubKey?.startsWith("pk_live_");

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">{t("pay_admin_title")}</h1>

      <p className="text-sm text-gray-500">
        {t("pay_pending_notice")}
      </p>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {/* ── Stripe Card Payments ─────────────────────────────────────── */}
      <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 space-y-4">

          {/* Header + enable toggle */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Card payments via Stripe</p>
              <p className="text-xs text-gray-400">
                {setting.enabled ? t("pay_admin_enabled") : t("pay_admin_toggle_off")}
              </p>
            </div>
            <button
              onClick={() => setSetting((s) => ({ ...s, enabled: !s.enabled }))}
              className={`relative h-6 w-11 rounded-full transition-colors ${setting.enabled ? "bg-brand-500" : "bg-gray-200"}`}
              aria-label={setting.enabled ? t("pay_admin_toggle_off") : t("pay_admin_toggle_on")}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${setting.enabled ? "left-5" : "left-0.5"}`} />
            </button>
          </div>

          {/* Env var status panel */}
          <div className="rounded-xl bg-gray-50 px-3 py-3 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</span>
              {pubKey ? (
                <span className="flex items-center gap-1 font-medium text-green-600">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
                  Configured
                </span>
              ) : (
                <span className="font-medium text-red-500">Not set in Vercel env</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">STRIPE_SECRET_KEY</span>
              <span className="text-xs text-gray-400">Server-only — never shown here</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">STRIPE_WEBHOOK_SECRET</span>
              <span className="text-xs text-gray-400">Server-only — never shown here</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Mode</span>
              <span className={`font-medium ${liveMode ? "text-green-600" : "text-amber-600"}`}>
                {liveMode ? "Live" : pubKey ? "Test" : "Not configured"}
              </span>
            </div>
          </div>

          {/* Security reminder */}
          <div className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5 text-xs text-brand-800 space-y-1">
            <p className="font-semibold">Security reminder</p>
            <p>STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET must remain in Vercel environment variables only. Never paste them here.</p>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {saving ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : saved ? (
              t("pay_admin_saved")
            ) : (
              t("pay_admin_save_method")
            )}
          </button>
        </div>
      </div>

      {/* Disabled methods notice */}
      <div className="rounded-xl border border-gray-100 bg-white px-4 py-4 text-sm text-gray-500 space-y-1">
        <p className="font-semibold text-gray-700">Other payment methods</p>
        <p>PayPal, Mobile Money, and Bank Transfer are currently disabled. Only card payments via Stripe are active. Other methods can be re-enabled in a future release.</p>
      </div>
    </div>
  );
}
