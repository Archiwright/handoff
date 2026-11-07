export type Level = 'green' | 'yellow' | 'red'

export type Reading = { tokens: number; window: number; level: Level }

declare module 'claude-code' {
  interface PluginState {
    archiwright: { reading: Reading | null; told: Level; ready: boolean; armed: boolean; pendingSince: number | null; waiting: boolean; agentCount: number }
  }
}
