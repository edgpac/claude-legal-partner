import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Risky Contract Review" },
      { name: "description", content: "Terms of Service for Risky Contract Review." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
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
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: June 2026</p>

        <div className="mt-10 space-y-10 text-sm leading-relaxed text-foreground">
          <section className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="font-semibold text-amber-900">Not legal advice</p>
            <p className="mt-1 text-amber-800">
              Risky Contract Review is an AI-powered analysis tool. Nothing on this platform constitutes legal advice. All output is for informational purposes only. Always consult a licensed attorney before signing or acting on any contract.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">1. Acceptance</h2>
            <p className="text-muted-foreground">
              By creating an account or using Risky Contract Review ("the Service"), you agree to these Terms. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">2. The service</h2>
            <p className="text-muted-foreground">
              Risky Contract Review provides AI-assisted analysis of contract documents — identifying potential risks, missing clauses, and plain-English summaries. The Service is provided as-is and results may contain errors or omissions. You are solely responsible for any decisions made based on the output.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">3. Your account</h2>
            <ul className="space-y-2 text-muted-foreground list-disc list-inside">
              <li>You must be 18 or older to use the Service.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You may not share your account or allow others to use it on your behalf.</li>
              <li>One free review is available per account. Additional reviews require a paid plan.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">4. Payments and refunds</h2>
            <ul className="space-y-2 text-muted-foreground list-disc list-inside">
              <li>Starter packs are one-time purchases and are non-refundable once reviews have been used.</li>
              <li>Pro and Business subscriptions are billed monthly and can be cancelled at any time. Cancellation takes effect at the end of the current billing period.</li>
              <li>Monthly review limits reset at the start of each billing cycle and do not roll over.</li>
              <li>All payments are processed by Stripe. We do not store card details.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">5. Acceptable use</h2>
            <p className="text-muted-foreground">You agree not to:</p>
            <ul className="mt-3 space-y-2 text-muted-foreground list-disc list-inside">
              <li>Upload documents containing malware, illegal content, or content that violates third-party rights.</li>
              <li>Attempt to reverse-engineer, scrape, or abuse the Service.</li>
              <li>Use the Service for any unlawful purpose.</li>
              <li>Resell or redistribute outputs from the Service without permission.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">6. Your content</h2>
            <p className="text-muted-foreground">
              You retain ownership of the documents you upload. By uploading a document, you grant us a limited license to process it for the purpose of providing the review service. We do not claim any ownership over your contracts or their contents.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">7. Limitation of liability</h2>
            <p className="text-muted-foreground">
              To the maximum extent permitted by law, Risky Contract Review and its operators shall not be liable for any indirect, incidental, consequential, or punitive damages arising from your use of the Service, including reliance on AI-generated analysis. Our total liability for any claim shall not exceed the amount you paid us in the 30 days prior to the claim.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">8. Termination</h2>
            <p className="text-muted-foreground">
              We may suspend or terminate your account if you violate these Terms. You may delete your account at any time from the billing settings page.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">9. Changes</h2>
            <p className="text-muted-foreground">
              We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">10. Governing law</h2>
            <p className="text-muted-foreground">
              These Terms are governed by the laws of the United States. Any disputes shall be resolved through binding arbitration.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">11. Contact</h2>
            <p className="text-muted-foreground">
              Questions? Email us at <a href="mailto:hello@riskycontract.com" className="text-primary hover:underline">hello@riskycontract.com</a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
