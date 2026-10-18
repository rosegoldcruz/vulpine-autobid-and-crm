import type { QuartzConfig } from "./quartz/cfg"
export function restrictVaultPublishing(config: QuartzConfig): QuartzConfig

export function privateVaultView<T>(config: T, output: string | undefined): T
