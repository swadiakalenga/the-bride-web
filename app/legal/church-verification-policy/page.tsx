"use client";

import Link from "next/link";
import { useLanguage } from "../../../lib/useLanguage";

const fr = {
  title: "Politique de vérification des églises",
  updated: "Dernière mise à jour : 20 mai 2026",
  sections: [
    {
      heading: "Objectif",
      body: "La vérification des comptes d'église vise à garantir l'authenticité des congrégations présentes sur TheBride. Elle permet aux membres d'identifier les églises légitimes, en particulier lorsqu'ils envisagent de faire des dons, des dîmes ou de rejoindre une communauté ecclésiale via la plateforme. La vérification est optionnelle mais débloque l'ensemble des fonctionnalités de la plateforme.",
    },
    {
      heading: "Statuts de vérification",
      items: [
        { term: "Non vérifiée", def: "Statut par défaut. Fonctionnalités de base disponibles. Le badge de vérification n'est pas affiché." },
        { term: "En attente", def: "Demande soumise et en cours d'examen (généralement 3 à 7 jours ouvrables)." },
        { term: "Vérifiée", def: "Toutes les fonctionnalités débloquées. Badge de vérification affiché sur le profil et les pages de l'église." },
        { term: "Refusée", def: "La demande ne satisfait pas aux exigences. Le motif du refus est communiqué. Une nouvelle demande est possible après 30 jours avec des documents corrigés." },
        { term: "Suspendue", def: "Le statut vérifié a été révoqué en raison de violations de conduite ou de fausses déclarations avérées." },
      ],
    },
    {
      heading: "Documents requis",
      items: [
        { term: "Certificat d'enregistrement de l'église", def: "Document officiel gouvernemental ou dénominationnel attestant de l'enregistrement légal de la congrégation." },
        { term: "Pièce d'identité du pasteur / responsable", def: "Pièce d'identité officielle émise par le gouvernement ou attestation officielle du pasteur principal ou de l'administrateur de l'église." },
        { term: "Justificatif d'adresse officielle", def: "Facture de services publics, bail ou document officiel attestant de l'adresse physique de l'église." },
        { term: "Site web / réseaux sociaux (optionnel)", def: "Lien vers le site officiel de l'église ou ses profils de réseaux sociaux pour corroborer l'identité." },
      ],
    },
    {
      heading: "Processus d'examen",
      steps: [
        "L'administrateur de l'église soumet le formulaire de vérification avec les documents requis.",
        "L'équipe TheBride examine la demande dans un délai de 3 à 7 jours ouvrables.",
        "Une décision est communiquée à l'administrateur de l'église, avec le motif en cas de refus.",
        "Les églises approuvées reçoivent immédiatement le badge de vérification.",
      ],
    },
    {
      heading: "Appels",
      body: "Les églises dont la demande a été refusée peuvent soumettre une nouvelle demande après 30 jours avec des documents corrigés ou mis à jour. Pour contester une décision, envoyez un e-mail à verify@thebride.app en indiquant votre identifiant d'église et les raisons de votre contestation.",
    },
    {
      heading: "Badge de vérification",
      body: "Le badge de vérification est affiché sur le profil de l'église et toutes ses pages associées sur la plateforme. Il indique aux membres que l'église a passé avec succès le processus de contrôle de TheBride. Ce badge est révocable si une fausse déclaration ou une violation grave est découverte ultérieurement.",
    },
    {
      heading: "Conformité continue",
      body: "Le statut vérifié peut être réexaminé en cas de signalements de violations de conduite, de plaintes de membres ou de découverte d'informations contradictoires. TheBride se réserve le droit de suspendre le statut vérifié pendant la durée d'une enquête.",
    },
    {
      heading: "Stockage des documents",
      body: "Les documents soumis pour la vérification sont stockés dans un compartiment de stockage privé et sécurisé, accessible uniquement aux administrateurs désignés de TheBride chargés de l'examen. Ces documents ne sont jamais rendus publics ni partagés avec des tiers. Ils sont définitivement supprimés 12 mois après la fin de l'examen de vérification, qu'il soit accepté ou refusé.",
    },
    {
      heading: "Faux documents",
      body: "La soumission de documents falsifiés ou frauduleux entraîne le bannissement permanent et immédiat du compte concerné. TheBride signalera également ces cas aux autorités compétentes. Aucune exception ne sera faite.",
    },
    {
      heading: "Contact",
      body: "Questions sur la vérification : verify@thebride.app",
    },
  ],
  relatedLinks: [
    { href: "/legal/donation-policy", label: "Politique de dons et paiements" },
    { href: "/legal/community-guidelines", label: "Charte communautaire" },
  ],
  relatedTitle: "Documents liés",
};

const en = {
  title: "Church Verification Policy",
  updated: "Last updated: May 20, 2026",
  sections: [
    {
      heading: "Purpose",
      body: "Church account verification aims to ensure the authenticity of congregations present on TheBride. It helps members identify legitimate churches, particularly when considering donations, tithes, or joining a church community via the platform. Verification is optional but unlocks the full set of platform features.",
    },
    {
      heading: "Verification Statuses",
      items: [
        { term: "Unverified", def: "Default status. Basic features available. The verification badge is not displayed." },
        { term: "Pending", def: "Application submitted and under review (typically 3 to 7 business days)." },
        { term: "Verified", def: "All features unlocked. Verification badge displayed on the church profile and all associated pages." },
        { term: "Rejected", def: "Application did not meet requirements. Reason for rejection is provided. Reapplication is possible after 30 days with corrected documents." },
        { term: "Suspended", def: "Verified status has been revoked due to proven conduct violations or misrepresentation." },
      ],
    },
    {
      heading: "Required Documents",
      items: [
        { term: "Church registration certificate", def: "Official government or denominational document attesting to the congregation's legal registration." },
        { term: "Pastor / leader ID", def: "Government-issued ID or official credentials of the lead pastor or church administrator." },
        { term: "Proof of official address", def: "Utility bill, lease, or official document showing the church's physical address." },
        { term: "Website / social media (optional)", def: "Link to the church's official website or social media profiles to corroborate identity." },
      ],
    },
    {
      heading: "Review Process",
      steps: [
        "The church administrator submits the verification form with the required documents.",
        "The TheBride team reviews the application within 3 to 7 business days.",
        "A decision is communicated to the church administrator, with the reason in case of rejection.",
        "Approved churches receive the verification badge immediately.",
      ],
    },
    {
      heading: "Appeals",
      body: "Churches whose application has been rejected may reapply after 30 days with corrected or updated documents. To contest a decision, email verify@thebride.app with your church ID and the reasons for your appeal.",
    },
    {
      heading: "Verified Badge",
      body: "The verification badge is displayed on the church profile and all its associated pages on the platform. It signals to members that the church has successfully passed TheBride's review process. The badge is revocable if misrepresentation or a serious violation is discovered at a later date.",
    },
    {
      heading: "Ongoing Compliance",
      body: "Verified status may be reviewed in the event of reported conduct violations, member complaints, or discovery of contradictory information. TheBride reserves the right to suspend verified status for the duration of an investigation.",
    },
    {
      heading: "Document Storage",
      body: "Documents submitted for verification are stored in a private, secure storage bucket accessible only to designated TheBride administrators conducting the review. These documents are never made public or shared with third parties. They are permanently deleted 12 months after the completion of the verification review, whether approved or rejected.",
    },
    {
      heading: "False Documents",
      body: "Submission of falsified or fraudulent documents results in immediate and permanent account banning. TheBride will also refer such cases to relevant authorities. No exceptions will be made.",
    },
    {
      heading: "Contact",
      body: "Verification questions: verify@thebride.app",
    },
  ],
  relatedLinks: [
    { href: "/legal/donation-policy", label: "Donation & Payment Policy" },
    { href: "/legal/community-guidelines", label: "Community Guidelines" },
  ],
  relatedTitle: "Related documents",
};

export default function ChurchVerificationPolicyPage() {
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
          {"body" in section && section.body && (
            <p className="text-sm leading-relaxed text-gray-700">{section.body}</p>
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
          {"steps" in section && section.steps && (
            <ol className="space-y-2">
              {section.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed text-gray-700">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
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
