export const HEALTH_PROBE_TOKEN = Symbol('HEALTH_PROBE_TOKEN')

/** Infrastructure reachability probes for the public health endpoint (§13.2). */
export interface IHealthProbe {
  database(): Promise<boolean>
  redis(): Promise<'ok' | 'down' | 'disabled'>
}
