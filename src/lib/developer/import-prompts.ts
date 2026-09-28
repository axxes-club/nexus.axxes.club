/**
 * Ready-made AI prompts for getting content into Nexus.
 *
 * The point of these is that they are not blank textareas. Each one is
 * written for a specific model and a specific job, and each tells the model
 * the exact JSON shape Nexus will accept — so the output pastes straight
 * into the importer instead of needing a human to reshape it.
 *
 * The schema block is generated from the same constants the importer uses,
 * so a change to the shape cannot drift from the instructions.
 */

export const IMPORT_SHAPE = `{
  "space": { "icon": "📚", "name": "string" },
  "pages": [
    {
      "name": "string",
      "summary": "one sentence",
      "tags": ["string"],
      "blocks": [
        { "type": "text", "body": "markdown" },
        { "type": "callout", "body": "markdown", "tone": "info|warn|success" }
      ]
    }
  ]
}`

export type Prompt = {
  id: string
  title: string
  blurb: string
  /** For which model this was written. */
  bestFor: string
  /** The prompt itself, ready to copy. */
  text: string
}

export function buildPrompts(opts: { orgName: string; orgSlug: string; spaceName?: string }): Prompt[] {
  const { orgName, spaceName } = opts

  return [
    {
      id: "onboard",
      title: "Turn a folder of notes into a space",
      blurb:
        "Point it at a directory of markdown files, meeting notes or docs. You get a space with one page per file, the original structure kept.",
      bestFor: "Claude, ChatGPT with file access",
      text: `I have a folder of notes for ${orgName}. Read every file in it and build a Nexus space.

Rules:
- One page per source file. Keep the file's own heading structure.
- Never invent facts. If a file is a meeting note, keep the date and attendees exactly as written.
- Put each page under a space called "${spaceName ?? "Imported"}" with the 📚 icon.
- Add 2-5 tags per page drawn from the actual content, lowercase, hyphenated.
- Where a page is mostly a list of action items, add a callout block at the top summarising them.

Return ONLY JSON, no prose before or after, in exactly this shape:

${IMPORT_SHAPE}`,
    },
    {
      id: "wiki",
      title: "Build an onboarding wiki from a code repo",
      blurb:
        "Walks a repository and writes the pages a new joiner actually needs: how it fits together, how to run it, where things live.",
      bestFor: "Claude Code, Cursor",
      text: `Explore this repository and write the onboarding wiki a new engineer would want on day one.

Cover, in this order:
1. What this is, in two sentences someone outside the team would follow.
2. How to run it locally — the real commands, not the aspirational ones.
3. The shape of the codebase: the directories that matter and what belongs in each.
4. How a change gets made and shipped.
5. Anything that surprised you, where the footguns are.

Ground every claim in a file you actually read. If you cannot find something, write
"not documented in the repo" rather than guessing — a wrong onboarding page costs more
than a missing one.

Return ONLY JSON, no prose, in exactly this shape:

${IMPORT_SHAPE}`,
    },
    {
      id: "summarise",
      title: "Distil a long document into a page",
      blurb:
        "For the one huge PDF or transcript nobody will read. Keeps decisions and open questions, drops the narrative.",
      bestFor: "Any long-context model",
      text: `Condense the attached document into a single Nexus page.

Keep:
- Decisions actually made, with who made them and when, if the document says.
- Open questions and who is waiting on an answer.
- Anything with a date, number or name attached.
- Links, quoted verbatim.

Drop:
- Narration, throat-clearing and pleasantries.
- Anything you would have to guess at.

Structure the page with the decisions first. If the document is mostly one of those four
kinds of content, say so in the summary rather than padding the page to look complete.

Return ONLY JSON, no prose, in exactly this shape:

${IMPORT_SHAPE}`,
    },
    {
      id: "sop",
      title: "Write a runbook from a messy process",
      blurb:
        "Turn tribal knowledge into a procedure someone else could follow at 2am without asking you anything.",
      bestFor: "Claude, ChatGPT",
      text: `Turn the process described below into a runbook for ${orgName}.

Assume the reader is competent but has never done this before, and that they cannot ask
you a question. That means:

- Every step says what to do, not what it is called.
- Anything that is easy to get wrong gets its own callout.
- Every irreversible step names what it destroys before it happens.
- Anything that varies by environment (staging vs live) is called out explicitly.
- If a step needs a credential, say where it comes from and who holds it.

Where the process as described has a gap — a missing approval, an undefined threshold —
write the step anyway and mark it with a ⚠️ and a one-line question. Do not invent the
answer.

Return ONLY JSON, no prose, in exactly this shape:

${IMPORT_SHAPE}`,
    },
    {
      id: "migrate",
      title: "Move content in from another tool",
      blurb:
        "Export from Notion, Confluence, Airtable or Google Docs and reshape it on the way in, so links and hierarchy survive.",
      bestFor: "Any model with file access",
      text: `Convert the attached export into Nexus pages for ${orgName}.

Preserve:
- The page hierarchy. A child page becomes a page inside its parent's section, not a
  flat sibling.
- Internal links, rewritten to point at the new page names. A link you cannot resolve
  becomes plain text — do not leave a dangling reference.
- Database-like tables as callouts or lists. Nexus has no database, so a table that
  only makes sense sorted should become a list ordered the way the table was.

Drop:
- Empty pages.
- Comment threads and edit history.
- Page icons and cover images you cannot fetch.

Return ONLY JSON, no prose, in exactly this shape:

${IMPORT_SHAPE}`,
    },
  ]
}
