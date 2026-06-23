import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Risky Contract Review" },
      { name: "description", content: "How Risky Contract Review collects, uses, and protects your data." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface/80 sticky top-0 z-30">
        <div className="mx-auto flex max-w-4xl items-center px-6 py-3.5">
          <Link to="/" className="flex items-center gap-2">
            <img src="/favicon-32x32.png" alt="Risky Contract" className="h-7 w-7" />
            <span className="font-semibold tracking-tight">
              Risky<span className="text-primary">Contract</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: June 2026</p>

        <div className="mt-10 space-y-10 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="text-base font-semibold mb-3">1. What we collect</h2>
            <p className="text-muted-foreground">When you use Risky Contract Review we collect:</p>
            <ul className="mt-3 space-y-2 text-muted-foreground list-disc list-inside">
              <li><strong className="text-foreground">Account information</strong> — your email address and password (stored securely via Supabase Auth).</li>
              <li><strong className="text-foreground">Document text</strong> — the text extracted from contracts you upload. This text is sent to Anthropic's API to generate your review and is stored alongside the review result in your account.</li>
              <li><strong className="text-foreground">Usage data</strong> — review history, plan type, and credit balance associated with your account.</li>
              <li><strong className="text-foreground">Payment information</strong> — handled entirely by Stripe. We never see or store your card details.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">2. How we use it</h2>
            <ul className="mt-1 space-y-2 text-muted-foreground list-disc list-inside">
              <li>To provide and improve the contract review service.</li>
              <li>To process payments and manage your subscription via Stripe.</li>
              <li>To send transactional emails (account confirmation, password reset).</li>
              <li>We do not sell, rent, or share your personal data or document content with third parties for marketing purposes.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">3. Third-party services</h2>
            <p className="text-muted-foreground">We use the following sub-processors:</p>
            <ul className="mt-3 space-y-2 text-muted-foreground list-disc list-inside">
              <li><strong className="text-foreground">Supabase</strong> — authentication and database hosting.</li>
              <li><strong className="text-foreground">Anthropic</strong> — AI analysis of document text. Anthropic's API processes your contract text to generate clause-by-clause reviews. Anthropic's data usage policy applies.</li>
              <li><strong className="text-foreground">Stripe</strong> — payment processing. Stripe's privacy policy governs payment data.</li>
              <li><strong className="text-foreground">Vercel</strong> — application hosting and deployment.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">4. Data retention</h2>
            <p className="text-muted-foreground">
              Your review history and associated document text are retained while your account is active. You can delete your account at any time from the billing settings page, which permanently removes all your data from our systems.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">5. Security</h2>
            <p className="text-muted-foreground">
              All data is transmitted over HTTPS. Access to your data is protected by row-level security — only your account can read your reviews. Payment processing is handled entirely by Stripe and we do not store payment card data.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">6. Your rights</h2>
            <p className="text-muted-foreground">
              You may request a copy of your data, correction of inaccurate data, or deletion of your account and all associated data at any time by contacting us at <a href="mailto:hello@riskycontract.com" className="text-primary hover:underline">hello@riskycontract.com</a> or using the delete account option in settings.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">7. Cookies</h2>
            <p className="text-muted-foreground">
              We use only essential session cookies required for authentication. We do not use tracking or advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">8. Contact</h2>
            <p className="text-muted-foreground">
              Questions about this policy? Email us at <a href="mailto:hello@riskycontract.com" className="text-primary hover:underline">hello@riskycontract.com</a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
