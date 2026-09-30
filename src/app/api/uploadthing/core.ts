import { createUploadthing, type FileRouter } from "uploadthing/next"
import { UploadThingError } from "uploadthing/server"
import { z } from "zod"
import { foldersRequest, pageContext } from "@/lib/folders/server"
import { db } from "@/lib/db"
import { sql } from "drizzle-orm"

const f = createUploadthing()
export const appFileRouter = {
  nexusAssets: f({ image: { maxFileSize: "16MB", maxFileCount: 20, acl: "private" }, blob: { maxFileSize: "64MB", maxFileCount: 20, acl: "private" } })
    .input(z.object({ pageId: z.string().uuid(), libraryId: z.string().min(1), folder: z.string().max(120), expiresAt: z.string().nullable().optional(), intentId: z.string().uuid().optional() }))
    .middleware(async ({ input, files }) => {
      try {
        if (files.length > 20) throw new Error("Upload up to 20 files at a time")
        const { cookie, ctx: _ctx, ...identity } = await pageContext(input.pageId, true)
        const res = await foldersRequest("authorize", { ...input, ...identity }, cookie)
        const auth = await res.json() as { intentId: string }
        return { intentId: auth.intentId }
      } catch (error) { throw new UploadThingError(error instanceof Error ? error.message : "Upload unavailable") }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        const res = await foldersRequest("complete", { intentId: metadata.intentId, file: { key: file.key, url: file.ufsUrl, name: file.name, size: file.size, type: file.type } })
        return await res.json() as { id: string; name: string; mimeType: string | null }
      } catch (error) {
        // The shared outbox survives a Folders outage. The worker keeps bytes
        // when a registration succeeded but its response was lost.
        await db.execute(sql`insert into folder_storage_cleanup(storage_key) values(${file.key}) on conflict do nothing`)
        throw error
      }
    }),
} satisfies FileRouter
export type AppFileRouter = typeof appFileRouter
