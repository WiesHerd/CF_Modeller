import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

/**
 * Scroll-to-top FAB. Shown when the user scrolls past the top sentinel (IntersectionObserver)
 * or past scrollThresholdPx if no sentinel exists. Respects prefers-reduced-motion.
 *
 * Top sentinel: place a 1px element with id="top" (or pass sentinelId) at the very top of
 * the scroll container (e.g. first child of [data-scroll-root]). Example:
 *   <div id="top" className="h-px w-full shrink-0" aria-hidden="true" />
 *
 * Threshold: when using scroll fallback, pass scrollThresholdPx (default 250).
 */
const SENTINEL_ID = 'top'
const SCROLL_ROOT_SELECTOR = '[data-scroll-root]'
const SCROLL_THRESHOLD_PX = 250
const FAB_OFFSET_PX = 24

function getScrollContainer(): HTMLElement | null {
  const el = document.querySelector(SCROLL_ROOT_SELECTOR)
  return el instanceof HTMLElement ? el : null
}

function getPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export interface ScrollToTopButtonProps {
  /** Id of the top sentinel element. When sentinel is not visible, the button is shown. */
  sentinelId?: string
  /** Fallback scroll threshold in px when sentinel is not found. Button shows when scroll passes this. */
  scrollThresholdPx?: number
  /** Offset from bottom and right in px. */
  offsetPx?: number
}

export function ScrollToTopButton({
  sentinelId = SENTINEL_ID,
  scrollThresholdPx = SCROLL_THRESHOLD_PX,
  offsetPx = FAB_OFFSET_PX,
}: ScrollToTopButtonProps = {}) {
  const [visible, setVisible] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const scrollToTop = useCallback(() => {
    const reduceMotion = getPrefersReducedMotion()
    const behavior = reduceMotion ? 'auto' : 'smooth'
    const container = getScrollContainer()
    if (container) container.scrollTo({ top: 0, behavior })
    window.scrollTo({ top: 0, behavior })
  }, [])

  useEffect(() => {
    const scrollContainer = getScrollContainer()

    const updateVisible = () => {
      const mainScrolled = scrollContainer ? scrollContainer.scrollTop > scrollThresholdPx : false
      const windowScrolled = typeof window !== 'undefined' && window.scrollY > scrollThresholdPx
      setVisible(mainScrolled || windowScrolled)
    }

    if (scrollContainer) {
      const sentinel = document.getElementById(sentinelId)
      if (sentinel) {
        observerRef.current = new IntersectionObserver(
          (entries) => {
            const [entry] = entries
            if (entry) setVisible(!entry.isIntersecting)
          },
          { root: scrollContainer, rootMargin: '0px', threshold: 0 }
        )
        observerRef.current.observe(sentinel)
      }
      updateVisible()
      scrollContainer.addEventListener('scroll', updateVisible, { passive: true })
    }

    window.addEventListener('scroll', updateVisible, { passive: true })
    updateVisible()

    return () => {
      observerRef.current?.disconnect()
      observerRef.current = null
      if (scrollContainer) scrollContainer.removeEventListener('scroll', updateVisible)
      window.removeEventListener('scroll', updateVisible)
    }
  }, [sentinelId, scrollThresholdPx])

  if (!visible || typeof document === 'undefined') return null

  const style = {
    bottom: `${offsetPx}px`,
    right: `${offsetPx}px`,
  }

  return createPortal(
    <button
      type="button"
      onClick={scrollToTop}
      style={style}
      className="fixed z-[9999] flex size-12 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-lg transition-colors hover:bg-muted active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      aria-label="Scroll to top"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>,
    document.body
  )
}
