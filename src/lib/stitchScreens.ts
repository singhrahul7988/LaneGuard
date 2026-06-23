export type StitchScreen = {
  id: string;
  title: string;
  route: string;
  sourceHtmlPath: string;
  screenshotPath: string;
  sourceFolder: string;
  coreRegions: string[];
  status: "reference-port";
};

export const stitchScreens: StitchScreen[] = [
  {
    id: "command-center",
    title: "Command Center",
    route: "/screens/command-center",
    sourceFolder: "stitch_screens/laneguard_command_dashboard",
    sourceHtmlPath: "stitch_screens/laneguard_command_dashboard/code.html",
    screenshotPath: "stitch_screens/laneguard_command_dashboard/screen.png",
    coreRegions: ["topNavBar", "filterBar", "mapCanvas", "kpiRail", "interveneNowPanel"],
    status: "reference-port",
  },
  {
    id: "hotspot-detail",
    title: "Hotspot Detail Drawer",
    route: "/screens/hotspot-detail",
    sourceFolder: "stitch_screens/hotspot_detail_drawer",
    sourceHtmlPath: "stitch_screens/hotspot_detail_drawer/code.html",
    screenshotPath: "stitch_screens/hotspot_detail_drawer/screen.png",
    coreRegions: ["contextCanvas", "drawerHeader", "reasonChips", "charts", "recommendations"],
    status: "reference-port",
  },
  {
    id: "policy-recommendations",
    title: "Policy Recommendations",
    route: "/screens/policy-recommendations",
    sourceFolder: "stitch_screens/policy_recommendations",
    sourceHtmlPath: "stitch_screens/policy_recommendations/code.html",
    screenshotPath: "stitch_screens/policy_recommendations/screen.png",
    coreRegions: ["topNavBar", "sideNavBar", "tabRail", "rankedList", "supportPanel"],
    status: "reference-port",
  },
  {
    id: "enforcement-planner",
    title: "Enforcement Planner",
    route: "/screens/enforcement-planner",
    sourceFolder: "stitch_screens/enforcement_planner",
    sourceHtmlPath: "stitch_screens/enforcement_planner/code.html",
    screenshotPath: "stitch_screens/enforcement_planner/screen.png",
    coreRegions: ["topNavBar", "plannerFilters", "rankedQueue", "selectedActionQueue", "reliefSummary"],
    status: "reference-port",
  },
  {
    id: "daily-brief",
    title: "Daily Brief",
    route: "/screens/daily-brief",
    sourceFolder: "stitch_screens/daily_brief",
    sourceHtmlPath: "stitch_screens/daily_brief/code.html",
    screenshotPath: "stitch_screens/daily_brief/screen.png",
    coreRegions: ["briefHeader", "headlineMetrics", "topHotspots", "policySummary", "mapInset"],
    status: "reference-port",
  },
  {
    id: "station-analytics",
    title: "Station Analytics",
    route: "/screens/station-analytics",
    sourceFolder: "stitch_screens/station_analytics",
    sourceHtmlPath: "stitch_screens/station_analytics/code.html",
    screenshotPath: "stitch_screens/station_analytics/screen.png",
    coreRegions: ["stationTable", "barChart", "heatmap", "trendChart", "mapSnippets"],
    status: "reference-port",
  },
  {
    id: "data-explorer",
    title: "Data Explorer",
    route: "/screens/data-explorer",
    sourceFolder: "stitch_screens/data_explorer",
    sourceHtmlPath: "stitch_screens/data_explorer/code.html",
    screenshotPath: "stitch_screens/data_explorer/screen.png",
    coreRegions: ["searchBar", "filters", "recordsTable", "recordInspector", "mapPreview"],
    status: "reference-port",
  },
];
