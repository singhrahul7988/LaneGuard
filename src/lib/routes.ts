import { stitchScreens } from "./stitchScreens";

export function screenRoute(id: string) {
  return stitchScreens.find((screen) => screen.id === id)?.route ?? "/";
}
