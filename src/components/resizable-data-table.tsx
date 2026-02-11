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

  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-lg border border-border/60 bg-card', className)}
      style={{ height: maxHeight, maxHeight }}
    >
      <div className="overflow-touch h-full min-h-0 overflow-auto">
        <table className="border-collapse text-sm" style={{ tableLayout: 'fixed', width: '100%', minWidth: tableMinWidth }}>
          <thead className="sticky top-0 z-10 border-b border-border/60 bg-muted/50 shadow-sm">
            <tr>
              {columns.map((col) => {
                const w = getWidth(col.key)
                const align = col.align ?? 'left'
                return (
                  <th
                    key={col.key}
                    className={cn(
                      'relative h-11 px-3 text-xs font-semibold text-muted-foreground',
                      align === 'right' && 'text-right',
                      align === 'center' && 'text-center'
                    )}
                    style={{ width: w, minWidth: col.minWidth ?? DEFAULT_MIN }}
                    title={col.title}
                  >
                    <span className="block truncate">{col.label}</span>
                    {!isTouchDevice && (
                      <span
                        role="separator"
                        aria-label={`Resize ${col.label}`}
                        onMouseDown={handleResizeStart(col.key)}
                        className={cn(
                          'absolute right-0 top-0 h-full w-1 cursor-col-resize select-none border-r border-transparent hover:border-primary/40 hover:bg-primary/10',
                          resizing === col.key && 'border-primary/60 bg-primary/20'
                        )}
                      />
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-sm text-muted-foreground">
                  No rows to display.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={((row as Record<string, unknown>)[keyField] as string) ?? i}
                  className="hover:bg-muted/30 transition-colors"
                >
                  {columns.map((col) => {
                    const value = (row as Record<string, unknown>)[col.key]
                    const align = col.align ?? 'left'
                    const content = col.render ? col.render(value, row) : (value as React.ReactNode)
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          'px-3 py-2 text-foreground',
                          align === 'right' && 'text-right tabular-nums',
                          align === 'center' && 'text-center'
                        )}
                        style={{
                          width: getWidth(col.key),
                          minWidth: col.minWidth ?? DEFAULT_MIN,
                          maxWidth: getWidth(col.key),
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
