import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-border mt-auto py-5 px-6">
      <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} Risky Contract Review. Not legal advice.</span>
        <div className="flex items-center gap-4">
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
        </div>
      </div>
    </footer>
  );
}
