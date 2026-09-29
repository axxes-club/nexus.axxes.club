// The Tollbooth space, as a single importable definition.
//
// Split out from the importer so the words can be reviewed without reading any SQL.
// Page titles are unique per space, and Nexus resolves [[wiki links]] by title
// across the whole tenant, so a title that already exists elsewhere in AXXES CLUB
// would silently merge two pages into one. The titles below are checked against the
// tenant's existing pages by import-tollbooth.mjs before anything is written.

const TENANT_SLUG = "axxes-club-CgWei8"
export { TENANT_SLUG }

export const SPACE = {
  name: "Tollbooth",
  icon: "🛣️",
  description:
    "The payment gateway for AXXES workspaces: hosted checkout, a small REST API, signed webhooks, and payouts to each merchant's own bank account.",
}

/** Every page, in sidebar order. `parent` nests it under another title. */
export const PAGES = [
  {
    title: "Tollbooth",
    icon: "🛣️",
    content: `Tollbooth is the payment gateway for AXXES businesses. It takes a
checkout request, puts the money in the right merchant's bank account, and tells
that merchant's app what happened.

Live at [tollbooth.axxes.club](https://tollbooth.axxes.club). Card processing is
Stripe's; the API, the idempotency, the webhook delivery, the dashboard and the
no-code checkout path are ours.

The pitch to a merchant is that they never log into Stripe at all. They connect a
payout account once, and from then on a charge is one HTTP request and a signed
webhook. See [[The API]] and [[Selling with no code]].

---

## What is in this space

| Page | What it covers |
| --- | --- |
| [[How money moves]] | Connect accounts, destination charges, where the fee comes from |
| [[The API]] | Every endpoint, and the conventions they all share |
| [[Webhooks]] | Signing, delivery, retries, and the ten events we emit |
| [[Selling with no code]] | Payment links, for anyone who isn't writing software |
| [[Test and live modes]] | How a test key is prevented from moving real money |
| [[Reliability]] | Idempotency, the two races, rate limits, request ids |
| [[Data model]] | The twelve tables, and why each exists |
| [[Testing]] | 153 tests, the Stripe fake, and the standing checks |
| [[Design decisions]] | The calls that are expensive to reverse |
| [[Faults found and fixed]] | What actually broke, and what it cost |
| [[Running it]] | Environment, deploy, and what to watch |
| [[What is not done yet]] | The honest gaps |

## Why it exists

Tollbooth is the layer that every AXXES product that takes money would otherwise
build separately. See [[Commerce — money and stock]] for how it sits with the rest
of the commerce picture, and [[Developers — building on AXXES]] for the wider
developer story.

## The shape of an integration

Three steps, and only the third one involves the merchant writing anything that
moves money.

1. **Connect payouts.** One click hands the owner to Stripe's onboarding. Most
   finish in five minutes. See [[Running it]].
2. **Make something to sell.** A product and a price, which can then be sold
   through the [[The API|API]] or through a [[Selling with no code|payment link]].
3. **Charge, and get told.** \`POST /checkout-sessions\` returns a hosted URL; the
   buyer pays on it; \`payment.succeeded\` arrives as a signed webhook.

The merchant can skip step 2's code entirely and share a link instead. That path
produces ordinary payments — same records, same API, same webhooks — which is the
point. See [[Selling with no code]].`,
  },
  {
    title: "How money moves",
    icon: "💸",
    content: `Each workspace gets its own Stripe Connect (Express) account, created on
first use. That account is where that workspace's money lands.

A checkout is a **destination charge**: the charge is created on the platform
account with \`transfer_data.destination\` pointing at the workspace's account, and
\`application_fee_amount\` is Tollbooth's cut. Stripe moves the rest to the merchant
and pays us the fee.

- **Fee:** \`TOLLBOOTH_FEE_BPS\` (default 100, so 1%) plus \`TOLLBOOTH_FEE_FIXED\`
  in minor units. Configured per deployment, not per merchant.
- **Minimum charge:** 50 minor units. \`/checkout-sessions\` refuses less.
- **Currencies:** USD, EUR, GBP, CAD, AUD, NZD, SGD, MXN, BRL, JPY. JPY is
  zero-decimal, and the money helpers account for that.
- **Expiry:** an unpaid checkout stays payable for just under 24 hours, which is
  Stripe's maximum for \`expires_at\`. See [[Design decisions]].

## Refunds

A refund does three things at once, and skipping any one of them costs the merchant
money:

- \`reverse_transfer: true\` — the transfer back to the merchant's account.
- \`refund_application_fee: true\` — the fee comes back too.
- Our own ledger is updated to match.

The fee returned is **proportional and cumulative**: it is computed from the total
amount refunded so far, not per refund. That detail is the subject of its own
decision page, because getting it wrong quietly pays out more than we took in.
See [[Cumulative refund fees]].

## Balances

The dashboard reads available, pending and the next payout date **live from
Stripe**, not from our own rows. A merchant reconciling a bank statement needs the
number their processor actually holds; an estimate accumulated from our table is
the wrong number by exactly the amount they are trying to explain.

## Payout setup is a hard gate

\`POST /checkout-sessions\` returns \`409 account_not_ready\` until the workspace has
a connected account that Stripe reports as charge-enabled. Readiness is our cached
copy of that state, refreshed by the sync action and by the \`account.updated\`
webhook — so it is eventually consistent. Stripe is the backstop: if our cache is
stale, Stripe rejects the charge, which costs a failed request and never a wrong
transfer.

## Disputes

A dispute flips the payment to \`disputed\` and fires \`payment.disputed\`. Responding
with evidence is done in Stripe's own tooling, which is where the deadline lives.
We surface the dispute and the reason; we do not duplicate the response UI.`,
  },
  {
    title: "The API",
    icon: "🔌",
    content: `Base URL \`https://tollbooth.axxes.club/api/v1\`. JSON in, JSON out.
Money is always an integer in minor units alongside a currency — \`2500\` is $25.00.

| Method | Path | Notes |
| --- | --- | --- |
| \`POST\` | \`/checkout-sessions\` | Creates a payment, returns \`checkout_url\` |
| \`GET\` | \`/payments\`, \`/payments/:id\` | Filters: status, customer, reference, mode, created range |
| \`POST\` \`GET\` | \`/refunds\`, \`/refunds/:id\` | Full or partial; returns the fee returned |
| \`GET\` \`POST\` | \`/customers\`, \`/customers/:id\` | Auto-created on first payment |
| \`GET\` \`POST\` | \`/products\`, \`/prices\` | Prices are immutable; archive and re-create |
| \`GET\` \`POST\` | \`/links\` | Shareable \`/pay/<slug>\` checkout |
| \`GET\` \`POST\` | \`/webhook-endpoints\` | Returns \`secret\` once |
| \`GET\` | \`/webhook-endpoints/:id/deliveries\` | The delivery log |
| \`POST\` | \`/webhook-endpoints/:id/deliveries/:deliveryId\` | Replay one delivery |
| \`GET\` | \`/events\` | The audit trail of what we emitted |
| \`GET\` | \`/balance\` | Available, pending, next payout — read from Stripe |
| \`GET\` | \`/health\` | Unauthenticated liveness probe |

## Every endpoint inherits the same four things

- **Auth.** \`Authorization: Bearer tb_live_…\`. See [[Test and live modes]].
- **Scopes.** \`payments:read\`, \`payments:write\`, \`refunds:write\`,
  \`catalog:write\`, \`webhooks:write\`. A key without the scope gets a
  \`403 insufficient_scope\` naming it. \`payments:write\` implies read, and a refund
  is a payment operation, so \`refunds:write\` rides on it.
- **Rate limits.** 300 reads and 120 writes a minute per key, with
  \`x-ratelimit-*\` on every response — including errors and replays — and
  \`retry-after\` on a \`429\`.
- **A request id.** Generated per request, echoed as \`x-request-id\`, and included
  in every error body. Quote it and we can find the exact request.

## Errors

One shape, standard status codes:

\`\`\`json
{ "error": { "type": "account_not_ready", "message": "…", "request_id": "req_9f2a…" } }
\`\`\`

| Status | Type | |
| --- | --- | --- |
| 400 | \`invalid_request_error\` | Malformed, and the message names the field |
| 401 | \`authentication_error\` | Missing, invalid or revoked key |
| 403 | \`insufficient_scope\` | The key lacks what this endpoint needs |
| 404 | \`resource_missing\` | Not in this workspace |
| 409 | \`account_not_ready\` | Finish payout setup first |
| 409 | \`refund_conflict\` | The payment changed; fetch it and retry |
| 409 | \`idempotent_request_in_progress\` | A duplicate is still running |
| 429 | \`rate_limit_exceeded\` | Slow down |
| 502 | \`api_error\` | Stripe rejected or could not be reached |

## Pagination

Cursor paging on \`created_at\`, newest first. \`starting_after\` takes the id of the
last row you saw. Offset paging would let a payment landing mid-scroll make you
skip or repeat a row.

## Starting a checkout

\`\`\`bash
curl https://tollbooth.axxes.club/api/v1/checkout-sessions \\
  -H "Authorization: Bearer $TOLLBOOTH_KEY" \\
  -H "Idempotency-Key: order_1234" \\
  -d '{
    "price": "vip_ticket",
    "customer_email": "buyer@example.com",
    "reference": "order_1234",
    "success_url": "https://yoursite.com/thanks"
  }'
\`\`\`

Prefer \`price\` over \`amount\`. A price keeps the amount on the server, so a client
cannot choose what it pays — which is the whole reason to have a catalog. See
[[Immutable prices]].

## The SDK

Zero dependencies, ESM, typed, and served from
\`https://tollbooth.axxes.club/sdk/tollbooth.js\` — which is the same file the docs
tell people to import, so the two cannot drift.

It adds an idempotency key to every write and retries only what is safe to retry:
network errors, \`429\`, \`5xx\`, and a \`409\` saying a duplicate is still in flight.
It never retries a \`402\` or a \`404\`, because those will not fix themselves.`,
  },
  {
    title: "Webhooks",
    icon: "📨",
    content: `Every state change is POSTed to the merchant's endpoint, signed. Ten
event types, no more — a gateway that emits two hundred is a gateway nobody can
build against.

\`payment.created\` · \`payment.succeeded\` · \`payment.failed\` · \`payment.expired\` ·
\`payment.refunded\` · \`payment.disputed\` · \`refund.created\` ·
\`customer.created\` · \`payout.paid\` · \`payout.failed\`

## Verify before you parse

The \`Tollbooth-Signature\` header is \`t=<unix>,v1=<hex>\`, where the HMAC covers
the timestamp **and** the raw body:

\`\`\`js
import { verifySignature } from "@tollbooth/sdk"

export async function POST(request) {
  // Verify against the raw body, before any JSON parsing.
  const payload = await request.text()
  const valid = await verifySignature({
    payload,
    header: request.headers.get("tollbooth-signature"),
    secret: process.env.TOLLBOOTH_WEBHOOK_SECRET,
  })
  if (!valid) return new Response("invalid signature", { status: 400 })

  const event = JSON.parse(payload)
  if (event.type === "payment.succeeded") await markPaid(event.data.object.metadata.order_id)

  return new Response("ok", { status: 200 }) // 2xx = we won't retry
}
\`\`\`

Binding the timestamp into the signed string is the part that matters. Signing the
body alone would let anyone who captured a delivery re-post it to you later and
fake a second payment. Check it against the **raw** body, because re-serialising
the parsed JSON changes the bytes.

## Delivery

Return any \`2xx\` to acknowledge. Anything else is a failure and is retried with
backoff — six attempts over roughly 24 hours. An endpoint that exhausts its
retries is disabled, rather than being left hammering a URL that is not there.

Every attempt is logged with its response code and error text, and any delivery
can be replayed by hand from the dashboard. That is what makes "it didn't arrive"
answerable.

Events are **not** delivered across modes: a test-mode event never reaches a
live-mode endpoint.

## The secret

Returned once, on creation and on rotation, and never in a list response. Without
it a receiver cannot tell a genuine event from a forged one, which is the only
thing the signature is for. Rotating issues a new one and the old stops working
immediately.

## Inbound, from Stripe

One endpoint serves both the platform account and each connected account, because
\`account.updated\` arrives on its own endpoint with its own signing secret.
\`STRIPE_WEBHOOK_SECRET\` holds both, comma-separated.

Inbound events are recorded before they are handled and applied exactly once, so
Stripe's retries are free. A handler failure returns a 5xx so Stripe does retry,
and the event row is removed so the retry isn't mistaken for a duplicate.`,
  },
  {
    title: "Selling with no code",
    icon: "🔗",
    content: `A payment link is a hosted page that sells a price, at
\`/pay/<slug>\`. Share it and money arrives. No integration, no deploy, no
developer.

This is the shortest possible path from "we should sell tickets" to taking money,
and it is deliberately not a lesser kind of charge: a payment made through a link
is an ordinary payment. It gets a record, it appears in the API, it fires the same
webhooks, and it shows up in the dashboard beside everything else. A merchant who
starts with a link and later writes an integration should not have to change how
they read their payments.

## The page

Shows the product, the amount, an email field for the receipt, and optionally a
quantity stepper. Paying redirects to a hosted Stripe Checkout page that handles
cards, Apple Pay and Google Pay.

Slugs are short and generated from an alphabet with no \`0/o\` or \`1/l\`, because
these get read aloud and retyped. They are unique across every workspace, not just
within one: a link is looked up without a tenant filter, so two merchants must not
be able to collide.

## When a link is not available

The page says the seller isn't accepting payments yet, rather than failing at
Stripe's checkout with a raw error. That happens when the workspace's payout
onboarding isn't finished.

## Turning a link into an integration

A link is just a price with a public URL. When the merchant wants the payment to
carry their own order id, they switch to \`POST /checkout-sessions\` with the same
\`price\` reference and keep the same webhook handler. See [[The API]].`,
  },
  {
    title: "Test and live modes",
    icon: "🧪",
    content: `An API key carries its mode in its prefix:

\`\`\`
tb_live_…   real money
tb_test_…   test money only
\`\`\`

A key only authenticates against a row of the same mode. A request labelled live
carrying a test secret is rejected rather than falling through to the test row, so
a mislabelled key **fails closed**. That is the property that makes test mode worth
having: it cannot become live by accident.

Each mode uses its own Stripe key — \`STRIPE_SECRET_KEY\` and
\`STRIPE_SECRET_KEY_TEST\`. \`stripe("test")\` refuses to start if the test variable
holds an \`sk_live_\` key, so the two can't be crossed at the environment level
either.

The mode is carried onto the payment row, which is what keeps a test payment out of
a merchant's real balance and out of their volume figures. The dashboard labels
them.

## What test mode does not do

It is not a sandbox account. It is the same platform, the same API, the same
webhooks and the same dashboard, wired to a Stripe test key. A test payment is a
first-class record; the only difference is that no money exists behind it.

That means the whole integration — checkout, webhooks, retries, refunds, the
dashboard — can be built and exercised at no cost, and the swap to live is one
change to an environment variable.

## The dashboard defaults to test

When you create a key in the dashboard, test is offered first and live asks you to
mean it. A test key that quietly started moving real money is the worst outcome
available, so the default is the safe one.`,
  },
  {
    title: "Reliability",
    icon: "🛡️",
    content: `The three failures that cost a merchant money are a duplicate charge, an
over-refund, and a silently dropped webhook. All three are handled explicitly.

## Idempotency

Send \`Idempotency-Key\` on any write; your order id is the obvious choice. The
first request claims the key, and a retry gets the original response back with
\`idempotent-replay: true\`.

Three details that are easy to get wrong:

- **The same key with a different body is a 400**, not a replay. A changed payload
  under a reused key is a confused retry loop, and a silent replay would return the
  wrong payment.
- **A failed request releases the key**, so a retry can succeed. A 400 must not
  burn the key for an hour.
- **A concurrent duplicate waits rather than re-running.** The loser polls for up
  to five seconds and then returns a 409. See [[Design decisions]].

## The two races

Neither is visible in a functional test; both return 200 or 201 regardless.

**Two identical requests at once.** The naive implementation sees an incomplete
row and concludes the first attempt died, then runs the handler a second time —
which is the exact case the header exists for. The fix is to distinguish *in
flight* from *abandoned*, and wait for the first rather than re-running it.

**Two refunds for the same payment.** Both read the full balance, both pass the
"amount left" check, both refund. The fix is to claim the amount on the payment
with a conditional update **before** calling Stripe, and release it if Stripe
refuses. See [[Reserve before Stripe]].

## Everything else

- **Errors carry a request id**, and internal detail is never leaked. A Stripe
  message that is safe for developers is shown; a raw provider payload is not.
- **A malformed id is a 404**, not a 500. Path parameters are compared against
  \`uuid\` columns, and a non-UUID is a Postgres type error rather than a miss.
- **Responses are never cached**, and always say so.
- **Non-UUID path parameters and cursors are rejected before the handler runs**,
  centrally, so every endpoint behaves the same way.`,
  },
  {
    title: "Data model",
    icon: "🗃️",
    content: `Twelve tables, all prefixed \`tollbooth_\`, all additive — the migration
never touches a table shared with another product. Every statement is idempotent,
so it is safe to re-run, and it upgrades an existing deployment rather than only
creating.

| Table | Holds |
| --- | --- |
| \`tollbooth_accounts\` | One Connect account per workspace, and a balance snapshot |
| \`tollbooth_api_keys\` | Hash, prefix, mode, scopes, last used, revoked |
| \`tollbooth_customers\` | Buyers, auto-created on first payment |
| \`tollbooth_products\` | What is sold |
| \`tollbooth_prices\` | How much, with an optional stable \`lookup_key\` |
| \`tollbooth_links\` | A shareable checkout page |
| \`tollbooth_payments\` | The record of every charge |
| \`tollbooth_refunds\` | Each refund, with its reason and the fee returned |
| \`tollbooth_events\` | Inbound Stripe event ids, for dedupe |
| \`tollbooth_webhook_endpoints\` | Where we deliver, and the signing secret |
| \`tollbooth_webhook_deliveries\` | One row per attempt, for the log and replay |
| \`tollbooth_idempotency_keys\` | Replays, and the fingerprint of the request |

## Two uniqueness rules are global, not per-tenant

\`tollbooth_payments.checkout_session_id\` and \`tollbooth_links.slug\` are unique
across the whole database, not scoped to a workspace. A Stripe Checkout session id
is globally unique by construction, and a link slug is looked up without a tenant
filter, so both must be. Getting this wrong would have let two merchants claim the
same link.

## \`tollbooth_events\` has no tenant column

Stripe's event ids are globally unique, and the table is a dedupe set rather than
a merchant's data. It is keyed on the event id alone.

## The migration is the schema

\`scripts/create-tables.sql\` is the source of truth, and \`npm run check:schema\`
compares it against the drizzle definitions and against the live database. That
check exists because a mistyped column name is invisible to TypeScript and fatal
at runtime — see [[Faults found and fixed]].`,
  },
  {
    title: "Testing",
    icon: "🧰",
    content: `153 tests, and no test framework. The suite runs on Node's built-in
\`node:test\`, so it costs nothing to run and nothing to install.

\`\`\`bash
npm test                    # build the tests, then run them
npm run test:watch
npm run verify              # typecheck + tests + checks + build
\`\`\`

## How it runs

\`tsc\` compiles the app and the tests to \`.test-build/\`, and
\`test/register.cjs\` supplies the three things Next normally provides: the \`@/\`
alias, the \`server-only\` marker, and a stand-in for the Stripe SDK. Route handlers
are then called directly with a constructed \`Request\`, so the suite exercises the
real handler and every wrapper around it without booting a server or claiming a
port.

## The Stripe fake

The gateway's own logic — fees, the refund reservation, retries, mode handling — is
all ours, and none of it should need network access or real money to be tested. The
fake records every call, lets a test script a response or force a failure, and
verifies webhook signatures for real. Anything that always succeeded would make
"a forged request changes nothing" pass for the wrong reason.

## Against the real database

Tests run against real Postgres, because the behaviour worth covering — conditional
updates, unique constraints, races — only exists there. Each suite derives its own
synthetic workspace and its own slice of the two globally-unique tables, and
cleans up after itself. Without \`DATABASE_URL\` the database-backed suites are
skipped rather than silently passing.

## Standing checks

Three scripts run in \`verify\`, each written because of a specific bug rather than
because it seemed like a good idea:

| Check | Why it exists |
| --- | --- |
| \`check:fees\` | A rounding slip in partial refunds returns more fee than was charged |
| \`check:schema\` | A mistyped column name is invisible to \`tsc\` and fatal at runtime |
| \`check:concurrency\` | Races return 200 either way, so nothing else sees them |

The first two prove their worth by being broken: reverting the fee fix fails
\`check:fees\` with the exact over-refund, and retyping a column fails
\`check:schema\`.

## What is not covered

Anything inside Stripe. The reservation and transfer behaviour of a real refund is
untested, and that is where a mistake would cost actual money. See
[[What is not done yet]].`,
  },
  {
    title: "Design decisions",
    icon: "⚖️",
    content: `The calls that are expensive to reverse, and what they cost to work out.
Each one has its own page because the reasoning is longer than a bullet.

- [[Immutable prices]] — a price amount can never be edited
- [[Cumulative refund fees]] — fee returned is computed from the total refunded
- [[Mode lives in the key]] — \`tb_live_\` / \`tb_test_\` prefix, enforced per request
- [[Reserve before Stripe]] — claim the refund before calling the provider

Two more that are smaller but still worth writing down:

**One product at a time.** A price is looked up by id *or* \`lookup_key\`, and the
two are tried separately. Sending \`vip_ticket\` to a \`uuid\` column is a Postgres
type error, not an empty result, so the id lookup has to be guarded.

**Ready-made URLs, host-checked.** Caller-supplied URLs must be https, or http on
loopback. The rule is based on the host rather than on \`NODE_ENV\`, because a check
that only fires when \`NODE_ENV\` is exactly \`"production"\` silently allows
plaintext everywhere else — a preview deploy, a misconfigured box, a test run.`,
  },
  {
    title: "Immutable prices",
    parent: "Design decisions",
    icon: "🔒",
    content: `A price's amount can never be changed after creation. The only mutable
field is \`active\`.

The obvious alternative — let the merchant edit the amount — quietly rewrites what
every past receipt says it was. An order paid at $25 becomes a receipt for $30,
and nothing records that the price moved.

So changing a price is: archive the old one (\`PATCH {"active": false}\`) and
create a new one. Checkout by \`id\` or \`lookup_key\` refuses an archived price
explicitly rather than falling back to something else.

## Why \`lookup_key\` exists

Because a hard-coded UUID in an application's source is a small, permanent
liability: it leaks volume, and it makes "what does this charge?" a database
lookup. A \`lookup_key\` like \`vip_ticket\` is the same information, readable in
the code that spends it, and stable as long as the price is current.

## The rule that follows from this

\`amount\` is only accepted when no \`price\` is named. Once a price is in play the
amount comes from the server, and a client that sends both has its \`amount\`
ignored. The test for that is explicit, because the alternative is a client
choosing what it pays.

The one cost: a price is a row, not a number, so there is no free-form "charge
$4.25 for a coffee top-up" without creating a price first. That is the right
trade for a gateway, and \`amount\` remains available for exactly that case.`,
  },
  {
    title: "Cumulative refund fees",
    parent: "Design decisions",
    icon: "➗",
    content: `When a payment is refunded, the slice of Tollbooth's fee that covered
the refunded money goes back to the merchant. A refund must not cost them the fee
twice.

## The bug

The first implementation computed that slice per refund, with rounding, and
clamped it to the fee originally charged:

\`\`\`js
Math.min(chargedFee, Math.round((chargedFee * amount) / originalAmount))
\`\`\`

For a single refund that is correct. Split a $25.00 payment with a 25¢ fee into two
$12.50 refunds and each one rounds 12.5¢ up to 13¢ — **26¢ returned against a 25¢
fee**. The platform lost a cent per split, and more of them on smaller amounts: a
$1,000 payment with a $10 fee split seven ways returned $10.03.

It was silent. Every response was a success.

## The fix

Compute from the **total** refunded so far, and floor rather than round. Flooring
keeps the value monotonic in the amount refunded, so the sum of the per-refund
deltas taken across successive refunds can never exceed the fee charged.

\`\`\`js
const alreadyReturned = chargedFee - netFee
const target = Math.min(chargedFee, Math.floor((chargedFee * refundedTotal) / originalAmount))
const feeReturned = Math.max(0, Math.min(target - alreadyReturned, chargedFee - alreadyReturned))
\`\`\`

The same rule is applied in SQL on the inbound \`charge.refunded\` path, which
originally had its own \`round()\`.

## The property worth stating

*For any sequence of partial refunds summing to at most the original amount, the
total fee returned is at most the fee charged, and exactly equal to it when the
payment is fully refunded.*

That is what \`check:fees\` asserts, across ten amounts and seven split patterns.
The old implementation fails it on six.`,
  },
  {
    title: "Mode lives in the key",
    parent: "Design decisions",
    icon: "🔑",
    content: `A key says what it is for: \`tb_live_\` or \`tb_test_\`.

The alternative — a mode column set in the dashboard — means the key and the mode
can disagree, and the disagreement is discovered when real money moves.

## Fails closed

Authentication only matches a key row of the **same** mode. A request labelled live
carrying a test secret is rejected. It does not fall through to the test row and
serve a test answer to a caller who believed they were live, and it certainly does
not serve a live answer to a test key.

The environment is guarded the same way: \`stripe("test")\` refuses to construct a
client if \`STRIPE_SECRET_KEY_TEST\` holds an \`sk_live_\` key.

## What a test key can and cannot do

It can run the entire integration. The API is identical, the dashboard is identical,
webhooks are delivered, refunds work, the ledger is written. What it cannot do is
move money, because the Stripe key it uses is a test key.

The mode is stored on the payment row, which keeps test payments out of the
merchant's real balance and out of their volume figures, and the dashboard labels
every one.

## The swap

Test in development, live in production. One environment variable changes; no code
path changes, and no branch anywhere decides "are we in test". That is deliberate —
a mode branch in the code is a mode branch that can be wrong.

See [[Test and live modes]] for the dashboard side.`,
  },
  {
    title: "Reserve before Stripe",
    parent: "Design decisions",
    icon: "🔒",
    content: `A refund claims its amount on the payment **before** calling Stripe, with
a conditional update guarded on the value that was just read:

\`\`\`sql
update tollbooth_payments
   set amount_refunded = :new_total, status = :status, net_fee = :net
 where id = :id
   and amount_refunded = :observed      -- optimistic concurrency
   and status in ('succeeded', 'partially_refunded')
\`\`\`

Exactly one of two concurrent refunds wins. The other updates zero rows and gets a
\`409 refund_conflict\`.

## The bug it prevents

Two refunds for the same payment, at the same moment, both read the full balance.
Both pass "amount left". Both call Stripe. A $25 payment is refunded $50, and the
fee is returned twice. Every response is a success.

Reading then writing, with no guard, is the shape almost every payment API has.

## Why reserve first rather than call Stripe first

The two orderings fail differently.

**Call first** can refund twice. That is a real loss of money and a customer
who has been paid back for something they bought.

**Reserve first** can, if the process dies between the two writes, record a refund
that Stripe never received. That is a merchant who believes they refunded and
whose customer was not — recoverable, visible, and fixable from the dashboard.

Of those, a stranded ledger row is the cheaper failure, so that is the one chosen.

## Releasing the reservation

If Stripe refuses, the reservation is handed back, guarded on our own write so it
can never roll back a refund something else has since recorded. The payment returns
to refundable, which is what makes the failure retryable.

## A duplicate refund is a safe rejection, not an error to hide

Whether the loser sees \`409 refund_conflict\` or a plain "only N left" depends on
timing: if it reads after the winner committed it fails the earlier check. Both are
safe, so the tests assert the guarantee — exactly one succeeds, and the payment is
never refunded beyond its value — rather than which of the two happened.`,
  },
  {
    title: "Faults found and fixed",
    icon: "🩹",
    content: `What actually broke in Tollbooth, and what each one cost. All of these
were found by running the thing, not by reading it.

## A column name that only failed at runtime

The drizzle schema said \`payout_enabled\`; the table said \`payouts_enabled\`.
\`tsc\` was perfectly happy, the build was clean, and every query touching a payout
account returned a Postgres error at runtime.

A missing \`s\` is not a type error, a lint warning, or anything a compiler can see.
It only exists in the database.

That is why \`check:schema\` compares the drizzle definitions, the migration and
the live database against each other. See [[Data model]].

## Split refunds returned more than we charged

A $25 payment with a 25¢ fee, refunded in halves, returned **26¢**. Each refund
rounded its own share up and the total was clamped to the original fee rather than
to what was left. Silent, and worse the more parts a payment was split into.

The fix and the property that pins it are in [[Cumulative refund fees]].

## A lookup key crashed the endpoint

\`price\` accepts an id *or* a \`lookup_key\`, and both were tried in the same
query. Sending \`vip_ticket\` to a \`uuid\` column is a **type error** in Postgres,
not an empty result — so creating a payment link by lookup key returned a 500.

The same flaw sat in \`starting_after\` and in every \`:id\` route, and a test now
covers all of them centrally.

## A status filter silently ignored most of the request

\`?status=succeeded,failed\` validated both values, then applied only the first. A
merchant reconciling a month would quietly see the wrong payments.

Also, \`disputed\` was rejected as an unknown status by the API, even though the
dispute webhook writes exactly that status and the dashboard has a filter for it.

## Rate-limit headers vanished on retries

Any request carrying an \`Idempotency-Key\` lost \`x-ratelimit-*\`, because the
wrapper discarded the original response and built a new one. The client could not
tell a quiet success from a throttled one.

## Webhook URLs could be plaintext

\`safeUrl\` refused \`http:\` only when \`NODE_ENV === "production"\`. In every other
environment — a preview deploy, a misconfigured box, a test run — a webhook
endpoint could be an \`http://\` address, which meant payment details posted in the
clear and a caller able to aim the gateway at something on the internal network.

The rule is now host-based: https, or loopback only.

## A stray import at the bottom of a file

\`contacts.ts\` ended with \`import { boolean } from "drizzle-orm/pg-core"\`, a
hundred lines below the tables that used it. ESM hoists imports, so the app worked
by luck. Loaded as CommonJS — which is how the test suite loads it — it threw a
temporal-dead-zone error.

## The idempotency race

The guard re-ran the handler whenever a key had no completed response. But an
incomplete response is exactly what an **in-flight** request looks like, so two
identical requests arriving together both ran the handler. That is the one case the
header exists for.

The loser now waits for the winner. Verified with eight concurrent requests:
one payment created, seven replays.

## The refund race

See [[Reserve before Stripe]]. Two refunds could both succeed and refund a payment
twice over.

## Payment links ignored the deployment mode

\`POST /api/pay/:id\` hard-coded \`mode: "live"\`. A link has no API key, so it
should follow the platform's own mode — as written, every link on a test
deployment failed, and test payments would have been recorded as real.

## The SDK quietly dropped idempotency keys

Five of its seven \`create\` methods ignored the \`idempotencyKey\` option. A caller
who set it would get no error and no protection — the worst possible shape for the
one option that prevents double charges. There is now a test asserting that every
\`create\` forwards it.

## A webhook returned 500 after succeeding

The handler used \`after()\` to drain the delivery queue, which throws outside a
request scope. The event had already been applied and recorded, and Stripe would
retry it for no reason.

## The webhooks page could not load

A raw SQL fragment interpolated a JavaScript array, producing literal brackets in
the statement. The dashboard's webhooks page was broken for anyone with an
endpoint.`,
  },
  {
    title: "Running it",
    icon: "🛠️",
    content: `\`tollbooth.axxes.club\`, a Next.js app sharing the AXXES database and
account. Handshake sign-in; a workspace is the unit of everything.

## Environment

| Variable | Needed for |
| --- | --- |
| \`DATABASE_URL\`, \`BETTER_AUTH_SECRET\`, \`BETTER_AUTH_URL\` | Shared AXXES database and auth |
| \`AUTH_COOKIE_DOMAIN\`, \`HANDSHAKE_URL\` | One session across every \`*.axxes.club\` app |
| \`STRIPE_SECRET_KEY\` | Live charges |
| \`STRIPE_SECRET_KEY_TEST\` | Test charges — required for test keys to work |
| \`STRIPE_WEBHOOK_SECRET\` | Both Stripe endpoints, comma-separated |
| \`TOLLBOOTH_FEE_BPS\`, \`TOLLBOOTH_FEE_FIXED\` | The platform fee, default 1% |
| \`CRON_SECRET\` | Guards the delivery cron |
| \`TOLLBOOTH_SITE_URL\` | Absolute URLs in the SDK page and examples |

## Database

\`\`\`bash
npm run db:migrate
\`\`\`

Additive and idempotent: it creates \`tollbooth_*\` tables and never alters a table
shared with another product, and it upgrades an existing deployment rather than
only creating. See [[Data model]].

## Stripe

One Connect (Express) platform account. Two webhook endpoints point at
\`/api/webhooks/stripe\` — one for the platform, one for \`account.updated\` on
connected accounts, each with its own signing secret.

## Deploying

\`npm run verify\` runs the typecheck, the test suite, the three standing checks and
a production build. The cron in \`vercel.json\` calls \`/api/cron/deliveries\` every
minute, which is what clears a delivery backlog if the app was asleep when an event
landed. The Stripe handler also drains the queue after each event, so the cron is
a safety net rather than the main path.

## Onboarding a merchant

The dashboard's checklist is derived from the workspace's real state — a connected
account, something to sell, a key, a webhook, a test payment — so the progress it
shows cannot be wrong. Payout setup is one click into Stripe's own onboarding;
everything after that is the gateway's problem.

## What to watch

- \`/api/v1/health\` — reports \`degraded\` if Stripe is not fully configured.
- Endpoints with a rising \`failure_count\` are retrying, and are disabled once they
  exhaust their attempts. The webhooks page lists recent deliveries with response
  codes.
- Payments with a non-zero \`last_error\` are the ones worth looking at; that
  column carries the reason Stripe or the ledger gave.`,
  },
  {
    title: "What is not done yet",
    icon: "⚠️",
    content: `Written down so the gaps are visible rather than discovered.

## Stripe keys are not set

\`STRIPE_SECRET_KEY\` and \`STRIPE_SECRET_KEY_TEST\` are both unset in the
deployment this was built against, so a real charge cannot complete. Everything up
to the Stripe call is exercised — by the test suite, against a fake that verifies
signatures for real — and \`/api/v1/health\` correctly reports \`degraded\`.

Checkout returns a clear \`platform_misconfigured\` error rather than failing
opaquely, which is the right behaviour but is not the same as a charge working.

## Nothing inside Stripe is tested

This is the important gap. The reservation and transfer behaviour of a real
refund, the exact shape of a Connect account after onboarding, and the real
outcome of a dispute are all untested, because they need a Stripe account to
exist.

A low-value live test charge, end to end — create, pay, refund, check the payout —
is the first thing that should happen before this takes anyone's money.

## Disputes are surfaced, not answered

A dispute marks the payment and fires an event, but responding with evidence is
done in Stripe's tooling. That is a deliberate non-goal for now rather than an
oversight, though a merchant who loses a dispute to a deadline they missed would
have a fair complaint.

## Rate limits are per instance

The counter lives in module scope, so a serverless deployment gets a limit per
isolate rather than a single shared one. It is generous enough not to catch a
legitimate client and tight enough to stop a runaway loop or a credential guess,
but it is not a global limit. Redis would fix it.

## The SDK is JavaScript only

TypeScript types ship, and the package is plain ESM, but there is no Python, Go
or Ruby client. A \`curl\`-able REST API is the floor and most integrations can
stop there; a first-class Python client is the obvious next request.

## No merchant-facing changelog or status page

There is a \`nexus\` page and a git history. A merchant reading a changelog on the
product's own site would be better.`,
  },
]

export const buildContent = () => ({ space: SPACE, pages: PAGES, tenantSlug: TENANT_SLUG })
