import { createContext, useContext } from "react";
import type { GlossaryKey } from "../components/glossary";

export type GuideApi = {
  /** Opens the Guide drawer, scrolled to one term when a key is given. */
  openGuide: (key?: GlossaryKey) => void;
};

// App owns the open/closed state; the help buttons deep in the page only need to ask for it.
// The default does nothing, so a component rendered on its own (a test) never crashes.
export const GuideContext = createContext<GuideApi>({ openGuide: () => {} });

export function useGuide(): GuideApi {
  return useContext(GuideContext);
}
