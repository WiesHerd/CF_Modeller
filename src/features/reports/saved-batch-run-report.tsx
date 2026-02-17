import { useMemo, useState } from 'react'
import { ArrowLeft, FileDown, FileSpreadsheet, Printer, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SectionTitleWithIcon } from '@/components/section-title-with-icon'
import { TccWrvuSummaryTable } from './tcc-wrvu-summary-table'
import { downloadBatchResultsCSV, exportBatchResultsXLSX } from '@/lib/batch-export'
import { formatPercentile, getGapInterpretation } from '@/features/optimizer/components/optimizer-constants'
import { FileText } from 'lucide-react'
import type { BatchResults, BatchRowResult, SavedBatchRun } from '@/types/batch'

function formatRunDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export interface SavedBatchRunReportProps {
  savedBatchRuns: SavedBatchRun[]
  selectedRunId: string | null
  onSelectRunId: (id: string | null) => void
  onBack: () => void
}

export function SavedBatchRunReport({
  savedBatchRuns,
  selectedRunId,
  onSelectRunId,
  onBack,
}: SavedBatchRunReportProps) {
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all')
  const [providerSearch, setProviderSearch] = useState<string>('')
  const [payVsProdFilter, setPayVsProdFilter] = useState<string>('all')

  const handlePrint = () => {
    window.print()
  }

  if (savedBatchRuns.length === 0) {
    return (
      <div className="space-y-6">
        <SectionTitleWithIcon icon={<FileText className="size-5 text-muted-foreground" />}>
          Saved batch run report
        </SectionTitleWithIcon>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-2" aria-label="Back">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              No saved batch runs. Run a scenario from Batch or Scenario results, then save the run to view it here.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const effectiveRunId = selectedRunId ?? savedBatchRuns[0]?.id ?? null
  const effectiveRun = effectiveRunId ? savedBatchRuns.find((r) => r.id === effectiveRunId) ?? null : null

  if (!effectiveRunId || !effectiveRun) {
    return (
      <div className="space-y-6">
        <SectionTitleWithIcon icon={<FileText className="size-5 text-muted-foreground" />}>
          Saved batch run report
        </SectionTitleWithIcon>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-2" aria-label="Back">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Select a saved run.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const run = effectiveRun
  const results = run.results

  const specialtyOptions = useMemo(() => {
    if (!results?.rows?.length) return []
    const set = new Set(results.rows.map((r) => r.specialty?.trim()).filter(Boolean))
    return Array.from(set).sort((a, b) => (a ?? '').localeCompare(b ?? ''))
  }, [results?.rows])

  const filteredRows = useMemo((): BatchRowResult[] => {
    if (!results?.rows?.length) return []
    let out = results.rows
    if (specialtyFilter !== 'all') {
      out = out.filter((r) => (r.specialty?.trim() ?? '') === specialtyFilter)
    }
    if (providerSearch.trim()) {
      const q = providerSearch.trim().toLowerCase()
      out = out.filter(
        (r) =>
          (r.providerName ?? '').toLowerCase().includes(q) ||
          (r.providerId ?? '').toString().toLowerCase().includes(q)
      )
    }
    if (payVsProdFilter !== 'all') {
      out = out.filter((r) => {
        const gap = r.results?.alignmentGapModeled
        if (gap == null || !Number.isFinite(gap)) return false
        return getGapInterpretation(gap) === payVsProdFilter
      })
    }
    return out
  }, [results?.rows, specialtyFilter, providerSearch, payVsProdFilter])

  const summaryForRun = useMemo(() => {
    if (!results?.rows?.length) return null
    const rows = results.rows
    let tccPctSum = 0
    let tccPctCount = 0
    let wrvuPctSum = 0
    let wrvuPctCount = 0
    const providerIds = new Set<string>()
    for (const r of rows) {
      if (r.providerId) providerIds.add(r.providerId)
      if (r.results?.modeledTCCPercentile != null && Number.isFinite(r.results.modeledTCCPercentile)) {
        tccPctSum += r.results.modeledTCCPercentile
        tccPctCount += 1
      }
      if (r.results?.wrvuPercentile != null && Number.isFinite(r.results.wrvuPercentile)) {
        wrvuPctSum += r.results.wrvuPercentile
        wrvuPctCount += 1
      }
    }
    return {
      providerCount: providerIds.size,
      rowCount: rows.length,
      avgTccPercentile: tccPctCount > 0 ? tccPctSum / tccPctCount : null,
      avgWrvuPercentile: wrvuPctCount > 0 ? wrvuPctSum / wrvuPctCount : null,
    }
  }, [results])

  const exportResults: BatchResults | null = results
    ? { ...results, rows: filteredRows }
    : null

  return (
    <div className="space-y-6 report-print">
      {/* Consistent header: left = Back + (Title + Confidential); right = Export actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onBack} className="shrink-0 gap-2 no-print" aria-label="Back">
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <div className="min-w-0">
            <SectionTitleWithIcon icon={<FileText className="size-5 text-muted-foreground" />}>
              Saved batch run report
            </SectionTitleWithIcon>
            {results && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                <Lock className="size-3.5 shrink-0" aria-hidden />
                Confidential — compensation planning
              </p>
            )}
          </div>
        </div>
        {exportResults && (
          <div className="flex flex-wrap items-center gap-2 shrink-0 no-print">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2" aria-label="Print">
              <Printer className="size-4" />
              Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadBatchResultsCSV(exportResults)}
              className="gap-2"
              aria-label="Export CSV"
            >
              <FileDown className="size-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportBatchResultsXLSX(exportResults)}
              className="gap-2"
              aria-label="Export XLSX"
            >
              <FileSpreadsheet className="size-4" />
              Export XLSX
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 no-print">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={effectiveRunId} onValueChange={(v) => onSelectRunId(v)}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select a run" />
            </SelectTrigger>
            <SelectContent>
              {[...savedBatchRuns].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name} — {formatRunDate(r.createdAt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-muted-foreground max-w-[640px]">
          <strong>Saved batch runs</strong> are result sets saved from Batch or Scenario results. Select a run to view and export; filter by specialty, provider, or pay vs productivity.
        </p>

        {results && results.rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 border border-border/60 rounded-lg px-3 py-2 bg-muted/30">
            <Label className="text-xs text-muted-foreground shrink-0">Filters</Label>
            <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <SelectValue placeholder="Specialty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All specialties</SelectItem>
                {specialtyOptions.map((s) => (
                  <SelectItem key={s ?? ''} value={s ?? ''}>
                    {s ?? '—'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Search provider name or ID"
              value={providerSearch}
              onChange={(e) => setProviderSearch(e.target.value)}
              className="h-8 w-[200px] text-xs"
            />
            <Select value={payVsProdFilter} onValueChange={setPayVsProdFilter}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Pay vs productivity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="aligned">Aligned</SelectItem>
                <SelectItem value="overpaid">Pay above productivity</SelectItem>
                <SelectItem value="underpaid">Underpaid vs productivity</SelectItem>
              </SelectContent>
            </Select>
            {(specialtyFilter !== 'all' || providerSearch.trim() || payVsProdFilter !== 'all') && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setSpecialtyFilter('all')
                  setProviderSearch('')
                  setPayVsProdFilter('all')
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        )}
      </div>

      {results && (
        <>
          {summaryForRun && (
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Run date</p>
                <p className="font-medium">{formatRunDate(run.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Providers</p>
                <p className="font-medium">{summaryForRun.providerCount}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Rows</p>
                <p className="font-medium">{filteredRows.length}{filteredRows.length !== results.rows.length ? ` of ${results.rows.length}` : ''}</p>
              </div>
              {summaryForRun.avgTccPercentile != null && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Avg TCC percentile</p>
                  <p className="font-medium tabular-nums">{formatPercentile(summaryForRun.avgTccPercentile)}</p>
                </div>
              )}
              {summaryForRun.avgWrvuPercentile != null && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Avg wRVU percentile</p>
                  <p className="font-medium tabular-nums">{formatPercentile(summaryForRun.avgWrvuPercentile)}</p>
                </div>
              )}
            </div>
          )}

          <Card>
            <CardHeader>
              <p className="text-sm font-medium text-foreground">Total cash and wRVU percentiles</p>
              <p className="text-xs text-muted-foreground">
                {run.name}. {filteredRows.length} row(s){filteredRows.length !== results.rows.length ? ` of ${results.rows.length}` : ''}.
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400/90 mt-1.5">
                <strong>FMV risk:</strong> Total cash comp at or above the 75th percentile may warrant Fair Market Value review. Use the FMV risk column (Low / Elevated / High) to flag providers for attention.
              </p>
            </CardHeader>
            <CardContent>
              <TccWrvuSummaryTable rows={filteredRows} showScenarioName={true} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
