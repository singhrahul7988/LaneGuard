import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { screenRoute } from "../lib/routes";

export const platformTabs = [
  { label: "Live Map", route: screenRoute("command-center") },
  { label: "Interventions", route: screenRoute("enforcement-planner") },
  { label: "Analytics", route: screenRoute("station-analytics") },
  { label: "Reports", route: screenRoute("daily-brief") },
  { label: "Policy", route: screenRoute("policy-recommendations") },
];

export const headerUtilityRoutes = {
  home: "/",
};

export function buildCriticalMapRoute(station?: string | null) {
  const params = new URLSearchParams({
    severity: "critical",
    timeBand: "peak",
  });

  if (station && !["all", "All Stations", "ALL_STATIONS"].includes(station)) {
    params.set("station", station);
  }

  return `${screenRoute("command-center")}?${params.toString()}`;
}

export function AppHeader(props: {
  active: string;
  actions?: ReactNode;
  borderless?: boolean;
}) {
  return (
    <header
      className="lg-platform-header"
      style={{
        borderBottom: props.borderless ? "none" : "1px solid var(--lg-outline-variant)",
      }}
    >
      <div className="lg-platform-brand">
        <Link to="/" aria-label="LaneGuard Home">
          <img src="/laneguard-mark.svg" alt="" className="lg-platform-brand-mark" aria-hidden="true" />
          <span className="lg-platform-brand-lane">Lane</span>
          <span className="lg-platform-brand-guard">Guard</span>
        </Link>
      </div>
      <div className="lg-platform-nav-wrap">
        <nav className="lg-platform-nav" aria-label="Primary">
          {platformTabs.map((item) => {
            const active = item.label === props.active;
            return (
              <Link
                key={item.label}
                to={item.route}
                className={`lg-platform-tab${active ? " is-active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="lg-platform-actions">
        <HeaderClock />
        {props.actions}
      </div>
    </header>
  );
}

function HeaderClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const dateLabel = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(now);

  const timeLabel = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(now);

  return (
    <div className="lg-header-clock" aria-label={`Current India time ${dateLabel} ${timeLabel}`}>
      <span className="lg-header-clock-date">{dateLabel}</span>
      <span className="lg-header-clock-time">{timeLabel} IST</span>
    </div>
  );
}
