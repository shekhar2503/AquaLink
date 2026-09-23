import { AlertTriangle, LoaderCircle, Waves } from "lucide-react";

export function PageHeader({ eyebrow, title, description, children }) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children ? <div className="page-header-meta">{children}</div> : null}
    </header>
  );
}

export function SectionHeading({ eyebrow, title, description, meta }) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {meta ? <span className="section-meta">{meta}</span> : null}
    </div>
  );
}

export function MetricCard({ icon: Icon, label, value, suffix, detail, tone = "aqua" }) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <div className="metric-icon" aria-hidden="true">
        <Icon size={20} strokeWidth={1.8} />
      </div>
      <div className="metric-copy">
        <span>{label}</span>
        <strong>
          {value}
          {suffix ? <small>{suffix}</small> : null}
        </strong>
        <p>{detail}</p>
      </div>
    </article>
  );
}

export function StatusBadge({ status, children }) {
  const normalized = String(status || "neutral").toLowerCase();
  return (
    <span className={`status-badge status-${normalized}`}>
      <span className="status-indicator" aria-hidden="true" />
      {children ?? status}
    </span>
  );
}

export function LoadingState({ title = "Loading AquaLink data", description }) {
  return (
    <div className="state-card" role="status" aria-live="polite">
      <LoaderCircle className="state-spinner" aria-hidden="true" />
      <h2>{title}</h2>
      <p>{description || "Preparing the latest water intelligence."}</p>
    </div>
  );
}

export function EmptyState({ title, description, error = false }) {
  const Icon = error ? AlertTriangle : Waves;
  return (
    <div className={`state-card ${error ? "state-error" : ""}`} role={error ? "alert" : "status"}>
      <Icon aria-hidden="true" />
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
