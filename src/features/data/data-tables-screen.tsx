'use client'

import { useState, useEffect } from 'react'
import { SectionTitleWithIcon } from '@/components/section-title-with-icon'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table2 } from 'lucide-react'
import { loadDataBrowserFilters, saveDataBrowserFilters, type DataBrowserFilters } from '@/lib/storage'
import type { ProviderRow } from '@/types/provider'
import type { MarketRow } from '@/types/market'
import { ProviderDataTable } from '@/features/data/provider-data-table'
import { MarketDataTable } from '@/features/data/market-data-table'

interface DataTablesScreenProps {
  providerRows: ProviderRow[]
  marketRows: MarketRow[]
  /** Controlled tab when provided; use with onDataTabChange. */
  dataTab?: 'providers' | 'market'
  onDataTabChange?: (tab: 'providers' | 'market') => void
  onNavigateToUpload?: () => void
  onUpdateProvider?: (providerId: string, updates: Partial<ProviderRow>) => void
  onAddProvider?: (row: ProviderRow) => void
  onDeleteProvider?: (providerId: string) => void
  onUpdateMarketRow?: (existingRow: MarketRow, updates: Partial<MarketRow>) => void
  onAddMarketRow?: (row: MarketRow) => void
  onDeleteMarketRow?: (row: MarketRow) => void
}

export function DataTablesScreen({
  providerRows,
  marketRows,
  dataTab: controlledTab,
  onDataTabChange,
  onNavigateToUpload,
  onUpdateProvider,
  onAddProvider,
  onDeleteProvider,
  onUpdateMarketRow,
  onAddMarketRow,
  onDeleteMarketRow,
}: DataTablesScreenProps) {
  const defaultTab = providerRows.length > 0 ? 'providers' : 'market'
  const [persistedFilters, setPersistedFilters] = useState(loadDataBrowserFilters)
  useEffect(() => {
    saveDataBrowserFilters(persistedFilters)
  }, [persistedFilters])
  const [internalTab, setInternalTab] = useState<'providers' | 'market'>(() =>
    controlledTab ?? persistedFilters.dataTab ?? defaultTab
  )
  const hasAny = providerRows.length > 0 || marketRows.length > 0

  if (!hasAny) {
    return (
      <div className="space-y-6">
        <SectionTitleWithIcon icon={<Table2 />}>Data browser</SectionTitleWithIcon>
        <Card>
          <CardContent>
            <EmptyState
              message="No provider or market data loaded."
              description="Upload provider and market files on the Upload screen to browse and filter here."
              action={onNavigateToUpload ? <Button onClick={onNavigateToUpload}>Go to Upload</Button> : undefined}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  const tabValue = controlledTab ?? internalTab
  const handleTabChange = (v: string) => {
    const t = v as 'providers' | 'market'
    setPersistedFilters((prev: DataBrowserFilters) => ({ ...prev, dataTab: t }))
    if (onDataTabChange) onDataTabChange(t)
    else setInternalTab(t)
  }
  return (
    <div className="space-y-6">
      <SectionTitleWithIcon icon={<Table2 />}>Data browser</SectionTitleWithIcon>
      <Tabs value={tabValue} onValueChange={handleTabChange} className="w-full">
        <TabsList>
          <TabsTrigger value="providers">Providers ({providerRows.length})</TabsTrigger>
          <TabsTrigger value="market">Market ({marketRows.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="providers" className="mt-4">
          {providerRows.length > 0 ? (
            <ProviderDataTable
              rows={providerRows}
              specialtyFilter={persistedFilters.providerSpecialty}
              onSpecialtyFilterChange={(v) => setPersistedFilters((p: DataBrowserFilters) => ({ ...p, providerSpecialty: v }))}
              divisionFilter={persistedFilters.providerDivision}
              onDivisionFilterChange={(v) => setPersistedFilters((p: DataBrowserFilters) => ({ ...p, providerDivision: v }))}
              modelFilter={persistedFilters.providerModel}
              onModelFilterChange={(v) => setPersistedFilters((p: DataBrowserFilters) => ({ ...p, providerModel: v }))}
              providerTypeFilter={persistedFilters.providerType}
              onProviderTypeFilterChange={(v) => setPersistedFilters((p: DataBrowserFilters) => ({ ...p, providerType: v }))}
              onUpdateProvider={onUpdateProvider}
              onAddProvider={onAddProvider}
              onDeleteProvider={onDeleteProvider}
            />
          ) : (
            <Card>
              <CardContent>
                <EmptyState
                  message="No provider data loaded."
                  action={onNavigateToUpload ? <Button variant="outline" size="sm" onClick={onNavigateToUpload}>Go to Upload</Button> : undefined}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="market" className="mt-4">
          {marketRows.length > 0 ? (
            <MarketDataTable
              rows={marketRows}
              specialtyFilter={persistedFilters.marketSpecialty}
              onSpecialtyFilterChange={(v) => setPersistedFilters((p: DataBrowserFilters) => ({ ...p, marketSpecialty: v }))}
              onUpdateMarketRow={onUpdateMarketRow}
              onAddMarketRow={onAddMarketRow}
              onDeleteMarketRow={onDeleteMarketRow}
            />
          ) : (
            <Card>
              <CardContent>
                <EmptyState
                  message="No market data loaded."
                  action={onNavigateToUpload ? <Button variant="outline" size="sm" onClick={onNavigateToUpload}>Go to Upload</Button> : undefined}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
