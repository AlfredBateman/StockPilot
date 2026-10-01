# NL Query Eval Results

40 queries (10 simple, 15 vague/compound, 10 numeric, 5 unanswerable), all "unreviewed".

## Overall

| Tier | Precision | Recall | Full-query match |
| --- | --- | --- | --- |
| Rules | 1.00 | 1.00 | 100% (40/40) |
| LLM (alone, no fallback) | skipped — no LLM_PROVIDER/LLM_API_KEY/LLM_MODEL configured | | |

## By category

| Category | Rules P | Rules R | Rules full |
| --- | --- | --- | --- |
| simple | 1.00 | 1.00 | 100% |
| vague | 1.00 | 1.00 | 100% |
| numeric | 1.00 | 1.00 | 100% |
| unanswerable | 1.00 | 1.00 | 100% |

## Failing cases

None — every query got a full-query match from every scored tier.
