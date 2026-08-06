export default function LandingFooter() {
  return (
    <footer className="lv-footer">
      <div className="lv-footer-inner">
        <span>© {new Date().getFullYear()} Nirmaan AI</span>
        <span>Built for SEBI-compliant SME IPO disclosure drafting</span>
      </div>
    </footer>
  );
}
