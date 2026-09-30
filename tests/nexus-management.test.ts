import { test } from 'node:test'
import assert from 'node:assert/strict'
import { descendantIds, menuPosition } from '../src/lib/nexus/management'

test('move destinations exclude a whole subtree even when descendants precede parents', () => {
 const pages = [{id:'grandchild',parentId:'child'},{id:'outside',parentId:null},{id:'child',parentId:'root'},{id:'root',parentId:null}]
 assert.deepEqual([...descendantIds(pages,'root')].sort(), ['child','grandchild','root'])
 assert.deepEqual(pages.filter(p => !descendantIds(pages,'root').has(p.id)).map(p => p.id), ['outside'])
})
test('malformed cyclic trees terminate and retain unrelated pages', () => {
 assert.deepEqual([...descendantIds([{id:'a',parentId:'b'},{id:'b',parentId:'a'},{id:'other',parentId:null}],'a')].sort(), ['a','b'])
})
test('context menus remain reachable at viewport edges and on small phones', () => {
 assert.deepEqual(menuPosition(399,799,240,320,400,800), {left:152,top:472})
 assert.deepEqual(menuPosition(-20,-30,240,900,200,600), {left:8,top:8})
})

test('failed attachment duplication removes the newly created page and reports original failure', async () => {
 const { duplicateWithCleanup } = await import('../src/lib/nexus/management')
 const records = new Set(['original'])
 await assert.rejects(duplicateWithCleanup(async () => { records.add('copy'); return {id:'copy'} }, async () => { throw new Error('Folders unavailable') }, async copy => {records.delete(copy.id)}), /Folders unavailable/)
 assert.deepEqual([...records], ['original'])
})

test('viewer and guest roles cannot mutate pages and members cannot delete', async () => {
 const { assertMutationRole } = await import('../src/lib/nexus/management')
 for (const role of ['guest','viewer','unknown']) assert.throws(()=>assertMutationRole(role), /permission/i)
 for (const role of ['owner','admin','manager','member']) assert.doesNotThrow(()=>assertMutationRole(role))
 assert.throws(()=>assertMutationRole('member',true), /permission/i)
 for (const role of ['owner','admin','manager']) assert.doesNotThrow(()=>assertMutationRole(role,true))
})
