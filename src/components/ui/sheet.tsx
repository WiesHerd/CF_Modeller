"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Sheet({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

type SheetContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & {
  side?: "left" | "right" | "top" | "bottom"
  showCloseButton?: boolean
  /** Applied to the content panel (e.g. for resizable drawer width). */
  contentStyle?: React.CSSProperties
}

function SheetContent({
  className,
  side = "right",
  showCloseButton = true,
  contentStyle,
  children,
  style,
  ...props
}: SheetContentProps) {
  const slideIn = {
    right: "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
    left: "data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
    top: "data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top",
    bottom: "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
  }
  const position = {
    right: "inset-y-0 right-0 h-full w-full sm:max-w-md border-l border-border",
    left: "inset-y-0 left-0 h-full w-full sm:max-w-md border-r border-border",
    top: "inset-x-0 top-0 h-auto max-h-[85vh] border-b border-border",
    bottom: "inset-x-0 bottom-0 h-auto max-h-[85vh] border-t border-border",
  }
  const mergedStyle = { ...contentStyle, ...style }
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-background p-6 shadow-xl duration-200 ease-in-out outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          slideIn[side],
          position[side],
          className
        )}
        style={Object.keys(mergedStyle).length > 0 ? mergedStyle : undefined}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-border focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-2 text-left", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-lg font-semibold leading-none", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetPortal,
  SheetOverlay,
}
