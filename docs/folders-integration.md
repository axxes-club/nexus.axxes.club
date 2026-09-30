# Folders as the Axxes asset service

## User flow

An app upload has an explicit owner and destination. Personal is the default; users can select a workspace, a folder shared with them, or a custom folder. Nexus creates/reuses `/Apps/Nexus` in the selected library. Ownership is separate from the uploading user and the page audience.

Files are managed in Folders regardless of source app. Attaching a file grants the page's workspace access to that individual file, not its library. Removing an attachment or deleting a page revokes that usage without deleting the asset. File/folder expiration and Trash are enforced when an app requests delivery, even if the scheduled expiration sweep has not run yet.

External URL entries remain links to third-party hosts. Their original host controls the bytes; Folders can remove the catalog entry but cannot revoke an already copied external URL. Hosted uploads use private UploadThing objects and authenticated streaming delivery. Storage URLs and keys never appear in the picker or rendered app content.

## Register another Axxes app

1. Add its server-side record authorization adapter to Folders' `src/lib/apps/registry.ts`. It must check live record, workspace, membership, and write permission; clients cannot register themselves.
2. Add its record URL resolver to `src/lib/app-links.ts` for Open in App links.
3. Reuse the signed envelope protocol in `src/lib/apps/envelope.ts` from a server-only adapter. Never ship its secret to a client. Requests contain `{appKey, token}`; the signed payload contains `{appKey, action, exp, userId, recordId, audienceTenantId, ...operationFields}`. Domain separation is `folders-app:v1:<appKey>:<base64url-payload>` with HMAC-SHA256. Service envelopes expire after 60 seconds.
4. Forward the user's shared session cookie on interactive operations. Folders compares the actual session user with the signed user and validates the app record. Completion requests use the persisted upload intent rather than a client-selected owner.
5. Use the same Folders UploadThing project/token, with private ACL, for direct browser uploads. Middleware calls `authorize`; its verified callback calls `complete`. See Nexus's `src/app/api/uploadthing/core.ts` for a working adapter with durable failed-completion cleanup.
6. Store stable asset-ID references in content and stream them through the app's authenticated delivery adapter. Reconcile removed references, copy grants when duplicating records, and detach grants before deleting records.

## Operations

All operations are POST `/api/apps/<action>` with the signed envelope. Interactive operations require the session cookie.

| Action | Additional fields | Result |
| --- | --- | --- |
| `destinations` | None | Personal, workspace and shared-folder choices; per-user/app preference key |
| `authorize` | `libraryId`, `folder`, optional `expiresAt` and existing `intentId` | Persisted upload intent, destination, expiration |
| `complete` | `intentId`, verified provider `file:{key,url,name,type,size}` | Stable asset; idempotent per intent/file key; attachment grant |
| `assets` | `libraryId`, optional `folder` | Available files in authorized scope |
| `attach` | `assetId` | Existing file attached to the authorized app record |
| `uploads` | `intentId` | Completed assets for desktop-to-phone polling |
| `copy` | `toRecordId` | Copy attachment grants to another authorized record |
| `deliver` | `assetId` | Protected bytes or an authorized external-link redirect |

`personal` refers only to the authenticated user. Shared personal library IDs use `user:<ownerId>` with an authorized folder scope. Workspace library IDs are workspace UUIDs. Upload intents last 30 minutes and callbacks recheck permissions, destination availability, record state, and lifetime. The shared cleanup outbox survives failed completion and retries byte deletion; referenced objects are retained.

Nexus's phone link is signed, destination-bound, and requires the same account as the desktop. It also offers organization switching when the phone has a different active workspace. The desktop polls the authorized intent and inserts each completed asset once.

## Rollout

These changes span three feature branches: Nexus `feat/folders-assets-nexus-ux`, Folders `feat/owned-app-assets`, and members `feat/folders-ownership-schema`. The implementation has not changed the production database or deployed either app.

1. Review and apply members' `scripts/folders-ownership.sql` through the platform migration process. Existing assets stay workspace-owned; historical uploaders are not invented. The migration adds persistent folders, owner constraints, app/folder grants, upload intents, transfer audit events, and a cleanup outbox.
2. Enable private ACL support in the shared UploadThing project. Review the Folders `scripts/protect-storage.mjs` inventory in dry-run mode, then make historical hosted objects private before exposing the new lifecycle controls. Other apps serving their raw public URLs must switch to authenticated delivery as part of this rollout.
3. Configure `DATABASE_URL`, `BETTER_AUTH_SECRET`, shared `UPLOADTHING_TOKEN` and session cookie domain in both apps. Set Nexus `FOLDERS_URL` to the intended Folders deployment; its default is `https://dam.axxes.club`. Both apps must use the shared authentication secret/cookie domain already established by Handshake.
4. Configure Folders `CRON_SECRET`; its daily Vercel job calls `/api/cron/expire` with bearer authorization. The route supports GET and POST; access-time checks enforce immediate expiration regardless of scheduling delays. No automatic permanent Trash deletion is enabled.
5. Deploy Folders, then Nexus. Verify a personal upload, workspace upload, shared-folder upload, phone handoff, inline image, file download, expiration, Trash, restoration, ownership transfer and multi-page usage with test accounts.

## Verification commands

Nexus: `npm test`, `npx tsc --noEmit --incremental false`, `npm run build`.

Folders: `npm test`, `npx tsc --noEmit --incremental false`, `npm run build`. Its tests include real PostgreSQL execution through PGlite for subtree rename/restore and durable cleanup behavior.

Members migration fixture: `NODE_PATH=../dam.axxes.club/node_modules node scripts/check-folders-migration.cjs`. Members' TypeScript check verifies schema compatibility with its consumers.

Browser smoke verification used actual Nexus components with external actions/API boundaries stubbed. It exercised desktop keyboard menus, mobile focus handling, failed rename recovery, movement/deletion scope, space editing and existing asset attachment. Real provider uploads require the migrated test deployment and credentials above.

## Production rollout attempt — 2026-09-30

Vercel rejected deployment because the account reached its daily deployment quota (`api-deployments-free-per-day`). Folders cron was changed to daily to match the current Hobby plan; read-time expiration stays immediate. Nexus production now has the shared upload token and Folders URL configured, and Folders has its cron secret. No new deployment was promoted.

The first ownership migration rolled back atomically on six historical URL assets whose workspaces no longer exist. The backfill now only creates folders for existing workspaces, preserving those asset records, with a regression fixture. Production still has the original schema and 11,306 assets. Historical storage remains unchanged. Resume migration and deployment after quota availability, then verify private uploads and phone handoff. Office currently embeds raw storage URLs in imported content; those references need authenticated delivery before protecting its four linked hosted assets.
