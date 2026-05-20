export default function ChurchVerificationPolicyPage() {
  return (
    <article className="prose prose-gray max-w-none">
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        <strong>Draft</strong> — Placeholder document. Subject to revision before official launch.
      </div>

      <h1>Church Verification Policy</h1>
      <p>TheBride verifies churches to provide members with confidence that church accounts represent legitimate Christian congregations. Verification is optional but unlocks full platform features.</p>

      <h2>Verification Statuses</h2>
      <ul>
        <li><strong>Unverified:</strong> Default status. Basic features available. Verification badge not shown.</li>
        <li><strong>Pending:</strong> Application submitted and under review (typically 3–7 business days).</li>
        <li><strong>Verified:</strong> Full features unlocked. Verification badge displayed.</li>
        <li><strong>Rejected:</strong> Application did not meet requirements. Reason provided. Reapplication allowed after 30 days.</li>
      </ul>

      <h2>Required Documents</h2>
      <ul>
        <li><strong>Church registration document:</strong> Official government or denominational registration certificate.</li>
        <li><strong>Pastor/Leader ID:</strong> Government-issued ID or official credentials of the lead pastor or church administrator.</li>
        <li><strong>Proof of address:</strong> Utility bill, lease, or official document showing the church&apos;s physical address.</li>
        <li><strong>Contact information:</strong> Valid phone number and email address for the church.</li>
      </ul>

      <h2>Document Privacy</h2>
      <p>All submitted documents are stored in a private, encrypted storage bucket. They are accessible only to designated TheBride administrators conducting the review. Documents are not shared publicly or with third parties.</p>

      <h2>Review Process</h2>
      <ol>
        <li>Church admin submits the verification form with required documents.</li>
        <li>TheBride team reviews the application within 3–7 business days.</li>
        <li>The church admin receives a notification of approval or rejection.</li>
        <li>Approved churches receive the verification badge immediately.</li>
      </ol>

      <h2>Revocation</h2>
      <p>Verification can be revoked if a church is found to violate Community Guidelines, provide false information, or engage in conduct inconsistent with Christian values.</p>

      <h2>Contact</h2>
      <p>Questions about verification: <a href="mailto:verify@thebride.app">verify@thebride.app</a></p>
    </article>
  );
}
