"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { supabase } from "../../../../lib/supabase";
import { useLanguage } from "../../../../lib/useLanguage";

const DonateWithStripe = dynamic(
  () => import("../../../components/payments/DonateWithStripe"),
  { ssr: false },
);

type Donation = {
  id: string;
  amount: number;
  currency: string;
  method: string;
  give_type: string | null;
  status: string;
  reference: string | null;
  created_at: string;
};

type Church = {
  id: string;
  name: string;
  verification_status: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
  rejected:  "bg-red-100 text-red-700",
};

export default function TithePage() {
  const params   = useParams();
  const router   = useRouter();
  const churchId = params.id as string;
  const { t, lang } = useLanguage();
  const isFr = lang === "fr";

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isChurchAdmin, setIsChurchAdmin] = useState(false);
  const [isMember,      setIsMember]      = useState(false);
  const [church,        setChurch]        = useState<Church | null>(null);
  const [myDonations,   setMyDonations]   = useState<Donation[]>([]);
  const [loading,       setLoading]       = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const me = authData.user?.id;
    if (!me) { router.push("/login"); return; }
    setCurrentUserId(me);

    const [churchRes, profileRes, memberRes, donRes] = await Promise.all([
      supabase.from("churches").select("id, name, verification_status").eq("id", churchId).maybeSingle(),
      supabase.from("profiles").select("role, church_id").eq("id", me).maybeSingle(),
      supabase.from("church_memberships").select("status").eq("church_id", churchId).eq("user_id", me).maybeSingle(),
      supabase.from("donations")
        .select("id, amount, currency, method, give_type, status, reference, created_at")
        .eq("target_type", "church")
        .eq("target_id", churchId)
        .eq("donor_id", me)
        .order("created_at", { ascending: false }),
    ]);

    setChurch(churchRes.data ?? null);
    const admin = profileRes.data?.role === "church_admin" && profileRes.data?.church_id === churchId;
    setIsChurchAdmin(admin);
    setIsMember(memberRes.data?.status === "member" || admin);
    setMyDonations((donRes.data as Donation[]) ?? []);
    setLoading(false);
  }, [churchId, router]);

  useEffect(() => { loadData(); }, [churchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (amt: number, cur: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(amt);

  const methodName = (m: string) => {
    const map: Record<string, string> = {
      stripe: isFr ? "Carte bancaire" : "Card",
      paypal: "PayPal",
      mobile_money: isFr ? "Mobile Money" : "Mobile Money",
      bank: isFr ? "Virement" : "Bank transfer",
    };
    return map[m] ?? m;
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  const isVerified = church?.verification_status === "approved";

  return (
    <main className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 shadow-sm">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          aria-label={t("common_back")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div>
          <h1 className="font-bold text-gray-900">
            {isFr ? `Donner à ${church?.name ?? "l'église"}` : `Give to ${church?.name ?? "Church"}`}
          </h1>
          <p className="text-xs text-gray-500">
            {isFr ? "Dîmes, offrandes & dons" : "Tithes, offerings & donations"}
          </p>
        </div>

        {isChurchAdmin && (
          <button
            onClick={() => router.push(`/church/${churchId}/payments`)}
            className="ml-auto flex items-center gap-1 rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {isFr ? "Config" : "Setup"}
          </button>
        )}
      </div>

      <div className="mx-auto max-w-lg px-4 pt-6 space-y-5">
        {/* Unverified notice */}
        {!isVerified && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-semibold text-amber-800">{t("pay_unverified_short")}</p>
            <p className="mt-1 text-sm text-amber-700">{t("pay_unverified")}</p>
          </div>
        )}

        {/* Give form */}
        {isVerified && (isMember || isChurchAdmin) && (
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-bold text-gray-900">
              {isFr ? "Enregistrer mon don" : "Record My Giving"}
            </h2>

            {!currentUserId ? (
              <div className="rounded-xl bg-amber-50 p-4 text-center">
                <p className="text-sm font-semibold text-amber-800">
                  {isFr ? "Connectez-vous pour faire un don" : "Sign in to donate"}
                </p>
                <button onClick={() => router.push("/login")} className="mt-3 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-600">
                  {isFr ? "Se connecter" : "Sign in"}
                </button>
              </div>
            ) : (
              <DonateWithStripe
                targetType="church"
                targetId={churchId}
                showGiveType={true}
                lang={lang}
                onSuccess={() => loadData()}
              />
            )}
          </div>
        )}

        {/* Platform-managed Stripe notice for church admins */}
        {isVerified && isChurchAdmin && (
          <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-xs text-brand-700">
            {isFr
              ? "Les dons par carte sont gérés par la plateforme TheBride (Beta). Les fonds seront reversés selon les modalités convenues."
              : "Card donations are platform-managed by TheBride (Beta). Funds will be disbursed per agreed terms."}
          </div>
        )}

        {/* Non-member gate */}
        {isVerified && !isMember && !isChurchAdmin && (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-gray-500">
              {isFr ? "Vous devez être membre pour faire un don." : "You must be a church member to give."}
            </p>
            <button onClick={() => router.back()} className="mt-3 text-sm font-semibold text-amber-600">
              {isFr ? "Demander l'adhésion depuis le profil de l'église" : "Request membership from the church profile"}
            </button>
          </div>
        )}

        {/* Giving history */}
        {myDonations.length > 0 && (
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-bold text-gray-900">{t("pay_my_history")}</h2>
            <div className="space-y-2">
              {myDonations.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold capitalize text-amber-700">
                        {d.give_type ?? t("pay_give_donation")}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[d.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {d.status === "pending"   ? t("pay_status_pending")
                          : d.status === "confirmed" ? t("pay_status_confirmed")
                          : t("pay_status_rejected")}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {new Date(d.created_at).toLocaleDateString()}
                      {" · "}{methodName(d.method)}
                      {d.reference ? ` · ${d.reference}` : ""}
                    </p>
                  </div>
                  <p className="font-bold text-gray-900">{fmt(d.amount, d.currency)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
