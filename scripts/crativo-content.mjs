// Crativo, as a single importable definition.
//
// Crativo is the personal side of the work: crativo.xyz, the portfolio and blog,
// and the projects that stand on their own rather than under the AXXES brand.
// It is a separate organisation from AXXES CLUB because the audience, the
// ownership and the pitch are all different — a portfolio is judged by what was
// built, a suite by what it can reconcile.
//
// Page titles are unique per space, and Nexus resolves [[wiki links]] by title
// across the whole tenant, so a title that already exists elsewhere would
// silently merge two pages into one. import-space.mjs checks that before writing.

export const SPACE = {
  name: "Crativo",
  icon: "🎛️",
  description:
    "crativo.xyz and the projects behind it: apps, tools, libraries and kiosks, plus the writing that goes with them.",
}

/** Created on first run; Crativo is not an AXXES product and is owned outright. */
export const CREATE_TENANT = {
  name: "Crativo",
  slug: "crativo",
  type: "brand",
  status: "active",
  website: "https://crativo.xyz",
  primaryColor: "#111111",
}

export const TENANT = { slug: CREATE_TENANT.slug }

export const PAGES = [
  {
    title: "Crativo",
    icon: "🎛️",
    content: `Crativo is the personal side of the work.

**crativo.xyz** is a portfolio and a technical blog: nineteen projects, about
ninety published posts, and the notes that came out of building both. It is not
an AXXES product and is not sold as one.

The split is deliberate. AXXES CLUB sells software to people who run live events,
and it is judged on whether tonight's numbers agree. Crativo is a record of what
was built and why — a different audience, a different standard, and a different
owner. Hence a separate organisation here too.

---

## What is in this space

| Page | What it covers |
| --- | --- |
| [[The site]] | How crativo.xyz is put together, and what it costs to run |
| [[Apps]] | Whole applications: macOS tools, room booking, ticketing |
| [[Tools]] | CLIs and utilities that do one job properly |
| [[Libraries]] | Reusable React and macOS components |
| [[Kiosks]] | Touchscreen software for retail floors |
| [[The writing]] | Ninety-odd posts, and what they are actually about |
| [[How the work is organised]] | Naming, versioning, and why Crativo is separate |

## The one overlap worth naming

Two projects appear both here and in AXXES CLUB:

- **afters** — built as a personal ticketing experiment, now the ticketing
  product at [afters.am](https://afters.am).
- **Qortr** — built as a personal booking app, now sold as
  [Rooms](https://qortr.axxes.club).

Both kept their name, their stack and their history when they moved under the
AXXES brand. That is the test applied to every project here: moving it should
not require pretending it was built differently.`,
  },
  {
    title: "The site",
    icon: "🌐",
    content: `crativo.xyz is a Next.js 16 app on the App Router, React 19, Tailwind
4 and TypeScript, deployed to Vercel.

## Shape

| Route | What it is |
| --- | --- |
| \`/\` | Project grid with category filtering and an animated intro |
| \`/projects/[id]\` | One project, long form, from \`src/data/projects.ts\` |
| \`/blog\` | Post index, filtered by category |
| \`/blog/[slug]\` | A post, rendered from \`content/blog/\` |
| \`/about\` \`/apps\` \`/videos\` \`/contact\` | Static pages |
| \`/admin/*\` | Comment moderation, gated by \`ADMIN_KEY\` |

## The two things that are genuinely unusual

**The splash is two different things.** Desktop plays a Remotion composition
through \`@remotion/player\`; mobile gets an iOS call-style splash instead,
because a video intro on a phone is a tax on the reader. \`SplashContext\` tracks
whether it has already played in \`sessionSessionStorage\`, so it is once per
visit and not once per page.

**Comments are self-hosted and moderated after the fact.** They post immediately
as \`approved\` and are taken down later if they should be. The guards are a
honeypot field, a three-per-minute per-IP limit and duplicate detection; replies
nest to a fixed depth and a removed comment with replies leaves a tombstone so
the thread underneath survives. Backed by Neon, alongside the newsletter and the
carbon ads.

## What it runs on

Neon Postgres, Resend for the contact form, Twilio for the SMS that follows it,
Remotion for the intro, Microsoft Clarity for analytics. Secrets are read from
the environment; \`ADMIN_KEY\` gates \`/admin\` and every \`/api/admin/*\` route.

The blog is \`content/blog/*.md\` with frontmatter, parsed by \`gray-matter\`.
Ninety published posts and twenty-two drafts. The drafts are kept in the repo
because an unpublished post is still writing, and writing is worth keeping.`,
  },
  {
    title: "Apps",
    icon: "📱",
    content: `Whole applications — things with a user interface and an opinion.

## macOS

**BetterBar** — a dock alternative. Brutalist terminal aesthetic, native
performance, no web view in the critical path.

**FLX2 Status Overlay** — an always-on-top window that reads the AlphaTheta
DDJ-FLX2's active pad mode per deck, with a live legend. It exists because
answering that question should not require remembering a colour chart in a dark
booth.

**MTMR Designer** — a visual drag-and-drop designer for MacBook TouchBar
presets. It exists to remove JSON editing from a task that had no business
involving JSON.

**floatnote** — a transparent, always-on-top drawing and note-taking overlay, with
annotation tools.

**DUALPLAYER** — a CDJ-3000-styled fullscreen companion display for djay Pro,
driven by the player's own state.

## Web

**Qortr** — room and venue booking with interactive maps and flexible pricing.
The repo is still named \`qortr\`; the product is **Rooms**, in AXXES CLUB.

**afters** — event ticketing built for the underground rather than for a
corporate buyer. The repo is \`axxes-club/afters\`; the product is
**afters.am**, in AXXES CLUB.

**Donkeygame** — a retro shooter where you purify zombified donkeys into rainbow
unicorns with the Bio-Gaster. It is the oldest joke in the portfolio and it
stayed in.

## Work

**SnapTask** — mobile-first task management with real-time messaging and push.

**Innovation Portal** — internal idea submission and tracking, from pilot to
production, built for Retail Business Services.

**Zeebra** — z-index management with virtual z-stack recycling, for the case
where a UI genuinely needs layers rather than a portal.`,
  },
  {
    title: "Tools",
    icon: "🛠️",
    content: `Utilities that do one thing and get out of the way.

**git-drive** — turns any external drive into a git remote, so a backup of your
code is a drive and a \`git push\`. CLI plus a web UI, no cloud involved. Written
because trusting a backup to a sync folder is trusting it to a company.

**pubsafe** — checks a project for files that are sensitive and not gitignored.
The failure it prevents is the one that ends up in a public repository's history
forever, which is to say: it cannot be undone by deleting the file later.

**PROJAX** — a dashboard for managing local development projects across stacks.
It knows what is running, on what port, and why.

**ace** — a Node CLI for scaffolding React applications, views and components.

**FLX2 Status Overlay** and **MTMR Designer** live under [[Apps]]; they have
interfaces, and a window is an interface.

There is a Homebrew tap — \`homebrew-josetunes\` and \`homebrew-betterbar\` — so
the two tools that install can be installed by the thing that installs tools.`,
  },
  {
    title: "Libraries",
    icon: "📦",
    content: `Reusable pieces, published to be used rather than admired.

**toolbench** — development utilities for React: console helpers and debugging
tools that are meant to be left in.

**too-bored** — a configurable virtual keyboard component, built for retail
kiosks where a hardware keyboard is a liability and a shopper should be able to
reach anything on screen.

**gappa-comments** — a responsive, configurable threaded comment component with
user tagging. The threading and the tagging are the point; the styling is
somebody else's problem.

**zeebra** — z-index management with virtual z-stack recycling, for complex
layering. Published because the problem is real and the solution is not obvious.

**floatnote** — the transparent macOS overlay, packaged as a library rather than
only an app, so another tool can borrow the annotation layer.`,
  },
  {
    title: "Kiosks",
    icon: "🏪",
    content: `Touchscreen software for retail floors. This is the oldest part of the
portfolio and the least glamorous, and it is where most of the kiosk experience
comes from.

**Stop & Shop Kiosk** — interactive kiosk software for grocery stores: product
lookup, a voice-driven shopping list, and in-store navigation. Built for a
touchscreen used by someone with one hand and a child.

**TicketCloud** — a support ticket system, notable as the first application
written for the MiPortal online operating system.

The two libraries that exist because of this work are the virtual keyboard and
the comment thread in [[Libraries]]. Both are
generic now, and both were written twice first.`,
  },
  {
    title: "The writing",
    icon: "✍️",
    content: `About ninety published posts and twenty-two drafts in
\`content/blog/\`, with frontmatter for title, excerpt, category, date, tags and
an optional cover.

## What gets written about

The posts are mostly about things that turned out to be more complicated than the
documentation implied. The honest examples:

- **AI tooling, assessed rather than adopted** — what it actually saved, what it
  cost, and where it made the code worse. There are several of these and they do
  not all reach the same conclusion, which is the point.
- **CSS features that removed a dependency** — container queries, \`:has()\`,
  anchor positioning, scroll-driven animations, \`@scope\`. Each one is written as
  "this replaced a library we were about to install".
- **Desktop apps** — building them with Tauri, and what the web platform can and
  cannot do for them.
- **Terminal UIs** — Ink, and why a CLI sometimes should have a display.
- **Production incidents** — debugging at 3am, written afterwards, which is the
  only time it is useful.
- **Security reality** — checking a CISA KEV catalogue, and the habit it should
  produce.

## Categories

\`tutorials\`, \`thoughts\`, \`devtools\`. They are a filing convenience, not an
argument, and a post that does not fit is filed under the closest one.

## Why drafts are in the repository

Because an unwritten post is a thought, and a thought you had to have again next
month is a post you will write worse next month.`,
  },
  {
    title: "How the work is organised",
    icon: "🧭",
    content: `The conventions, so that a new project does not need a new argument.

## Naming

A project keeps the name it was given. If it later becomes a product, the repo
name and the product name are allowed to diverge, and both are recorded rather
than reconciled: \`qortr\` is the repo, **Rooms** is the product. Renaming the
repository to match a marketing decision loses the history of what it was
actually called while it was being built.

## What decides whether a project moves under AXXES

Not how good it is. Three questions:

1. Does it need to read another product's records to be correct?
2. Does it need to share a sign-in session with the rest of the suite?
3. Would selling it alongside the suite be honest?

**afters** and **Qortr** pass all three, so they are AXXES products that also
appear in the portfolio, because that is what happened. Everything else here is
standalone and stays that way.

## Versioning and deploys

Individual projects carry their own conventions. One rule is shared across the
AXXES repos because it bit us: **the commit author must be \`viscasillas@me.com\`
or the Vercel deploy is refused.** That is enforced by the deploy pipeline, not
by discipline, which is the only kind of rule that survives a deadline.

## Why Crativo is a separate organisation

Because the two are answerable to different questions. AXXES is asked "does this
number agree with the next number". Crativo is asked "what was built, and was it
worth it". A page that tries to serve both is worse at both, so the
organisations are separate, and the two projects that genuinely span them are
named in both places on purpose.`,
  },
]
