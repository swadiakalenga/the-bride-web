"use client";

import Link from "next/link";
import { useLanguage } from "../../../lib/useLanguage";

const fr = {
  title: "Politique de sécurité et de signalement",
  updated: "Dernière mise à jour : 20 mai 2026",
  intro: "TheBride s'engage à maintenir un environnement sûr, respectueux et spirituellement sain. Cette politique explique comment signaler des préoccupations et comment nous y répondons.",
  sections: [
    {
      heading: "Que signaler",
      list: [
        "Harcèlement ou intimidation",
        "Discours haineux ou discrimination",
        "Spam ou usurpation d'identité",
        "Messages abusifs ou menaçants",
        "Contenus sexuels ou à caractère inapproprié",
        "Fraude liée à un compte d'église ou collecte de fonds trompeuse",
        "Exploitation ou abus sur des mineurs",
        "Menaces violentes ou appels à la violence",
        "Désinformation dangereuse",
      ],
    },
    {
      heading: "Comment signaler",
      items: [
        { term: "Dans l'application", def: "Appuyez sur le menu à 3 points (⋮) sur n'importe quelle publication, profil ou message, puis sélectionnez « Signaler » et choisissez un motif. Votre signalement reste anonyme vis-à-vis de la personne signalée." },
        { term: "Par e-mail", def: "Envoyez votre signalement à safety@thebride.app en incluant : une description du problème, des captures d'écran si disponibles, et le nom d'utilisateur ou le lien vers le profil concerné." },
      ],
    },
    {
      heading: "Délais de traitement",
      items: [
        { term: "Menaces critiques / sécurité immédiate", def: "traitement sous 24 heures." },
        { term: "Signalements standard", def: "traitement sous 72 heures." },
        { term: "Cas complexes", def: "jusqu'à 7 jours ouvrables pour les situations nécessitant une enquête approfondie." },
      ],
    },
    {
      heading: "Que se passe-t-il après un signalement",
      list: [
        "Accusé de réception envoyé dans les meilleurs délais",
        "Enquête menée par notre équipe de modération",
        "Action appropriée prise (voir ci-dessous)",
        "Notification de résolution envoyée au signalant lorsque possible, dans le respect de la confidentialité",
      ],
    },
    {
      heading: "Urgence",
      body: "Si quelqu'un est en danger immédiat, contactez d'abord les services d'urgence locaux (police, SAMU, pompiers). TheBride ne peut pas répondre en temps réel à des situations d'urgence. Une fois la situation d'urgence gérée, signalez l'incident sur la plateforme pour que nous puissions prendre des mesures.",
    },
    {
      heading: "Droits de modération de la plateforme",
      list: [
        "Supprimer tout contenu violant nos politiques",
        "Suspendre ou bannir des comptes",
        "Conserver des preuves à des fins de coopération avec les autorités",
        "Signaler des activités illégales aux forces de l'ordre",
        "Bloquer des adresses IP ou des appareils en cas d'activité malveillante persistante",
      ],
    },
    {
      heading: "Confidentialité des signalements",
      body: "L'identité des personnes qui signalent des contenus reste confidentielle vis-à-vis de la personne signalée. Nous ne divulguerons jamais votre identité à l'utilisateur faisant l'objet d'un signalement, sauf si la loi nous y oblige expressément.",
    },
    {
      heading: "Faux signalements",
      body: "Soumettre délibérément de faux signalements pour cibler ou harceler un autre utilisateur constitue également une violation de nos politiques. De tels actes peuvent entraîner des sanctions allant jusqu'au bannissement du compte.",
    },
  ],
  relatedLinks: [
    { href: "/legal/community-guidelines", label: "Charte communautaire" },
    { href: "/legal/terms", label: "Conditions d'utilisation" },
  ],
  relatedTitle: "Documents liés",
};

const en = {
  title: "Safety & Reporting Policy",
  updated: "Last updated: May 20, 2026",
  intro: "TheBride is committed to maintaining a safe, respectful, and spiritually healthy environment. This policy explains how to report concerns and how we respond.",
  sections: [
    {
      heading: "What to Report",
      list: [
        "Harassment or bullying",
        "Hate speech or discrimination",
        "Spam or impersonation",
        "Abusive or threatening messages",
        "Sexual content or inappropriate material",
        "Church account fraud or deceptive fundraising",
        "Exploitation or abuse involving minors",
        "Violent threats or incitement to violence",
        "Dangerous misinformation",
      ],
    },
    {
      heading: "How to Report",
      items: [
        { term: "In-app", def: "Tap the 3-dot menu (⋮) on any post, profile, or message, then select \"Report\" and choose a reason. Your report remains anonymous to the reported party." },
        { term: "By email", def: "Send your report to safety@thebride.app including: a description of the issue, screenshots if available, and the username or profile link of the account being reported." },
      ],
    },
    {
      heading: "Response Timeline",
      items: [
        { term: "Critical / immediate safety threats", def: "handled within 24 hours." },
        { term: "Standard reports", def: "reviewed within 72 hours." },
        { term: "Complex cases", def: "up to 7 business days for situations requiring thorough investigation." },
      ],
    },
    {
      heading: "What Happens After a Report",
      list: [
        "Acknowledgment sent as soon as possible",
        "Investigation carried out by our moderation team",
        "Appropriate action taken (see below)",
        "Resolution notification sent to the reporter where possible, subject to privacy constraints",
      ],
    },
    {
      heading: "Emergency",
      body: "If someone is in immediate danger, contact local emergency services first (police, ambulance, fire brigade). TheBride cannot respond in real time to emergency situations. Once the emergency is handled, report the incident on the platform so we can take action.",
    },
    {
      heading: "Platform Moderation Rights",
      list: [
        "Remove any content violating our policies",
        "Suspend or permanently ban accounts",
        "Preserve evidence for cooperation with law enforcement",
        "Report illegal activity to the relevant authorities",
        "Block IP addresses or devices in cases of persistent malicious activity",
      ],
    },
    {
      heading: "Privacy of Reports",
      body: "The identity of those who report content remains confidential to the reported party. We will never disclose your identity to the user being reported, except where expressly required by law.",
    },
    {
      heading: "False Reports",
      body: "Deliberately submitting false reports to target or harass another user is also a violation of our policies. Such conduct may result in sanctions up to and including account banning.",
    },
  ],
  relatedLinks: [
    { href: "/legal/community-guidelines", label: "Community Guidelines" },
    { href: "/legal/terms", label: "Terms of Use" },
  ],
  relatedTitle: "Related documents",
};

export default function SafetyReportingPage() {
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
