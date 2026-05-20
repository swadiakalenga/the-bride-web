"use client";

import Link from "next/link";
import { useLanguage } from "../../../lib/useLanguage";

const cta = {
  fr: { label: "Supprimer mon compte maintenant", href: "/settings/account" },
  en: { label: "Delete my account now", href: "/settings/account" },
};

const fr = {
  title: "Politique de suppression de compte",
  updated: "Dernière mise à jour : 20 mai 2026",
  sections: [
    {
      heading: "Comment supprimer votre compte",
      body: "Vous pouvez supprimer votre compte à tout moment via :",
      list: [
        "Paramètres → Compte → Supprimer le compte (dans l'application)",
        "Par e-mail : envoyez une demande à support@thebride.app depuis l'adresse e-mail associée à votre compte",
      ],
      footer: "Votre compte sera désactivé immédiatement. La suppression définitive des données intervient après la période de grâce de 30 jours.",
    },
    {
      heading: "Ce qui est supprimé",
      body: "Lors de la suppression définitive de votre compte, les données suivantes sont effacées :",
      list: [
        "Votre profil (nom, photo, biographie, informations personnelles)",
        "Vos publications et commentaires",
        "Votre historique de suivis et d'abonnés",
        "Vos appartenances à des communautés ecclésiales",
        "Votre participation aux conversations de messagerie",
        "Votre historique de notifications",
      ],
    },
    {
      heading: "Ce qui est conservé",
      body: "Certaines données sont conservées même après la suppression de votre compte, conformément à nos obligations légales :",
      list: [
        "Journaux de modération et signalements vous concernant : conservés 3 ans pour la conformité légale",
        "Enregistrements de dons anonymisés : conservés 7 ans à des fins de conformité fiscale",
        "Contenu déjà partagé ou mis en cache par d'autres utilisateurs avant la suppression",
      ],
    },
    {
      heading: "Période de grâce de 30 jours",
      body: "Après avoir lancé la suppression, votre compte entre dans une période de grâce de 30 jours. Pendant cette période, votre compte est désactivé et invisible aux autres utilisateurs, mais vos données ne sont pas encore supprimées. Vous pouvez annuler la suppression et réactiver votre compte en vous reconnectant à n'importe quel moment durant ces 30 jours.",
    },
    {
      heading: "Irréversibilité",
      body: "Après l'expiration du délai de grâce de 30 jours, la suppression est définitive et irréversible. Il ne sera pas possible de récupérer votre compte, vos publications ou vos données. Votre nom d'utilisateur sera libéré et pourra être réutilisé par un autre utilisateur.",
    },
    {
      heading: "Comptes d'administrateur d'église",
      body: "Si vous êtes le seul administrateur d'un compte d'église, vous devez transférer les droits d'administration à un autre membre ou demander la suppression du compte d'église avant de supprimer votre compte personnel. Si aucun transfert n'est effectué, le compte d'église sera automatiquement supprimé en même temps que votre compte personnel à l'issue de la période de grâce.",
    },
    {
      heading: "Conformité avec les stores d'applications",
      body: "Cette procédure de suppression de compte est conforme aux exigences de l'Apple App Store et du Google Play Store en matière de suppression de compte utilisateur. Si vous avez accédé à TheBride via une application mobile, vous pouvez initier la suppression directement depuis l'application comme décrit ci-dessus.",
    },
    {
      heading: "Contact",
      body: "Pour toute question relative à la suppression de votre compte : support@thebride.app",
    },
  ],
  relatedLinks: [
    { href: "/legal/data-deletion", label: "Demande de suppression de données" },
    { href: "/legal/privacy", label: "Politique de confidentialité" },
  ],
  relatedTitle: "Documents liés",
};

const en = {
  title: "Account Deletion Policy",
  updated: "Last updated: May 20, 2026",
  sections: [
    {
      heading: "How to Delete Your Account",
      body: "You can delete your account at any time via:",
      list: [
        "Settings → Account → Delete Account (in the app)",
        "By email: send a request to support@thebride.app from the email address associated with your account",
      ],
      footer: "Your account will be deactivated immediately. Permanent data deletion occurs after the 30-day grace period.",
    },
    {
      heading: "What Gets Deleted",
      body: "When your account is permanently deleted, the following data is erased:",
      list: [
        "Your profile (name, photo, bio, personal information)",
        "Your posts and comments",
        "Your following and follower history",
        "Your church community memberships",
        "Your participation in messaging conversations",
        "Your notification history",
      ],
    },
    {
      heading: "What Is Retained",
      body: "Certain data is retained even after account deletion, in accordance with our legal obligations:",
      list: [
        "Moderation logs and reports involving your account: retained for 3 years for legal compliance",
        "Anonymized donation records: retained for 7 years for tax compliance purposes",
        "Content already shared or cached by other users before deletion",
      ],
    },
    {
      heading: "30-Day Grace Period",
      body: "After initiating deletion, your account enters a 30-day grace period. During this period, your account is deactivated and invisible to other users, but your data has not yet been deleted. You can cancel the deletion and reactivate your account by logging back in at any point during these 30 days.",
    },
    {
      heading: "Irreversibility",
      body: "After the 30-day grace period expires, deletion is permanent and irreversible. It will not be possible to recover your account, posts, or data. Your username will be released and may be reused by another user.",
    },
    {
      heading: "Church Admin Accounts",
      body: "If you are the sole administrator of a church account, you must transfer admin rights to another member or request the deletion of the church account before deleting your personal account. If no transfer is made, the church account will be automatically deleted alongside your personal account at the end of the grace period.",
    },
    {
      heading: "App Store Compliance",
      body: "This account deletion process complies with Apple App Store and Google Play Store requirements for user account deletion. If you accessed TheBride via a mobile app, you can initiate deletion directly from within the app as described above.",
    },
    {
      heading: "Contact",
      body: "For questions about deleting your account: support@thebride.app",
    },
  ],
  relatedLinks: [
    { href: "/legal/data-deletion", label: "Data Deletion Request" },
    { href: "/legal/privacy", label: "Privacy Policy" },
  ],
  relatedTitle: "Related documents",
};

export default function AccountDeletionPage() {
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

      {/* In-app delete CTA — App Store / Play Store compliant */}
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
        <p className="mb-3 text-sm font-semibold text-red-700">
          {lang === "fr" ? "Vous souhaitez supprimer votre compte ?" : "Ready to delete your account?"}
        </p>
        <Link
          href={cta[lang].href}
          className="inline-block rounded-full bg-red-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600"
        >
          {cta[lang].label}
        </Link>
      </div>

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
