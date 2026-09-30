// The Keel space, as a single importable definition.
//
// Keel is the suite's source-control answer and the clearest expression of the
// "every change explains itself" thread that runs through the whole catalog —
// the same sentence as the company positioning. Facts come from the repository's
// README, PR-NOTES and schema.

const TENANT_SLUG = "axxes-club-CgWei8"
export { TENANT_SLUG }

export const SPACE = {
  name: "Keel",
  icon: "⚓",
  description:
    "Source control where every change explains itself: checkpoints instead of commits, undo that appends, and a timeline you can scrub.",
}

export const PAGES = [
  {
    title: "Keel",
    icon: "⚓",
    content: `Keel is the AXXES answer to GitHub. Catalog key \`keel\`, status
**announced**, not surfaced in the members launcher.

> Source control for people who did not choose source control.

---

## What is in this space

| Page | What it covers |
| --- | --- |
| [[The three ideas]] | Checkpoints not commits, nothing lost, changes that explain themselves |
| [[Snapshots and blobs]] | Why a checkpoint is a whole snapshot, and what that costs |
| [[Layout and schema]] | The pure/database split, and the five \`keel_*\` tables |
| [[Checks]] | The 24 engine checks, 17 browser checks, and three that exist because of bugs |
| [[Keel — what is not finished]] | The honest gaps, including the actual moat |

## Why it exists, and what makes it different

The wedge is **not** "a nicer Git UI". It is that Keel shares a database with the
rest of the suite, so a change can be tied to the business records it actually
affects. That lets it answer a question no Git host can:

> **What was live when the numbers stopped adding up?**

That question is the product. Everything in [[The three ideas]] is in service of
making the answer reachable by somebody who does not know what a commit hash is.

## The key is reserved, deliberately

The catalog row exists with \`status = 'soon'\` and \`surface_in_members = false\`,
applied through \`node scripts/apply-catalog.mjs\` from the portal. Registering
the key ahead of launch means it cannot be lost to a later decision, and cannot
collide with whatever gets claimed first. It is the same reasoning that keeps
product keys permanent — see [[The AXXES catalog]].`,
  },
  {
    title: "The three ideas",
    icon: "💡",
    content: `Everything Keel does follows from three commitments.

## 1. Checkpoints, not commits

The unit is a plain-language checkpoint — *"Tue 2am — door count fix"* — never a
SHA.

The consequence is that the history is **a timeline you scrub**, not a graph you
interpret. This is the whole bet of the product: the people Keel is for are not
going to learn a DAG, and a tool that requires fluency to read its own history
has excluded its audience at the point of first contact.

## 2. Nothing is lost, ever

Undo is one click from anywhere. It **appends** rather than deletes, and whatever
it set aside goes to a drawer that can put it back.

That gives one property that is easy to miss: **pressing undo twice costs
nothing.** A destructive undo makes people afraid to undo, and a person afraid to
undo has no undo. Making undo safe enough to press twice is what makes it usable
under pressure, which is the only time it matters.

## 3. Every change explains itself

The change splits in two:

- **The factual half** — what moved, how many lines — is written *from the
  diff*, so it cannot be wrong. It is derived, not typed.
- **The intentional half** — the person's own words. **Keel never overwrites
  it.**

That split is the most careful decision in the product. A tool that auto-generates
a commit message destroys the one thing the author was contributing; a tool that
requires typing the facts is a tool nobody types into. Deriving the facts and
protecting the sentence gets both.

## Where the third one stops

The repository says this plainly, in \`describe.ts\`: it can count and name, and
it says so in its own comments, **because it cannot know why** — that is the
human's sentence. See [[Keel — what is not finished]] for why that boundary is
also the product's moat.`,
  },
  {
    title: "Snapshots and blobs",
    icon: "🧊",
    content: `The one architectural decision that makes the three ideas cheap rather
than aspirational.

## A checkpoint is a complete snapshot

Not a patch. File contents are **content-addressed by SHA-256**: the address of
content is derived from the content, so identical content is stored once.

Three properties follow, and they are the whole reason for the choice:

- **Undo points at blobs that already exist.** It cannot fail halfway, because
  there is nothing to compute and nothing to fetch.
- **Loading a checkpoint is one query.** The timeline scrubs without a request
  per tick.
- **Identical content is stored once.** A one-line change in a large repository
  costs one new blob, not a new copy of the file.

## What it costs

A row per file per checkpoint. That is a real price, and the repository is
careful to say it was **deliberate** and is recorded on the product board rather
than discovered later — which is the right way to record a trade you might have
got wrong.

## Git is the exit, not the rewrite

Import and export are the escape hatch from this model. The repository is
explicit that this is the plan: git interoperability is a door, not a
destination. Rewriting a git-compatible product into a checkpoint model would
buy familiarity at the cost of the three ideas, and the three ideas are the
product.

## Implementation

\`\`\`
src/lib/keel/
  diff.ts        hashing, LCS diffing, context collapsing   (pure)
  describe.ts    a change into a sentence                   (pure)
  files.ts       the paste format                           (pure)
  store.ts       checkpoints, undo, drawer, timeline        (database)
  actions.ts     server actions; every write is tenant-scoped
\`\`\`

The first three are **deliberately free of the database** so they can be tested
alone — which is what makes the pure half cheap to be confident about. See
[[Checks]].`,
  },
  {
    title: "Layout and schema",
    icon: "🗄️",
    content: `How Keel is put together, and why its tables are namespaced.

## Five tables, all prefixed

\`\`\`
keel_repos
keel_checkpoints
keel_entries       (file per checkpoint)
keel_blobs         (content-addressed, by SHA-256)
keel_undone        (the drawer)
\`\`\`

Plus \`keel_links\` and \`keel_record_links\` for the record-linking work.

**Every AXXES product shares one Neon database.** A new product writing into an
unprefixed namespace can break Lanes, [[Stock|manifest]] or the portal, so the
prefix is not hygiene — it is the condition of being allowed to exist. See
[[AXXES]].

## Migrations come from the portal

The DDL lives in \`members.axxes.club/db/keel.sql\` and is applied with
\`node scripts/apply-keel.mjs\` from the portal. **Keel runs no migrations of its
own**, which is the suite convention: one place owns the schema, and a product
does not get to reshape a shared table on a deploy.

## Tenant scoping

Every write in \`actions.ts\` is tenant-scoped. Not "most of them" — every one.
This is the same shared-database bargain as above, seen from the other side: the
isolation is a property of the code path, not of the deployment.

## Folders integration

Keel plugs into the suite's asset layer through \`product.config.ts\`:

\`\`\`ts
folders: {
  appKey: "yourapp",                    // must match axxes_product.key
  recordHref: (id) => \`/things/\${id}\`,
  quickLookHref: (id) => \`/things/\${id}/read\`,
  openAssetHref: (assetId) => \`/open?asset=\${assetId}\`,
}
\`\`\`

\`asset_app_links\` is owned by the portal; this app only maps the columns it
writes, and \`linkAssetToRecord\`, \`unlinkAsset\` and \`assetForRecord\` check
workspace ownership on every call.

## Git interoperability

\`src/lib/keel/git/\` — \`pkt-line\`, \`objects\`, \`protocol\`, \`pack\`, and a
\`bridge\`. There is a real git implementation in here, not a wrapper: import and
export are treated as first-class.`,
  },
  {
    title: "Checks",
    icon: "✅",
    content: `How Keel is verified, and the three checks that exist because of specific
bugs.

## What runs

\`\`\`bash
npm run check          # typecheck + source check, no database needed
npm run check:engine   # 24 checks against the real database
npm run check:ui       # 17 checks driving a real browser
\`\`\`

Plus \`node scripts/links-check.mjs\` for record links, 13 checks.

\`check:engine\` runs against the shared database and **always removes its scratch
project, including when it fails** — on a shared database, a check that leaks a
project on failure is a check that will eventually be blamed for real data.

\`check:ui\` bootstraps its own account and workspace membership, so it needs no
setup, and it runs against production when given a base URL.

## The three checks that exist because of bugs

These are the interesting ones, and each is commented at the point it guards.

**The CRLF check.** A browser normalises a \`textarea\` to \`\\r\\n\`, so splitting
the paste format on a literal \`\\n---\\n\` worked for API callers and **silently
folded every file into the first one** for anyone using the product.

This is the sharpest lesson in the repository. The engine check passed on \`\\n\`
input — it was testing the format with a tool that does not go through a browser.
The defect was in the *transport*, not the parser, and only the browser test could
see it. A test that exercises the same code path as the real client is not a
duplicate of the unit test; here it was the only test that mattered.

**Server action exports.** A \`"use server"\` file may only export async
functions. Exporting a plain helper **compiles, passes \`tsc\`, and then breaks
every action in the module at runtime.** \`check-source.mjs\` enforces it because
the type checker cannot.

**NUL bytes.** The binary heuristic was written with two literal NUL characters
in it. That works at runtime, is **invisible in every diff**, and confuses
anything that treats the file as text. The scan reads the file as a \`Buffer\`,
because a text read hides exactly what it is looking for.

## The pattern

All three checks guard something a compiler or a unit test cannot see: a
transport that rewrites your input, a framework rule that fails at runtime rather
than compile time, and a character that is legitimate in a string literal and
poisonous in a file. That is what a source-level check is *for*.`,
  },
  {
    title: "Keel — what is not finished",
    icon: "⚠️",
    content: `The gaps, and the one that is genuinely the product.

## Record linking is not built, and it is the moat

From the README: *"git import/export, and the AXXES record linking that is the
actual moat"* are not built.

This is worth stating precisely, because the architecture supports it and the
implementation is absent. **What was live when the numbers stopped adding up?**
is answerable only if a checkpoint can be tied to the business records it
affected — the \`keel_record_links\` table is namespaced and waiting.

So the suite's clearest demonstration of "built so it can't disagree with
itself" is currently the product whose headline capability is unimplemented. The
honest statement is that Keel today is a good local history tool that could,
one day, become a forensic tool.

## Also unbuilt

- **Braces and merges**, and the merge-as-conversation view
- **The Explain level** — the Plain ↔ Technical slider
- **Git import/export**

All are on the board with acceptance criteria, which is the right place for them
and not the same as being built.

## An open product decision

**Whether Keel is branch-free by default** is unresolved — it is the company
board card *"Decide whether Keel is branch-free by default"*, and the branch-bar
gate ships with it. A source-control product that omits branches is a large
opinion, and it is right that it is being decided rather than assumed.

## Deployment is behind the code

Per \`PR-NOTES.md\`: the site is live and serving, but **the record-link work is
built and committed and not deployed** — Vercel's free tier refused with
\`api-deployments-free-per-day\` (100/day, exhausted by parallel agents).

This is a pipeline limit rather than a code problem, and it is recorded in the PR
notes with the exact commands to finish it. It is also the reason the deployed
site is behind the repository, which is the state a reader of the docs should know
about.

## The deploy author rule

Every AXXES repo has it: **the commit author must be \`viscasillas@me.com\` or
Vercel blocks the deploy.** Enforced by the pipeline, not by discipline — the
only kind of rule that survives a deadline. See [[AXXES]].`,
  },
]
