import { NavLink } from "react-router-dom";

function Sidebar() {
  const navItems = [
    {
      path: "/dashboard",
      icon: "▦",
      label: "Dashboard"
    },
    {
      path: "/map",
      icon: "⌖",
      label: "Risk Map"
    },
    {
      path: "/analytics",
      icon: "◒",
      label: "Analytics"
    },
    {
      path: "/forecast",
      icon: "↗",
      label: "Forecast"
    },
    {
      path: "/recommendations",
      icon: "✓",
      label: "Recommendations"
    }
  ];

  return (
    <aside className="sidebar">

      <div className="sidebar-brand">

        <div className="brand-icon">
          💧
        </div>

        <div>
          <h2>AquaLink</h2>
          <span>Water Intelligence</span>
        </div>

      </div>


      <div className="sidebar-section-title">
        MAIN MENU
      </div>


      <nav className="sidebar-nav">

        {navItems.map((item) => (

          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-link ${
                isActive ? "active" : ""
              }`
            }
          >

            <span className="sidebar-icon">
              {item.icon}
            </span>

            <span>
              {item.label}
            </span>

          </NavLink>

        ))}

      </nav>


      <div className="sidebar-bottom">

        <div className="sidebar-status">

          <span className="status-dot"></span>

          <div>
            <strong>System Active</strong>
            <small>Pune District</small>
          </div>

        </div>

        <div className="sidebar-version">
          AquaLink DSS • v1.0
        </div>

      </div>

    </aside>
  );
}

export default Sidebar;