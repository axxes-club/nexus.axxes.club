// The afters.am space, as a single importable definition.
//
// afters is the suite's ticketing product and the one that carries the
// reconciliation promise furthest: the door count has to match the sales count.
// Facts here are taken from the repository (README, HISTORY, package.json and
// the source tree), not from the marketing copy.
//
// Titles must be unique across the whole AXXES CLUB organisation, because Nexus
// resolves [[wiki links]] by title within a tenant. "Data model" already exists
// in both the Matter and Tollbooth spaces — a pre-existing collision that the
// importer refuses to add to — so this space avoids the obvious shared names.

const TENANT_SLUG = "axxes-club-CgWei8"
export { TENANT_SLUG }

export const SPACE = {
  name: "afters",
  icon: "🎟️",
  description:
    "Event ticketing for the underground: tiers, capacity, scanning and payouts, with Vibez riding along so the photos land on the right event.",
}

export const PAGES = [
  {
    title: "afters",
    icon: "🎟️",
    content: `afters is the ticketing product. Live at [afters.am](https://afters.am),
catalog key \`afters\`, status **live**.

It is the oldest product in the suite and the one that decides whether the
positioning is true, because a ticket is the first number an operator ever has
to reconcile. The door count has to match the sales count; if it does not, nothing
downstream can be believed.

---

## What is in this space

| Page | What it covers |
| --- | --- |
| [[Selling the night]] | Tiers, capacity, RSVPs, waitlists, recurring series |
| [[The door]] | Scanning, offline mode, and what happens when the internet drops |
| [[Vibez inside afters]] | How the photobooth feature was actually broken, and all four causes |
| [[Money and payouts]] | Stripe Connect, instant payouts, and the fees |
| [[How afters is built]] | The stack, the tests, and the data model |
| [[afters — what is not finished]] | The honest gaps |

## The one-line pitch

*Sell the night, run the door.* The product exists to make those two numbers the
same number.

## Where it sits in the suite

- A sale is a movement in [[Stock|manifest.axxes.club]] and a line in
  [[Tollbooth]], because they are rows in one database rather than three systems
  somebody reconciles by hand at closing time.
- [[Vibez]] is embedded in the event page, not bolted on beside it.
- The catalog row is the source of truth; see [[The AXXES catalog]].`,
  },
  {
    title: "Selling the night",
    icon: "💰",
    content: `The ticketing surface, from the README's own feature list.

\`\`\`
TICKETING     tiered pricing · capacity limits · hidden venues
RSVP          free events · plus-ones · waitlists
SCANNER       qr check-in · offline mode · real-time stats
RECURRING     series templates · bulk generation · smart updates
PAYMENTS      stripe connect · instant payouts · transparent fees
AI ASSISTANT  natural language event creation · analytics · flyer generation
\`\`\`

## Tiers and capacity

A ticket type carries a price and a quantity, and capacity is enforced against
the sum rather than against a counter that can drift. That is the whole job:
**do not sell a hundred and forty tickets into a room that holds a hundred.**

## Hidden venues

The venue is not always published. Some events are announced by link only, and a
public listing is an opt-out per event rather than a global setting — which is
the difference between an underground listing and a warehouse party.

## Recurring series

Series templates generate a run of events, and **smart updates** propagate a
change to the instances that have not yet diverged. This is the feature most
likely to be wrong in an interesting way: a series is one intention expressed
many times, and a change to one past event must not rewrite history.

## The AI assistant

Natural-language event creation, analytics, and flyer generation, on Groq. It is
marketed as part of the product and treated here as a feature, not as the
positioning — see [[AXXES]].`,
  },
  {
    title: "The door",
    icon: "🚪",
    content: `Scanning is where a ticketing product is either correct or a nuisance,
because it runs in a dark room, on a phone, with a queue behind it.

## Offline mode

The scanner works without a connection and reconciles when it gets one. This is
not a nice-to-have: a basement venue has a bar, a concrete ceiling and no signal,
and a scanner that stops working at the door is a scanner that stops being used.

## Real-time stats

While the door is open, the numbers are visible: sold, admitted, and the gap
between them. **The gap is the product.** A promoter who can see admissions
running ahead of sales learns about it tonight; one who reconciles in the morning
learns about it too late.

## Guest access

Most people buying a ticket never make an account. The feed and the order
history therefore work for guests via a **signed token** rather than behind a
sign-in wall. See [[Vibez inside afters]] for what that looked like when it was
wrong.

## A real bug worth remembering

The order confirmation page was behind Clerk authentication since launch, so a
guest who bought a ticket got a **404** on the page that tells them they have
bought a ticket. The fix was a signed token from checkout, with signed-in buyers
still able to view their own orders without one.

The same release fixed \`/demo\` and \`/developers\` returning 404 — a dashboard
route matcher matching any path beginning with \`/d\`. Two of the three 404s in
one release came from the same class of mistake: a route that matches more than
it looks like it matches.`,
  },
  {
    title: "Vibez inside afters",
    icon: "📸",
    content: `The photobooth feature inside afters was not "not quite baked in". It had a
defect at every layer, and the visible symptom sat on top of four independent
causes. This page exists because the diagnosis is more useful than the fix.

| Defect | Effect | Fix |
| --- | --- | --- |
| Required a Clerk session | Locked out the people most likely to be there. Most people buy a ticket as a guest and never make an account, so the feed served the wrong audience. | A guest redeems their ticket for a signed token (\`src/lib/vibez-guest.ts\`) and is a first-class attendee. Access is keyed on a \`subject\` — a Clerk id or \`tkt_<id>\` — not on an account. |
| No camera at all | The app's entire premise is a night-flash photobooth. It shipped a file input, which nobody uses in a dark room. | Ported the reference camera and grade from \`vibez.axxes.club\`. \`src/lib/vibez-flash.ts\` is byte-identical on purpose. |
| Upload tickets could be forged | \`secret()\` walked a fallback chain and ended at \`""\` — a constant. With no secret configured, anyone could mint a valid upload ticket for any event. | Fails closed. A missing secret means no ticket, loudly. Two regression tests cover it. |
| Silent failures in the dark | A camera permission prompt, in a room, is a dead end. | The flash camera and the post flow were rebuilt for the review/post stages with captions. |

## The lesson, stated plainly

Three of the four causes were the same mistake: **a fallback that resolves to a
harmless-looking empty value.** An empty string secret, a file input instead of a
camera, a sign-in wall that is technically correct and practically fatal. Each one
looked like a reasonable default in isolation and none of them announced itself.

The byte-identical file is the other lesson. When the same code is needed in two
places, copying it and saying so in a comment beats an abstraction that hides
which copy you are running.

## Why this is on the afters page

Because it is the clearest example in the portfolio of a feature that was
*shipped* and still did not work, and of the difference between "the feature is
nearly done" and "the feature has a defect at every layer". See
[[afters — what is not finished]].`,
  },
  {
    title: "Money and payouts",
    icon: "💳",
    content: `Payments in afters run through Stripe Connect, with instant payouts and
fees that are visible rather than described.

## Connect, not platform accounts

Each organiser connects their own account. afters never holds a balance on
someone else's behalf, which is the difference between a ticketing product and a
wallet.

## Instant payouts

A promoter who sells out on Saturday night should not wait for a banking cycle to
know the money is theirs. This is a direct consequence of the positioning: the
reconciliation the operator is doing at 2am includes the payout.

## Transparent fees

The fee is shown before the purchase, not discovered in a statement. A
transparent fee is part of the promise that the numbers reconcile — an
unexplained fee is a number that does not agree with anything.

## The reconciliation chain

A sale in afters is simultaneously:

- a row in the event's ticket ledger here,
- a stock movement in [[Stock|manifest]], if the event sells merchandise,
- a line in [[Tollbooth]], if the checkout runs through the suite's gateway.

One database, so the three are the same transaction rather than three
reconciliations. See [[Commerce — money and stock]].

## The API equivalent

The same primitives are available over HTTP for anyone building on top of
afters rather than using it. See [[AXXES for Builders]].`,
  },
  {
    title: "How afters is built",
    icon: "🧱",
    content: `The shape of the thing, for anyone changing it.

## Stack

Next.js on the App Router, React, TypeScript, Tailwind. Prisma against Postgres
via the Neon serverless driver. Clerk for authentication — note that this predates
[[Handshake]] and is a known inconsistency, see [[afters — what is not finished]].

The rest of the dependencies describe the feature list honestly rather than
tidy: \`stripe\` and \`@stripe/react-stripe-js\` for payments, \`qrcode\` and
\`@yudiel/react-qr-scanner\` for the door, \`rrule\` for recurring series,
\`svix\` for webhooks, \`resend\` and \`nodemailer\` for mail, \`uploadthing\` and
\`@react-pdf/renderer\` for assets and passes, \`@ai-sdk/groq\` for the assistant,
\`html2canvas\` for capture, and \`ws\` for the live feed.

## Data access

Prisma with \`@prisma/adapter-neon\`. **Every AXXES product shares one database**,
so the tables afters owns are the point of contention. This is the suite's central
architectural bargain: one account, one database, one session, and in exchange
every product must namespace its own tables.

## Tests

Nineteen unit/integration files under Vitest, and six Playwright specs for the
end-to-end path. Vitest is the default; \`npm run test:e2e\` is separate because it
needs a browser and a running server.

There is a Docker Compose setup (\`docker compose up\`) with a dedicated MCP
profile, so the app can be run and driven without a local Node install getting in
the way.

## Run it

\`\`\`bash
git clone https://github.com/axxes-club/afters.git
cd afters
cp docker/.env.docker.example docker/.env.docker   # edit with your keys
docker compose up
\`\`\`

Then localhost:3000. Documentation is published at
[axxes-club.github.io/afters](https://axxes-club.github.io/afters/).`,
  },
  {
    title: "afters — what is not finished",
    icon: "⚠️",
    content: `The gaps, stated as gaps. Anything here is a decision or missing data, not
a surprise discovered later.

## Authentication is not the suite's

afters uses **Clerk**. The rest of the suite signs in through
[[Handshake|handshake.axxes.club]] on a shared \`BETTER_AUTH_SECRET\`. This is
the single most consequential inconsistency in the product, and it is why
[[Vibez inside afters]] had to invent a guest path: a Clerk session is not a
Handshake session, so the two cannot be joined by an ordinary account lookup.

The suite convention — every app accepts the same session — is a stated
prerequisite, not a nice-to-have. See [[AXXES]].

## The AI assistant is a feature, not a strategy

Natural-language event creation and flyer generation are genuinely useful and
also the most likely thing to be mistaken for the product's value. The product's
value is that the door count matches the sales count; the assistant does not
contribute to that.

## Recurring series propagate changes, and that is a risk

**Smart updates** rewrite future instances of a series. A template that is right
for a run of twelve shows the thirteenth to someone who did not expect it. The
"has not diverged" rule is the right instinct and needs real edge cases written
down before it is trusted.

## There is no reconciliation report

The promise is that the numbers agree. The product enforces capacity, shows
admissions in real time, and moves the money correctly — but the artefact a
promoter would actually want at closing time, one page that says what sold, what
came through the door and what landed in the bank, is not built. This is the gap
between the positioning and the product, and it is the most important one on
this page.

## Untested at the edges

Nineteen unit files against the size of the feature list is thin. Payment
refunds, ticket transfers and partial refunds are the paths where a bug costs
real money, and they are the paths most likely to be under-covered.`,
  },
]
