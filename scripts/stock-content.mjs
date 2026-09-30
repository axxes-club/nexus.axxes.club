// The Stock space, as a single importable definition.
//
// manifest.axxes.club is the suite's inventory engine. The catalog calls it
// **Stock** because the key `manifest` is permanent and the product's name is
// not — the clearest single illustration of the key/name rule described in the
// Company space. Facts come from the repository README and its drizzle schema.

const TENANT_SLUG = "axxes-club-CgWei8"
export { TENANT_SLUG }

export const SPACE = {
  name: "Stock",
  icon: "📦",
  description:
    "The suite's inventory engine: an immutable double-entry stock ledger, FIFO or average costing, and purchasing, with every number explaining itself.",
}

export const PAGES = [
  {
    title: "Stock",
    icon: "📦",
    content: `Stock is the inventory engine. Live at
[manifest.axxes.club](https://manifest.axxes.club), catalog key \`manifest\`,
status **beta**.

**Every stock number explains itself.** That sentence was Manifest's README
opening, and when the catalog was rewritten it was recognised as the company
line rather than a product tagline. It is still the accurate description of what
this thing does.

---

## What is in this space

| Page | What it covers |
| --- | --- |
| [[The ledger]] | Why moves are immutable and double-entry, and what that buys |
| [[Costing]] | FIFO and average, and the projections that make them cheap |
| [[Purchasing]] | Purchase orders, goods receipts, landed costs, undo |
| [[How Stock is built]] | Command pattern, permissions, the raw-SQL trap |
| [[Stock — what is not finished]] | The honest gaps |

## The name and the key

The repo is \`manifest.axxes.club\`. The product is **Stock**. The key is
\`manifest\`.

That is deliberate, and it is the clearest example of the rule the whole catalog
follows: **a key is permanent, a name changes.** The key is referenced by the
plan catalog, Handshake's OIDC client registry, the integrations providers and
the suite registry, so renaming it would break every one of them. Renaming the
display name costs nothing and communicates better. See [[The AXXES catalog]].

## Where it sits

Stock is the provider behind the portal's basic Stock module as well as a
product in its own right. Its output — a quantity — is consumed by
[[afters]] for merchandise, by [[Pulse]] for reporting, and by the public
storefront feed. All of them read the same row.
See [[Commerce — money and stock]].`,
  },
  {
    title: "The ledger",
    icon: "📒",
    content: `The design decision everything else in Stock rests on.

## \`manifest_stock_moves\` is the source of truth

Immutable. Double-entry. Moves between locations.

**Mistakes are fixed with reversal moves, never edits.** This is the whole
commitment in one sentence, and it is the difference between a ledger you can
audit and a table you can only trust.

The consequence people miss: there is no \`UPDATE\` anywhere in the stock path.
Every number you see is a sum of things that happened, so a number cannot quietly
become wrong. It can only be contradicted, and the contradiction is a visible
row rather than a missing history.

## The projections

Three tables are maintained **in the same transaction** as the posting, so they
cannot lag behind the truth:

| Table | What it holds |
| --- | --- |
| \`manifest_quants\` | Stock per item, location, lot and status |
| \`manifest_cost_layers\` | Open cost layers, with what remains in each |
| \`manifest_item_costs\` | The item's current unit cost |

Derived data that is updated transactionally is cheap to read. Derived data
updated by a job is a source of disagreement between two numbers, which is the
exact failure this suite exists to prevent.

## The mirror into the shared catalog

After each posting, stock is mirrored into the shared \`products.quantity\` and
\`inventory_levels\`. That is how members, [[Pulse]] and the public storefront feed
stay correct without any of them knowing that Manifest exists.

A mirror is a place where two systems can disagree, so the rule is that it
happens **inside the posting transaction** rather than afterwards. See
[[AXXES]] for why "one honest ledger" is a claim about transactions and not about
schemas.

## Adjustment and audit

\`manifest_adjustments\` and \`manifest_adjustment_lines\` handle counted stock.
\`manifest_audit\` is written per command and is unique on tenant and idempotency
key — so a retried command is recorded once, and "who changed this" is a
question with a table behind it rather than a hopeful search of logs. See
[[The audit trail]].`,
  },
  {
    title: "Costing",
    icon: "🧮",
    content: `How a unit cost is decided, and why the answer is allowed to change.

## Two methods, chosen per item

\`manifest_costing_method\` — **FIFO** or **average** — is a per-item decision, not
a global setting.

That matters because the two answers are both defensible and they are
*different numbers*. An operator choosing FIFO has decided something true about
their business: the stuff on the floor came from the earlier purchase. Forcing one
method on every item would be imposing an accounting opinion on customers who
have not asked for one.

## Layers, not a running average

FIFO is implemented as \`manifest_cost_layers\` with a \`remaining\` quantity per
layer, rather than as a single moving average. Each layer knows how much of itself
is still on hand, which is what makes the cost of *this* unit well defined rather
than approximately defined.

\`manifest_item_costs\` holds the current answer; \`manifest_cost_layers\` holds
the work. Same split as [[The ledger]]'s moves and quants.

## Landed costs

\`manifest_landed_costs\` spread an extra cost across what it bought, by
\`manifest_landed_cost_method\` — **by value or by quantity**.

The capitalisation rule is the part worth knowing: **only the share still on hand
is capitalised; the rest is recorded as a variance.**

So shipping costs on 400 units, of which 100 have sold, put 75% of the freight
into the cost of the remaining stock and 25% into a variance line. That is the
honest treatment, and it is exactly the sort of thing that gets skipped in
hand-rolled inventory systems — where it shows up later as a margin that does not
reconcile. See [[Commerce — money and stock]].

## Undo is symmetric

Undoing a goods receipt rolls back **the stock, the valuation and the order**,
together. Rolling back only the stock would leave the cost basis describing goods
that are no longer there, which is precisely the kind of quiet disagreement the
suite is built to prevent.`,
  },
  {
    title: "Purchasing",
    icon: "🛒",
    content: `Buying stock, and the point at which the ledger meets a real supplier.

## Purchase orders

A state machine: \`draft\` → \`approved\` → \`sent\` → \`received\` → \`closed\`, with
an **optional approval threshold**.

The threshold is optional on purpose. A small business buying stationery should
not need a second approver; a business buying a container of hardware should not
have a single person able to commit the company. The same workflow serves both
because the rule is a number, not a policy document nobody reads.

## Goods receipts

A receipt posts **supplier → bin** moves at **the order's cost, converted to base
currency**.

Both details matter. The cost is the order's cost, not the current market price,
so a receipt is not a moment where a valuation can be quietly improved. And the
currency conversion happens at posting, so a later exchange-rate move does not
retroactively restate stock that has already moved.

## After the receipt

Landed costs spread by value or quantity — see [[Costing]] — and the capitalised
share goes into the open cost layers where FIFO and average will pick it up
naturally.

Undoing rolls back stock, valuation and order in one go.

## Master data

Suppliers and price lists still use the generic resource screens from
\`src/product.config.ts\` rather than bespoke ones. That is a deliberate
economy: master data is not where inventory becomes honest, so it does not get
its own UI budget.`,
  },
  {
    title: "How Stock is built",
    icon: "🧱",
    content: `The engineering conventions, because they are the reason the ledger is
trustworthy.

## One way in: the command pattern

\`src/domain\` is **the only code that writes**. Every command runs through
\`runCommand\` in \`src/domain/command.ts\`, in **one transaction**, and each one
carries:

- a permission check,
- a state-machine guard,
- a per-item lock,
- an audit row,
- an outbox event.

Five things, always, in one transaction. A stock system is exactly the place
where "we do the audit in a service" produces an audit row that is missing for
the one operation somebody cares about. Making the checklist the *only* way in is
what makes it a property of the system rather than a habit of its author.

## Permissions in one place

\`src/lib/permissions.ts\` is **the one place that decides what each role can do**,
and roles come from the workspace membership. A second opinion on authorization
is a second answer.

## Namespacing, and who owns what

\`drizzle.config.ts\` is scoped to \`manifest_*\`. **Stock never touches another
app's tables.**

Shared tables — \`tenants\`, \`products\`, \`inventory_levels\` — are owned by
members.axxes.club. The documented procedure is explicit about the direction:
*change them there first, then copy the schema here.* Two apps editing one
definition is how a suite breaks. See [[AXXES]].

## The raw-SQL trap, and why it is written down

Inside correlated subqueries, reference outer columns with \`outer()\` from
\`src/lib/db/sql.ts\`.

Drizzle leaves columns unqualified in single-table selects, so an unqualified
\`"id"\` inside a subquery **binds to the subquery's own table** and the query
returns confident, plausible, wrong numbers. This is the single most dangerous
class of bug in an inventory system, because it does not error — it reconciles
against a different column and nothing looks broken. There is a test file for it
(\`tests/sql.test.ts\`).

## Tests

Five files: \`ledger\`, \`costing\`, \`purchasing\`, \`verbs\` (the commands),
\`catalog-import\`, and \`sql\`. They run on an in-process Postgres, so the
transaction behaviour under test is the behaviour that ships.

## Run it

\`\`\`bash
npm install --legacy-peer-deps
npm run db:local            # disposable Postgres on :5499, seeded demo workspace
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5499/postgres npm run dev
# sign in as demo@manifest.local / manifest-demo
\`\`\`

\`npm test\` and \`npm run typecheck\` are the standing checks. \`-- --reset\`
re-seeds.

## Schema changes

Edit \`src/lib/db/schema/manifest/*\`, run \`db:generate\`, **review the SQL in
\`drizzle/\` — it must only touch \`manifest_*\` objects** — then \`db:migrate\`.

The review step is a human check, and it exists because the generated SQL is the
last place the namespacing can be verified.`,
  },
  {
    title: "Stock — what is not finished",
    icon: "⚠️",
    content: `The gaps, as gaps. Stock is **beta** in the catalog, and these are the
reasons.

## Barcode and cycle counting are not built

Counted stock exists as \`manifest_adjustments\`, but there is no handheld
workflow, no blind-count discipline and no variance investigation. An adjustment
you can post is not the same as a count you can trust — without blind counting,
the person doing the count sees the expected quantity, and that is the mechanism
by which inventory drifts.

## Multi-currency is partial

The receipt converts at posting, which is correct. What is not built is
**revaluation of open layers** when a rate moves, or a currency dimension on
\`manifest_quants\`. A business whose suppliers bill in two currencies can buy
correctly and will get a cost basis that ages badly.

## Landed costs do not cover everything

Freight and duty, spread by value or quantity. Not: insurance, handling,
warehouse time, or a landed-cost estimate that was quoted before the invoice
arrived. The last one is the interesting gap — the common case is a *planned*
landed cost applied at receipt and revised later, and revising a capitalised cost
after the fact is a real accounting problem that this schema does not yet have an
answer for.

## Costs reach the storefront, but revenue does not come back

Stock mirrors \`quantity\` into the shared catalog so the storefront stays right.
There is no path by which a completed sale reduces a cost layer in Manifest.
**Stock knows what is on hand; it does not know what sold.** For a suite whose
entire positioning is reconciliation, that is the most consequential gap on this
page, and it is a real one rather than a missing convenience.

## Lots and expiry are schema, not product

\`manifest_lots\` exists. Nothing enforces FEFO, nothing warns about a lot about
to expire, and nothing blocks selling one that has. For a business with
perishable stock the ledger is correct and the product is not enough.

## One database, many authors

Every app shares the schema, and Stock is the app that owns the most intricate
constraints in it. The namespacing discipline and the portal-owns-shared-tables
rule are documented and enforced by review, not by tooling. There is no
mechanical check that a migration stayed inside \`manifest_*\` — it is a step in a
documented procedure. See [[How Stock is built]].`,
  },
]
