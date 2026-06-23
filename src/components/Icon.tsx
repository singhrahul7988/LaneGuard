import type { ReactNode } from "react";

type IconProps = {
  name: string;
  size?: number;
  color?: string;
};

export function Icon(props: IconProps) {
  const size = props.size ?? 18;
  const graphic = getIconGraphic(props.name);

  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        minWidth: size,
        height: size,
        color: props.color,
        lineHeight: 1,
      }}
      title={props.name}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {graphic}
      </svg>
    </span>
  );
}

function getIconGraphic(name: string): ReactNode {
  switch (name) {
    case "search":
      return (
        <>
          <circle cx="11" cy="11" r="6" />
          <path d="M16 16l4 4" />
        </>
      );
    case "help":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.8 9a2.4 2.4 0 1 1 4.3 1.5c-.9 1-2.1 1.6-2.1 3" />
          <circle cx="12" cy="17.2" r=".8" fill="currentColor" stroke="none" />
        </>
      );
    case "warning":
    case "priority_high":
    case "security_update_warning":
      return (
        <>
          <path d="M12 3l9 16H3L12 3z" />
          <path d="M12 9v4.5" />
          <circle cx="12" cy="16.6" r=".9" fill="currentColor" stroke="none" />
        </>
      );
    case "arrow_drop_down":
      return <path d="M6 9l6 6 6-6" />;
    case "open_in_new":
      return (
        <>
          <path d="M14 5h5v5" />
          <path d="M10 14L19 5" />
          <path d="M19 13v5H5V5h5" />
        </>
      );
    case "local_shipping":
      return (
        <>
          <path d="M4 7h10v8H4z" />
          <path d="M14 10h3l2 2v3h-5z" />
          <circle cx="8" cy="17" r="1.6" />
          <circle cx="17" cy="17" r="1.6" />
        </>
      );
    case "directions_walk":
      return (
        <>
          <circle cx="13" cy="5" r="1.8" />
          <path d="M11.3 10l2.7-1.7 1.8 2.2" />
          <path d="M10 20l1.4-5-2.1-2.3 1.6-3.5" />
          <path d="M14.1 12.2l-1.1 3.7 3 4.1" />
        </>
      );
    case "directions_car":
      return (
        <>
          <path d="M6 16l1.6-5h8.8L18 16" />
          <path d="M5 16h14v3H5z" />
          <circle cx="8" cy="17.5" r="1.2" />
          <circle cx="16" cy="17.5" r="1.2" />
        </>
      );
    case "fence":
      return (
        <>
          <path d="M6 20V8l2-3 2 3v12M14 20V8l2-3 2 3v12" />
          <path d="M4 12h16M4 16h16" />
        </>
      );
    case "traffic":
      return (
        <>
          <path d="M10 4h4l2 3v7l-2 3h-4l-2-3V7z" />
          <circle cx="12" cy="8.3" r="1" />
          <circle cx="12" cy="11.5" r="1" />
          <circle cx="12" cy="14.7" r="1" />
        </>
      );
    case "map":
      return (
        <>
          <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z" />
          <path d="M9 4v14M15 6v14" />
        </>
      );
    case "analytics":
      return (
        <>
          <path d="M5 19V11M12 19V7M19 19V4" />
          <path d="M3 19h18" />
        </>
      );
    case "hub":
      return (
        <>
          <circle cx="12" cy="12" r="2.4" />
          <circle cx="6" cy="7" r="2" />
          <circle cx="18" cy="7" r="2" />
          <circle cx="6" cy="17" r="2" />
          <circle cx="18" cy="17" r="2" />
          <path d="M10.3 10.4L7.6 8.5M13.7 10.4l2.7-1.9M10.3 13.6l-2.7 1.9M13.7 13.6l2.7 1.9" />
        </>
      );
    case "policy":
      return (
        <>
          <path d="M7 4h10v16l-5-2-5 2V4z" />
          <path d="M9.5 8h5M9.5 11h5M9.5 14h3.5" />
        </>
      );
    case "target":
      return (
        <>
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21" />
        </>
      );
    case "add_task":
      return (
        <>
          <path d="M8 5h10v14H6V7" />
          <path d="M8 5V3h4" />
          <path d="M9.5 12l1.8 1.8L15 10" />
        </>
      );
    case "close":
      return (
        <>
          <path d="M6 6l12 12M18 6L6 18" />
        </>
      );
    case "groups":
      return (
        <>
          <circle cx="9" cy="9" r="2.2" />
          <circle cx="16.5" cy="10" r="1.8" />
          <path d="M5.5 18a3.5 3.5 0 0 1 7 0" />
          <path d="M13.5 18a3 3 0 0 1 5.5-1.4" />
        </>
      );
    case "local_parking":
      return (
        <>
          <rect x="6" y="4" width="10" height="16" rx="1.5" />
          <path d="M10 16V8h2.5a2.2 2.2 0 1 1 0 4.4H10" />
        </>
      );
    case "location_on":
      return (
        <>
          <path d="M12 20s-5-4.9-5-9a5 5 0 1 1 10 0c0 4.1-5 9-5 9z" />
          <circle cx="12" cy="11" r="1.8" />
        </>
      );
    case "add_circle":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </>
      );
    case "remove_circle":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12h8" />
        </>
      );
    case "check_circle":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 12.3l2.2 2.2 4.8-5" />
        </>
      );
    case "schedule":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      );
    case "timeline":
      return (
        <>
          <path d="M4 16l5-5 4 3 7-7" />
          <circle cx="4" cy="16" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="9" cy="11" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="13" cy="14" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="20" cy="7" r="1.2" fill="currentColor" stroke="none" />
        </>
      );
    case "my_location":
      return (
        <>
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21" />
        </>
      );
    case "trending_up":
      return (
        <>
          <path d="M4 16l6-6 4 4 6-8" />
          <path d="M16 6h4v4" />
        </>
      );
    case "equal":
      return (
        <>
          <path d="M6 9h12M6 15h12" />
        </>
      );
    case "download":
      return (
        <>
          <path d="M12 4v10" />
          <path d="M8.5 10.5L12 14l3.5-3.5" />
          <path d="M5 19h14" />
        </>
      );
    case "chevron_left":
      return <path d="M15 5l-6 7 6 7" />;
    case "chevron_right":
      return <path d="M9 5l6 7-6 7" />;
    case "unfold_more":
      return (
        <>
          <path d="M8 8l4-4 4 4" />
          <path d="M16 16l-4 4-4-4" />
        </>
      );
    default:
      return (
        <>
          <circle cx="12" cy="12" r="7.5" opacity="0.35" />
        </>
      );
  }
}
