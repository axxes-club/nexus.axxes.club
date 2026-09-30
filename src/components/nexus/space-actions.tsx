"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { SpaceT } from "@/lib/nexus/types"
import { createPage, deleteSpace, updateSpace } from "@/lib/nexus/actions"
import { ActionMenu, ManagementDialog, OverflowButton } from "./management-ui"

type Space = SpaceT & { pages: number }
export function SpaceActions({ space, card = false, canWrite = true, canDelete = true }: { space: Space; card?: boolean; canWrite?: boolean; canDelete?: boolean }) {
 const router=useRouter()
 const [menu,setMenu]=useState<{x:number;y:number}|null>(null)
 const [dialog,setDialog]=useState<'edit'|'delete'|null>(null)
 const [error,setError]=useState<string|null>(null)
 const [pending,start]=useTransition()
 const run=(work:()=>Promise<void>)=>{setError(null);start(async()=>{try{await work();router.refresh()}catch(e){setError(e instanceof Error?e.message:'Could not complete this action. Try again.')}})}
 const actions=<><OverflowButton label={`Actions for ${space.name}`} open={(x,y)=>setMenu({x,y})}/>{error&&!dialog&&<p role="alert" className="text-sm text-danger">{error}</p>}
 {menu&&<ActionMenu {...menu} close={()=>setMenu(null)} items={[
 {label:'Open space',action:()=>router.push(`/dashboard/s/${space.id}`)},
 {label:'Edit space',disabled:!canWrite,action:()=>{setError(null);setDialog('edit')}},
 {label:'Create page',disabled:!canWrite,action:()=>run(async()=>{const page=await createPage(space.id,null);router.push(page.href)})},
 {label:'Copy link',action:()=>run(async()=>navigator.clipboard.writeText(`${window.location.origin}/dashboard/s/${space.id}`))},
 {label:'Delete space',danger:true,disabled:!canDelete,action:()=>{setError(null);setDialog('delete')}}
 ]}/>}
 {dialog&&<ManagementDialog title={dialog==='edit'?'Edit space':`Delete “${space.name}”`} close={()=>setDialog(null)} pending={pending} error={error} danger={dialog==='delete'} confirmLabel={dialog==='delete'?'Delete space':'Save'} submit={form=>run(async()=>{
 if(dialog==='delete'){await deleteSpace(space.id);router.push('/dashboard')}else await updateSpace(space.id,{name:String(form.get('name')||''),icon:String(form.get('icon')||''),description:String(form.get('description')||'')})
 setDialog(null)
 })}>
 {dialog==='delete'?<p className="text-sm text-muted">This deletes the space and all {space.pages} pages, including nested pages. Attached files remain in Folders.</p>:<><label className="grid gap-2 text-sm">Name<input name="name" autoFocus required maxLength={80} defaultValue={space.name} className="input"/></label><label className="grid gap-2 text-sm">Icon<input name="icon" maxLength={16} defaultValue={space.icon} className="input"/></label><label className="grid gap-2 text-sm">Description<textarea name="description" maxLength={2000} defaultValue={space.description??''} className="input min-h-24"/></label></>}
 </ManagementDialog>}</>
 if(!card)return actions
 return <div className="card relative p-5 transition hover:border-accent/50" onContextMenu={e=>{e.preventDefault();setMenu({x:e.clientX,y:e.clientY})}}><div className="absolute right-2 top-2">{actions}</div><Link href={`/dashboard/s/${space.id}`} className="block pr-6"><p className="text-2xl">{space.icon}</p><p className="mt-2 font-medium">{space.name}</p>{space.description&&<p className="mt-1 line-clamp-2 text-sm text-muted">{space.description}</p>}<p className="mt-1 text-sm text-muted">{space.pages} page{space.pages===1?'':'s'}</p></Link></div>
}
