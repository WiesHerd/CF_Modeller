import { useState, useEffect } from 'react'
import { Save, Copy, Trash2, FolderOpen, ChevronDown, Settings2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { SavedScenario } from '@/types/scenario'
import { formatDate as formatScenarioDate } from '@/utils/format'

function sortedScenarios(scenarios: SavedScenario[]): SavedScenario[] {
  return scenarios
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
}

interface SaveScenarioDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with (name, updateId?). When updateId is set, update that scenario; otherwise save as new. */
  onSave: (name: string, updateId?: string) => void
  /** When set, show "Update current" so the user can overwrite this scenario instead of creating a new one. */
  currentScenarioId?: string | null
  /** Name of the current scenario (when currentScenarioId is set), for the Update button label. */
  currentScenarioName?: string | null
}

export function SaveScenarioDialog({
  open,
  onOpenChange,
  onSave,
  currentScenarioId,
  currentScenarioName,
}: SaveScenarioDialogProps) {
  const [name, setName] = useState('')
  useEffect(() => {
    if (open && currentScenarioName) setName(currentScenarioName)
    if (!open) setName('')
  }, [open, currentScenarioName])
  const canUpdate = Boolean(currentScenarioId && name.trim())
  const handleSaveAsNew = () => {
    const trimmed = name.trim()
    if (trimmed) {
      onSave(trimmed)
      setName('')
      onOpenChange(false)
    }
  }
  const handleUpdate = () => {
    const trimmed = name.trim()
    if (trimmed && currentScenarioId) {
      onSave(trimmed, currentScenarioId)
      setName('')
      onOpenChange(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save scenario</DialogTitle>
          <DialogDescription>
            Give this model scenario a name so you can load it later.
            {currentScenarioId && (
              <span className="mt-1 block text-foreground/80">
                You have a scenario loaded — update it or save as a new one.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label htmlFor="scenario-name">Model name</Label>
          <Input
            id="scenario-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={currentScenarioName ?? 'e.g. 40th %ile + 5% carve-out'}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveAsNew()}
          />
        </div>
        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <div className="flex gap-2">
            {currentScenarioId && (
              <Button onClick={handleUpdate} disabled={!canUpdate} variant="secondary">
                Update current
              </Button>
            )}
            <Button onClick={handleSaveAsNew} disabled={!name.trim()}>
              {currentScenarioId ? 'Save as new' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ManageScenariosDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scenarios: SavedScenario[]
  onLoad: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onClearAll?: () => void
}

function ManageScenariosDialog({
  open,
  onOpenChange,
  scenarios,
  onLoad,
  onDuplicate,
  onDelete,
  onClearAll,
}: ManageScenariosDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="manage-scenarios-desc">
        <DialogHeader>
          <DialogTitle>Manage model scenarios</DialogTitle>
          <DialogDescription id="manage-scenarios-desc">
            Load, duplicate, or delete saved model scenarios (each has a model name you chose).
          </DialogDescription>
        </DialogHeader>
        {scenarios.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No saved scenarios yet.
          </p>
        ) : (
          <>
          <ScrollArea className="max-h-[280px] rounded-md border">
            <ul className="space-y-0.5 p-2">
              {sortedScenarios(scenarios).map((sc) => (
                <li
                  key={sc.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{sc.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {formatScenarioDate(sc.createdAt)}
                      {sc.selectedSpecialty != null && <> · {sc.selectedSpecialty}</>}
                      {sc.providerSnapshot?.providerName != null && (
                        <> · {sc.providerSnapshot.providerName}</>
                      )}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => {
                        onLoad(sc.id)
                        onOpenChange(false)
                      }}
                      title="Load scenario"
                    >
                      <FolderOpen className="size-4" />
                      <span className="sr-only">Load</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => onDuplicate(sc.id)}
                      title="Duplicate"
                    >
                      <Copy className="size-4" />
                      <span className="sr-only">Duplicate</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete "${sc.name}"? This cannot be undone.`
                          )
                        ) {
                          onDelete(sc.id)
                        }
                      }}
                      title="Delete"
                    >
                      <Trash2 className="size-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
          {onClearAll && (
            <div className="flex justify-end pt-2 border-t">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => {
                  if (
                    window.confirm(
                      `Clear all ${scenarios.length} saved scenario(s)? This cannot be undone.`
                    )
                  ) {
                    onClearAll()
                    onOpenChange(false)
                  }
                }}
              >
                <RotateCcw className="size-4 mr-1" />
                Clear all
              </Button>
            </div>
          )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

interface SavedScenariosSectionProps {
  scenarios: SavedScenario[]
  onLoad: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onClearAll?: () => void
  onSaveNew: (name: string) => void
  loadWarning: string | null
  onDismissWarning: () => void
  canSave: boolean
}

export function SavedScenariosSection({
  scenarios,
  onLoad,
  onDuplicate,
  onDelete,
  onClearAll,
  onSaveNew,
  loadWarning,
  onDismissWarning,
  canSave,
}: SavedScenariosSectionProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)

  const sorted = sortedScenarios(scenarios)

  return (
    <div className="space-y-2">
      {loadWarning && (
        <div
          className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900/50 dark:bg-amber-950/30"
          role="alert"
        >
          <span className="text-amber-800 dark:text-amber-200">
            {loadWarning}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
            onClick={onDismissWarning}
          >
            Dismiss
          </Button>
        </div>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-w-[10rem] justify-between gap-2 font-normal"
            aria-haspopup="listbox"
            aria-label="Saved scenarios"
          >
            <span className="truncate">
              {scenarios.length === 0
                ? 'Scenario'
                : `${scenarios.length} saved`}
            </span>
            <ChevronDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[14rem]">
          {sorted.length === 0 ? (
            <DropdownMenuItem disabled className="text-muted-foreground">
              No saved scenarios yet
            </DropdownMenuItem>
          ) : (
            sorted.map((sc) => (
              <DropdownMenuItem
                key={sc.id}
                onSelect={() => onLoad(sc.id)}
                className="flex flex-col items-start gap-0.5 py-2"
              >
                <span className="font-medium">{sc.name}</span>
                <span className="text-muted-foreground text-xs font-normal">
                  {formatScenarioDate(sc.createdAt)}
                  {sc.selectedSpecialty != null && ` · ${sc.selectedSpecialty}`}
                </span>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setSaveDialogOpen(true)}
            disabled={!canSave}
          >
            <Save className="size-4" />
            Save current scenario…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setManageOpen(true)}>
            <Settings2 className="size-4" />
            Manage scenarios…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SaveScenarioDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        onSave={onSaveNew}
      />
      <ManageScenariosDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        scenarios={scenarios}
        onLoad={onLoad}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onClearAll={onClearAll}
      />
    </div>
  )
}
