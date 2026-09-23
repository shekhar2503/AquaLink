import { Waves } from "lucide-react";

function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer-brand">
        <span className="footer-logo" aria-hidden="true">
          <Waves size={18} />
        </span>
        <div>
          <strong>AquaLink</strong>
          <p>Water stress monitoring and decision support for Pune District.</p>
        </div>
      </div>
      <div className="app-footer-meta">
        <span>Decision Support System</span>
        <span>SIH 2026 prototype</span>
      </div>
    </footer>
  );
}

export default AppFooter;
