# Detection accuracy evaluation — required before stable release

**Do not claim 95% precision based on unit tests or the 32 synthetic fixtures.**

The scorer accepts a **manually reviewed** collection of labeled examples. It computes
true positives, false positives, false negatives, true negatives, precision, recall and
F1 per rule. It does **not** perform external site scanning, automatically identify truth,
or imply that submitted labels are representative.

```bash
node scripts/score-benchmark.js benchmarks/example-reviewed.json
```

Each unique case needs `id`, public rule ID, expected/observed booleans and
`source` (`synthetic` or `reviewed-staging`). Source is declared by the reviewer;
the scorer does not verify the provenance of a review.

## Review protocol

1. Obtain permission to test at least 12 diverse staging sites with disposable test data.
2. Independently annotate screenshots, route, width, action path, expected condition and
   detected condition. Include clean/negative examples and issues missed by the detector.
3. Record rule IDs, sample date/browser version, confirmation notes, and unexpected findings.
   Avoid private URLs, credentials or screenshots in the public repository.
4. Have a second reviewer settle disagreements; enter one verified label per case.
5. Report per-rule sample sizes and precision/recall. Null means no relevant denominator;
   high percentages with few positives are not meaningful.
6. Validate safe exploration separately under an explicit site-owner agreement.
7. Keep raw consented staging-site evidence private. Publish aggregate metrics and
   sanitized reproduced defects only.

A dataset with an adequate number of real positive/negative examples is required
before treating automatic CI findings as production-grade. This repository currently
ships an **illustrative synthetic schema**, not real-world performance evidence.
