// The AXXES for Builders space, as a single importable definition.
//
// api.axxes.club is the suite's public REST API — the surface a developer builds
// against rather than the portal they log into. The display name is "AXXES for
// Builders" because the catalog renamed `api` away from "AXXES API"; the repo,
// the base URL and the key prefix are all still `api`. See [[AXXES]] for why the
// key is never renamed.

const TENANT_SLUG = "axxes-club-CgWei8"
export { TENANT_SLUG }

export const SPACE = {
  name: "AXXES for Builders",
  icon: "🛠️",
  description:
    "The public REST API for ticketing: keys, resources, idempotency, signed webhooks and the errors every endpoint shares.",
}

export const PAGES = [
  {
    title: "AXXES for Builders",
    icon: "🛠️",
    content: `AXXES for Builders is the ticketing API at
[api.axxes.club](https://api.axxes.club). Catalog key \`api\`, status **live**.

It is a separate product from **AXXES Developers** (\`developer.axxes.club\`) and
the two are deliberately not merged. One is the API you call; the other is the
portal where you register an app, get a key and read the plan catalog. They
happen to both be developer tools, which is exactly the sort of overlap that
looks like duplication right up until someone needs a different permission model
for each. See [[Developers — building on AXXES]].

---

## What is in this space

| Page | What it covers |
| --- | --- |
| [[Keys and modes]] | The four key types, and how test and live are kept apart |
| [[The resources]] | Events, ticket types, orders, tickets — and what the schema holds |
| [[Idempotency and errors]] | The header, the retry story, and the five error types |
| [[Webhook events]] | The seven events and what a consumer does with them |
| [[Builders — what is not finished]] | The honest gaps |

## The pitch, and the caveat

The old tagline was **"The Stripe of Ticketing"**. It is a comparison to a
company with a hundred times the headcount, and on brand alone that comparison is
lost. The catalog copy was rewritten to the reconciliation promise instead. The
ambition is unchanged; the claim is one we can actually keep. See
[[Brand and messaging]].

## Where the records come from

Every object the API returns is a row in the shared AXXES database. An event
created here is the same row the portal shows, and the same row that appears in
[[afters]]'s ledger — not a copy synchronised later. That is the suite's central
bargain, and it is why there is no connector to build and nothing to fall out of
sync.`,
  },
  {
    title: "Keys and modes",
    icon: "🔑",
    content: `Authentication is a bearer key, and the key itself carries the mode.

## Key types

| Prefix | Type | Use |
| --- | --- | --- |
| \`pk_test_\` | Publishable, test | Client-side, test mode |
| \`sk_test_\` | Secret, test | Server-side, test mode |
| \`pk_live_\` | Publishable, live | Client-side, live mode |
| \`sk_live_\` | Secret, live | Server-side, live mode |

The prefix is not decoration. A test key is *structurally* unable to touch live
data, so "did I remember to switch keys" is answered by the credential rather
than by discipline. This is the same idea as [[Tollbooth]]'s rule that the mode
lives in the key, applied independently in two products.

## The three server-side types

The schema distinguishes more than the prefixes do:

\`\`\`
PUBLISHABLE  safe for a browser
SECRET      full access, server only
RESTRICTED  scoped to less than the account
\`\`\`

A restricted key is the one worth reaching for first. Most integrations do not
need to create events, and a credential that cannot create events is a smaller
thing to leak.

## Two ways to send it

\`\`\`bash
# Bearer token (recommended)
curl https://api.axxes.club/v1/events -H "Authorization: Bearer sk_test_xxx"

# Query parameter
curl "https://api.axxes.club/v1/events?api_key=sk_test_xxx"
\`\`\`

The header is recommended and the query parameter exists. A query parameter ends
up in proxy logs, in \`Referer\` headers and in browser history, so a secret key
sent that way is a key that has leaked — the parameter form is for publishable
keys.

## Rate limits

| Mode | Limit |
| --- | --- |
| Test | 20 requests/second |
| Live | 100 requests/second |

The test limit is lower, which is correct: a loop that is hammering the test API
is a bug worth catching early, and nobody is being billed for it.`,
  },
  {
    title: "The resources",
    icon: "📚",
    content: `Six resources carry the whole model, and the Prisma schema is the authority
on their fields.

## Events

\`EventStatus\`: \`DRAFT\` → \`PUBLISHED\` → \`CANCELLED\` or \`COMPLETED\`. Publishing
is a separate call, not a field update, which is what makes "an event that
somebody could see" a state you can reason about.

\`\`\`bash
curl -X POST https://api.axxes.club/v1/events \\
  -H "Authorization: Bearer sk_test_xxx" -H "Content-Type: application/json" \\
  -d '{"name":"Summer Festival 2024","starts_at":1720310400,
       "venue_name":"Central Park","city":"New York"}'
\`\`\`

## Ticket types

Price and quantity, attached to an event. Capacity is enforced against ticket
types rather than a free-floating counter — the same rule that makes
[[afters]]'s capacity honest.

\`\`\`bash
curl -X POST https://api.axxes.club/v1/ticket_types \\
  -H "Authorization: Bearer sk_test_xxx" -H "Content-Type: application/json" \\
  -d '{"event":"evt_xxx","name":"General Admission","price":5000,"quantity":1000}'
\`\`\`

Prices are integers in the smallest currency unit. 5000 is fifty units, and
storing it that way means no rounding decision is ever made twice.

## Orders and the pay step

An order is a basket, not a sale. **Marking it paid is a separate call that
generates the tickets**, so a payment and the tickets it buys are separate
events with a step between them.

\`OrderStatus\`: \`PENDING\`, \`PAID\`, \`REFUNDED\`, \`PARTIALLY_REFUNDED\`,
\`CANCELLED\`, \`EXPIRED\`. Tickets are only issued on \`PAID\`.

## Tickets and the door

\`TicketStatus\`: \`VALID\`, \`CHECKED_IN\`, \`CANCELLED\`, \`REFUNDED\`,
\`TRANSFERRED\`. Check-in is its own endpoint, so "admitted" is a fact with a
timestamp rather than an inference.

## The supporting tables

\`Customer\`, \`Scanner\`, \`ScanLog\`, \`WebhookEndpoint\`, \`WebhookDelivery\`,
\`RequestLog\`, \`ApiKey\`, \`Account\`.

Two of those are worth naming. **ScanLog** is the door: a scan is recorded
whether or not it succeeded, so "admitted" and "refused" are both countable.
**RequestLog** exists because an API that cannot show you what it received cannot
be debugged by the person integrating against it.`,
  },
  {
    title: "Idempotency and errors",
    icon: "🧷",
    content: `Two conventions that every endpoint shares, and that make the difference
between an API you can retry and one you cannot.

## Idempotency

Every \`POST\`, \`PUT\` and \`PATCH\` accepts an \`Idempotency-Key\` header:

\`\`\`bash
curl -X POST https://api.axxes.club/v1/orders \\
  -H "Authorization: Bearer sk_test_xxx" \\
  -H "Idempotency-Key: unique-request-id" \\
  -H "Content-Type: application/json" -d '{ ... }'
\`\`\`

This matters more here than in most APIs, because a retried order is a **second
charge**. A network timeout on \`POST /orders\` leaves the caller unable to tell
whether the first attempt succeeded; without a key, the safe response is "do not
retry", which means a dropped connection becomes a lost sale. With one, the retry
is free.

It is applied as middleware (\`src/middleware/idempotency.ts\`), not per-route,
so it cannot be forgotten on the next endpoint somebody adds.

## The error shape

One shape, everywhere:

\`\`\`json
{
  "error": {
    "type": "invalid_request_error",
    "code": "resource_not_found",
    "message": "Event not found",
    "param": "event",
    "doc_url": "https://docs.axxes.club/errors/resource_not_found"
  }
}
\`\`\`

\`param\` names the field that was wrong and \`doc_url\` points at the specific
error rather than the docs root. Both exist because "invalid request" with no
field is the least useful string an API can return.

## The five types

| Type | Meaning |
| --- | --- |
| \`authentication_error\` | Invalid or missing API key |
| \`permission_error\` | Valid key, insufficient permissions |
| \`invalid_request_error\` | Bad parameters, or a resource that is not there |
| \`rate_limit_error\` | Too many requests |
| \`api_error\` | Our fault |

A key that is valid but not allowed is a \`permission_error\`, distinct from a
key that does not work. The distinction is what tells an integrator whether to
fix their code or fix their credentials.

## Rate limiting and the other middleware

\`logger\`, \`cors\`, \`secureHeaders\`, \`prettyJSON\`, \`idempotency\` — mounted
on \`*\` in \`src/index.ts\`, in that order. Applying them globally rather than
per-route is the reason a new endpoint cannot accidentally ship without them.`,
  },
  {
    title: "Webhook events",
    icon: "📨",
    content: `What a consumer receives, and what they are expected to do about it.

## The seven events

\`\`\`
event.created
event.published
event.cancelled
order.created
order.paid
order.refunded
ticket.checked_in
\`\`\`

Deliberately few. A consumer that needs to know something happened gets told
about the seven things that matter, rather than every internal state change —
which is the difference between an event you can build against and a stream you
have to filter.

## What they map to

| Event | Why you would care |
| --- | --- |
| \`event.published\` | Your listing is now visible; you may want to post about it |
| \`order.paid\` | Tickets exist now; the fulfilment step begins |
| \`order.refunded\` | Access to a ticket has been withdrawn |
| \`ticket.checked_in\` | Somebody came through the door |
| \`event.cancelled\` | Stop selling, tell attendees |

\`order.paid\` and \`ticket.checked_in\` are the two that make the door count
available to a third party. An integrator building a dashboard does not have to
poll; the numbers arrive.

## The contract to be careful about

**Webhooks are at-least-once, not exactly-once.** A delivery is retried, so the
same event can arrive twice, and a handler that emails a customer on
\`order.paid\` will email them twice. Handlers must be idempotent, keyed on the
event id — the same discipline the API asks of its callers in
[[Idempotency and errors]], which is not a coincidence.

**Verify the signature before parsing the body.** Webhook delivery is
authenticated by signature, and the verification step is cheap. Skipping it
means anyone who learns the endpoint URL can post an \`order.paid\` into your
system.

## The difference from Tollbooth

Tollbooth emits **signed** webhooks, and it has a full page on the signing,
retries and the ten events it emits — see [[Webhooks]]. The API's own webhooks
are registered per endpoint (\`WebhookEndpoint\`, \`WebhookDelivery\`) and delivered
with \`svix\`.

**Whether the API's deliveries are signed the same way, and are retried on the
same schedule, is not documented here.** It is verifiable in
\`src/routes/v1\` and it should be written down; see
[[Builders — what is not finished]].`,
  },
  {
    title: "Builders — what is not finished",
    icon: "⚠️",
    content: `The gaps, as gaps.

## There are no tests

The repository contains **zero** test files. \`npm test\` is wired up but there is
nothing behind it. For an API that moves money and issues tickets, that is the
first thing that would have to change, and it is worth being blunt about: the
"live" status in the catalog refers to availability, not to confidence.

The schema is the specification, and the README is thorough, which means the
*documented* contract is good. Nothing enforces it.

## Four route files, twelve models

\`src/routes/v1\` has exactly four routers: \`events\`, \`ticket-types\`, \`orders\`,
\`tickets\`. The schema defines twelve models, including \`Scanner\`, \`ScanLog\`,
\`WebhookEndpoint\`, \`WebhookDelivery\`, \`Customer\` and \`RequestLog\`.

So the data model is ahead of the HTTP surface. That is a reasonable order to
build in — but it means the README's "Scanners" and "Webhooks" bullets describe
**intended** endpoints. A developer following the README will find 404s on the
scanner and webhook resources. This page is here so nobody learns that the hard
way.

## Webhook signing and retries are undocumented

Delivery, retry policy and signature verification are not written down anywhere
in the repository, unlike [[Tollbooth]] where all three have a page. An integrator
cannot build a correct handler from what is published. See [[Webhook events]].

## Publishable keys and the browser

The schema has a \`PUBLISHABLE\` type and the README documents \`pk_\` prefixes for
client-side use, but the authentication middleware's rules about which origins
may hold a publishable key are not documented. A publishable key is a key; what
it is allowed to do should be written down somewhere other than the code.

## The comparison in the tagline

"The Stripe of Ticketing" is still the first line of the README, while the
catalog copy has moved to the reconciliation promise. The README and the
positioning currently disagree, and the README is the one developers read. See
[[AXXES]] and [[Brand and messaging]].`,
  },
]
