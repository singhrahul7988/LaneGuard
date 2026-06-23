import { Navigate, Route, Routes } from "react-router-dom";
import { stitchScreens } from "./lib/stitchScreens";
import { CommandCenterScreen } from "./screens/CommandCenterScreen";
import { DailyBriefScreen } from "./screens/DailyBriefScreen";
import { DataExplorerScreen } from "./screens/DataExplorerScreen";
import { EnforcementPlannerScreen } from "./screens/EnforcementPlannerScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { HotspotDetailScreen } from "./screens/HotspotDetailScreen";
import { PolicyRecommendationsScreen } from "./screens/PolicyRecommendationsScreen";
import { StationAnalyticsScreen } from "./screens/StationAnalyticsScreen";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/workbench" element={<Navigate to="/" replace />} />
      <Route path="/screens/command-center" element={<CommandCenterScreen />} />
      <Route path="/screens/hotspot-detail" element={<HotspotDetailScreen />} />
      <Route path="/screens/policy-recommendations" element={<PolicyRecommendationsScreen />} />
      <Route path="/screens/enforcement-planner" element={<EnforcementPlannerScreen />} />
      <Route path="/screens/daily-brief" element={<DailyBriefScreen />} />
      <Route path="/screens/station-analytics" element={<StationAnalyticsScreen />} />
      <Route path="/screens/data-explorer" element={<DataExplorerScreen />} />
      <Route
        path="/screens"
        element={<Navigate to={stitchScreens[0].route} replace />}
      />
    </Routes>
  );
}
