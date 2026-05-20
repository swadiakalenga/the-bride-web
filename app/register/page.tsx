"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useLanguage } from "../../lib/useLanguage";
import type { Lang } from "../../lib/i18n";
import Logo from "../components/ui/Logo";

export default function RegisterPage() {
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();
  const [accountType, setAccountType] = useState<"personal" | "church">("personal");

  const [fullName, setFullName] = useState("");
  const [churchName, setChurchName] = useState("");
  const [pastorName, setPastorName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [description, setDescription] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Tithing setup (optional, church only)
  const [showTithingSetup, setShowTithingSetup] = useState(false);
  const [createdChurchId, setCreatedChurchId] = useState<string | null>(null);
  const [tBankName, setTBankName] = useState("");
  const [tAccountName, setTAccountName] = useState("");
  const [tAccountNumber, setTAccountNumber] = useState("");
  const [tMobileMoney, setTMobileMoney] = useState("");
  const [tInstructions, setTInstructions] = useState("");
  const [savingTithe, setSavingTithe] = useState(false);

  const resetForm = () => {
    setFullName("");
    setChurchName("");
    setPastorName("");
    setCity("");
    setCountry("");
    setDescription("");
    setEmail("");
    setPassword("");
    setAccountType("personal");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    const trimmedEmail = email.trim();
    const trimmedPassword = password;
    const trimmedFullName = fullName.trim();
    const trimmedChurchName = churchName.trim();
    const trimmedPastorName = pastorName.trim();
    const trimmedCity = city.trim() || null;
    const trimmedCountry = country.trim() || null;
    const trimmedDescription = description.trim() || null;

    if (accountType === "personal" && !trimmedFullName) {
      setMessage("Full name is required.");
      setLoading(false);
      return;
    }

    if (accountType === "church" && !trimmedChurchName) {
      setMessage("Church name is required.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password: trimmedPassword,
      options: {
        data: {
          full_name: accountType === "personal" ? trimmedFullName : trimmedChurchName,
          account_type: accountType,
        },
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const user = data.user;
    const session = data.session;

    if (!user) {
      setMessage("Account could not be created.");
      setLoading(false);
      return;
    }

    if (!session) {
      setMessage("Account created. Check your email to confirm your account, then log in.");
      setLoading(false);
      return;
    }

    if (accountType === "personal") {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: trimmedFullName,
          city: trimmedCity,
          country: trimmedCountry,
          bio: null,
          role: "member",
          account_type: "member",
          church_id: null,
        })
        .eq("id", user.id);

      if (profileError) {
        setMessage(`Account created, but profile failed: ${profileError.message}`);
        setLoading(false);
        return;
      }
    }

    if (accountType === "church") {
      const { data: churchData, error: churchError } = await supabase
        .from("churches")
        .insert([
          {
            name: trimmedChurchName,
            city: trimmedCity,
            country: trimmedCountry,
            pastor_name: trimmedPastorName || null,
            description: trimmedDescription,
            admin_user_id: user.id,
          },
        ])
        .select("id")
        .single();

      if (churchError) {
        setMessage(`Church account created, but church row failed: ${churchError.message}`);
        setLoading(false);
        return;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: trimmedChurchName,
          city: trimmedCity,
          country: trimmedCountry,
          bio: trimmedDescription,
          role: "church_admin",
          account_type: "church",
          church_id: churchData.id,
        })
        .eq("id", user.id);

      if (profileError) {
        setMessage(`Church account created, but profile failed: ${profileError.message}`);
        setLoading(false);
        return;
      }

      // Offer optional tithing setup
      setCreatedChurchId(churchData.id);
      setShowTithingSetup(true);
      setLoading(false);
      return;
    }

    setMessage("Account created successfully!");
    resetForm();
    setLoading(false);
  };

  const saveTithing = async () => {
    if (!createdChurchId) return;
    setSavingTithe(true);
    await supabase.from("tithing_configs").upsert([{
      church_id: createdChurchId,
      bank_name: tBankName || null,
      account_name: tAccountName || null,
      account_number: tAccountNumber || null,
      mobile_money: tMobileMoney || null,
      payment_instructions: tInstructions || null,
    }], { onConflict: "church_id" });
    setSavingTithe(false);
    setShowTithingSetup(false);
    setMessage("Account and tithing system set up successfully!");
    resetForm();
  };

  const inputClass = "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100";
  const labelClass = "mb-1.5 block text-sm font-medium text-gray-700";

  // Tithing setup step
  if (showTithingSetup) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-10">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-green-500 shadow-md text-2xl">
              🙏
            </div>
            <h2 className="text-xl font-bold text-gray-900">Set Up Tithing</h2>
            <p className="mt-1 text-sm text-gray-500">
              Add payment details so members can give tithes and offerings. You can skip this and do it later from your profile.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { label: "Bank Name", value: tBankName, set: setTBankName, placeholder: "e.g. First National Bank" },
              { label: "Account Name", value: tAccountName, set: setTAccountName, placeholder: "Name on account" },
              { label: "Account Number", value: tAccountNumber, set: setTAccountNumber, placeholder: "Bank account number" },
              { label: "Mobile Money", value: tMobileMoney, set: setTMobileMoney, placeholder: "e.g. M-Pesa: +254 700 000 000" },
            ].map((f) => (
              <div key={f.label}>
                <label className={labelClass}>{f.label}</label>
                <input
                  type="text"
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  placeholder={f.placeholder}
                  className={inputClass}
                />
              </div>
            ))}

            <div>
              <label className={labelClass}>Special Instructions (optional)</label>
              <textarea
                value={tInstructions}
                onChange={(e) => setTInstructions(e.target.value)}
                rows={2}
                placeholder="Any additional payment instructions..."
                className={inputClass}
              />
            </div>

            <button
              onClick={saveTithing}
              disabled={savingTithe}
              className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-3 font-semibold text-white shadow-sm transition hover:from-amber-500 hover:to-amber-600 disabled:opacity-60"
            >
              {savingTithe ? "Saving..." : "Save & Finish"}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowTithingSetup(false);
                setMessage("Account created! You can set up tithing later from your profile.");
                resetForm();
              }}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Skip for now
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-10">
      {/* Language picker */}
      <div className="absolute right-4 top-4 flex gap-1">
        {(["fr", "en"] as Lang[]).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`rounded px-2 py-1 text-xs font-semibold uppercase ${
              lang === l ? "bg-amber-100 text-amber-700" : "text-gray-400 hover:text-gray-700"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Logo */}
      <div className="mb-6 flex flex-col items-center">
        <Logo size="lg" />
        <p className="mt-1 text-sm text-gray-500">Join the community</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-5 flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {t("common_back")}
        </button>

        <h2 className="mb-1 text-xl font-bold text-gray-900">{t("register_title")}</h2>
        <p className="mb-5 text-sm text-gray-500">{lang === "fr" ? "Choisissez votre type de compte" : "Choose your account type"}</p>

        {/* Account type toggle */}
        <div className="mb-6 flex rounded-xl border border-gray-200 bg-gray-50 p-1">
          <button
            type="button"
            onClick={() => setAccountType("personal")}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
              accountType === "personal"
                ? "bg-white text-amber-500 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Personal
          </button>
          <button
            type="button"
            onClick={() => setAccountType("church")}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
              accountType === "church"
                ? "bg-white text-blue-500 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Church
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleRegister}>
          {accountType === "personal" ? (
            <div>
              <label className={labelClass}>Full Name</label>
              <input
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
                required
              />
            </div>
          ) : (
            <>
              <div>
                <label className={labelClass}>Church Name</label>
                <input
                  type="text"
                  placeholder="Enter church name"
                  value={churchName}
                  onChange={(e) => setChurchName(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Pastor Name</label>
                <input
                  type="text"
                  placeholder="Enter pastor name"
                  value={pastorName}
                  onChange={(e) => setPastorName(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  placeholder="Describe the church"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className={inputClass}
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>City</label>
              <input
                type="text"
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Country</label>
              <input
                type="text"
                placeholder="Country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Password</label>
            <input
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-3 font-semibold text-white shadow-sm transition hover:from-amber-500 hover:to-amber-600 disabled:opacity-60"
          >
            {loading ? "…" : t("register_submit")}
          </button>

          {message && (
            <p className={`rounded-lg px-3 py-2 text-center text-sm ${
              message.toLowerCase().includes("success") || message.toLowerCase().includes("created") || message.toLowerCase().includes("set up")
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-600"
            }`}>
              {message}
            </p>
          )}
        </form>
      </div>

      <p className="mt-6 text-sm text-gray-500">
        {t("register_has_account")}{" "}
        <a href="/login" className="font-semibold text-amber-500 hover:text-amber-600">
          {t("register_login_link")}
        </a>
      </p>
    </main>
  );
}
