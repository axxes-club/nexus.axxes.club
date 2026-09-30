/**
 * Seed the AXXES product documentation into Nexus.
 *
 * Writes into the AXXES CLUB tenant as a "Company" space: what the company is,
 * what it promises, and one page per product family, plus the full catalog.
 *
 * Why a script and not a pile of SQL: the catalog is the single source of truth in
 * members.axxes.club/db/axxes-products.sql, and this document is derived from it.
 * Reading it here means a product added to the catalog shows up here, and a rename
 * in one place does not leave a stale page behind.
 *
 * Idempotent. Pages are matched on title within the space and updated in place, so
 * running it twice does not create a second copy of everything. Run it after a
 * catalog change and the documentation follows.
 *
 *   node scripts/seed-axxes-docs.mjs           # dry run, prints the plan
 *   node scripts/seed-axxes-docs.mjs --write   # apply
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CATALOG = join(ROOT, "..", "members.axxes.club", "db", "axxes-products.sql");

const TENANT = {
  id: "40119de9-ef87-4e41-b479-7a28ec8e3d66",
  name: "AXXES CLUB",
};

/** Author recorded on the rows. Any real member works; this is a primary owner. */
const AUTHOR = "XN4YdRavK88taFmmWbSE55UVF8dEpjlj";

const WRITE = process.argv.includes("--write");

/* ------------------------------------------------------------------ catalog */

/**
 * Parse the catalog seed.
 *
 * Comments are stripped first: the file is heavily commented, and a naive split
 * picks up prose as though it were data — which is how "Keel is registered but
 * deliberately NOT surfaced" becomes a product.
 */
function parseCatalog() {
  const raw = readFileSync(CATALOG, "utf8");
  const body = raw
    .split("\n")
    .map((l) => l.replace(/^\s*--.*$/, ""))
    .join("\n")
    .split("VALUES")[1]
    .split("ON CONFLICT")[0];

  const rows = [];
  for (const chunk of body.split("),")) {
    const text = chunk.replace(/^\s*\(/, "");
    if (!/^\s*'[a-z_]+'\s*,/.test(text)) continue;

    const fields = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === "'") {
        if (inQuote && text[i + 1] === "'") {
          cur += "'";
          i++;
          continue;
        }
        inQuote = !inQuote;
        continue;
      }
      if (c === "," && !inQuote) {
        fields.push(cur.trim());
        cur = "";
        continue;
      }
      cur += c;
    }
    fields.push(cur.trim());
    if (fields.length < 13) continue;

    // Column order is fixed by the INSERT column list:
    //   key, name, tagline, description, url, color, category, status,
    //   sso, icon, members_path, surface_in_members, sort_order
    // members_path is nullable, so it shifts the trailing two — index it by name
    // rather than by eye.
    rows.push({
      key: fields[0],
      name: fields[1],
      tagline: fields[2],
      description: fields[3],
      url: fields[4],
      category: fields[6],
      status: fields[7],
      sso: fields[8] === "true",
      shown: fields[11] === "true",
      order: Number(String(fields[12]).replace(/[^0-9.]/g, "")) || 0,
    });
  }
  return rows.sort((a, b) => a.order - b.order);
}

/* -------------------------------------------------------------------- prose */

const FAMILIES = [
  {
    category: "Events",
    icon: "🎟️",
    title: "Events — the night itself",
    intro:
      "What happens in the room: the event, the ticket, the door, the room itself, and the photos that come out of it.",
    why:
      "This is the part of the business that cannot be moved to a generic tool, because it is all happening in a dark room at 2am with people in it. Everything here is judged on whether it still works when the wifi is bad and someone's phone is at 5%.",
  },
  {
    category: "Commerce",
    icon: "📦",
    title: "Commerce — money and stock",
    intro:
      "The two things that have to agree with each other: what you sold, and what you had to sell it with.",
    why:
      "A promoter buys a hundred cases and sells eighty. The stock figure, the money taken and the sales report have to be the same number by the end of the night, or the next booking is planned on a lie.",
  },
  {
    category: "Developers",
    icon: "🛠️",
    title: "Developers — building on AXXES",
    intro:
      "The API, the developer portal, and the product that treats a change to shared data as something that has to be explainable.",
    why:
      "Every product here shares one database and one account, which means the genuinely hard part of building on AXXES is already solved for you — reading across products is a join, not an integration.",
  },
  {
    category: "Work",
    icon: "🗂️",
    title: "Work — internal tools",
    intro: "The horizontal tools: boards, files, knowledge and reporting.",
    why:
      "These are real and they work, and they are not what AXXES is for. Each one invites a comparison against a company with a thousand times the headcount, and on brand alone that comparison is lost. They are used internally and kept supported; they are not what we lead with.",
  },
];

function familyPage(family, products) {
  const status = (s) =>
    s === "live" ? "Live" : s === "beta" ? "Beta" : "Announced";

  const table = [
    "| Product | What it does | Status | AXXES sign-in | Product page |",
    "| --- | --- | --- | --- | --- |",
    ...products.map(
      (p) =>
        `| **${p.name}** | ${p.tagline} | ${status(p.status)} | ${
          p.sso ? "yes" : "no"
        } | [open](${p.url}) |`
    ),
  ].join("\n");

  const detail = products
    .map(
      (p) =>
        `### ${p.name}\n\n**${p.tagline}.** ${p.description}\n\n- **Where:** ${p.url}\n- **Key:** \`${p.key}\``
    )
    .join("\n\n");

  return `# ${family.title}

${family.intro}

> ${family.why}

${table}

---

${detail}
`;
}


function catalogPage(products) {
  // Group by family, then by launcher order. sort_order alone interleaves the
  // categories (Work sits between Suite and Events) and reads as arbitrary.
  const grouped = [...FAMILIES.map((f) => f.category), "Suite"]
    .map((cat) => ({
      category: cat,
      items: products
        .filter((p) => p.category === cat)
        .sort((a, b) => a.order - b.order),
    }))
    .filter((g) => g.items.length);

  const c = (s) => products.filter((p) => p.status === s).length;
  const status = (s) =>
    s === "live" ? "Live" : s === "beta" ? "Beta" : "Announced";

  const body = grouped
    .map((g) =>
      [
        `### ${g.category}`,
        "",
        "| Product | Key | Status | In the launcher | Where |",
        "| --- | --- | --- | --- | --- |",
        ...g.items.map(
          (p) =>
            `| **${p.name}** | \`${p.key}\` | ${status(p.status)} | ${
              p.shown ? "listed" : "not listed"
            } | ${p.url} |`
        ),
      ].join("\n")
    )
    .join("\n\n");

  return `Every product AXXES offers, in one table.

This page is generated from the catalog, which is the single source of truth — the
app launcher, the public product page and this page all read the same rows, so they
cannot disagree with each other.

**${products.length} products: ${c("live")} live, ${c("beta")} beta, ${c("soon")} announced.**

${body}

---

## About the keys

The \`key\` column is permanent. It is referenced by the plan catalog, the OIDC
client registry, the integrations providers and the suite registry, so a key is
never renamed — a product's *name* changes regularly and that is fine, but the key
is a stable internal identifier.

That is why **Stock** above is the product whose key is \`manifest\`, and why
**AXXES Developers** and **AXXES for Builders** are two separate rows: they are two
different products that both happen to be developer tools.

## About the ones not listed

"Not listed" means the product is deliberately kept out of the members launcher. It
is registered, supported and reachable — just not part of the default view.

The five horizontal Work tools are held back on purpose: each one invites a
comparison against a company with a hundred times the headcount, and on brand alone
that comparison is lost. See [[Work — internal tools]].

**Keel** is registered ahead of launch so the key is reserved rather than invented
at launch, which would risk colliding with whatever got claimed first.
`;
}


function overviewPage(products) {
  const bullets = FAMILIES.map((f) => {
    const ps = products.filter((p) => p.category === f.category);
    return `- **${f.title.split(" — ")[0]}** — ${f.intro} (${ps.length} ${ps.length === 1 ? "product" : "products"})`;
  }).join("\n");

  return `# AXXES

**Everything reconciles.**

Tickets, stock, money, doors and rooms on one honest ledger.

AXXES builds software for the people who run live events — promoters, venues, agents
and the businesses around them. The Suite is the workspace; the ${products.length}
products below are what it is made of.

---

## What the promise means

The operator's job is reconciliation. The door count has to match the sales count.
The stock has to match what the floor believes is on the shelf. The payout has to
match the bank statement. The promoter split has to match what the venue settled.

That work happens at 2am on a Saturday, in a room, with people in it. It is the
thing a generic tool does not do, and it is the entire positioning.

Every product is judged against that question: **does this number agree with the
next number?** Where a product cannot answer it, the product does not belong.

---

## What is here

${bullets}

Everything is listed in [[The AXXES catalog]].

---

## How it fits together

- **One account.** Sign in once; every AXXES product accepts the session.
- **One database.** Products read each other's records directly. A contact linked
  to a card is the same row, not a synchronised copy — so there is no connector to
  build, nothing to fall out of sync, and no OAuth between a company's own tools.
- **One ledger.** A sale in [afters.am](https://afters.am) is a movement in
  **Stock** and a line in **Tollbooth**, because they are rows in one database
  rather than three systems somebody has to reconcile by hand at closing time.

That shared foundation is a genuine advantage. It is also a trap, and the trap is
worth stating plainly: **a shared foundation is the precondition for a suite, not a
reason to sell one.** Plenty of products share a database. Few of them can promise
that tonight's door count and tonight's stock count are the same number. See
[[Brand and messaging]] for what follows from that.

---

## Where to go next

- [[The AXXES catalog]] — every product, its key, its status and where it lives
- [[Events — the night itself]] — events, tickets, doors, rooms, photos
- [[Commerce — money and stock]] — stock, inventory, payments
- [[Developers — building on AXXES]] — the API and the developer portal
- [[Work — internal tools]] — the horizontal tools, and why they are not the pitch
- [[Brand and messaging]] — how we talk about all of this
- [[Engineering notes]] — the decisions that are easy to undo by accident
`;
}


const brandPage = `# Brand and messaging

How AXXES talks about itself, and the rules that keep it consistent.

---

## The position

> **Everything reconciles.**

That is the whole position. Everything below is an elaboration of it, and anything
that cannot be traced back to it does not ship.

---

## The rules

**1. Say what it does for the night, not what the feature is.**
Not "a CRM with a ticketing module" — "sell the night, run the door." The person
buying is standing in a room, not comparing feature grids.

**2. A tagline is not a spec.**
Short, declarative, faintly dry. The strongest lines in the portfolio are five
words: *"The collection, kept."* *"Every room is a photobooth."* A tagline that
needs a comma and a subordinate clause is a sentence, and should be a page instead.

**3. One promise, repeated.**
Reconciliation. A product page that does not connect to it is a page that could
belong to any company, and a page that could belong to any company is not doing
its job.

**4. Never invite a comparison we lose.**
We are not Linear, Notion, Stripe or Skedda. Describing a product as "our version
of" one of those asks to be judged against it — on brand, before anyone has tried
the product. Name the job, not the competitor.

**5. Show the number, not the claim.**
The strongest asset here is a screenshot of a real number explaining itself. A stock
figure with its movement trail behind it is worth more than a paragraph about
trust.

---

## Naming

**Product keys never change.** They are referenced by the plan catalog, the OIDC
registry, the integrations providers and the suite registry. Renaming a key is how
a product silently disappears for a paying customer.

**Display names do change,** and have: Manifest is now **Stock**, Qortr is now
**Rooms**, AXXES API is now **AXXES for Builders**. That is expected. Change the
name, keep the key, and say so in the commit message.

**Check the search surface before choosing a name.** Nexus, Lanes, Pulse, Folders
and Quill are all names other software companies already ship. A name nobody can
search for is a name nobody will find.

---

## Two audiences, one brand

[afters.am](https://afters.am) is consumer and loud — hot pink on black, selling a night
*out* to someone who wants to go to it. The business products are quiet and
operational.

These should not look alike. They are not selling the same thing to the same
person, and the visual difference is a deliberate signal about which one you have
landed on, not a drift that happened.
`;


const engineeringPage = `# Engineering notes

Decisions that are easy to undo by accident. Each one is here because it cost
something to work out.

---

## One secret, and the version is not optional

Every AXXES app must share a single \`BETTER_AUTH_SECRET\` and run the **same**
better-auth version — currently pinned to 1.4.19. This is documented in Handshake's
README and enforced nowhere.

A version bump in one app breaks sign-in in every other app simultaneously, and
the failure presents as "the session quietly stopped working" rather than as a
version mismatch. Nothing in the stack will tell you.

## One database means one schema means one migration

Because every product shares a database, a migration in any one app is a schema
change for all of them. There is no staging step and no room for "safe for this
app". This is also why the Vibez migrations could not simply be applied wherever it
was most convenient to apply them.

### The product list lives in the database, not in a file

\`axxes_product\` is the catalog. The members launcher, the public product page and
the API plan catalog all read it.

That is deliberate. Before it, a product had to be added to a hard-coded array
*and* to the seed file, and one of them would eventually be forgotten — which is
exactly how the dead and phantom product links appeared in the first place.

## The Vibez feed needed no account

Most people at a night bought a ticket as a guest and never made an account. The
feed required a signed-in Clerk session, which served the people least likely to
be in the room at all.

A guest now redeems the ticket they already hold for a signed token and is
identified by a subject rather than an account. The access check re-reads the
ticket on every request instead of trusting the cookie, so refunding or cancelling
a ticket revokes access immediately rather than at some later expiry.

## Upload tickets must fail closed

The signing secret for upload tickets used to fall through a chain of other
environment variables and finally to an empty string — which is a constant, not a
secret. With nothing configured, anyone could mint a valid upload permission for
any event.

It now refuses outright when the secret is missing. A loud failure in one place
beats a quiet forgery in another.

## Removal should be reversible

Deleting a photo on removal, and separately offering to restore it, means "restore"
puts a broken image back in the middle of the feed — worse than the mistake it was
undoing.

Removal now only hides the post. The file is purged later, after a grace period,
and a restore attempted after that point says plainly that it is too late.

## Migrations must be rehearsed, not read

Three separate ordering and idempotence defects in the Vibez migration chain were
invisible to reading them and obvious within minutes of running them against a real
Postgres. One of them would have failed every fresh deploy — a defect a code review
cannot catch, because it is only wrong against a database.
`;


/* --------------------------------------------------------------------- main */

function buildPages(products) {
  return [
    { icon: "🏛️", title: "AXXES", content: overviewPage(products) },
    { icon: "📋", title: "The AXXES catalog", content: catalogPage(products) },
    ...FAMILIES.map((f) => ({
      icon: f.icon,
      title: f.title,
      content: familyPage(
        f,
        products.filter((p) => p.category === f.category)
      ),
    })),
    { icon: "🗣️", title: "Brand and messaging", content: brandPage },
    { icon: "🔧", title: "Engineering notes", content: engineeringPage },
  ];
}

function resolveUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const m = readFileSync(join(ROOT, ".env.local"), "utf8").match(
      /^DATABASE_URL="?([^"\n]+)/m
    );
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function digest(docs) {
  return createHash("sha256")
    .update(docs.map((d) => `${d.title} ${d.content}`).join(" "))
    .digest("hex")
    .slice(0, 12);
}

async function main() {
  const url = resolveUrl();
  if (!url) {
    console.error("No DATABASE_URL. Set it, or run from the repo with .env.local present.");
    process.exit(1);
  }

  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url);

  const products = parseCatalog();
  if (products.length === 0) {
    // Writing an empty space over a good one is worse than writing nothing.
    console.error("Catalog parse produced no products — refusing to write.");
    process.exit(1);
  }
  const docs = buildPages(products);

  // A [[wiki link]] to a page that does not exist renders as "create this page",
  // so a typo becomes a dead link rather than an error. Catch it here instead.
  const titles = new Set(docs.map((d) => d.title.toLowerCase()));
  const dangling = new Set();
  for (const d of docs) {
    for (const m of d.content.matchAll(/\[\[([^\]|]{1,200})(?:\|[^\]]{1,200})?\]\]/g)) {
      if (!titles.has(m[1].trim().toLowerCase())) dangling.add(`${d.title} -> ${m[1]}`);
    }
  }
  if (dangling.size) {
    console.error("Wiki links pointing at pages that do not exist:");
    for (const l of dangling) console.error(`  ${l}`);
    process.exit(1);
  }

  // Render to stdout for review, without touching the database at all.
  // Accepts both --print and --print=<title filter>.
  const printArg = process.argv.find(
    (a) => a === "--print" || a.startsWith("--print=")
  );
  if (printArg) {
    const only = printArg.includes("=") ? printArg.split("=")[1] : null;
    for (const d of docs) {
      if (only && !d.title.toLowerCase().includes(only.toLowerCase())) continue;
      console.log(`\n${"=".repeat(70)}\n${d.icon}  ${d.title}\n${"=".repeat(70)}\n`);
      console.log(d.content);
    }
    return;
  }

  console.log(`Catalog : ${products.length} products`);
  console.log(`Tenant  : ${TENANT.name}`);
  console.log(`Space   : Company · ${docs.length} pages`);
  console.log(`Digest  : ${digest(docs)}\n`);

  const spaces = await sql`
    select id::text, name from nexus_spaces
    where tenant_id = ${TENANT.id} and deleted_at is null
  `;
  const space = spaces.find((s) => s.name === "Company");

  if (!WRITE) {
    console.log("Dry run — nothing written. Pass --write to apply.\n");
    for (const d of docs) {
      console.log(
        `  ${d.icon}  ${d.title.padEnd(32)} ${String(d.content.length).padStart(6)} chars`
      );
    }
    console.log(`\nSpace ${space ? "exists" : "will be created"}: ${space?.id ?? "(new)"}`);
    return;
  }

  let spaceId = space?.id;
  const description = "What AXXES is, what it makes, and how we talk about it.";

  if (!spaceId) {
    const rows = await sql`
      insert into nexus_spaces (tenant_id, name, icon, description, created_by_id)
      values (${TENANT.id}, ${"Company"}, ${"🏛️"}, ${description}, ${AUTHOR})
      returning id::text
    `;
    spaceId = rows[0].id;
    console.log(`Created space "Company" ${spaceId}`);
  } else {
    await sql`
      update nexus_spaces set description = ${description} where id = ${spaceId}
    `;
    console.log(`Reusing space "Company" ${spaceId}`);
  }

  // Match on title so a re-run edits pages in place instead of duplicating them.
  const current = await sql`
    select id::text, title, content from nexus_pages
    where space_id = ${spaceId} and deleted_at is null
  `;
  const byTitle = new Map(current.map((p) => [p.title.toLowerCase(), p]));

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const [position, doc] of docs.entries()) {
    const prior = byTitle.get(doc.title.toLowerCase());

    if (!prior) {
      await sql`
        insert into nexus_pages
          (tenant_id, space_id, title, icon, content, position, created_by_id, updated_by_id)
        values (
          ${TENANT.id}, ${spaceId}, ${doc.title}, ${doc.icon}, ${doc.content},
          ${position}, ${AUTHOR}, ${AUTHOR}
        )
      `;
      created++;
      continue;
    }

    if (prior.content === doc.content) {
      unchanged++;
      continue;
    }

    // Snapshot before overwriting, so a bad seed run is recoverable.
    await sql`
      insert into nexus_page_versions (page_id, title, content, author_id)
      values (${prior.id}, ${doc.title}, ${prior.content}, ${AUTHOR})
    `;
    await sql`
      update nexus_pages
         set content = ${doc.content},
             icon = ${doc.icon},
             position = ${position},
             updated_by_id = ${AUTHOR},
             updated_at = now()
       where id = ${prior.id}
    `;
    updated++;
  }

  // Backlinks are served from nexus_links, which the editor normally rebuilds on
  // every save. Writing pages straight to the table skips that, so without this
  // the pages exist but nothing links to them and the graph is empty.
  await rebuildLinks(sql, TENANT.id, spaceId);

  const graph = await sql`
    select count(*)::int n from nexus_links
    where from_page_id in (
      select id from nexus_pages where space_id = ${spaceId} and deleted_at is null
    )
  `;
  console.log(`Links: ${graph[0].n} edges rebuilt.`);

  console.log(`\nPages: ${created} created, ${updated} updated, ${unchanged} unchanged.`);
  console.log(`https://nexus.axxes.club/dashboard/s/${spaceId}`);
}

/**
 * Recompute [[wiki link]] edges for a space.
 *
 * Mirrors backfillLinksTo() in src/lib/nexus/actions.ts: resolve by
 * lower(title) across the tenant, never link a page to itself.
 */
async function rebuildLinks(sql, tenantId, spaceId) {
  const pages = await sql`
    select id::text, title, content from nexus_pages
    where space_id = ${spaceId} and deleted_at is null
  `;

  const byLowerTitle = new Map(pages.map((p) => [p.title.toLowerCase(), p.id]));
  const edges = new Set();

  for (const p of pages) {
    const body = p.content.replace(/```[\s\S]*?```|`[^`\n]*`/g, "");
    for (const m of body.matchAll(/\[\[([^\]|]{1,200})(?:\|[^\]]{1,200})?\]\]/g)) {
      const target = byLowerTitle.get(m[1].trim().toLowerCase());
      if (target && target !== p.id) edges.add(`${p.id}|${target}`);
    }
  }

  await sql`
    delete from nexus_links
    where from_page_id in (
      select id from nexus_pages where space_id = ${spaceId} and deleted_at is null
    )
  `;

  for (const edge of edges) {
    const [from, to] = edge.split("|");
    await sql`
      insert into nexus_links (from_page_id, to_page_id)
      values (${from}, ${to})
      on conflict do nothing
    `;
  }
}

main().catch((err) => {
  console.error("Failed:", err?.message ?? err);
  process.exit(1);
});

