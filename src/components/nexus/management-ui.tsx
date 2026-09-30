"use client"
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { menuPosition } from "@/lib/nexus/management"

export type MenuItem = { label: string; action: () => void; danger?: boolean; disabled?: boolean }
export function ActionMenu({ x, y, items, close }: { x: number; y: number; items: MenuItem[]; close: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const closeRef = useRef(close)
  closeRef.current = close
  const [position, setPosition] = useState({ left: x, top: y })
  useLayoutEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null
    const node = ref.current!
    const place = () => setPosition(menuPosition(x, y, node.offsetWidth, node.offsetHeight, window.innerWidth, window.innerHeight))
    place()
    node.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [x, y])
  useEffect(() => {
    const outside = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) closeRef.current() }
    document.addEventListener('pointerdown', outside)
    return () => { document.removeEventListener('pointerdown', outside); previousFocus.current?.focus() }
  }, [])
  return <div ref={ref} role="menu" aria-label="Actions" className="fixed z-[70] max-h-[calc(100dvh-16px)] w-60 max-w-[calc(100vw-16px)] overflow-y-auto rounded-lg border border-line bg-panel p-1 shadow-2xl" style={position} onKeyDown={e => {
    const buttons = Array.from(ref.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); close() }
    else if (['ArrowDown','ArrowUp','Home','End'].includes(e.key)) { e.preventDefault(); buttons[e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus() }
  }}>{items.map(item => <button key={item.label} type="button" role="menuitem" disabled={item.disabled} className={`block w-full rounded px-3 py-2 text-left text-sm hover:bg-panel-2 focus:bg-panel-2 disabled:cursor-not-allowed disabled:opacity-40 ${item.danger ? 'text-danger' : ''}`} onClick={() => { close(); item.action() }}>{item.label}</button>)}</div>
}

export function ManagementDialog({ title, children, close, submit, pending, danger, error, confirmLabel = 'Save' }: { title: string; children: ReactNode; close: () => void; submit: (form: FormData) => void; pending: boolean; danger?: boolean; error?: string | null; confirmLabel?: string }) {
 const ref = useRef<HTMLDialogElement>(null)
 useEffect(() => { const previous = document.activeElement as HTMLElement | null; ref.current?.showModal(); return () => previous?.focus() }, [])
 return <dialog ref={ref} aria-label={title} onCancel={e => { e.preventDefault(); if (!pending) close() }} className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-xl border border-line bg-panel p-6 text-text shadow-2xl backdrop:bg-black/60">
 <form onSubmit={event => { event.preventDefault(); if (!pending) submit(new FormData(event.currentTarget)) }} className="grid gap-4"><h2 className="text-lg font-semibold">{title}</h2>{children}{error && <p role="alert" className="text-sm text-danger">{error}</p>}<div className="flex justify-end gap-2"><button type="button" disabled={pending} onClick={close} className="btn-ghost">Cancel</button><button disabled={pending} className={danger ? 'btn-primary bg-danger' : 'btn-primary'}>{pending ? 'Working…' : confirmLabel}</button></div></form></dialog>
}
export function OverflowButton({ label, open }: { label: string; open: (x: number, y: number) => void }) {
 return <button type="button" aria-label={label} aria-haspopup="menu" className="grid size-9 shrink-0 place-items-center rounded-md text-muted hover:bg-panel-2 focus-visible:outline-2 focus-visible:outline-accent" onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); open(rect.right - 240, rect.bottom) }}>•••</button>
}
