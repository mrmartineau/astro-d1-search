---
name: record-intent
description: At the end of an investigation or design session, write what was decided into intent/ and strengthen the oracle, so the next session inherits the reasoning. Use when a session settled how search should behave, found an oracle blind spot, or changed a rule.
---

# Record intent

Goal: the next agent gets the decision and the reasoning, not just the code.

1. **List what was settled** this session that isn't already in `intent/`.
   Ignore implementation detail; keep only things that constrain future
   changes ("ties break by url", "undated docs rank as if 1y old").
2. **Pick where each goes.**
   - A checkable promise → new or revised rule in `intent/search.md` or
     `intent/budgets.md`. Next free id. Fields: rule, Why, Assumes, Check.
   - A choice between options with tradeoffs → `intent/decisions/NNNN-slug.md`
     (Status, Context, Decision, Consequences). Short.
   - Still undecided → add it as an **Open question** under the closest rule.
     Don't invent an answer.
3. **Strengthen the check.** For every new or revised rule, add or update a
   property in `src/search.oracle.test.ts` (or `src/intent.test.ts` for
   structural rules). Extend the model, don't special-case the implementation.
   If it can't be checked yet, say so under the rule.
4. **Run `bun test`.** A new property that passes first time on a rule you just
   wrote: confirm it can fail. Back up the file outside the repo
   (`bak=$(mktemp)`; `cp <file> "$bak"`), break it, run the test, then
   `cp "$bak" <file>` and `rm "$bak"`. Don't use `git checkout` to revert; it
   discards other uncommitted work in the file.
5. **Update `intent/README.md`** table if you added a file.
6. Summarise in 3 lines: rules added/changed, checks added, open questions.

Keep entries terse. One rule per promise. No restating code.
