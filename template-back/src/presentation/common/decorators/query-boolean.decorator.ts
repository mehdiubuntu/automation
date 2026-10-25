import { Transform } from 'class-transformer'

/** Query-string booleans arrive as text and implicit conversion would turn "false" into true, so read the raw (pre-conversion) value. */
export const QueryBoolean = () =>
  Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }): unknown => {
    const raw = obj[key]
    return raw === 'true' || raw === true ? true : raw === 'false' || raw === false ? false : raw
  })
