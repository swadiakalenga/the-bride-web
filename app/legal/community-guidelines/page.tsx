"use client";

import Link from "next/link";
import { useLanguage } from "../../../lib/useLanguage";

const fr = {
  title: "Charte communautaire",
  updated: "Dernière mise à jour : 20 mai 2026",
  intro: "TheBride est une communauté centrée sur la foi chrétienne. Nous demandons à tous les membres de respecter cette charte afin de maintenir un espace sûr, accueillant et spirituellement édifiant.",
  sections: [
    {
      heading: "Contenus encouragés",
      list: [
        "Témoignages de foi et parcours spirituels personnels",
        "Discussions bibliques, demandes de prière et dévotionnels",
        "Recommandations de musique de louange et de médias chrétiens",
        "Encouragements et soutien entre croyants",
        "Annonces et événements d'église",
        "Questions et réflexions sur la foi chrétienne",
      ],
    },
    {
      heading: "Contenus interdits",
      items: [
        { term: "Politique", def: "Aucune opinion politique, aucun parti, aucune élection ni candidat." },
        { term: "Sports", def: "Aucun commentaire sportif, score d'équipe ou débat sur les sports." },
        { term: "Contenus sexuels", def: "Aucun contenu à caractère sexuel, nudité ou langage à caractère sexuel explicite." },
        { term: "Discours haineux", def: "Aucun contenu dénigrant des personnes en raison de leur race, sexe, nationalité, origine ou croyance." },
        { term: "Harcèlement", def: "Aucun harcèlement ciblé, intimidation ou menaces envers d'autres membres." },
        { term: "Violence", def: "Aucun contenu prônant ou glorifiant la violence." },
        { term: "Spam", def: "Pas de publications répétitives, de chaînes de messages ou de sollicitations non sollicitées." },
        { term: "Désinformation", def: "Ne diffusez pas de fausses informations sur la santé, la foi ou des événements." },
        { term: "Usurpation d'identité", def: "N'usurpez pas l'identité d'une personne, d'une église ou d'une organisation." },
        { term: "Publicité non autorisée", def: "Aucune sollicitation commerciale sans autorisation préalable de TheBride." },
      ],
    },
    {
      heading: "Standards pour les comptes d'église",
      body: "Les comptes d'église doivent représenter de vraies congrégations chrétiennes. La soumission de faux documents de vérification, la diffusion d'informations trompeuses sur une église ou l'organisation de collectes de fonds contraires à l'éthique entraîneront la suppression immédiate du compte et, le cas échéant, un signalement aux autorités compétentes.",
    },
    {
      heading: "Standards pour la messagerie",
      body: "Les messages privés doivent être envoyés avec respect. L'envoi de messages sexuels non sollicités, le harcèlement dans les messages privés ou toute tentative de manipulation financière via la messagerie constituent des violations graves pouvant entraîner une suspension immédiate.",
    },
    {
      heading: "Standards pour les médias",
      list: [
        "Pas de nudité ni de contenu sexuellement suggestif",
        "Pas de violence graphique ni d'images choquantes",
        "Pas de contenu illégal (droits d'auteur, matériel illicite)",
        "Tout média doit être approprié pour une audience chrétienne générale",
      ],
    },
    {
      heading: "Protection des mineurs",
      body: "TheBride prend la protection des mineurs très au sérieux. Tout contenu impliquant l'exploitation ou les abus sur des mineurs doit être signalé immédiatement. Ces cas seront transmis aux autorités compétentes sans délai. Les comptes impliqués dans de tels actes seront définitivement bannis.",
    },
    {
      heading: "Étapes d'application",
      items: [
        { term: "Avertissement", def: "pour les premières violations mineures." },
        { term: "Suppression du contenu", def: "le contenu en infraction est retiré." },
        { term: "Suspension temporaire", def: "1 à 30 jours selon la gravité de la violation." },
        { term: "Bannissement permanent", def: "pour les violations graves ou répétées." },
      ],
    },
    {
      heading: "Signalement",
      body: "Si vous voyez un contenu qui viole cette charte, signalez-le via le bouton de signalement dans l'application (menu 3 points → Signaler) ou envoyez un e-mail à safety@thebride.app. Notre équipe de modération examine les signalements dans un délai de 72 heures.",
    },
    {
      heading: "Appels",
      body: "Si vous pensez qu'une action de modération a été prise par erreur, vous pouvez faire appel en écrivant à moderation@thebride.app avec vos coordonnées et les motifs de votre contestation.",
    },
  ],
  relatedLinks: [
    { href: "/legal/safety-reporting", label: "Politique de sécurité et signalement" },
    { href: "/legal/terms", label: "Conditions d'utilisation" },
  ],
  relatedTitle: "Documents liés",
};

const en = {
  title: "Community Guidelines",
  updated: "Last updated: May 20, 2026",
  intro: "TheBride is a Christian faith-centered community. We ask all members to uphold these guidelines to maintain a safe, welcoming, and spiritually edifying space.",
  sections: [
    {
      heading: "Encouraged Content",
      list: [
        "Faith testimonies and personal spiritual journeys",
        "Bible study discussions, prayer requests, and devotionals",
        "Worship music recommendations and Christian media",
        "Encouragement and support among believers",
        "Church announcements and events",
        "Questions and reflections on the Christian faith",
      ],
    },
    {
      heading: "Prohibited Content",
      items: [
        { term: "Politics", def: "No political opinions, parties, elections, or candidates." },
        { term: "Sports", def: "No sports commentary, team scores, or sports debates." },
        { term: "Sexual content", def: "No sexually explicit content, nudity, or sexually explicit language." },
        { term: "Hate speech", def: "No content that demeans people based on race, gender, nationality, origin, or belief." },
        { term: "Harassment", def: "No targeted harassment, bullying, or threats toward other members." },
        { term: "Violence", def: "No content advocating or glorifying violence." },
        { term: "Spam", def: "No repetitive posts, chain messages, or unsolicited solicitations." },
        { term: "Misinformation", def: "Do not spread false information about health, faith, or events." },
        { term: "Impersonation", def: "Do not impersonate a person, church, or organization." },
        { term: "Unauthorized advertising", def: "No commercial solicitation without prior permission from TheBride." },
      ],
    },
    {
      heading: "Church Account Standards",
      body: "Church accounts must represent real Christian congregations. Submitting false verification documents, spreading misleading information about a church, or engaging in unethical fundraising will result in immediate account removal and, where applicable, referral to relevant authorities.",
    },
    {
      heading: "Messaging Standards",
      body: "Private messages must be sent respectfully. Sending unsolicited sexual messages, harassing other users in DMs, or attempting any form of financial manipulation via messaging are serious violations that may result in immediate suspension.",
    },
    {
      heading: "Media Standards",
      list: [
        "No nudity or sexually suggestive content",
        "No graphic violence or shocking imagery",
        "No illegal content (copyright violations, illicit material)",
        "All media must be appropriate for a general Christian audience",
      ],
    },
    {
      heading: "Minors",
      body: "TheBride takes the protection of minors extremely seriously. Any content involving the exploitation or abuse of minors must be reported immediately. Such cases will be referred to relevant authorities without delay. Accounts involved in such acts will be permanently banned.",
    },
    {
      heading: "Enforcement Steps",
      items: [
        { term: "Warning", def: "for first-time minor violations." },
        { term: "Content removal", def: "the infringing content is taken down." },
        { term: "Temporary suspension", def: "1 to 30 days depending on the severity of the violation." },
        { term: "Permanent ban", def: "for serious or repeated violations." },
      ],
    },
    {
      heading: "Reporting",
      body: "If you see content that violates these guidelines, report it via the in-app report button (3-dot menu → Report) or email safety@thebride.app. Our moderation team reviews reports within 72 hours.",
    },
    {
      heading: "Appeals",
      body: "If you believe a moderation action was taken in error, you may appeal by writing to moderation@thebride.app with your account details and reasons for the appeal.",
    },
  ],
  relatedLinks: [
    { href: "/legal/safety-reporting", label: "Safety & Reporting Policy" },
    { href: "/legal/terms", label: "Terms of Use" },
  ],
  relatedTitle: "Related documents",
};

export default function CommunityGuidelinesPage() {
  const { lang } = useLanguage();
  const c = lang === "fr" ? fr : en;

  return (
    <article className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{c.title}</h1>
        <p className="mt-1 text-sm text-gray-500">{c.updated}</p>
        <p className="mt-3 text-sm leading-relaxed text-gray-700">{c.intro}</p>
      </div>

      {c.sections.map((section) => (
        <section key={section.heading} className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">{section.heading}</h2>
          {"body" in section && section.body && (
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
          {"items" in section && section.items && (
            <ul className="space-y-2">
              {section.items.map((item, i) => (
                <li key={i} className="text-sm leading-relaxed text-gray-700">
                  <strong className="text-gray-900">{item.term} :</strong> {item.def}
                </li>
              ))}
            </ul>
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
