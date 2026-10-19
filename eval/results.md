# NL Query Eval Results

81 queries (10 simple, 19 vague, 11 numeric, 5 unanswerable, 5 typo, 5 messy, 5 question, 5 advice, 5 offtopic, 5 zeroResult, 6 names), all "unreviewed".

"Rules" means the offline pipeline the app runs first: typo fix, rule parser, then company names. It always answers intent "filter", so it can never get a question, advice or off-topic query right on intent.

Advice queries that name a company (a01, a02, a05) expect that name search too, because the app does search the name.

## Overall (rules)

| Precision | Recall | Full-query match | Intent correct | Zero-result help |
| --- | --- | --- | --- | --- |
| 0.99 | 1.00 | 99% (80/81) | 81% (66/81) | 5/5 |

## By category (rules)

| Category | Rules P | Rules R | Rules full | Rules intent |
| --- | --- | --- | --- | --- |
| simple | 1.00 | 1.00 | 100% | 100% |
| vague | 1.00 | 1.00 | 100% | 100% |
| numeric | 1.00 | 1.00 | 100% | 100% |
| unanswerable | 1.00 | 1.00 | 100% | 100% |
| typo | 1.00 | 1.00 | 100% | 100% |
| messy | 1.00 | 1.00 | 100% | 100% |
| question | 1.00 | 1.00 | 100% | 0% |
| advice | 0.80 | 1.00 | 80% | 0% |
| offtopic | 1.00 | 1.00 | 100% | 0% |
| zeroResult | 1.00 | 1.00 | 100% | 100% |
| names | 1.00 | 1.00 | 100% | 100% |

## Failing cases (rules)

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
  - expected: intent advice, filters [], search "reliance"
  - rules got: intent filter, filters [], search "reliance"
- **a02** `is it a good time to sell my TCS shares` (advice)
  - expected: intent advice, filters [], search "tcs"
  - rules got: intent filter, filters [], search "tcs"
- **a03** `should I invest in small caps right now` (advice)
  - expected: intent advice, filters []
  - rules got: intent filter, filters [{"field":"marketCapBucket","op":"eq","value":"Small"}]
- **a04** `which stock will double next year` (advice)
  - expected: intent advice, filters []
  - rules got: intent filter, filters []
- **a05** `is infosys a buy` (advice)
  - expected: intent advice, filters [], search "infosys"
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

## AI results (LLM alone, no fallback)

Run: date not recorded (these numbers were already in the file in commit d4aada1, 2026-10-07), 70 queries (the set before the names and price-history queries were added; its z03 was "cheap tech large caps that rose this month", since replaced), provider nvidia, model nvidia/nemotron-3.5-lightning-30b-a3b. The cloud LLM is called alone, with no guard, cache or rules fallback. A failed call (timeout, HTTP error, or a reply discarded by validation) scores as no filters and intent "filter". **Most calls failed: 53 of 70 timed out at about 8 seconds, so these numbers mostly measure the timeout, not the model.** **Not re-run:** these numbers are kept from that run, not from the 81 queries above. Run `npm run eval` with LLM_PROVIDER, LLM_API_KEY and LLM_MODEL set to refresh them.

| Precision | Recall | Full-query match | Intent correct | Zero-result help |
| --- | --- | --- | --- | --- |
| 0.50 | 0.50 | 49% (34/70) | 77% (54/70) | 2/5 |

| Category | LLM P | LLM R | LLM full | LLM intent |
| --- | --- | --- | --- | --- |
| simple | 0.00 | 0.00 | 0% | 100% |
| vague | 0.00 | 0.00 | 0% | 100% |
| numeric | 0.90 | 0.90 | 90% | 100% |
| unanswerable | 1.00 | 1.00 | 100% | 80% |
| typo | 0.70 | 0.70 | 60% | 100% |
| messy | 0.20 | 0.20 | 20% | 100% |
| question | 1.00 | 1.00 | 100% | 0% |
| advice | 1.00 | 1.00 | 100% | 0% |
| offtopic | 1.00 | 1.00 | 100% | 0% |
| zeroResult | 0.30 | 0.30 | 20% | 100% |

Latency (wall-clock per call, from the machine that ran it):

| Median | Worst case | Failed or discarded calls |
| --- | --- | --- |
| 8.01s | 8.02s | 53/70 |

Answers (question, advice, offtopic):

- **q01** `what is P/E?` -> intent filter: n/a
- **q02** `how do stocks work` -> intent filter: n/a
- **q03** `what does debt to equity mean` -> intent filter: n/a
- **q04** `why does market cap matter` -> intent filter: n/a
- **q05** `what is a sector` -> intent filter: n/a
- **a01** `should I buy Reliance?` -> intent filter: n/a
- **a02** `is it a good time to sell my TCS shares` -> intent filter: n/a
- **a03** `should I invest in small caps right now` -> intent filter: n/a
- **a04** `which stock will double next year` -> intent filter: n/a
- **a05** `is infosys a buy` -> intent filter: n/a
- **o01** `what's the weather in Chandigarh` -> intent filter: n/a
- **o02** `write me a poem about cats` -> intent filter: n/a
- **o03** `who won the cricket match yesterday` -> intent filter: n/a
- **o04** `recommend a good movie` -> intent filter: n/a
- **o05** `how do I cook biryani` -> intent filter: n/a

Cases the LLM did not fully get right:

- **s01** `cheap stocks` (simple)
  - expected: intent filter, filters [{"field":"pe","op":"lt","value":20}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **s02** `expensive stocks` (simple)
  - expected: intent filter, filters [{"field":"pe","op":"gt","value":40}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **s03** `profitable companies` (simple)
  - expected: intent filter, filters [{"field":"profitMargin","op":"gt","value":0}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **s04** `low debt stocks` (simple)
  - expected: intent filter, filters [{"field":"debtToEquity","op":"lt","value":0.5}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **s05** `high debt stocks` (simple)
  - expected: intent filter, filters [{"field":"debtToEquity","op":"gt","value":1}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **s06** `small cap stocks` (simple)
  - expected: intent filter, filters [{"field":"marketCapBucket","op":"eq","value":"Small"}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **s07** `midcap stocks` (simple)
  - expected: intent filter, filters [{"field":"marketCapBucket","op":"eq","value":"Mid"}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **s08** `large cap stocks` (simple)
  - expected: intent filter, filters [{"field":"marketCapBucket","op":"eq","value":"Large"}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **s09** `technology stocks` (simple)
  - expected: intent filter, filters [{"field":"sector","op":"eq","value":"Technology"}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **s10** `healthcare stocks` (simple)
  - expected: intent filter, filters [{"field":"sector","op":"eq","value":"Healthcare"}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **v01** `cheap profitable midcaps` (vague)
  - expected: intent filter, filters [{"field":"pe","op":"lt","value":20},{"field":"profitMargin","op":"gt","value":0},{"field":"marketCapBucket","op":"eq","value":"Mid"}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **v02** `cheap profitable midcaps that fell this month` (vague)
  - expected: intent filter, filters [{"field":"pe","op":"lt","value":20},{"field":"profitMargin","op":"gt","value":0},{"field":"marketCapBucket","op":"eq","value":"Mid"},{"field":"change1m","op":"lt","value":0}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **v03** `low debt tech stocks` (vague)
  - expected: intent filter, filters [{"field":"debtToEquity","op":"lt","value":0.5},{"field":"sector","op":"eq","value":"Technology"}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **v04** `expensive large cap healthcare stocks` (vague)
  - expected: intent filter, filters [{"field":"pe","op":"gt","value":40},{"field":"marketCapBucket","op":"eq","value":"Large"},{"field":"sector","op":"eq","value":"Healthcare"}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **v05** `profitable small caps that rose this month` (vague)
  - expected: intent filter, filters [{"field":"profitMargin","op":"gt","value":0},{"field":"marketCapBucket","op":"eq","value":"Small"},{"field":"change1m","op":"gt","value":0}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **v06** `high debt energy stocks` (vague)
  - expected: intent filter, filters [{"field":"debtToEquity","op":"gt","value":1},{"field":"sector","op":"eq","value":"Energy"}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **v07** `cheap financial services stocks` (vague)
  - expected: intent filter, filters [{"field":"pe","op":"lt","value":20},{"field":"sector","op":"eq","value":"Financial Services"}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **v08** `low debt profitable large caps` (vague)
  - expected: intent filter, filters [{"field":"debtToEquity","op":"lt","value":0.5},{"field":"profitMargin","op":"gt","value":0},{"field":"marketCapBucket","op":"eq","value":"Large"}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **v09** `expensive tech stocks that fell this month` (vague)
  - expected: intent filter, filters [{"field":"pe","op":"gt","value":40},{"field":"sector","op":"eq","value":"Technology"},{"field":"change1m","op":"lt","value":0}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **v10** `cheap small cap banking stocks` (vague)
  - expected: intent filter, filters [{"field":"pe","op":"lt","value":20},{"field":"marketCapBucket","op":"eq","value":"Small"},{"field":"sector","op":"eq","value":"Financial Services"}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **v11** `profitable midcap pharma stocks` (vague)
  - expected: intent filter, filters [{"field":"profitMargin","op":"gt","value":0},{"field":"marketCapBucket","op":"eq","value":"Mid"},{"field":"sector","op":"eq","value":"Healthcare"}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **v12** `high debt consumer cyclical stocks` (vague)
  - expected: intent filter, filters [{"field":"debtToEquity","op":"gt","value":1},{"field":"sector","op":"eq","value":"Consumer Cyclical"}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **v13** `low debt utilities that rose this month` (vague)
  - expected: intent filter, filters [{"field":"debtToEquity","op":"lt","value":0.5},{"field":"sector","op":"eq","value":"Utilities"},{"field":"change1m","op":"gt","value":0}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **v14** `cheap industrials` (vague)
  - expected: intent filter, filters [{"field":"pe","op":"lt","value":20},{"field":"sector","op":"eq","value":"Industrials"}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **v15** `profitable real estate stocks that fell this month` (vague)
  - expected: intent filter, filters [{"field":"profitMargin","op":"gt","value":0},{"field":"sector","op":"eq","value":"Real Estate"},{"field":"change1m","op":"lt","value":0}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **n01** `P/E under 15` (numeric)
  - expected: intent filter, filters [{"field":"pe","op":"lt","value":15}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **u01** `safe stocks` (unanswerable)
  - expected: intent filter, filters []
  - LLM got: intent offtopic, filters []
- **t03** `tecnology stocks with low debt` (typo)
  - expected: intent filter, filters [{"field":"debtToEquity","op":"lt","value":0.5},{"field":"sector","op":"eq","value":"Technology"}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **t05** `smal cap finacial stocks` (typo)
  - expected: intent filter, filters [{"field":"marketCapBucket","op":"eq","value":"Small"},{"field":"sector","op":"eq","value":"Financial Services"}]
  - LLM got: intent filter, filters [{"field":"marketCapBucket","op":"eq","value":"Small"},{"field":"sector","op":"in","value":["Financial Services"]}]
- **m01** `umm show me some cheap tech stuff pls` (messy)
  - expected: intent filter, filters [{"field":"pe","op":"lt","value":20},{"field":"sector","op":"eq","value":"Technology"}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **m03** `looking for banks, low debt ideally` (messy)
  - expected: intent filter, filters [{"field":"debtToEquity","op":"lt","value":0.5},{"field":"sector","op":"eq","value":"Financial Services"}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **m04** `which energy companies went down this month` (messy)
  - expected: intent filter, filters [{"field":"change1m","op":"lt","value":0},{"field":"sector","op":"eq","value":"Energy"}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **m05** `pharma cos w/ margins over 20%` (messy)
  - expected: intent filter, filters [{"field":"profitMargin","op":"gt","value":0.2},{"field":"sector","op":"eq","value":"Healthcare"}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **q01** `what is P/E?` (question)
  - expected: intent question, filters []
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **q02** `how do stocks work` (question)
  - expected: intent question, filters []
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **q03** `what does debt to equity mean` (question)
  - expected: intent question, filters []
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **q04** `why does market cap matter` (question)
  - expected: intent question, filters []
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **q05** `what is a sector` (question)
  - expected: intent question, filters []
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **a01** `should I buy Reliance?` (advice)
  - expected: intent advice, filters []
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **a02** `is it a good time to sell my TCS shares` (advice)
  - expected: intent advice, filters []
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **a03** `should I invest in small caps right now` (advice)
  - expected: intent advice, filters []
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **a04** `which stock will double next year` (advice)
  - expected: intent advice, filters []
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **a05** `is infosys a buy` (advice)
  - expected: intent advice, filters []
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **o01** `what's the weather in Chandigarh` (offtopic)
  - expected: intent offtopic, filters []
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **o02** `write me a poem about cats` (offtopic)
  - expected: intent offtopic, filters []
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **o03** `who won the cricket match yesterday` (offtopic)
  - expected: intent offtopic, filters []
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **o04** `recommend a good movie` (offtopic)
  - expected: intent offtopic, filters []
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **o05** `how do I cook biryani` (offtopic)
  - expected: intent offtopic, filters []
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **z01** `cheap realty` (zeroResult)
  - expected: intent filter, filters [{"field":"pe","op":"lt","value":20},{"field":"sector","op":"eq","value":"Real Estate"}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **z02** `smal cap energy` (zeroResult)
  - expected: intent filter, filters [{"field":"marketCapBucket","op":"eq","value":"Small"},{"field":"sector","op":"eq","value":"Energy"}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **z03** `cheap tech large caps that rose this month` (zeroResult)
  - expected: intent filter, filters [{"field":"pe","op":"lt","value":20},{"field":"marketCapBucket","op":"eq","value":"Large"},{"field":"change1m","op":"gt","value":0},{"field":"sector","op":"eq","value":"Technology"}]
  - LLM got: intent filter, filters [] (call failed or reply discarded)
- **z05** `large cap profit margin above 9000` (zeroResult)
  - expected: intent filter, filters [{"field":"marketCapBucket","op":"eq","value":"Large"},{"field":"profitMargin","op":"gt","value":90}]
  - LLM got: intent filter, filters [{"field":"marketCapBucket","op":"eq","value":"Large"},{"field":"profitMargin","op":"gt","value":0.9}]