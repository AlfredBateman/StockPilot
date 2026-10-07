import { useGuide } from "../hooks/guideContext";
import { GLOSSARY, type GlossaryKey } from "./glossary";

type GlossaryLinkProps = {
  metric: GlossaryKey;
};

/**
 * A small "What does this mean?" text link that opens the Guide at one term.
 * Used under every active filter chip and every query-box note, so a beginner
 * who meets an unfamiliar filter is one tap from its explanation. It is a
 * button (it opens a drawer, it is not a page link) styled as a link; the
 * aria-label names the term, because a page can hold many of these.
 */
export function GlossaryLink({ metric }: GlossaryLinkProps) {
  const { openGuide } = useGuide();
  return (
    <button
      type="button"
      onClick={() => openGuide(metric)}
      aria-label={`What does ${GLOSSARY[metric].term} mean? Opens the Guide`}
      className="inline-flex h-6 touch-manipulation items-center rounded-md text-caption font-medium text-accent-700 underline decoration-accent-300 underline-offset-2 transition-colors duration-150 hover:text-accent-800 hover:decoration-accent-600"
    >
      What does this mean?
    </button>
  );
}
