import { logError } from './log.js'

export function safeParseJSON(json: string | null | undefined): unknown {
  if (!json) {
    return null
  }
  try {
    return JSON.parse(json)
  } catch (e) {
    logError(e)
    return null
  }
}
