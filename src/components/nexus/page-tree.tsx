"use client"
import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import type { TreePage } from "@/lib/nexus/types"
import { createPage, deletePage, duplicatePage, movePage, savePage } from "@/lib/nexus/actions"
import { descendantIds } from "@/lib/nexus/management"
import { ActionMenu, ManagementDialog, OverflowButton } from "./management-ui"
import { SpaceActions } from "./space-actions"

type DialogState = { page: TreePage; kind: 'rename' | 'icon' | 'move' | 'delete' }
export function PageTree({ spaceId, spaceName, spaceIcon, spaceDescription, pages, canWrite = true, canDelete = true }: { spaceId: string; spaceName: string; spaceIcon: string; spaceDescription: string | null; pages: TreePage[]; canWrite?: boolean; canDelete?: boolean }) {
 const router = useRouter()
 const { pageId: current } = useParams<{ pageId?: string }>()
 const [open, setOpen] = useState<Set<string>>(new Set())
 const [mobile, setMobile] = useState(false)
 const [menu, setMenu] = useState<{x:number;y:number;page:TreePage} | null>(null)
 const [dialog, setDialog] = useState<DialogState | null>(null)
 const [error, setError] = useState<string | null>(null)
 const [pending, start] = useTransition()
 const children = useMemo(() => { const map = new Map<string | null, TreePage[]>(); for (const p of pages) map.set(p.parentId, [...(map.get(p.parentId) ?? []),p]); return map }, [pages])
 useEffect(() => { setMobile(false); if (!current) return; setOpen(old => { const next = new Set(old); const byId = new Map(pages.map(p=>[p.id,p])); let cursor=byId.get(current)?.parentId; while(cursor && !next.has(cursor)) { next.add(cursor); cursor=byId.get(cursor)?.parentId } return next }) }, [current,pages])
 useEffect(() => {
  if (!mobile) return
  const rail=document.getElementById('nexus-page-rail')!
  const previous=document.activeElement as HTMLElement | null
  const overflow=document.body.style.overflow
  document.body.style.overflow='hidden'
  rail.querySelector<HTMLElement>('a,button')?.focus()
  const onKey = (e: KeyboardEvent) => {
   if(e.key==='Escape' && !e.defaultPrevented && !document.querySelector('dialog[open], [role="menu"]')) setMobile(false)
   if(e.key==='Tab' && !document.querySelector('dialog[open], [role="menu"]')) {
    const items=Array.from(rail.querySelectorAll<HTMLElement>('a,button:not(:disabled)')).filter(node=>node.getClientRects().length>0)
    const first=items[0],last=items[items.length-1]
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
   }
  }
  window.addEventListener('keydown',onKey)
  return () => {window.removeEventListener('keydown',onKey);document.body.style.overflow=overflow;previous?.focus()}
 }, [mobile])
 const run = (work: () => Promise<void>) => { setError(null); start(async () => { try { await work(); router.refresh() } catch(e) { setError(e instanceof Error ? e.message : 'Could not complete this action. Try again.') } }) }
 const newPage = (parent: string | null) => run(async () => { const result = await createPage(spaceId,parent); if(parent) setOpen(old => new Set(old).add(parent)); router.push(result.href) })
 const showDialog = (page:TreePage,kind:DialogState['kind']) => { setError(null); setDialog({page,kind}) }
 const renderRow = (page:TreePage,depth:number): React.ReactNode => {
  const kids = children.get(page.id) ?? []; const expanded = open.has(page.id)
  return <li key={page.id}><div className={`flex items-center rounded-md text-sm ${current===page.id?'bg-panel-2 text-text':'text-muted hover:bg-panel-2'}`} style={{paddingLeft:4+depth*14}} onContextMenu={e=>{e.preventDefault();setMenu({x:e.clientX,y:e.clientY,page})}} data-tree-page={page.title}>
   <button type="button" disabled={!kids.length} aria-label={`${expanded?'Collapse':'Expand'} ${page.title}`} aria-expanded={kids.length ? expanded : undefined} className={`grid size-9 shrink-0 place-items-center rounded hover:bg-line ${kids.length?'':'invisible'}`} onClick={()=>setOpen(old=>{const next=new Set(old);if(next.has(page.id))next.delete(page.id);else next.add(page.id);return next})}><svg viewBox="0 0 24 24" className={`size-4 transition-transform ${expanded?'rotate-90':''}`} fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 5 7 7-7 7"/></svg></button>
   <Link href={`/dashboard/s/${spaceId}/${page.id}`} className="min-w-0 flex-1 truncate py-2" onClick={()=>setMobile(false)}><span className="mr-2">{page.icon ?? '📄'}</span>{page.title}</Link>
   <OverflowButton label={`Actions for ${page.title}`} open={(x,y)=>setMenu({x,y,page})}/></div>{expanded&&kids.length>0&&<ul>{kids.filter(k=>k.id!==page.id && depth < pages.length).map(k=>renderRow(k,depth+1))}</ul>}</li>
 }
 return <>
 <button type="button" aria-expanded={mobile} aria-controls="nexus-page-rail" onClick={()=>setMobile(true)} className="fixed bottom-4 left-4 z-40 rounded-full border border-line bg-panel px-4 py-3 text-sm shadow-lg lg:hidden">☰ Pages</button>
 {mobile&&<button aria-label="Close pages" className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={()=>setMobile(false)}/>}
 <aside id="nexus-page-rail" role={mobile?"dialog":undefined} aria-modal={mobile?true:undefined} aria-label="Pages" className={`${mobile?'flex':'hidden'} fixed inset-y-0 left-0 z-50 w-[min(20rem,85vw)] shrink-0 flex-col border-r border-line bg-panel lg:sticky lg:top-0 lg:z-auto lg:flex lg:h-dvh lg:w-72`}>
 <div className="flex items-center gap-1 px-4 py-4"><Link href={`/dashboard/s/${spaceId}`} className="min-w-0 flex-1 truncate font-semibold">{spaceIcon} {spaceName}</Link><SpaceActions space={{id:spaceId,name:spaceName,icon:spaceIcon,description:spaceDescription,pages:pages.length}} canWrite={canWrite} canDelete={canDelete}/><button type="button" aria-label="Close pages" className="size-9 lg:hidden" onClick={()=>setMobile(false)}>×</button></div>
 {error&&!dialog&&<p role="alert" className="px-4 pb-2 text-sm text-danger">{error}</p>}
 <ul className="flex-1 overflow-y-auto px-2 pb-4">{(children.get(null)??[]).map(p=>renderRow(p,0))}</ul>{canWrite&&<div className="border-t border-line p-2"><button type="button" disabled={pending} onClick={()=>newPage(null)} className="w-full rounded px-3 py-3 text-left text-sm hover:bg-panel-2">+ New page</button></div>}</aside>
 {menu&&<ActionMenu x={menu.x} y={menu.y} close={()=>setMenu(null)} items={[
 {label:canWrite?'Open / edit':'Open',action:()=>router.push(`/dashboard/s/${spaceId}/${menu.page.id}`)},
 {label:'Rename',disabled:!canWrite,action:()=>showDialog(menu.page,'rename')},{label:'Change icon',disabled:!canWrite,action:()=>showDialog(menu.page,'icon')},
 {label:'New page inside',disabled:!canWrite,action:()=>newPage(menu.page.id)},{label:'Move to…',disabled:!canWrite,action:()=>showDialog(menu.page,'move')},
 {label:'Copy link',action:()=>run(async()=>navigator.clipboard.writeText(`${window.location.origin}/dashboard/s/${spaceId}/${menu.page.id}`))},
 {label:'Duplicate',disabled:!canWrite,action:()=>run(async()=>{const result=await duplicatePage(menu.page.id);router.push(result.href)})},
 {label:'Delete',danger:true,disabled:!canDelete,action:()=>showDialog(menu.page,'delete')}
 ]}/>}
 {dialog&&<ManagementDialog title={`${dialog.kind==='delete'?'Delete':dialog.kind==='move'?'Move':dialog.kind==='icon'?'Change icon for':'Rename'} “${dialog.page.title}”`} close={()=>{setDialog(null);setError(null)}} pending={pending} error={error} danger={dialog.kind==='delete'} confirmLabel={dialog.kind==='delete'?'Delete pages':'Save'} submit={form=>run(async()=>{
  const page=dialog.page
  if(dialog.kind==='delete') {const gone=descendantIds(pages,page.id);await deletePage(page.id);if(current&&gone.has(current))router.push(`/dashboard/s/${spaceId}`)}
  else if(dialog.kind==='move') {const parent=String(form.get('parent')||'')||null;await movePage(page.id,parent);if(parent)setOpen(old=>new Set(old).add(parent))}
  else await savePage(page.id,dialog.kind==='icon'?{icon:String(form.get('icon')||'')}:{title:String(form.get('title')||'')})
  setDialog(null)
 })}>
 {dialog.kind==='delete'?<p className="text-sm text-muted">This deletes this page and {descendantIds(pages,dialog.page.id).size-1} nested pages from this space. Attached files remain in Folders.</p>:dialog.kind==='move'?<label className="grid gap-2 text-sm">Destination<select name="parent" defaultValue={dialog.page.parentId??''} className="input"><option value="">Top level</option>{pages.filter(p=>!descendantIds(pages,dialog.page.id).has(p.id)).map(p=><option key={p.id} value={p.id}>{p.icon??'📄'} {p.title}</option>)}</select></label>:<label className="grid gap-2 text-sm">{dialog.kind==='icon'?'Icon':'Title'}<input autoFocus name={dialog.kind==='icon'?'icon':'title'} defaultValue={dialog.kind==='icon'?dialog.page.icon??'':dialog.page.title} maxLength={dialog.kind==='icon'?16:200} required={dialog.kind==='rename'} className="input"/></label>}
 </ManagementDialog>}
 </>
}
