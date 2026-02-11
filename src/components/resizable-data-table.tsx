'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

/** True when primary input is coarse (touch). Resize handles are disabled so touch scroll works. */
function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    const m = window.matchMedia('(pointer: coarse)')
    setIsTouch(m.matches)
    const listener = () => setIsTouch(m.matches)
    m.addEventListener('change', listener)
    return () => m.removeEventListener('change', listener)
  }, [])
  return isTouch
}

export interface ResizableColumn<T> {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
  minWidth?: number
  defaultWidth?: number
  /** Optional custom cell renderer; otherwise row[key] is shown. */
  render?: (value: unknown, row: T) => React.ReactNode
  /** Header tooltip or accessibility */
  title?: string
}

interface ResizableDataTableProps<T extends object> {
  columns: ResizableColumn<T>[]
  rows: T[]
  keyField?: string
  maxHeight?: string
  className?: string
}

const DEFAULT_MIN = 80
const DEFAULT_WIDTH = 140

export function ResizableDataTable<T extends object>({
  columns,
  rows,
  keyField = 'id',
  maxHeight = '320px',
  className,
}: ResizableDataTableProps<T>) {
  const isTouchDevice = useIsTouchDevice()
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    columns.forEach((col) => {
      initial[col.key] = col.defaultWidth ?? DEFAULT_WIDTH
    })
    return initial
  })
  const [resizing, setResizing] = useState<string | null>(null)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const getWidth = useCallback(
    (key: string) => widths[key] ?? columns.find((c) => c.key === key)?.defaultWidth ?? DEFAULT_WIDTH,
    [columns, widths]
  )

  const handleResizeStart = useCallback(
    (colKey: string) => (e: React.MouseEvent) => {
      e.preventDefault()
      setResizing(colKey)
      startX.current = e.clientX
      startWidth.current = getWidth(colKey)
    },
    [getWidth]
  )

  useEffect(() => {
    if (!resizing) return
    const minW = columns.find((c) => c.key === resizing)?.minWidth ?? DEFAULT_MIN

    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - startX.current
      const next = Math.max(minW, startWidth.current + delta)
      setWidths((w) => ({ ...w, [resizing]: next }))
    }
    const onUp = () => setResizing(null)

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [resizing, columns])

  const tableMinWidth = columns.reduce((sum, col) => sum + getWidth(col.key), 0)
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const bodyScrollRef = useRef<HTMLDivElement>(null)

  const syncHeaderScroll = useCallback(() => {
    const body = bodyScrollRef.current
    const header = headerScrollRef.current
    if (body && header && body.scrollLeft !== header.scrollLeft) {
      header.scrollLeft = body.scrollLeft
    }
  }, [])
  const syncBodyScroll = useCallback(() => {
    const body = bodyScrollRef.current
    const header = headerScrollRef.current
    if (body && header && header.scrollLeft !== body.scrollLeft) {
      body.scrollLeft = header.scrollLeft
    }
  }, [])

  /** Table fills container; columns use % so they distribute and no empty gap on the right. */
  const tableStyles = { tableLayout: 'fixed' as const, width: '100%', minWidth: tableMinWidth }
  const getColWidthPct = useCallback(
    (key: string) => (tableMinWidth > 0 ? (getWidth(key) / tableMinWidth) * 100 : 100 / columns.length),
    [tableMinWidth, getWidth, columns.length]
  )

  return (
    <div
      className={cn('relative flex w-full flex-col overflow-hidden rounded-xl bg-card shadow-sm', className)}
      style={{ height: maxHeight, maxHeight }}
    >
      {/* Header: outside scroll area so native scrollbar appears only on body */}
      <div
        ref={headerScrollRef}
        className="flex-none overflow-x-auto overflow-y-hidden border-b border-border bg-muted [&::-webkit-scrollbar]:h-0"
        onScroll={syncBodyScroll}
        style={{ scrollbarWidth: 'none' }}
      >
        <table className="border-collapse text-sm" style={tableStyles}>
          <thead className="group/thead [&_th]:bg-muted [&_th]:text-foreground">
            <tr>
              {columns.map((col) => {
                const align = col.align ?? 'left'
                return (
                  <th
                    key={col.key}
                    className={cn(
                      'relative h-12 px-4 text-xs font-semibold tracking-wide',
                      align === 'right' && 'text-right',
                      align === 'center' && 'text-center'
                    )}
                    style={{ width: `${getColWidthPct(col.key)}%`, minWidth: col.minWidth ?? DEFAULT_MIN }}
                    title={col.title}
                  >
                    <span className="block truncate">{col.label}</span>
                    {!isTouchDevice && (
                      <span
                        role="separator"
                        aria-label={`Resize ${col.label}`}
                        onMouseDown={handleResizeStart(col.key)}
                        className={cn(
                          'absolute right-0 top-0 h-full w-1 cursor-col-resize select-none opacity-0 transition-opacity group-hover/thead:opacity-100 hover:opacity-100 border-r border-transparent hover:border-primary/30 hover:bg-primary/5',
                          resizing === col.key && 'opacity-100 border-primary/50 bg-primary/10'
                        )}
                      />
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
        </table>
      </div>
      {/* Body: native overflow scrollbar only here */}
      <div
        ref={bodyScrollRef}
        className="overflow-touch min-h-0 flex-1 overflow-auto"
        onScroll={syncHeaderScroll}
      >
        <table className="border-collapse text-sm" style={tableStyles}>
          <tbody className="divide-y divide-border/30">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-sm text-muted-foreground">
                  No rows to display.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={((row as Record<string, unknown>)[keyField] as string) ?? i}
                  className="group hover:bg-muted/40 transition-colors"
                >
                  {columns.map((col) => {
                    const value = (row as Record<string, unknown>)[col.key]
                    const align = col.align ?? 'left'
                    const content = col.render ? col.render(value, row) : (value as React.ReactNode)
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          'px-4 py-3 text-foreground',
                          align === 'right' && 'text-right tabular-nums',
                          align === 'center' && 'text-center'
                        )}
                        style={{
                          width: `${getColWidthPct(col.key)}%`,
                          minWidth: col.minWidth ?? DEFAULT_MIN,
                          maxWidth: `${getColWidthPct(col.key)}%`,
                        }}
                      >
                        <span className="block truncate" title={typeof content === 'string' ? content : undefined}>
                          {content ?? '—'}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
