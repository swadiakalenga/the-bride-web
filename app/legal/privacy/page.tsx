"use client";

import Link from "next/link";
import { useLanguage } from "../../../lib/useLanguage";

const fr = {
  title: "Politique de confidentialité",
  updated: "Dernière mise à jour : 20 mai 2026",
  sections: [
    {
      heading: "1. Informations que nous collectons",
      content: null,
      list: [
        { term: "Données de compte", def: "nom, adresse e-mail, mot de passe (haché et jamais stocké en clair)." },
        { term: "Données de profil", def: "biographie, ville, pays, photo de profil, affiliation ecclésiale." },
        { term: "Données de contenu", def: "publications, commentaires, messages, demandes de prière, dévotionnels." },
        { term: "Données d'utilisation", def: "vues de pages, utilisation des fonctionnalités, type d'appareil, via des analyses web standard." },
        { term: "Documents de vérification (églises uniquement)", def: "documents d'enregistrement, pièces d'identité, justificatifs d'adresse — stockés dans un compartiment privé à accès restreint." },
      ],
    },
    {
      heading: "2. Comment nous utilisons vos données",
      content: "Vos données sont utilisées pour :",
      list: [
        { term: null, def: "Fournir et améliorer la plateforme." },
        { term: null, def: "Vous envoyer des notifications pour lesquelles vous avez donné votre consentement." },
        { term: null, def: "Vérifier les comptes d'église soumis à notre processus de vérification." },
        { term: null, def: "Répondre à vos demandes d'assistance." },
        { term: null, def: "Se conformer aux obligations légales applicables." },
      ],
    },
    {
      heading: "3. Partage des données",
      content: "Nous ne vendons jamais vos données personnelles. Nous pouvons partager des données avec :",
      list: [
        { term: "Prestataires de services", def: "Supabase (base de données/authentification), Vercel (hébergement). Ces prestataires traitent les données dans le cadre d'accords de sécurité stricts." },
        { term: "Forces de l'ordre", def: "Uniquement lorsque la loi l'exige expressément et selon les procédures légales applicables." },
      ],
    },
    {
      heading: "4. Confidentialité des messages",
      content: "Les messages directs sont chiffrés en transit et stockés de manière sécurisée sur nos serveurs. Seuls les participants à une conversation peuvent lire les messages. Les administrateurs de la plateforme ne peuvent pas lire les conversations privées dans le cadre d'une utilisation normale. Exception : si une ordonnance judiciaire ou une injonction légale valide l'exige, nous pouvons être contraints de divulguer des données de message conformément à la loi.",
      list: null,
    },
    {
      heading: "5. Documents de vérification des églises",
      content: "Les documents soumis pour la vérification des comptes d'église sont stockés dans un compartiment de stockage privé accessible uniquement aux administrateurs de la plateforme chargés de l'examen. Ces documents ne sont jamais rendus publics ni partagés avec des tiers. Ils sont supprimés définitivement 12 mois après la fin de l'examen de vérification, qu'il soit accepté ou refusé.",
      list: null,
    },
    {
      heading: "6. Conservation des données",
      content: null,
      list: [
        { term: "Compte actif", def: "vos données sont conservées tant que votre compte est actif." },
        { term: "Compte supprimé", def: "une période de grâce de 30 jours s'applique. Votre compte est désactivé immédiatement, puis vos données personnelles sont définitivement supprimées après 30 jours." },
        { term: "Journaux de modération", def: "conservés 3 ans à des fins de conformité légale, même après suppression du compte." },
      ],
    },
    {
      heading: "7. Vos droits",
      content: "En fonction de votre juridiction, vous disposez des droits suivants concernant vos données personnelles :",
      list: [
        { term: "Accès", def: "obtenir une copie des données que nous détenons sur vous." },
        { term: "Rectification", def: "corriger des informations inexactes ou incomplètes." },
        { term: "Suppression", def: "demander l'effacement de vos données (voir notre politique de suppression de données)." },
        { term: "Exportation", def: "recevoir vos données dans un format portable." },
        { term: "Opposition", def: "vous opposer à certains traitements de vos données." },
      ],
      footer: "Pour exercer ces droits, contactez-nous à privacy@thebride.app.",
    },
    {
      heading: "8. Cookies",
      content: "Nous utilisons des cookies de session uniquement à des fins d'authentification. Nous n'utilisons pas de cookies publicitaires tiers ni de traceurs de suivi comportemental.",
      list: null,
    },
    {
      heading: "9. Enfants et mineurs",
      content: "TheBride est une plateforme réservée aux personnes âgées de 13 ans et plus. Si nous découvrons que des données appartenant à un enfant de moins de 13 ans ont été collectées, ces données seront supprimées immédiatement. Si vous pensez qu'un enfant de moins de 13 ans a créé un compte, contactez-nous à privacy@thebride.app.",
      list: null,
    },
    {
      heading: "10. Contact",
      content: "Pour toute question relative à la confidentialité : privacy@thebride.app",
      list: null,
    },
    {
      heading: "11. Modifications de cette politique",
      content: "Nous pouvons mettre à jour cette politique à tout moment. En cas de modification importante, nous vous informerons via une notification dans l'application ou par e-mail. La date de dernière mise à jour est indiquée en haut de cette page. La poursuite de l'utilisation de la plateforme après une mise à jour vaut acceptation de la nouvelle politique.",
      list: null,
    },
  ],
  relatedLinks: [
    { href: "/legal/data-deletion", label: "Demande de suppression de données" },
    { href: "/legal/account-deletion", label: "Politique de suppression de compte" },
    { href: "/legal/terms", label: "Conditions d'utilisation" },
  ],
  relatedTitle: "Documents liés",
};

const en = {
  title: "Privacy Policy",
  updated: "Last updated: May 20, 2026",
  sections: [
    {
      heading: "1. Information We Collect",
      content: null,
      list: [
        { term: "Account data", def: "name, email address, password (hashed and never stored in plain text)." },
        { term: "Profile data", def: "bio, city, country, profile photo, church affiliation." },
        { term: "Content data", def: "posts, comments, messages, prayer requests, devotionals." },
        { term: "Usage data", def: "page views, feature usage, device type via standard web analytics." },
        { term: "Verification documents (churches only)", def: "registration documents, ID, proof of address — stored in a private restricted-access bucket." },
      ],
    },
    {
      heading: "2. How We Use Your Data",
      content: "Your data is used to:",
      list: [
        { term: null, def: "Provide and improve the Platform." },
        { term: null, def: "Send notifications you have opted into." },
        { term: null, def: "Verify church accounts submitted through our verification process." },
        { term: null, def: "Respond to your support requests." },
        { term: null, def: "Comply with applicable legal obligations." },
      ],
    },
    {
      heading: "3. Data Sharing",
      content: "We never sell your personal data. We may share data with:",
      list: [
        { term: "Service providers", def: "Supabase (database/authentication), Vercel (hosting). These providers process data under strict security agreements." },
        { term: "Law enforcement", def: "Only when expressly required by law and pursuant to applicable legal process." },
      ],
    },
    {
      heading: "4. Message Privacy",
      content: "Direct messages are encrypted in transit and stored securely on our servers. Only conversation participants can read messages. Platform administrators cannot read private conversations in normal operation. Exception: if a valid court order or legal injunction requires it, we may be compelled to disclose message data in accordance with the law.",
      list: null,
    },
    {
      heading: "5. Church Verification Documents",
      content: "Documents submitted for church account verification are stored in a private storage bucket accessible only to designated TheBride administrators conducting the review. These documents are never made public or shared with third parties. They are permanently deleted 12 months after the completion of the verification review, whether approved or rejected.",
      list: null,
    },
    {
      heading: "6. Data Retention",
      content: null,
      list: [
        { term: "Active account", def: "your data is retained for as long as your account remains active." },
        { term: "Deleted account", def: "a 30-day grace period applies. Your account is deactivated immediately; personal data is permanently deleted after 30 days." },
        { term: "Moderation logs", def: "retained for 3 years for legal compliance purposes, even after account deletion." },
      ],
    },
    {
      heading: "7. Your Rights",
      content: "Depending on your jurisdiction, you have the following rights regarding your personal data:",
      list: [
        { term: "Access", def: "obtain a copy of the data we hold about you." },
        { term: "Rectification", def: "correct inaccurate or incomplete information." },
        { term: "Deletion", def: "request erasure of your data (see our Data Deletion Policy)." },
        { term: "Export", def: "receive your data in a portable format." },
        { term: "Objection", def: "object to certain processing of your data." },
      ],
      footer: "To exercise these rights, contact us at privacy@thebride.app.",
    },
    {
      heading: "8. Cookies",
      content: "We use session cookies solely for authentication purposes. We do not use third-party advertising cookies or behavioral tracking trackers.",
      list: null,
    },
    {
      heading: "9. Children & Minors",
      content: "TheBride is a platform for persons aged 13 and over. If we discover that data belonging to a child under 13 has been collected, that data will be deleted immediately. If you believe a child under 13 has created an account, contact us at privacy@thebride.app.",
      list: null,
    },
    {
      heading: "10. Contact",
      content: "Privacy questions: privacy@thebride.app",
      list: null,
    },
    {
      heading: "11. Changes to This Policy",
      content: "We may update this policy at any time. For significant changes, we will notify you via an in-app notification or by email. The date of the last update is shown at the top of this page. Continued use of the platform after an update constitutes acceptance of the new policy.",
      list: null,
    },
  ],
  relatedLinks: [
    { href: "/legal/data-deletion", label: "Data Deletion Request" },
    { href: "/legal/account-deletion", label: "Account Deletion Policy" },
    { href: "/legal/terms", label: "Terms of Use" },
  ],
  relatedTitle: "Related documents",
};

export default function PrivacyPolicyPage() {
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
          {section.content && (
            <p className="text-sm leading-relaxed text-gray-700">{section.content}</p>
          )}
          {section.list && (
            <ul className="space-y-2">
              {section.list.map((item, i) => (
                <li key={i} className="text-sm leading-relaxed text-gray-700">
                  {item.term ? (
                    <><strong className="text-gray-900">{item.term} :</strong> {item.def}</>
                  ) : (
                    <span className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />{item.def}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {"footer" in section && section.footer && (
            <p className="text-sm text-gray-700">{section.footer}</p>
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
