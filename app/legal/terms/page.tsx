"use client";

import Link from "next/link";
import { useLanguage } from "../../../lib/useLanguage";

const fr = {
  title: "Conditions d'utilisation",
  updated: "Dernière mise à jour : 20 mai 2026",
  sections: [
    {
      heading: "1. Acceptation",
      body: "En utilisant TheBride (« la Plateforme »), vous acceptez les présentes Conditions. Si vous n'acceptez pas ces Conditions, vous ne devez pas utiliser la Plateforme. L'utilisation de la Plateforme constitue une acceptation pleine et entière de ces Conditions.",
    },
    {
      heading: "2. Éligibilité",
      body: "Vous devez avoir au moins 13 ans pour utiliser TheBride. En créant un compte, vous confirmez que vous répondez à cette exigence. Les fonctionnalités financières, notamment les dons et les dîmes, sont réservées aux utilisateurs âgés de 18 ans ou plus, ou à l'âge légal de la majorité dans votre pays de résidence.",
    },
    {
      heading: "3. Responsabilités liées au compte",
      body: "Vous êtes responsable de la confidentialité de vos identifiants de connexion et de toute activité effectuée depuis votre compte. Vous vous engagez à fournir des informations exactes lors de l'inscription et à les maintenir à jour. En cas d'utilisation non autorisée de votre compte, vous devez nous en informer immédiatement à security@thebride.app.",
    },
    {
      heading: "4. Utilisations autorisées",
      body: "TheBride est une plateforme centrée sur la foi chrétienne. Les utilisations suivantes sont encouragées :",
      list: [
        "Partage de témoignages de foi et de parcours spirituels personnels",
        "Études bibliques, demandes de prière et dévotionnels",
        "Recommandations de musique de louange et de médias chrétiens",
        "Annonces et événements d'église",
        "Encouragement et soutien entre croyants",
        "Questions et discussions sur la foi chrétienne",
      ],
    },
    {
      heading: "5. Utilisations interdites",
      body: "Vous vous engagez à ne pas :",
      list: [
        "Publier des discours haineux, du contenu à caractère sexuel, des menaces ou du contenu violent",
        "Publier du contenu politique, des opinions sur des élections, des partis ou des candidats",
        "Commenter des événements sportifs, des scores ou des équipes",
        "Usurper l'identité d'une autre personne, d'une église ou d'une organisation",
        "Envoyer des messages non sollicités, du spam ou des sollicitations commerciales sans autorisation préalable",
        "Contourner des fonctionnalités de sécurité ou tenter d'accéder à des données non autorisées",
        "Diffuser de fausses informations sur la santé, la foi ou des événements",
        "Utiliser la Plateforme à des fins illégales",
      ],
    },
    {
      heading: "6. Comptes d'église",
      body: "Les comptes d'église sont soumis à un processus de vérification. Les églises non vérifiées disposent de fonctionnalités limitées. TheBride se réserve le droit de suspendre ou de supprimer les comptes d'église qui ne respectent pas les conditions de vérification, qui publient un contenu trompeur ou qui s'engagent dans des pratiques de collecte de fonds contraires à l'éthique.",
    },
    {
      heading: "7. Dons et dîmes",
      body: "TheBride facilite les dons à la plateforme et les dîmes aux églises participantes. La Plateforme agit en tant que facilitateur technique uniquement et n'est pas une institution financière. Tous les dons sont volontaires et les transactions se font entre l'utilisateur et l'église concernée. TheBride ne garantit pas que les fonds parviendront au destinataire prévu ; il est de votre responsabilité de vérifier le statut de vérification d'une église avant tout don financier.",
    },
    {
      heading: "8. Propriété du contenu",
      body: "Vous conservez la propriété du contenu que vous publiez sur la Plateforme. En publiant du contenu, vous accordez à TheBride une licence non exclusive, mondiale et libre de redevances pour afficher, distribuer et promouvoir ce contenu au sein de la Plateforme. Cette licence prend fin lorsque vous supprimez le contenu ou votre compte, sous réserve des délais de conservation légaux applicables.",
    },
    {
      heading: "9. Messagerie",
      body: "Les messages privés sont accessibles uniquement aux participants à la conversation. TheBride ne lit pas les messages privés sauf dans le cadre d'une obligation légale (ordonnance judiciaire valide) ou pour enquêter sur des violations signalées selon les procédures définies dans notre politique de confidentialité.",
    },
    {
      heading: "10. Modération et sanctions",
      body: "En cas de violation de ces Conditions ou de notre Charte communautaire, TheBride peut prendre les mesures suivantes :",
      list: [
        "Avertissement officiel",
        "Suppression du contenu en infraction",
        "Suspension temporaire du compte (1 à 30 jours)",
        "Bannissement permanent",
        "Signalement aux autorités compétentes en cas d'activité illégale",
      ],
      footer: "Pour faire appel d'une sanction, envoyez un e-mail à moderation@thebride.app avec vos coordonnées et les motifs de votre contestation.",
    },
    {
      heading: "11. Limitation de responsabilité",
      body: "TheBride est fourni « tel quel » sans garantie d'aucune sorte. Nous ne garantissons pas une disponibilité continue, un fonctionnement sans erreur, ni l'exactitude de tout contenu publié par des utilisateurs. Dans la mesure permise par la loi applicable, TheBride ne saurait être tenu responsable des dommages indirects, accessoires ou consécutifs découlant de l'utilisation de la Plateforme.",
    },
    {
      heading: "12. Droit applicable",
      body: "La Plateforme est exploitée à l'échelle internationale. Tout litige découlant de l'utilisation de la Plateforme sera résolu conformément au droit applicable dans votre juridiction de résidence, sauf convention contraire. Nous nous engageons à résoudre les différends à l'amiable dans la mesure du possible.",
    },
    {
      heading: "13. Modifications des Conditions",
      body: "Nous pouvons mettre à jour ces Conditions à tout moment. En cas de modification importante, nous vous informerons via une notification dans l'application ou par e-mail. La poursuite de l'utilisation de la Plateforme après une mise à jour vaut acceptation des nouvelles Conditions.",
    },
    {
      heading: "14. Contact",
      body: "Questions juridiques : legal@thebride.app",
    },
  ],
  relatedLinks: [
    { href: "/legal/community-guidelines", label: "Charte communautaire" },
    { href: "/legal/privacy", label: "Politique de confidentialité" },
    { href: "/legal/donation-policy", label: "Politique de dons et paiements" },
  ],
  relatedTitle: "Documents liés",
};

const en = {
  title: "Terms of Use",
  updated: "Last updated: May 20, 2026",
  sections: [
    {
      heading: "1. Acceptance",
      body: "By using TheBride (\"the Platform\"), you agree to these Terms. If you do not agree, you must not use the Platform. Use of the Platform constitutes full acceptance of these Terms.",
    },
    {
      heading: "2. Eligibility",
      body: "You must be at least 13 years old to use TheBride. By creating an account, you confirm that you meet this requirement. Financial features, including donations and tithes, are restricted to users aged 18 or over, or the legal age of majority in your country of residence.",
    },
    {
      heading: "3. Account Responsibilities",
      body: "You are responsible for keeping your login credentials confidential and for all activity carried out under your account. You agree to provide accurate information at registration and to keep it up to date. In the event of unauthorized use of your account, you must notify us immediately at security@thebride.app.",
    },
    {
      heading: "4. Acceptable Use",
      body: "TheBride is a Christian faith-centered platform. The following uses are encouraged:",
      list: [
        "Sharing faith testimonies and personal spiritual journeys",
        "Bible study, prayer requests, and devotionals",
        "Worship music recommendations and Christian media",
        "Church announcements and events",
        "Encouragement and support among believers",
        "Questions and discussions about the Christian faith",
      ],
    },
    {
      heading: "5. Prohibited Use",
      body: "You agree not to:",
      list: [
        "Post hate speech, sexual content, threats, or violent content",
        "Post political content, opinions on elections, parties, or candidates",
        "Provide sports commentary, scores, or team discussions",
        "Impersonate another person, church, or organization",
        "Send unsolicited messages, spam, or commercial solicitations without prior permission",
        "Circumvent security features or attempt to access unauthorized data",
        "Spread false information about health, faith, or events",
        "Use the Platform for any illegal purpose",
      ],
    },
    {
      heading: "6. Church Accounts",
      body: "Church accounts are subject to a verification process. Unverified churches have limited features. TheBride reserves the right to suspend or remove church accounts that do not comply with verification requirements, post misleading content, or engage in unethical fundraising practices.",
    },
    {
      heading: "7. Donations & Tithes",
      body: "TheBride facilitates donations to the platform and tithes to participating churches. The Platform acts as a technical facilitator only and is not a financial institution. All donations are voluntary and transactions occur between the user and the relevant church. TheBride does not guarantee that funds will reach the intended recipient; it is your responsibility to verify a church's verification status before making any financial gift.",
    },
    {
      heading: "8. Content Ownership",
      body: "You retain ownership of the content you post on the Platform. By posting content, you grant TheBride a non-exclusive, worldwide, royalty-free license to display, distribute, and promote that content within the Platform. This license ends when you delete the content or your account, subject to applicable retention periods.",
    },
    {
      heading: "9. Messaging",
      body: "Private messages are accessible only to conversation participants. TheBride does not read private messages except as required by law (valid court order) or to investigate reported violations pursuant to procedures set out in our Privacy Policy.",
    },
    {
      heading: "10. Moderation & Enforcement",
      body: "If you violate these Terms or our Community Guidelines, TheBride may take the following actions:",
      list: [
        "Official warning",
        "Removal of the infringing content",
        "Temporary account suspension (1 to 30 days)",
        "Permanent ban",
        "Referral to relevant authorities for illegal activity",
      ],
      footer: "To appeal an enforcement action, email moderation@thebride.app with your account details and reasons for the appeal.",
    },
    {
      heading: "11. Liability Limitation",
      body: "TheBride is provided \"as is\" without warranties of any kind. We do not guarantee continuous availability, error-free operation, or the accuracy of any content posted by users. To the extent permitted by applicable law, TheBride shall not be liable for indirect, incidental, or consequential damages arising from use of the Platform.",
    },
    {
      heading: "12. Governing Law",
      body: "The Platform is operated internationally. Any dispute arising from use of the Platform will be resolved in accordance with the applicable law of your jurisdiction of residence, unless otherwise agreed. We commit to resolving disputes amicably wherever possible.",
    },
    {
      heading: "13. Changes to Terms",
      body: "We may update these Terms at any time. For significant changes, we will notify you via an in-app notification or by email. Continued use of the Platform after an update constitutes acceptance of the new Terms.",
    },
    {
      heading: "14. Contact",
      body: "Legal questions: legal@thebride.app",
    },
  ],
  relatedLinks: [
    { href: "/legal/community-guidelines", label: "Community Guidelines" },
    { href: "/legal/privacy", label: "Privacy Policy" },
    { href: "/legal/donation-policy", label: "Donation & Payment Policy" },
  ],
  relatedTitle: "Related documents",
};

export default function TermsOfUsePage() {
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
