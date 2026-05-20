export default function DonationPolicyPage() {
  return (
    <article className="prose prose-gray max-w-none">
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        <strong>Draft</strong> — Placeholder document. Payment processing not yet configured. Subject to revision.
      </div>

      <h1>Donation Policy</h1>
      <p>This policy governs donations made to support TheBride platform development and operations.</p>

      <h2>Platform Support Donations</h2>
      <p>Donations to TheBride go toward:</p>
      <ul>
        <li>Server infrastructure and hosting costs</li>
        <li>Platform development and maintenance</li>
        <li>Security and data protection</li>
        <li>Customer support operations</li>
      </ul>

      <h2>Church Tithes & Offerings (Separate)</h2>
      <p>TheBride also facilitates church tithing features. Tithes and offerings made through a church&apos;s profile go directly to that church via their configured payment method. TheBride does not process or hold these funds.</p>

      <h2>Payment Methods</h2>
      <p>Currently, platform support donations are accepted via:</p>
      <ul>
        <li>Bank transfer (contact us for details)</li>
        <li>Mobile Money (contact us for details)</li>
      </ul>
      <p>Online payment processing (Stripe, PayPal) is not yet configured. We will update this policy when it becomes available.</p>

      <h2>No Automatic Recurring Charges</h2>
      <p>TheBride does not charge subscription fees or set up automatic recurring payments. All donations are one-time and voluntary.</p>

      <h2>Refunds</h2>
      <p>Donations are voluntary and non-refundable except in cases of documented processing errors. To dispute a charge, contact <a href="mailto:support@thebride.app">support@thebride.app</a> within 7 days.</p>

      <h2>Security</h2>
      <p>TheBride does not store payment card details directly. When online payment processing is configured, it will be handled by a PCI-compliant payment provider.</p>

      <h2>Contact</h2>
      <p>Donation questions: <a href="mailto:support@thebride.app">support@thebride.app</a></p>
    </article>
  );
}
