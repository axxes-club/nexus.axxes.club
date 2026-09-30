# Folders asset ownership and Nexus UX — approved design

Status: approved by the user and implemented on feature branches. Production rollout is pending; see ../../folders-integration.md.

## Intent

Every asset uploaded through an Axxes app has an explicit owner and is visible and manageable in Folders. Users choose personal or workspace storage and their destination folder. Nexus supplies desktop context menus and accessible mobile controls, and uses Folders for files and images. The integration becomes the standard for other Axxes apps.

## Existing implementation

Nexus has nested pages, a basic page context menu, tenant-scoped server actions, and a Markdown editor. It lacks space editing/deletion and asset uploads. Its tree expansion uses small text glyphs.

Folders lives in `dam.axxes.club`. Assets currently require a tenant ID and have neither a user owner nor trash/expiration fields. Folders are inferred from free-text asset paths, so empty folders are not persisted. UploadThing callbacks insert shared asset rows. Deletion removes rows and may permanently delete uploaded files. Signed share links and phone upload sessions expire, but asset expiration is absent. Shared schema ownership lives in `members.axxes.club`.

## Recommended architecture

Build ownership and lifecycle into Folders, with shared-schema migrations maintained by the platform schema owner. Nexus consumes an authenticated Folders integration API. Avoid separate ownership or expiration implementations in each consumer app.

Two alternatives are unsuitable for the complete request: Nexus-only asset fields would leave Folders unable to enforce lifecycle consistently; reusing the current workspace uploader unchanged would supply uploads but omit personal ownership and recoverable deletion.

## Ownership and destination

- Each asset has one explicit owning principal: a user or a workspace. Always record the uploading user separately. Workspace ownership is displayed clearly; its authorized administrators manage ownership and lifecycle.
- Users can choose their personal library or a workspace library they may write to. The destination picker shows the owner, folder, visibility, and expiration policy before upload.
- Default new app uploads to the user's personal `/Apps/Nexus` folder; remember an explicitly chosen destination per user and app. Users can choose a custom folder or reset the default.
- Persist libraries and hierarchical folders independently of files. Ensure `/Apps/Nexus` idempotently in the selected library; reuse it on subsequent uploads. Empty folders remain visible.
- Ownership transfers are explicit authorized operations, audited, and do not happen merely because an asset is attached to a page or moved between folders. Moving between owners requires a transfer, not an ordinary folder move.
- Existing assets retain workspace ownership during migration. Do not infer individual ownership from workspace memberships.

## Sharing and app attachments

- Model folder access grants separately from ownership. A shared folder retains its owner. Authorized recipients may upload according to its policy and see who will own their upload.
- Store stable asset IDs in app attachments and record each app/record use in Folders. Support multiple pages and apps referencing the same asset.
- Attaching a personal asset to a shared Nexus page explicitly grants that page's audience access to the attachment, without exposing the user's library or silently transferring ownership. Explain this in the attachment flow.
- Folders lists source app, owner, destination, and all authorized app usages. Nexus provides an Open in Folders action.
- Removing an attachment or deleting a Nexus page removes its usage/grant; it does not delete the owned asset.
- Resolve attachments through an authorization and lifecycle check. Private assets must not be exposed through permanent public storage URLs. The delivery implementation must cover images, downloads, caches, and expiring delivery URLs.

## Trash, expiration, and restoration

- Normal deletion moves an asset or folder to Trash. Owners can restore it or choose permanent deletion. Permanent deletion checks remaining references to the same stored object before removing bytes.
- Optional asset and folder expiration moves the affected content to Trash automatically. Shared folders use the same rules. Share-link expiration is a separate setting and only ends access via that link.
- Display the effective expiration date when folder policy applies. An explicit file setting may shorten that deadline; extending it beyond the folder deadline requires permission to change the folder policy. No expiration is the default.
- Enforce expiration at read time as well as through a retryable scheduled worker, so late worker execution cannot leave expired assets visible. Jobs must be idempotent and record why and when content was trashed.
- Expiration/deletion revokes delivery and sharing access. Nexus shows an unavailable attachment placeholder; it never uploads a replacement silently. Show affected app usages before a manual deletion.
- Restore retains stable asset IDs and app links, clears or replaces elapsed deadlines explicitly, and restores access only when existing grants are still valid. Permanent deletion leaves a meaningful attachment tombstone.
- Initially retain Trash until the owner permanently deletes it. Any automatic permanent-deletion policy needs an explicit user setting.

## Reusable integration contract

Folders owns library/destination selection, folder creation, upload authorization, completion registration, attachment grants, delivery, lifecycle, and app usage records. App identity is registered and verified server-side; clients cannot choose arbitrary app identities, owners, or grants.

Provide reusable client controls and a documented server API for destination selection, uploads, selecting existing files, attaching/detaching assets, and Open in Folders. Upload completion is idempotent and binds the stored object to the authorized owner and destination. Handle partially completed uploads and retries without creating duplicate assets or orphaned bytes.

## Nexus UX

- Pages and spaces have right-click menus and visible action buttons usable with keyboard and touch.
- Page actions: open/edit, rename, change icon, create child, move, copy link, and delete. Space actions: open, edit name/icon/description, create page, and delete. Destructive dialogs show the descendant count and scope.
- Replace browser prompts with accessible dialogs. Menus clamp to the viewport, support keyboard navigation/Escape, restore focus, and report errors without leaving optimistic changes permanently applied.
- Replace tree expansion glyphs with clear SVG chevrons, larger hit areas, and expanded-state labels. Provide mobile access to the page tree and action controls.
- Editor uploads support drag/drop, pasted images, multiple-file selection, choosing existing Folders assets, phone photo-library/camera selection, progress, cancellation, and retry.
- Reuse Folders' desktop-to-phone handoff with short-lived, destination-bound authorization. Bind ownership, app usage, and attachment delivery to the same flow as direct uploads.
- Images render inline; other files render downloadable attachments. Insertion uses stable asset references and preserves edits made while an upload is in flight.

## Delivery order and verification

1. Folders foundation: schema migration/backfill, libraries, owners, persistent folders, access grants, trash, expiration, authenticated delivery, and Folders management UI.
2. Reusable integration: authenticated upload/attachment API, reusable picker, app registration, phone handoff, and usage links.
3. Nexus integration and desktop/mobile UX.

Verify ownership boundaries, workspace permissions, explicit transfers, shared-folder behavior, multi-app references, repeated upload callbacks, upload failure cleanup, expiration at access time, job retries, restoration, and permanent deletion. Exercise desktop keyboard/right-click flows and phone uploads in browsers. Read each project's AGENTS.md and installed Next.js documentation before implementation. Shared-schema migrations and worker configuration must be reviewable before production rollout.

## Review

This proposal interprets an owner as either a user or an explicitly selected workspace, with the uploader always recorded. It defaults to personal storage and makes shared-page attachment access explicit. User review is required before implementation under the brainstorming workflow.
