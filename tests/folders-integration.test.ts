import assert from "node:assert/strict"
import test from "node:test"
import { signEnvelope, verifyEnvelope } from "../src/lib/folders/envelope"
import { attachmentMarkdown, insertAttachments, referencedAttachmentIds, removedAttachmentIds } from "../src/lib/folders/markdown"

const secret = "test-secret-long-enough-for-real-hmac-signatures"
test("service envelope rejects tampering, expiration and a different app", () => {
  const payload = { appKey: "nexus", userId: "user-a", exp: 2000, action: "authorize" }
  const token = signEnvelope(payload, secret)
  assert.deepEqual(verifyEnvelope(token, secret, "nexus", 1000), payload)
  assert.equal(verifyEnvelope(token, secret, "nexus", 2000), null)
  assert.equal(verifyEnvelope(token, secret, "office", 1000), null)
  assert.equal(verifyEnvelope(token.slice(0, -4) + "aaaa", secret, "nexus", 1000), null)
  const changed = Buffer.from(JSON.stringify({ ...payload, userId: "user-b" })).toString("base64url")
  assert.equal(verifyEnvelope(changed + "." + token.split(".")[1], secret, "nexus", 1000), null)
})
test("attachment filenames cannot escape their markdown label", () => {
  assert.equal(attachmentMarkdown({ id: "asset-a", name: "Photo [1]\\.jpg", mimeType: "image/jpeg" }, "page-a"), "![Photo \\[1\\]\\\\.jpg](/api/folders/assets/asset-a?pageId=page-a)")
  assert.equal(attachmentMarkdown({ id: "asset-a", name: "Report\nfinal.pdf", mimeType: "application/pdf" }, "page-a"), "[Report final.pdf](/api/folders/assets/asset-a?pageId=page-a)")
})
test("attachments append to latest edits when the document changed during upload", () => {
  assert.equal(insertAttachments("original plus new edits", { content: "original", start: 3, end: 3 }, "[file](url)").content, "original plus new edits\n\n[file](url)\n")
  assert.equal(insertAttachments("abc", { content: "abc", start: 1, end: 2 }, "[file](url)").content, "a\n[file](url)\nc")
})
test("attachment reconciliation keeps referenced assets and ignores code examples", () => {
  const id = "11111111-1111-4111-8111-111111111111"
  const href = `/api/folders/assets/${id}?pageId=page-a`
  assert.deepEqual(referencedAttachmentIds(`![image](${href})\n[download](${href})\n\`[example](/api/folders/assets/22222222-2222-4222-8222-222222222222)\``), [id])
  assert.deepEqual(referencedAttachmentIds("The attachment has been removed."), [])
})
test("reconciliation revokes removed references without revoking uploads not yet in the saved document", () => {
  const first = "11111111-1111-4111-8111-111111111111"
  const retained = "22222222-2222-4222-8222-222222222222"
  const previous = `[one](/api/folders/assets/${first})\n[two](/api/folders/assets/${retained})`
  assert.deepEqual(removedAttachmentIds(previous, `[two](/api/folders/assets/${retained})`), [first])
  assert.deepEqual(removedAttachmentIds("Text without attachments", "Still typing while an upload completes"), [])
})
