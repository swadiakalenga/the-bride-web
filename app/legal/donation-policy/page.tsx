"use client";

import Link from "next/link";
import { useLanguage } from "../../../lib/useLanguage";

const fr = {
  title: "Politique de dons et paiements",
  updated: "Dernière mise à jour : 20 mai 2026",
  sections: [
    {
      heading: "Dons de soutien à la plateforme",
      body: "Les dons effectués directement à TheBride servent à financer l'infrastructure technique, le développement de la plateforme, la sécurité et le support utilisateur. Ces dons ne constituent pas des dons caritatifs et ne donnent pas droit à une déduction fiscale. Ils sont volontaires et non récurrents.",
    },
    {
      heading: "Dîmes et offrandes aux églises",
      body: "TheBride permet aux membres de faire des dons, dîmes et offrandes aux églises présentes sur la plateforme. Cette fonctionnalité est distincte des dons à TheBride. La plateforme agit en tant que facilitateur technique uniquement : les transactions financières se font directement entre l'utilisateur et l'église. TheBride n'est pas une institution financière et n'est pas responsable des fonds transférés.",
    },
    {
      heading: "Méthodes de paiement",
      body: "Les méthodes de paiement suivantes sont actuellement disponibles :",
      list: [
        "PayPal",
        "Mobile Money (selon disponibilité régionale)",
        "Virement bancaire",
      ],
      footer: "Le traitement par carte bancaire directe n'est pas disponible actuellement. Nous mettrons à jour cette politique lorsque de nouvelles méthodes seront intégrées.",
    },
    {
      heading: "Modèle de confirmation manuelle",
      body: "Tous les dons soumis via la plateforme sont enregistrés comme « en attente » jusqu'à ce qu'un administrateur de l'église ou de la plateforme confirme la réception. Cette confirmation est manuelle et peut prendre quelques jours ouvrables selon l'église concernée. Aucun montant n'est automatiquement marqué comme reçu.",
    },
    {
      heading: "Absence de garantie de réception",
      body: "TheBride ne peut pas garantir que les fonds parviendront au destinataire prévu. En cas de problème avec une transaction, TheBride peut tenter de faciliter la communication entre les parties, mais ne peut pas forcer des remboursements sur des méthodes de paiement externes. Il est de votre responsabilité de vérifier le statut de vérification d'une église avant tout don financier.",
    },
    {
      heading: "Églises vérifiées et non vérifiées",
      body: "TheBride recommande vivement de n'effectuer des dons financiers qu'aux églises portant le badge de vérification. Les églises non vérifiées n'ont pas été soumises au processus de contrôle de la plateforme. Effectuer un don à une église non vérifiée se fait entièrement à vos risques et périls.",
    },
    {
      heading: "Politique de remboursement",
      body: "Il n'existe pas de système de remboursement automatique. Si vous pensez avoir effectué un paiement par erreur ou êtes victime d'une fraude, contactez l'administration de la plateforme à payments@thebride.app. TheBride ne peut pas forcer des remboursements sur des transactions effectuées via des méthodes de paiement externes (PayPal, Mobile Money, virement). Tout litige doit être traité directement avec votre prestataire de paiement.",
    },
    {
      heading: "Lutte contre la fraude",
      body: "Toute activité de don suspecte (faux comptes d'église, collectes frauduleuses, usurpation d'identité) sera signalée et fera l'objet d'une enquête. Les comptes impliqués dans des fraudes liées aux dons seront définitivement bannis et signalés aux autorités compétentes. Signalez toute activité suspecte à safety@thebride.app.",
    },
    {
      heading: "Conservation des données",
      body: "Les enregistrements de dons sont conservés pendant 7 ans à des fins de conformité légale et fiscale, même après la suppression d'un compte.",
    },
    {
      heading: "Contact",
      body: "Questions sur les paiements : payments@thebride.app",
    },
  ],
  relatedLinks: [
    { href: "/legal/church-verification-policy", label: "Politique de vérification des églises" },
    { href: "/legal/terms", label: "Conditions d'utilisation" },
  ],
  relatedTitle: "Documents liés",
};

const en = {
  title: "Donation & Payment Policy",
  updated: "Last updated: May 20, 2026",
  sections: [
    {
      heading: "Platform Support Donations",
      body: "Donations made directly to TheBride fund technical infrastructure, platform development, security, and user support. These donations are not charitable gifts and do not qualify for tax deduction. They are voluntary and non-recurring.",
    },
    {
      heading: "Church Tithes & Offerings",
      body: "TheBride enables members to make donations, tithes, and offerings to churches on the platform. This feature is separate from donations to TheBride itself. The platform acts as a technical facilitator only: financial transactions occur directly between the user and the church. TheBride is not a financial institution and is not responsible for transferred funds.",
    },
    {
      heading: "Payment Methods",
      body: "The following payment methods are currently available:",
      list: [
        "PayPal",
        "Mobile Money (subject to regional availability)",
        "Bank Transfer",
      ],
      footer: "Direct card processing is not currently available. We will update this policy when new payment methods are integrated.",
    },
    {
      heading: "Manual Confirmation Model",
      body: "All donations submitted via the platform are recorded as \"pending\" until a church or platform administrator manually confirms receipt. This confirmation is manual and may take a few business days depending on the church. No amount is automatically marked as received.",
    },
    {
      heading: "No Guarantee of Receipt",
      body: "TheBride cannot guarantee that funds will reach the intended recipient. In the event of a problem with a transaction, TheBride may attempt to facilitate communication between the parties, but cannot force refunds on external payment methods. It is your responsibility to verify a church's verification status before making any financial gift.",
    },
    {
      heading: "Verified vs Unverified Churches",
      body: "TheBride strongly recommends making financial gifts only to churches displaying the verified badge. Unverified churches have not been through the platform's review process. Donating to an unverified church is done entirely at your own risk.",
    },
    {
      heading: "Refund Policy",
      body: "There is no automated refund system. If you believe you made a payment in error or are a victim of fraud, contact platform administration at payments@thebride.app. TheBride cannot force refunds on transactions made via external payment methods (PayPal, Mobile Money, bank transfer). Any dispute must be handled directly with your payment provider.",
    },
    {
      heading: "Anti-Fraud",
      body: "Any suspicious donation activity (fake church accounts, fraudulent fundraising, identity theft) will be reported and investigated. Accounts engaged in donation-related fraud will be permanently banned and referred to relevant law enforcement authorities. Report any suspicious activity to safety@thebride.app.",
    },
    {
      heading: "Data Retention",
      body: "Donation records are retained for 7 years for legal and tax compliance purposes, even after an account is deleted.",
    },
    {
      heading: "Contact",
      body: "Payment questions: payments@thebride.app",
    },
  ],
  relatedLinks: [
    { href: "/legal/church-verification-policy", label: "Church Verification Policy" },
    { href: "/legal/terms", label: "Terms of Use" },
  ],
  relatedTitle: "Related documents",
};

export default function DonationPolicyPage() {
  const { lang } = useLanguage();
  const c = lang === "fr" ? fr : en;

  return (
    <article className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{c.title}</h1>
        <p className="mt-1 text-sm text-gray-500">{c.updated}</p>
      </div>

      {c.sections.map((section) => (
        <section key={section.heading} className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">{section.heading}</h2>
          {section.body && (
            <p className="text-sm leading-relaxed text-gray-700">{section.body}</p>
          )}
          {"list" in section && section.list && (
            <ul className="space-y-2">
              {section.list.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-gray-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
                  {item}
                </li>
              ))}
            </ul>
          )}
          {"footer" in section && section.footer && (
            <p className="text-sm italic text-gray-500">{section.footer}</p>
          )}
        </section>
      ))}

      <div className="rounded-xl border border-brand-200 bg-brand-50 px-5 py-4">
        <p className="mb-3 text-sm font-semibold text-brand-600">{c.relatedTitle}</p>
        <div className="flex flex-col gap-2">
          {c.relatedLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-brand-600 underline underline-offset-2 hover:opacity-75">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}
