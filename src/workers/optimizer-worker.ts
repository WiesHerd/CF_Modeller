/**
 * Web Worker: runs the CF optimizer off the main thread so the UI stays responsive.
 * Do not import React or DOM here.
 */
import type { ProviderRow } from '../types/provider'
import type { MarketRow } from '../types/market'
import type { OptimizerSettings, OptimizerRunResult } from '../types/optimizer'
import { runOptimizerAllSpecialties } from '../lib/optimizer-engine'

export interface OptimizerWorkerRunPayload {
  type: 'run'
  providerRows: ProviderRow[]
  marketRows: MarketRow[]
  settings: OptimizerSettings
  scenarioId: string
  scenarioName: string
  synonymMap?: Record<string, string>
  /** When set, run only this specialty. */
  specialtyFilter?: string
}

export interface OptimizerWorkerDoneMessage {
  type: 'done'
  result: OptimizerRunResult
}

export interface OptimizerWorkerErrorMessage {
  type: 'error'
  message: string
}

export interface OptimizerWorkerProgressMessage {
  type: 'progress'
  specialtyIndex: number
  totalSpecialties: number
  specialtyName: string
}

export type OptimizerWorkerOutMessage =
  | OptimizerWorkerDoneMessage
  | OptimizerWorkerErrorMessage
  | OptimizerWorkerProgressMessage

self.onmessage = (e: MessageEvent<OptimizerWorkerRunPayload>) => {
  const { type, providerRows, marketRows, settings, scenarioId, scenarioName, synonymMap, specialtyFilter } = e.data
  if (type !== 'run') return

  try {
    const result = runOptimizerAllSpecialties(providerRows, marketRows, settings, {
      scenarioId,
      scenarioName,
      synonymMap: synonymMap ?? {},
      specialtyFilter,
      onProgress(specialtyIndex, totalSpecialties, specialtyName) {
        const msg: OptimizerWorkerProgressMessage = {
          type: 'progress',
          specialtyIndex,
          totalSpecialties,
          specialtyName,
        }
        self.postMessage(msg)
      },
    })
    const msg: OptimizerWorkerDoneMessage = { type: 'done', result }
    self.postMessage(msg)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const msg: OptimizerWorkerErrorMessage = { type: 'error', message }
    self.postMessage(msg)
  }
}
