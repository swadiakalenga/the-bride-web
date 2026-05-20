"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "../../lib/useLanguage";

export default function SupportPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();

  const isFr = lang === "fr";

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 shadow-sm">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          aria-label={t("common_back")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="font-bold text-gray-900">{t("support_title")}</h1>
      </header>

      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">

        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 p-6 text-center text-white shadow-lg">
          <div className="mb-3 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
          </div>
          <h2 className="text-xl font-bold">{t("support_title")}</h2>
          <p className="mt-2 text-sm text-amber-100">{t("support_tagline")}</p>
        </div>

        {/* Why support */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-bold text-gray-900">
            {isFr ? "Pourquoi nous soutenir ?" : "Why support us?"}
          </h3>
          <ul className="space-y-2 text-sm text-gray-600">
            {(isFr ? [
              "Maintenir et améliorer la plateforme TheBride",
              "Développer de nouvelles fonctionnalités pour les églises",
              "Héberger des données en toute sécurité pour les communautés chrétiennes",
              "Garder TheBride gratuit pour tous les membres",
            ] : [
              "Maintain and improve the TheBride platform",
              "Build new features for churches",
              "Securely host data for Christian communities",
              "Keep TheBride free for all members",
            ]).map((item) => (
              <li key={item} className="flex items-start gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Payment options placeholder */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-bold text-gray-900">
            {isFr ? "Comment faire un don" : "How to donate"}
          </h3>

          <div className="space-y-3">
            {/* Mobile money */}
            <div className="rounded-xl border border-gray-100 p-4">
              <p className="font-semibold text-gray-800">
                {isFr ? "Mobile Money / Virement bancaire" : "Mobile Money / Bank Transfer"}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {isFr
                  ? "Contactez-nous à support@thebride.app pour recevoir les coordonnées de paiement."
                  : "Contact us at support@thebride.app to receive payment details."}
              </p>
              <a
                href="mailto:support@thebride.app"
                className="mt-2 inline-block text-sm font-semibold text-amber-600 hover:underline"
              >
                support@thebride.app
              </a>
            </div>

            {/* Stripe/PayPal placeholder */}
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center">
              <p className="text-sm font-medium text-gray-500">
                {isFr
                  ? "Paiement en ligne (Stripe / PayPal) — à venir"
                  : "Online payment (Stripe / PayPal) — coming soon"}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {isFr
                  ? "Nous n'acceptons pas encore les paiements en ligne directement dans l'application. Cette fonctionnalité sera disponible prochainement."
                  : "We do not yet accept online payments directly in the app. This feature is coming soon."}
              </p>
            </div>
          </div>
        </div>

        {/* Legal note */}
        <p className="text-center text-xs text-gray-400">
          {isFr
            ? "TheBride est une plateforme indépendante. Les dons sont volontaires et non remboursables."
            : "TheBride is an independent platform. Donations are voluntary and non-refundable."}
          {" "}
          <button
            onClick={() => router.push("/legal/donation-policy")}
            className="text-amber-500 hover:underline"
          >
            {isFr ? "Politique de dons" : "Donation Policy"}
          </button>
        </p>
      </div>
    </main>
  );
}
