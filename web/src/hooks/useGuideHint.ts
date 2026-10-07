import { useCallback, useState } from "react";

const STORAGE_KEY = "stockpilot:guide-hint-dismissed";

/** True when the visitor already dismissed the hint. Any storage problem counts as "not dismissed", never a crash. */
export function loadHintDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Same never-throw guarantee for the write (storage blocked or full): the hint just comes back next visit. */
export function saveHintDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Nothing else to do about it.
  }
}

/** The first-visit "there is a Guide" hint: shown until it is dismissed once, then remembered. */
export function useGuideHint() {
  const [visible, setVisible] = useState<boolean>(() => !loadHintDismissed());

  const dismiss = useCallback(() => {
    setVisible(false);
    saveHintDismissed();
  }, []);

  return { visible, dismiss };
}
