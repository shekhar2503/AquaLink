function KPICard({ icon, title, value, subtitle }) {
  return (
    <div className="kpi-card">

      <div className="kpi-icon">
        {icon}
      </div>

      <div className="kpi-content">

        <div className="kpi-title">
          {title}
        </div>

        <div className="kpi-value">
          {value}
        </div>

        <div className="kpi-subtitle">
          {subtitle}
        </div>

      </div>

    </div>
  );
}

export default KPICard;