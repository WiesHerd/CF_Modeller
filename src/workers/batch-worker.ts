/**
 * Web Worker: runs runBatch in chunks and posts progress + final results.
 * Do not import React or DOM here.
 */
import type { ProviderRow } from '../types/provider'
import type { MarketRow } from '../types/market'
import type { ScenarioInputs } from '../types/scenario'
import type { BatchResults, SynonymMap } from '../types/batch'
import { runBatch } from '../lib/batch'

export interface BatchWorkerRunPayload {
  type: 'run'
  providers: ProviderRow[]
  marketRows: MarketRow[]
  scenarios: { id: string; name: string; scenarioInputs: ScenarioInputs }[]
  synonymMap?: SynonymMap
  chunkSize?: number
}

export interface BatchWorkerProgressMessage {
  type: 'progress'
  processed: number
  total: number
  elapsedMs: number
}

export interface BatchWorkerDoneMessage {
  type: 'done'
  results: BatchResults
}

export type BatchWorkerOutMessage = BatchWorkerProgressMessage | BatchWorkerDoneMessage

self.onmessage = (e: MessageEvent<BatchWorkerRunPayload>) => {
  const { type, providers, marketRows, scenarios, synonymMap, chunkSize } = e.data
  if (type !== 'run') return

  const results = runBatch(providers, marketRows, scenarios, {
    synonymMap: synonymMap ?? {},
    chunkSize: chunkSize ?? 200,
    onProgress(processed, total, elapsedMs) {
      const msg: BatchWorkerProgressMessage = {
        type: 'progress',
        processed,
        total,
        elapsedMs,
      }
      self.postMessage(msg)
    },
  })

  const doneMsg: BatchWorkerDoneMessage = { type: 'done', results }
  self.postMessage(doneMsg)
}
