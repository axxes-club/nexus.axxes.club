// The Rooms space, as a single importable definition.
//
// Rooms is the room-booking product. The repo is `qortr` and the catalog key is
// `qortr`, while the display name is **Rooms** — the second clearest example of
// the permanent-key / changeable-name rule, after Stock/manifest.
//
// This space is deliberately blunt about the repository's README, which describes
// a Clerk prototype with mock data while the code has moved on considerably. Both
// states are recorded, because a reader who trusts the README would be misled.

const TENANT_SLUG = "axxes-club-CgWei8"
export { TENANT_SLUG }

export const SPACE = {
  name: "Rooms",
  icon: "🚪",
  description:
    "Room and venue booking with interactive maps and flexible pricing, sold into the suite and reconciling against the same ledger as everything else.",
}

export const PAGES = [
  {
    title: "Rooms",
    icon: "🚪",
    content: `Rooms is the room-booking product. Live at
[qortr.axxes.club](https://qortr.axxes.club), catalog key \`qortr\`, status
**beta**.

*Book rooms and venues with interactive maps and flexible pricing, so the calendar
and the till agree.*

---

## What is in this space

| Page | What it covers |
| --- | --- |
| [[Booking a room]] | Spaces, availability, reservations, the calendar |
| [[Pricing and money]] | Deposits, orders, Stripe, and the iCal export |
| [[Accounts and AXXES sign-in]] | NextAuth, Clerk sync, and joining the suite |
| [[How Rooms is built]] | The schema, the tests, and what the README gets wrong |
| [[Rooms — what is not finished]] | The honest gaps |

## The name

The repository is \`qortr\`. The product is **Rooms**. The key is \`qortr\`.

Stock is the same pattern with \`manifest\`: the key is referenced by the plan
catalog, the OIDC registry and the integrations providers, so it never changes;
the name is free to be whatever sells. See [[The AXXES catalog]].

It also began life as a personal project — it is in the
[portfolio](https://crativo.xyz) as **Qortr**, under the name it was built with.
Moving it under AXXES did not require renaming the repository, which is the test
applied to every project: a move should not require pretending it was built
differently.

## The pitch

The original README positions it as *"designed to disrupt AllBooked by Skedda"*
— unlimited spaces, interactive maps and flexible pricing at a fraction of the
cost. That is a real gap in the market and it is what the product is for. The
suite adds the part the incumbents never had to think about: the booking has to
reconcile against the same numbers as everything else the business sells. See
[[AXXES]].`,
  },
  {
    title: "Booking a room",
    icon: "📅",
    content: `The booking surface.

## Spaces and organisations

A booking is always made **by an organisation, against a space** in it. The
schema is explicit about this (\`Organization\`, \`OrganizationMembership\`,
\`Room\`, \`Booking\`) and it is the right shape: rooms are inventory that an
organisation owns, and a booking that does not name the owner cannot be
reconciled against anything.

\`src/lib/organizations.ts\` is where that ownership is decided.

## Availability and the calendar

\`src/lib/ical.ts\` and the booking calendar component. The calendar is a real
feature rather than a table: a room that cannot be seen is a room that cannot be
booked, and room availability is a scheduling problem before it is a payments
problem. See [[Booking a room]]'s tests in [[How Rooms is built]].

## QR codes on the room

\`qr.ts\` and \`qr-templates.ts\`, with \`@types/qrcode\` and \`qrcode\` in the
dependencies. A booking produces a code; the code is the thing the person in the
room actually needs, and it is printed rather than emailed. There is a vendor
guide in \`docs/QR_STICKER_VENDORS.md\`, which is a good sign — the sticker is
the product surface, so where it is printed matters.

## Dashboards

Booking management, favourites, calendar, QR codes, and an admin area for
organisations and bookings. Notifications, profile, public profile, preferences,
branding and API keys round out the settings screens.

That is a lot of surface, and it is worth being clear that **a wide surface is
not the same as depth in any of it** — see [[Rooms — what is not finished]].`,
  },
  {
    title: "Pricing and money",
    icon: "💳",
    content: `Where the booking becomes a transaction, and where the reconciliation
promise has to hold.

## Orders and line items

\`Order\` and \`OrderItem\` exist alongside \`Booking\`, which is the correct
separation: a booking is a reservation of a room, an order is money changing
hands. Conflating them is the reason booking systems become hard to refund.

## Deposits

A booking can take a deposit rather than full payment, which is how a room is
actually sold in practice. A deposit model is a real feature and also a real
source of disputes — what happens to it when the booking is cancelled, moved, or
never happened.

## Stripe

\`stripe.ts\`, \`@stripe/stripe-js\`, and \`svix\` for webhooks. Connected to the
same Stripe account model as the rest of the suite.

## The point of putting it in the suite

Tollbooth already exists and already knows how to move money for a merchant —
hosted checkout, signed webhooks, payouts to a bank account. What Rooms needs is
for a booking to **become a Tollbooth transaction**, so that a room booking is
visible in the same ledger as a ticket and a product sale.

**That link is not built.** Rooms has its own Stripe integration rather than
routing through [[Tollbooth]], which means a room booking and a ticket sale are
two payment paths that have to be reconciled by hand at closing time — the exact
failure this suite exists to prevent, reproduced inside the suite. It is listed
as a gap on [[Rooms — what is not finished]] because it is the most important
thing on that page.

## iCal export

Bookings export to iCal. Small feature, disproportionate value: it is what makes
a room appear in the organiser's existing calendar instead of becoming a second
thing to remember.`,
  },
  {
    title: "Accounts and AXXES sign-in",
    icon: "🔑",
    content: `Rooms is the product that most needed to join the suite, and the history of
that is in the repository.

## Where it started

NextAuth with email and password, then Clerk alongside it. The SSO design note
(\`docs/axxes-sso-handshake.md\`, marked **DESIGN v0.1**) records the problem
honestly: every AXXES product had its own user base, and a members.axxes.club
user should be able to enter any product without creating a second account.

The table in that document is the clearest inventory of the problem — members on
Clerk, afters on Clerk, qortr on NextAuth, and everything else *"varies"*.

## What actually shipped

Handshake, and Rooms merged into it. The last three commits in the repository
are the whole story:

- \`fix(auth): authenticate the client on the token exchange\`
- \`fix(auth): name the step that failed instead of showing one error for six\`
- \`fix(auth): let AXXES members merge into their Qortr account instead of hitting a wall\`

That third one is the real work. An AXXES member arriving at Rooms has to end up
with *one* account, not two, and not an error page. **Merging is harder than
authenticating**: the identity is shared but the rows are not, and a product that
gives an existing member a new account has quietly created the fragmentation the
SSO work was meant to remove.

\`clerk-sync.ts\` and \`axxes.ts\` are where this lives, and \`src/__tests__/lib/axxes.test.ts\`
is the test file for it.

## The second commit is the better lesson

*"name the step that failed instead of showing one error for six"*. A token
exchange has several steps — authorize, exchange, verify, sync, create session —
and reporting all of them as one error makes it impossible to tell which one
broke. That fix is worth more than it looks.

## Where it stands

Rooms accepts the suite session. Whether the merge is robust for every path —
a member who was already a Rooms user under a different email, two concurrent
first logins, a revoked session mid-exchange — is not established, and is on
[[Rooms — what is not finished]].`,
  },
  {
    title: "How Rooms is built",
    icon: "🧱",
    content: `The stack and the schema, and a warning about the README.

## Stack

Next.js 16, React 19, TypeScript, Tailwind. Prisma against Postgres.
\`@auth/prisma-adapter\` with NextAuth. \`bcryptjs\` for the original
email/password path. \`react-virtuoso\` for list virtualisation, \`date-fns\` for
dates, \`resend\` for mail, \`uploadthing\` for images, \`qrcode\` for codes, Stripe
and \`svix\` for payments and webhooks.

## The schema

Fifteen models, which is the real measure of the product's scope:

\`\`\`
Organization        Room                 Booking
User                Account              Session
OrganizationMembership                   VerificationToken
Favorite            ApiKey               Webhook
WebhookLog          ApiUsage             GhostAuditLog
Order               OrderItem            Location
PasswordResetToken
\`\`\`

Those are not fifteen token models. \`GhostAuditLog\` and \`Location\` in a
room-booking schema are the interesting ones — a ghost audit log implies deleted
or anonymous bookings are still accounted for, which is the same instinct as
Keel's drawer. See [[Keel]].

## Tests

Five files under \`src/__tests__\`: \`lib/db\`, \`lib/utils\`, \`lib/validation\`,
\`lib/axxes\` (the SSO merge), and \`components/BookingCalendar\`. The calendar
having its own component test is a good sign — it is the part with the most
logic and the least obvious behaviour.

## The README is out of date

**The README says the database is "Mock data (ready for Supabase integration)"
and that authentication is Clerk-based with interactive maps and Stripe listed as
*not yet implemented*.**

None of that is true any more. There is a real Postgres schema with fifteen
models, two migrations and a seed; authentication went NextAuth → Clerk →
Handshake; Stripe is wired; and the interactive maps and dashboard screens are
present as routes.

This page records the drift rather than quietly correcting it, because the README
is what a developer reads first. It is the same class of problem as
[[Builders — what is not finished]] finding a README that describes intended
endpoints: **documentation that was accurate once and never retired is worse than
no documentation**, because it is trusted.

## Planning material

\`.planning/\` holds the requirements, project state, and research notes, and
\`.planning/quick/\` has per-task plans with summaries. There is also
\`krates-cline-brief.md\` and \`requirements_ai.md\`. Substantial working
documentation — some of which is now itself out of date.`,
  },
  {
    title: "Rooms — what is not finished",
    icon: "⚠️",
    content: `The gaps, as gaps. Rooms is **beta**, and these are the reasons.

## The money is not reconciled with the rest of the suite

Rooms takes payments through **its own** Stripe integration rather than through
[[Tollbooth]].

That is the most important line on this page. The suite's entire positioning is
that tickets, stock, money, doors and rooms sit on one ledger — and rooms, the
product added to that sentence, is the one that does not. A room booking and a
ticket sale are two payment paths that somebody has to reconcile by hand at
closing time.

The fix is not exotic: the booking becomes a Tollbooth transaction, and both land
in one place. It is simply not done, and a beta product that does not yet honour
the company promise should say so rather than imply otherwise. See
[[Pricing and money]].

## Interactive floor maps

The pitch leads with "interactive maps". The README once listed them as a future
feature, and while the dashboard and QR routes exist, **the map that makes the
pitch true is not the strongest part of the product today.** That is a
positioning problem as much as a missing feature: the claim is ahead of the
build.

## No reconciliation view

The same gap as [[afters]]. What sold, what came through the door, what landed in
the bank — one page. For a booking product the equivalent is what is booked, what
was used, what was paid, what was refunded. It does not exist.

## Deposit disputes are undefined

Deposits are supported. What happens to one when a booking is cancelled, moved or
never used is not written down anywhere in the repository. Deposits are where
booking systems generate support load, and this is the case most likely to
generate it.

## The account merge is new and barely tested

Rooms only recently learned to merge an AXXES member into an existing Rooms
account. \`axxes.test.ts\` exists, but a merge is a correctness problem with a
long tail — different emails, concurrent first logins, a session revoked
mid-exchange, an account that was merged and then unmerged. None of that is
written down, and "it merged once in production" is not evidence.

## The README misleads

See [[How Rooms is built]]. Mock data, Supabase, and a "not yet implemented"
list that no longer describes the product. Cheap to fix, actively harmful while
unfixed, and the kind of drift that is easiest to fix the day it is noticed.`,
  },
]
