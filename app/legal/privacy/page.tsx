export default function PrivacyPolicyPage() {
  return (
    <article className="prose prose-gray max-w-none">
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        <strong>Draft</strong> — This is a placeholder document. It has not been reviewed by a lawyer and does not constitute legal advice.
      </div>

      <h1>Privacy Policy</h1>
      <p className="text-sm text-gray-500">Last updated: [Date pending final review]</p>

      <h2>1. Information We Collect</h2>
      <ul>
        <li><strong>Account data:</strong> name, email address, password (hashed).</li>
        <li><strong>Profile data:</strong> bio, city, country, avatar, church affiliation.</li>
        <li><strong>Content data:</strong> posts, comments, messages, prayer requests, devotionals.</li>
        <li><strong>Usage data:</strong> page views, feature usage, device type (via standard web analytics).</li>
        <li><strong>Verification documents (churches only):</strong> registration documents, ID, address proof — stored in a private, restricted bucket.</li>
      </ul>

      <h2>2. How We Use Your Data</h2>
      <ul>
        <li>To provide and improve the Platform.</li>
        <li>To send notifications you have opted into.</li>
        <li>To verify church accounts.</li>
        <li>To respond to support requests.</li>
        <li>To comply with applicable law.</li>
      </ul>

      <h2>3. Data Sharing</h2>
      <p>We do not sell your personal data. We may share data with:</p>
      <ul>
        <li><strong>Service providers:</strong> Supabase (database/auth), Vercel (hosting). These providers process data under strict security agreements.</li>
        <li><strong>Law enforcement:</strong> Only when legally required.</li>
      </ul>

      <h2>4. Message Privacy</h2>
      <p>Direct messages are encrypted in transit and stored securely. Only conversation participants can read messages. Platform administrators cannot read messages in normal operation.</p>

      <h2>5. Church Verification Documents</h2>
      <p>Documents submitted for church verification are stored in a private storage bucket accessible only to platform administrators conducting the review. Documents are not made public.</p>

      <h2>6. Data Retention</h2>
      <p>We retain your data for as long as your account is active. You may request deletion by contacting us at <a href="mailto:privacy@thebride.app">privacy@thebride.app</a>.</p>

      <h2>7. Your Rights</h2>
      <p>Depending on your jurisdiction, you may have rights to access, correct, delete, or export your data. Contact us to exercise these rights.</p>

      <h2>8. Cookies</h2>
      <p>We use session cookies for authentication. We do not use third-party advertising cookies.</p>

      <h2>9. Contact</h2>
      <p>Privacy questions: <a href="mailto:privacy@thebride.app">privacy@thebride.app</a></p>
    </article>
  );
}
