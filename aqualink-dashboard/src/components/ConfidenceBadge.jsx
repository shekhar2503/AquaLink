import { AlertTriangle, CircleCheck, ShieldQuestion } from "lucide-react";

const icons = { High: CircleCheck, Medium: ShieldQuestion, Low: AlertTriangle };

export default function ConfidenceBadge({ quality, label = "confidence", detailed = false }) {
  if (!quality) return <span className="confidence-badge confidence-unavailable" title="Quality assessment is unavailable in local fallback mode"><AlertTriangle aria-hidden="true" />Confidence not assessed</span>;
  const Icon = icons[quality.confidence] ?? ShieldQuestion;
  const badge = <span className={`confidence-badge confidence-${quality.confidence.toLowerCase()}`}><Icon aria-hidden="true" />{quality.confidence} {label} · {quality.quality_score}/100</span>;
  if (!detailed) return badge;
  return <details className="confidence-details"><summary>{badge}</summary><div className="confidence-popover">
    <p>{quality.reasons?.join(" ")}</p>
    <dl>{Object.entries(quality.dimensions ?? {}).map(([name, dimension]) => <div key={name}><dt>{name.replaceAll("_", " ")}</dt><dd><strong>{dimension.score}/100</strong> — {dimension.reasons?.join(" ")}</dd></div>)}</dl>
    <p><strong>Supporting observations:</strong> {quality.supporting_observation_count}</p>
    {quality.is_stale ? <p className="quality-warning"><AlertTriangle aria-hidden="true" />Stale data: {quality.stale_years} dataset years behind latest.</p> : null}
    {quality.missing_fields?.length ? <p className="quality-warning"><AlertTriangle aria-hidden="true" />Missing: {quality.missing_fields.join(", ")}</p> : null}
  </div></details>;
}
