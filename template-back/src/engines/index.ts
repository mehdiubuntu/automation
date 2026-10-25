import audit from './audit'
import content from './content'
import keyword from './keyword'
import { EngineDefinition } from './sdk'

/** Every engine the platform knows. Core-owned: a new engine is one reviewed line here (plus ENGINES_ENABLED to switch it on). */
export const ENGINES: EngineDefinition[] = [audit, keyword, content]
