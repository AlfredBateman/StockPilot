import { useSyncExternalStore } from "react";
import { getWaking, subscribeWaking } from "../api/client";
import { IconWarning } from "./Icons";

/** Shown only while the first API call is slow (a sleeping free-tier server). It disappears by itself once the server answers. */
export function WakeNotice() {
  const waking = useSyncExternalStore(subscribeWaking, getWaking);
  if (!waking) return null;
  return (
    <div className="mx-auto max-w-7xl px-4 pt-5 md:px-6 md:pt-6">
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl border border-warning/25 bg-warning-soft px-4 py-3 text-body text-warning"
      >
        <IconWarning size={18} />
        <p>Waking the server up, free hosting sleeps after inactivity. This takes about a minute.</p>
      </div>
    </div>
  );
}
