# Folders assets and Nexus UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Track tasks with checkboxes.

**Goal:** Deliver owned, configurable Folders assets and polished Nexus management and uploads.

**Architecture:** Folders owns assets, access and lifecycle. Shared migrations live in members; Nexus uses a same-origin server adapter and stable attachment references. Independent UI work uses the contracts below.

**Tech Stack:** Installed Next.js, React, Drizzle/Postgres, UploadThing, TypeScript and Node test runner via tsx.

**Spec:** ../specs/2026-09-30-folders-assets-and-nexus-ux-design.md (approved by user's instruction to proceed).

## Global Constraints

- Personal default `/Apps/Nexus`; workspace and custom destinations available.
- Explicit owner on every asset; uploader separately recorded; legacy files remain workspace-owned.
- Expiration and deletion revoke app delivery and move to recoverable Trash.
- Read installed Next.js guides before code. No production schema mutation, deployment or deletion in this implementation session.
- Work on feature branches in the existing clean checkouts, preserving user files. Native execution authorization is the user's “Just go for it.”

## Review Focus

- Unauthorized personal file delivery must fail even if the caller knows its ID.
- Expired shared folders must block delivery before the scheduled sweep runs.
- Upload completion retry must not create duplicate assets.
- Editing while uploading must preserve new text and cursor intent.
- Page deletion must detach usages without trashing owned files.

### Task 1: Platform ownership and Folders lifecycle

**Files:** members `scripts/folders-ownership.sql`, shared assets/folders schema; dam `src/lib/db/schema.ts`, `src/lib/library.ts`, `src/lib/asset-policy.ts`, existing API/queries/upload callbacks, lifecycle routes.

**Interfaces:** assets gain nullable tenantId, ownerUserId, uploadedById, appKey, storageKey, expiresAt, trashedAt and trashReason. Personal library key is `personal`; other library keys are tenant UUIDs. `guard(headers, libraryId, need)` returns viewer and tenant-like access whose personal id is `personal`. Persistent folders store libraryId, path, expiresAt, trashedAt; folder grants support shared upload/read. Asset app grants identify appKey, recordId, audienceTenantId.

- [ ] Write failing policy tests for personal access, role permissions, expiry inheritance, trash and restore deadlines.
- [ ] Run tests and observe missing policy failures.
- [ ] Implement ownership migration/backfill, persistent folders and grants, policy, library access, scoped queries, recoverable deletion, expiry sweep, and protected delivery.
- [ ] Run policy tests, TypeScript checks and migration fixture verification.

### Task 2: Folders management UI

**Files:** dam `src/components/folders/*`, `src/lib/types.ts`, `src/lib/assets.ts`.

**Interfaces:** existing API receives `tenantId: personal | UUID`; `/api/assets?trash=1` lists Trash; PATCH asset `{expiresAt, restore:true}` restores; DELETE `?permanent=1` permanently deletes only trashed assets. POST/PATCH folders persists empty folders and folder expiration. Ownership returned in Asset; lifecycle fields returned as ISO dates.

- [ ] Add meaningful tests for lifecycle display inputs if extracted logic requires them.
- [ ] Add personal library selection, visible owner/uploader, expiration controls, Trash/restore/permanent-delete flows, shared folder controls and persistent empty folders.
- [ ] Verify types and browser interactions; do not mutate Task 1 backend files.

### Task 3: Nexus desktop/mobile management

**Files:** Nexus tree, space cards, action menus/dialogs, `src/lib/nexus/actions.ts`, management utilities/tests.

**Interfaces:** same existing page URLs/actions; add `updateSpace(id, patch)`, `deleteSpace(id)`, `duplicatePage(id)`. Detach deleted page IDs using root-owned `detachPageAssets(ids)` exported from `src/lib/folders/server.ts` once available.

- [ ] Write failing tests for descendant exclusions and menu positioning.
- [ ] Implement accessible action menus/dialogs for pages/spaces, larger SVG chevrons, visible touch controls, responsive page rail, safe failures and management actions.
- [ ] Verify tests and Nexus TypeScript.

### Task 4: Reusable upload integration and Nexus editor

**Files:** dam `/api/apps/*`, integration ticket/upload helper; Nexus `src/lib/folders/*`, `/api/folders/*`, asset picker and editor; integration documentation.

**Interfaces:** authenticated Folders app uploads use signed short-lived tickets issued by Nexus's server for registered `nexus` page records and verified audiences. Destinations are owner-authorized server-side. Register stable asset grants, return Markdown URLs `/api/folders/assets/:id?pageId=:pageId` and record Folders usages. API adapter supports destinations, uploads, existing assets, attach and handoff.

- [ ] Write failing tests for signed ticket tampering/expiry, Markdown filename escaping and insertion preserving edits.
- [ ] Implement shared contract, upload lifecycle and desktop/mobile picker, pasted/dropped image handling, phone handoff and authenticated streaming attachment delivery.
- [ ] Verify tests and both builds. Document platform migration and cron/env setup.

### Task 5: Integration review and verification

- [ ] Review ownership boundaries, expiry, public storage behavior, migration constraints, multi-page links and optimistic mutations.
- [ ] Run all added tests, TypeScript and production builds; exercise browser interaction where tooling permits.
- [ ] Obtain independent review, fix material findings and record remaining deployment prerequisites accurately.
