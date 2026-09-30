import type { Attachment } from "./markdown"
export type Destination = { id: string; name: string; owner: string; canWrite?: boolean; folder?: string; expiresAt?: string | null }
export type FolderAsset = Attachment & { folder: string | null; size: number | null; expiresAt: string | null }
export type UploadAuthorization = { intentId: string; expiresAt: string; libraryId: string; folder: string }
