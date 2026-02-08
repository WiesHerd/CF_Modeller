import { useState, useCallback } from 'react'
import { Users, BarChart2, FileSpreadsheet, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { parseFile, buildDefaultMapping, applyProviderMapping, applyMarketMapping } from '@/lib/parse-file'
import type { RawRow } from '@/types/upload'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import type { ColumnMapping } from '@/types/upload'
import { PROVIDER_EXPECTED_COLUMNS } from '@/types/provider'
import { MARKET_EXPECTED_COLUMNS } from '@/types/market'
import {
  downloadSampleCsv,
  PROVIDER_SAMPLE_CSV,
  MARKET_SAMPLE_CSV,
  PROVIDER_SAMPLE_FILENAME,
  MARKET_SAMPLE_FILENAME,
} from '@/utils/sample-upload'

type FileType = 'provider' | 'market'

interface UploadAndMappingProps {
  onProviderData: (rows: ProviderRow[], mapping: ColumnMapping | null) => void
  onMarketData: (rows: MarketRow[], mapping: ColumnMapping | null) => void
  existingProviderRows: ProviderRow[]
  existingMarketRows: MarketRow[]
}

export function UploadAndMapping({
  onProviderData,
  onMarketData,
  existingProviderRows,
  existingMarketRows,
}: UploadAndMappingProps) {
  const [providerRaw, setProviderRaw] = useState<{ rows: RawRow[]; headers: string[] } | null>(null)
  const [marketRaw, setMarketRaw] = useState<{ rows: RawRow[]; headers: string[] } | null>(null)
  const [providerMapping, setProviderMapping] = useState<ColumnMapping>({})
  const [marketMapping, setMarketMapping] = useState<ColumnMapping>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<FileType | null>(null)

  const handleFile = useCallback(
    async (file: File | null, type: FileType) => {
      if (!file) return
      setError(null)
      setLoading(type)
      try {
        const { rows, headers } = await parseFile(file)
        if (rows.length === 0) {
          setError(`${type === 'provider' ? 'Provider' : 'Market'} file has no data rows.`)
          setLoading(null)
          return
        }
        if (type === 'provider') {
          setProviderRaw({ rows, headers })
          setProviderMapping(buildDefaultMapping(headers, [...PROVIDER_EXPECTED_COLUMNS]))
        } else {
          setMarketRaw({ rows, headers })
          setMarketMapping(buildDefaultMapping(headers, [...MARKET_EXPECTED_COLUMNS]))
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to parse file')
      } finally {
        setLoading(null)
      }
    },
    []
  )

  const applyProvider = useCallback(() => {
    if (!providerRaw) return
    const { rows, errors } = applyProviderMapping(
      providerRaw.rows,
      providerRaw.headers,
      providerMapping
    )
    if (errors.length) {
      setError(`Provider: ${errors.slice(0, 5).join('; ')}${errors.length > 5 ? '...' : ''}`)
      return
    }
    setError(null)
    onProviderData(rows, { ...providerMapping })
    setProviderRaw(null)
  }, [providerRaw, providerMapping, onProviderData])

  const applyMarket = useCallback(() => {
    if (!marketRaw) return
    const { rows, errors } = applyMarketMapping(
      marketRaw.rows,
      marketRaw.headers,
      marketMapping
    )
    if (errors.length) {
      setError(`Market: ${errors.slice(0, 5).join('; ')}${errors.length > 5 ? '...' : ''}`)
      return
    }
    setError(null)
    onMarketData(rows, { ...marketMapping })
    setMarketRaw(null)
  }, [marketRaw, marketMapping, onMarketData])

  const previewRows = 5
  const providerPreview = providerRaw ? providerRaw.rows.slice(0, previewRows) : []
  const marketPreview = marketRaw ? marketRaw.rows.slice(0, previewRows) : []
  const providerHeaders = providerRaw ? providerRaw.headers : []
  const marketHeaders = marketRaw ? marketRaw.headers : []

  return (
    <div className="space-y-6">
      {/* CompLens-style tool cards: icon, title, description, then file input */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm transition-shadow hover:shadow-md">
          <CardContent className="flex flex-col p-6">
            <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Users className="size-6" />
            </div>
            <h3 className="mb-2 text-lg font-semibold leading-tight text-foreground">
              Provider file
            </h3>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              Upload a CSV or XLSX with provider-level data: FTE, base salary, wRVUs, and conversion factors. One row per provider.
            </p>
            <div className="mt-auto flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="min-h-[44px] touch-manipulation text-sm file:mr-2 file:min-h-[44px] file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null, 'provider')}
                  disabled={!!loading}
                />
                {existingProviderRows.length > 0 && (
                  <span className="text-muted-foreground text-xs">
                    {existingProviderRows.length} rows loaded
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => downloadSampleCsv(PROVIDER_SAMPLE_FILENAME, PROVIDER_SAMPLE_CSV)}
                className="w-fit text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline touch-manipulation"
              >
                Download sample
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm transition-shadow hover:shadow-md">
          <CardContent className="flex flex-col p-6">
            <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <BarChart2 className="size-6" />
            </div>
            <h3 className="mb-2 text-lg font-semibold leading-tight text-foreground">
              Market file
            </h3>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              Upload market benchmarks by specialty: TCC, wRVU, and CF percentiles (25th–90th). Used to compare provider compensation to market.
            </p>
            <div className="mt-auto flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="min-h-[44px] touch-manipulation text-sm file:mr-2 file:min-h-[44px] file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null, 'market')}
                  disabled={!!loading}
                />
                {existingMarketRows.length > 0 && (
                  <span className="text-muted-foreground text-xs">
                    {existingMarketRows.length} rows loaded
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => downloadSampleCsv(MARKET_SAMPLE_FILENAME, MARKET_SAMPLE_CSV)}
                className="w-fit text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline touch-manipulation"
              >
                Download sample
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading && (
        <p className="text-muted-foreground text-sm">Parsing file…</p>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {providerRaw && (
        <Card className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-left">
              <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <FileSpreadsheet className="size-5" />
              </span>
              <span>Map provider columns</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {PROVIDER_EXPECTED_COLUMNS.map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <Label className="w-36 shrink-0 text-xs">{key}</Label>
                  <Select
                    value={providerMapping[key] ?? ''}
                    onValueChange={(v) =>
                      setProviderMapping((m) => ({ ...m, [key]: v }))
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Skip" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Skip</SelectItem>
                      {providerHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <Button onClick={applyProvider} className="min-h-[44px] touch-manipulation px-4">Apply mapping & load provider data</Button>
            <div className="rounded-md border overflow-x-auto">
              <ScrollArea className="h-[200px] w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {providerHeaders.slice(0, 8).map((h) => (
                        <TableHead key={h} className="whitespace-nowrap">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providerPreview.map((row, i) => (
                      <TableRow key={i}>
                        {providerHeaders.slice(0, 8).map((h) => (
                          <TableCell key={h} className="max-w-[120px] truncate">
                            {row[h] ?? '—'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      )}

      {marketRaw && (
        <Card className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-left">
              <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <FileSpreadsheet className="size-5" />
              </span>
              <span>Map market columns</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {MARKET_EXPECTED_COLUMNS.map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <Label className="w-28 shrink-0 text-xs">{key}</Label>
                  <Select
                    value={marketMapping[key] ?? ''}
                    onValueChange={(v) =>
                      setMarketMapping((m) => ({ ...m, [key]: v }))
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Skip" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Skip</SelectItem>
                      {marketHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <Button onClick={applyMarket} className="min-h-[44px] touch-manipulation px-4">Apply mapping & load market data</Button>
            <div className="rounded-md border overflow-x-auto">
              <ScrollArea className="h-[200px] w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {marketHeaders.slice(0, 8).map((h) => (
                        <TableHead key={h} className="whitespace-nowrap">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {marketPreview.map((row, i) => (
                      <TableRow key={i}>
                        {marketHeaders.slice(0, 8).map((h) => (
                          <TableCell key={h} className="max-w-[120px] truncate">
                            {row[h] ?? '—'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
