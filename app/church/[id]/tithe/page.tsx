"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type TithingConfig = {
  payment_instructions: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  mobile_money: string | null;
  accepts_tithe: boolean;
  accepts_offering: boolean;
  accepts_donation: boolean;
};

type Donation = {
  id: string;
  amount: number;
  currency: string;
  type: string;
  note: string | null;
  payment_reference: string | null;
  created_at: string;
};

type Church = {
  id: string;
  name: string;
  avatar_url?: string | null;
};

export default function TithePage() {
  const params = useParams();
  const router = useRouter();
  const churchId = params.id as string;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isChurchAdmin, setIsChurchAdmin] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [church, setChurch] = useState<Church | null>(null);
  const [config, setConfig] = useState<TithingConfig | null>(null);
  const [myDonations, setMyDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [uiMessage, setUiMessage] = useState("");

  // Give form
  const [giving, setGiving] = useState(false);
  const [giveType, setGiveType] = useState<"tithe" | "offering" | "donation">("tithe");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [note, setNote] = useState("");
  const [payRef, setPayRef] = useState("");
  const [giveSuccess, setGiveSuccess] = useState(false);

  // Admin tithing setup form
  const [setupMode, setSetupMode] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [mobileMoney, setMobileMoney] = useState("");
  const [instructions, setInstructions] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    loadPage();
  }, [churchId]);

  async function loadPage() {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const me = authData.user?.id;
    if (!me) { router.push("/login"); return; }
    setCurrentUserId(me);

    const { data: churchData } = await supabase
      .from("churches")
      .select("id, name")
      .eq("id", churchId)
      .maybeSingle();
    setChurch(churchData);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("role, church_id")
      .eq("id", me)
      .maybeSingle();

    const isAdmin = profileData?.role === "church_admin" && profileData?.church_id === churchId;
    setIsChurchAdmin(isAdmin);

    const { data: memberData } = await supabase
      .from("church_memberships")
      .select("status")
      .eq("church_id", churchId)
      .eq("user_id", me)
      .maybeSingle();

    setIsMember(memberData?.status === "member" || isAdmin);

    const { data: configData } = await supabase
      .from("tithing_configs")
      .select("*")
      .eq("church_id", churchId)
      .maybeSingle();
    setConfig(configData);

    if (configData) {
      setBankName(configData.bank_name || "");
      setAccountNumber(configData.account_number || "");
      setAccountName(configData.account_name || "");
      setMobileMoney(configData.mobile_money || "");
      setInstructions(configData.payment_instructions || "");
    }

    const { data: donationsData } = await supabase
      .from("donations")
      .select("*")
      .eq("church_id", churchId)
      .eq("user_id", me)
      .order("created_at", { ascending: false });
    setMyDonations(donationsData || []);

    setLoading(false);
  }

  const saveConfig = async () => {
    if (!isChurchAdmin) return;
    setSavingConfig(true);

    const payload = {
      church_id: churchId,
      bank_name: bankName || null,
      account_number: accountNumber || null,
      account_name: accountName || null,
      mobile_money: mobileMoney || null,
      payment_instructions: instructions || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("tithing_configs")
      .upsert([payload], { onConflict: "church_id" });

    setSavingConfig(false);
    if (!error) {
      setSetupMode(false);
      setUiMessage("Payment settings saved.");
      await loadPage();
    } else {
      setUiMessage(error.message);
    }
  };

  const submitDonation = async () => {
    if (!currentUserId || !amount || parseFloat(amount) <= 0) return;
    setGiving(true);

    const { error } = await supabase.from("donations").insert([{
      church_id: churchId,
      user_id: currentUserId,
      amount: parseFloat(amount),
      currency,
      type: giveType,
      note: note || null,
      payment_reference: payRef || null,
    }]);

    setGiving(false);
    if (!error) {
      setAmount("");
      setNote("");
      setPayRef("");
      setGiveSuccess(true);
      setUiMessage("");
      await loadPage();
      setTimeout(() => setGiveSuccess(false), 3000);
    } else {
      setUiMessage(error.message);
    }
  };

  const formatCurrency = (amt: number, cur: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(amt);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-10">
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
          <h1 className="font-bold text-gray-900">Give to {church?.name || "Church"}</h1>
          <p className="text-xs text-gray-500">Tithes, Offerings & Donations</p>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-6 space-y-6">
        {uiMessage && (
          <div className={`rounded-xl px-4 py-3 text-sm ${uiMessage.toLowerCase().includes("saved") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {uiMessage}
          </div>
        )}
        {/* No config yet */}
        {!config && !isChurchAdmin && (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-3xl">
              🏦
            </div>
            <p className="font-semibold text-gray-800">Payment not set up yet</p>
            <p className="mt-1 text-sm text-gray-400">
              The church admin has not configured payment details yet.
            </p>
          </div>
        )}

        {/* Admin setup button */}
        {isChurchAdmin && !setupMode && (
          <button
            onClick={() => setSetupMode(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-xl">⚙️</div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">{config ? "Edit Payment Setup" : "Set Up Tithing"}</p>
                <p className="text-xs text-gray-400">{config ? "Bank, mobile money details" : "Add payment details for members"}</p>
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}

        {/* Admin setup form */}
        {isChurchAdmin && setupMode && (
          <div className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Payment Setup</h2>
              <button onClick={() => setSetupMode(false)} className="text-sm text-gray-400">Cancel</button>
            </div>

            {[
              { label: "Bank Name", value: bankName, set: setBankName, placeholder: "e.g. First National Bank" },
              { label: "Account Name", value: accountName, set: setAccountName, placeholder: "Name on the account" },
              { label: "Account Number", value: accountNumber, set: setAccountNumber, placeholder: "Bank account number" },
              { label: "Mobile Money (M-Pesa, etc.)", value: mobileMoney, set: setMobileMoney, placeholder: "e.g. M-Pesa: +254 700 000 000" },
            ].map((f) => (
              <div key={f.label}>
                <label className="mb-1 block text-xs font-semibold text-gray-500 uppercase tracking-wide">{f.label}</label>
                <input
                  type="text"
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white"
                />
              </div>
            ))}

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500 uppercase tracking-wide">Additional Instructions</label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
                placeholder="Any special instructions for payment..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white"
              />
            </div>

            <button
              onClick={saveConfig}
              disabled={savingConfig}
              className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white disabled:bg-blue-400"
            >
              {savingConfig ? "Saving..." : "Save Payment Details"}
            </button>
          </div>
        )}

        {/* Payment info card */}
        {config && (config.bank_name || config.account_number || config.mobile_money || config.payment_instructions) && (
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-bold text-gray-900 flex items-center gap-2">
              <span className="text-xl">🏦</span> Payment Details
            </h2>
            <div className="space-y-2 text-sm">
              {config.bank_name && (
                <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-gray-500">Bank</span>
                  <span className="font-medium text-gray-900">{config.bank_name}</span>
                </div>
              )}
              {config.account_name && (
                <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-gray-500">Account Name</span>
                  <span className="font-medium text-gray-900">{config.account_name}</span>
                </div>
              )}
              {config.account_number && (
                <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-gray-500">Account No.</span>
                  <span className="font-medium text-gray-900 font-mono">{config.account_number}</span>
                </div>
              )}
              {config.mobile_money && (
                <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-gray-500">Mobile Money</span>
                  <span className="font-medium text-gray-900">{config.mobile_money}</span>
                </div>
              )}
              {config.payment_instructions && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {config.payment_instructions}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Give form — only for members */}
        {isMember && config && (
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-bold text-gray-900">Record Your Giving</h2>

            {/* Type selector */}
            <div className="mb-4 flex gap-2">
              {(["tithe", "offering", "donation"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setGiveType(t)}
                  className={`flex-1 rounded-xl py-2 text-sm font-semibold capitalize transition-colors ${
                    giveType === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {/* Amount + currency */}
              <div className="flex gap-2">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                >
                  {["USD", "EUR", "GBP", "NGN", "KES", "ZAR", "GHS", "XAF", "XOF"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white"
                />
              </div>

              <input
                type="text"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="Payment reference / transaction ID (optional)"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white"
              />

              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white"
              />

              {giveSuccess && (
                <div className="rounded-xl bg-green-50 px-3 py-2.5 text-sm font-medium text-green-700">
                  ✓ Your giving has been recorded. God bless you!
                </div>
              )}

              <button
                onClick={submitDonation}
                disabled={giving || !amount || parseFloat(amount) <= 0}
                className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white disabled:bg-blue-300"
              >
                {giving ? "Recording..." : `Record ${giveType.charAt(0).toUpperCase() + giveType.slice(1)}`}
              </button>
            </div>
          </div>
        )}

        {!isMember && config && !isChurchAdmin && (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-gray-500">You must be a church member to record giving.</p>
            <button
              onClick={() => router.back()}
              className="mt-3 text-sm font-semibold text-blue-600"
            >
              Request membership from the church profile
            </button>
          </div>
        )}

        {/* My giving history */}
        {myDonations.length > 0 && (
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-bold text-gray-900">My Giving History</h2>
            <div className="space-y-2">
              {myDonations.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
                  <div>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold capitalize text-blue-700">{d.type}</span>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {new Date(d.created_at).toLocaleDateString()}
                      {d.payment_reference && ` · Ref: ${d.payment_reference}`}
                    </p>
                  </div>
                  <p className="font-bold text-gray-900">{formatCurrency(d.amount, d.currency)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
