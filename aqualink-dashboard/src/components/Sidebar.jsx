import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  BarChart3,
  CloudSun,
  LayoutDashboard,
  Map,
  Menu,
  Moon,
  Route,
  Sun,
  Waves,
  X,
} from "lucide-react";

const navItems = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/map", icon: Map, label: "Risk Map" },
  { path: "/analytics", icon: BarChart3, label: "Analytics" },
  { path: "/forecast", icon: CloudSun, label: "Forecast" },
  { path: "/recommendations", icon: Route, label: "Recommendations" },
];

function Sidebar({ theme, onToggleTheme }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  return (
    <>
      <header className={`top-navigation ${isScrolled ? "is-scrolled" : ""}`}>
        <NavLink to="/dashboard" className="nav-brand" onClick={() => setIsOpen(false)}>
          <span className="nav-brand-mark">
            <img src="/logo.png" alt="" aria-hidden="true" />
          </span>
          <span>
            <strong>AquaLink</strong>
            <small>Water intelligence</small>
          </span>
        </NavLink>

        <nav className="desktop-nav" aria-label="Primary navigation">
          {navItems.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="nav-actions">
          <button
            className="theme-toggle"
            type="button"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </button>
          <NavLink to="/map" className="nav-primary-action">
            <Waves size={16} aria-hidden="true" />
            <span>Explore risk map</span>
          </NavLink>
          <button
            className="mobile-menu-button"
            type="button"
            aria-expanded={isOpen}
            aria-controls="mobile-navigation"
            aria-label={isOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setIsOpen((open) => !open)}
          >
            {isOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </header>

      <div
        className={`mobile-nav-backdrop ${isOpen ? "is-open" : ""}`}
        aria-hidden="true"
        onClick={() => setIsOpen(false)}
      />
      <nav
        id="mobile-navigation"
        className={`mobile-nav ${isOpen ? "is-open" : ""}`}
        aria-label="Mobile navigation"
      >
        <div className="mobile-nav-label">Navigate AquaLink</div>
        {navItems.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            onClick={() => setIsOpen(false)}
            className={({ isActive }) => `mobile-nav-link ${isActive ? "active" : ""}`}
          >
            <Icon size={19} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
        <button className="mobile-theme-toggle" type="button" onClick={onToggleTheme}>
          {theme === "dark" ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
          <span>Switch to {theme === "dark" ? "light" : "dark"} mode</span>
        </button>
        <div className="mobile-nav-status">
          <span className="live-dot" />
          <span>Dataset available</span>
        </div>
      </nav>
    </>
  );
}

export default Sidebar;
