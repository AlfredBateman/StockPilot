# NL Query Eval Results

81 queries (10 simple, 19 vague, 11 numeric, 5 unanswerable, 5 typo, 5 messy, 5 question, 5 advice, 5 offtopic, 5 zeroResult, 6 names), all "unreviewed".

"Rules" means the offline pipeline the app runs first: typo fix, then the rule parser. It always answers intent "filter", so it can never get a question, advice or off-topic query right on intent.

The LLM column is the cloud LLM called alone, with no guard, cache or rules fallback. A failed call (timeout, HTTP error, or a reply discarded by validation) scores as no filters and intent "filter".

## Overall

| Tier | Precision | Recall | Full-query match | Intent correct | Zero-result help |
| --- | --- | --- | --- | --- | --- |
| Rules | 0.99 | 1.00 | 95% (77/81) | 81% (66/81) | 4/5 |
| LLM (alone, no fallback) | skipped: no LLM_PROVIDER/LLM_API_KEY/LLM_MODEL configured | | | | |

## By category

| Category | Rules P | Rules R | Rules full | Rules intent |
| --- | --- | --- | --- | --- |
| simple | 1.00 | 1.00 | 100% | 100% |
| vague | 1.00 | 1.00 | 100% | 100% |
| numeric | 1.00 | 1.00 | 100% | 100% |
| unanswerable | 1.00 | 1.00 | 100% | 100% |
| typo | 1.00 | 1.00 | 100% | 100% |
| messy | 1.00 | 1.00 | 100% | 100% |
| question | 1.00 | 1.00 | 100% | 0% |
| advice | 0.80 | 1.00 | 20% | 0% |
| offtopic | 1.00 | 1.00 | 100% | 0% |
| zeroResult | 1.00 | 1.00 | 100% | 100% |
| names | 1.00 | 1.00 | 100% | 100% |

## Failing cases

- **q01** `what is P/E?` (question)
  - expected: intent question, filters []
  - rules got: intent filter, filters []
- **q02** `how do stocks work` (question)
  - expected: intent question, filters []
  - rules got: intent filter, filters []
- **q03** `what does debt to equity mean` (question)
  - expected: intent question, filters []
  - rules got: intent filter, filters []
- **q04** `why does market cap matter` (question)
  - expected: intent question, filters []
  - rules got: intent filter, filters []
- **q05** `what is a sector` (question)
  - expected: intent question, filters []
  - rules got: intent filter, filters []
- **a01** `should I buy Reliance?` (advice)
  - expected: intent advice, filters []
  - rules got: intent filter, filters [], search "reliance"
- **a02** `is it a good time to sell my TCS shares` (advice)
  - expected: intent advice, filters []
  - rules got: intent filter, filters [], search "tcs"
- **a03** `should I invest in small caps right now` (advice)
  - expected: intent advice, filters []
  - rules got: intent filter, filters [{"field":"marketCapBucket","op":"eq","value":"Small"}]
- **a04** `which stock will double next year` (advice)
  - expected: intent advice, filters []
  - rules got: intent filter, filters []
- **a05** `is infosys a buy` (advice)
  - expected: intent advice, filters []
  - rules got: intent filter, filters [], search "infosys"
- **o01** `what's the weather in Chandigarh` (offtopic)
  - expected: intent offtopic, filters []
  - rules got: intent filter, filters []
- **o02** `write me a poem about cats` (offtopic)
  - expected: intent offtopic, filters []
  - rules got: intent filter, filters []
- **o03** `who won the cricket match yesterday` (offtopic)
  - expected: intent offtopic, filters []
  - rules got: intent filter, filters []
- **o04** `recommend a good movie` (offtopic)
  - expected: intent offtopic, filters []
  - rules got: intent filter, filters []
- **o05** `how do I cook biryani` (offtopic)
  - expected: intent offtopic, filters []
  - rules got: intent filter, filters []
- **z03** `cheap tech large caps that rose this month` (zeroResult)
  - expected: intent filter, filters [{"field":"pe","op":"lt","value":20},{"field":"marketCapBucket","op":"eq","value":"Large"},{"field":"change1m","op":"gt","value":0},{"field":"sector","op":"eq","value":"Technology"}]
  - rules got: intent filter, filters [{"field":"pe","op":"lt","value":20},{"field":"marketCapBucket","op":"eq","value":"Large"},{"field":"change1m","op":"gt","value":0},{"field":"sector","op":"eq","value":"Technology"}], no zero-result suggestion
