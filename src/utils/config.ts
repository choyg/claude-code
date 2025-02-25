import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve, join } from 'path'
import { cloneDeep, memoize, pick } from 'lodash-es'
import { homedir } from 'os'
import { GLOBAL_CLAUDE_FILE } from './env.js'
import { getCwd } from './state.js'
import { randomBytes } from 'crypto'
import { safeParseJSON } from './json.js'
import { checkGate, logEvent } from '../services/statsig.js'
import { GATE_USE_EXTERNAL_UPDATER } from '../constants/betas.js'
import { ConfigParseError } from './errors.js'
import type { ThemeNames } from './theme.js'

export type McpStdioServerConfig = {
  type?: 'stdio' // Optional for backwards compatibility
  command: string
  args: string[]
  env?: Record<string, string>
}

export type McpSSEServerConfig = {
  type: 'sse'
  url: string
}

export type McpServerConfig = McpStdioServerConfig | McpSSEServerConfig

export type ProjectConfig = {
  allowedTools: string[]
  context: Record<string, string>
  contextFiles?: string[]
  history: string[]
  dontCrawlDirectory?: boolean
  enableArchitectTool?: boolean
  mcpContextUris: string[]
  mcpServers?: Record<string, McpServerConfig>
  approvedMcprcServers?: string[]
  rejectedMcprcServers?: string[]
  lastAPIDuration?: number
  lastCost?: number
  lastDuration?: number
  lastSessionId?: string
  exampleFiles?: string[]
  exampleFilesGeneratedAt?: number
  hasTrustDialogAccepted?: boolean
  hasCompletedProjectOnboarding?: boolean
}

const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  allowedTools: [],
  context: {},
  history: [],
  dontCrawlDirectory: false,
  enableArchitectTool: false,
  mcpContextUris: [],
  mcpServers: {},
  approvedMcprcServers: [],
  rejectedMcprcServers: [],
  hasTrustDialogAccepted: false,
}

function defaultConfigForProject(projectPath: string): ProjectConfig {
  const config = { ...DEFAULT_PROJECT_CONFIG }
  if (projectPath === homedir()) {
    config.dontCrawlDirectory = true
  }
  return config
}

export type AutoUpdaterStatus =
  | 'disabled'
  | 'enabled'
  | 'no_permissions'
  | 'not_configured'

export function isAutoUpdaterStatus(value: string): value is AutoUpdaterStatus {
  return ['disabled', 'enabled', 'no_permissions', 'not_configured'].includes(
    value as AutoUpdaterStatus,
  )
}

export type NotificationChannel =
  | 'iterm2'
  | 'terminal_bell'
  | 'iterm2_with_bell'
  | 'notifications_disabled'

export type AccountInfo = {
  accountUuid: string
  emailAddress: string
  organizationUuid?: string
}

export type GlobalConfig = {
  projects?: Record<string, ProjectConfig>
  numStartups: number
  autoUpdaterStatus?: AutoUpdaterStatus
  userID?: string
  theme: ThemeNames
  hasCompletedOnboarding?: boolean
  // Tracks the last version that reset onboarding, used with MIN_VERSION_REQUIRING_ONBOARDING_RESET
  lastOnboardingVersion?: string
  // Tracks the last version for which release notes were seen, used for managing release notes
  lastReleaseNotesSeen?: string
  mcpServers?: Record<string, McpServerConfig>
  preferredNotifChannel: NotificationChannel
  verbose: boolean
  customApiKeyResponses?: {
    approved?: string[]
    rejected?: string[]
  }
  primaryApiKey?: string // Primary API key for the user when no environment variable is set, set via oauth (TODO: rename)
  hasAcknowledgedCostThreshold?: boolean
  oauthAccount?: AccountInfo
  iterm2KeyBindingInstalled?: boolean // Legacy - keeping for backward compatibility
  shiftEnterKeyBindingInstalled?: boolean
}

export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  numStartups: 0,
  autoUpdaterStatus: 'not_configured',
  theme: 'dark' as ThemeNames,
  preferredNotifChannel: 'iterm2',
  verbose: false,
  customApiKeyResponses: {
    approved: [],
    rejected: [],
  },
}

export const GLOBAL_CONFIG_KEYS = [
  'autoUpdaterStatus',
  'theme',
  'hasCompletedOnboarding',
  'lastOnboardingVersion',
  'lastReleaseNotesSeen',
  'verbose',
  'customApiKeyResponses',
  'primaryApiKey',
  'preferredNotifChannel',
  'shiftEnterKeyBindingInstalled',
] as const

export type GlobalConfigKey = (typeof GLOBAL_CONFIG_KEYS)[number]

export function isGlobalConfigKey(key: string): key is GlobalConfigKey {
  return GLOBAL_CONFIG_KEYS.includes(key as GlobalConfigKey)
}

export const PROJECT_CONFIG_KEYS = [
  'dontCrawlDirectory',
  'enableArchitectTool',
  'hasTrustDialogAccepted',
  'hasCompletedProjectOnboarding',
] as const

export type ProjectConfigKey = (typeof PROJECT_CONFIG_KEYS)[number]

export function checkHasTrustDialogAccepted(): boolean {
  let currentPath = getCwd()
  const config = getConfig(GLOBAL_CLAUDE_FILE, DEFAULT_GLOBAL_CONFIG)

  while (true) {
    const projectConfig = config.projects?.[currentPath]
    if (projectConfig?.hasTrustDialogAccepted) {
      return true
    }
    const parentPath = resolve(currentPath, '..')
    // Stop if we've reached the root (when parent is same as current)
    if (parentPath === currentPath) {
      break
    }
    currentPath = parentPath
  }

  return false
}

// We have to put this test code here because Jest doesn't support mocking ES modules :O
const TEST_GLOBAL_CONFIG_FOR_TESTING: GlobalConfig = {
  ...DEFAULT_GLOBAL_CONFIG,
  autoUpdaterStatus: 'disabled',
}
const TEST_PROJECT_CONFIG_FOR_TESTING: ProjectConfig = {
  ...DEFAULT_PROJECT_CONFIG,
}

export function isProjectConfigKey(key: string): key is ProjectConfigKey {
  return PROJECT_CONFIG_KEYS.includes(key as ProjectConfigKey)
}

export function saveGlobalConfig(config: GlobalConfig): void {
  if (process.env.NODE_ENV === 'test') {
    for (const key in config) {
      // @ts-expect-error: TODO
      TEST_GLOBAL_CONFIG_FOR_TESTING[key] = config[key]
    }
    return
  }
  saveConfig(
    GLOBAL_CLAUDE_FILE,
    {
      ...config,
      projects: getConfig(GLOBAL_CLAUDE_FILE, DEFAULT_GLOBAL_CONFIG).projects,
    },
    DEFAULT_GLOBAL_CONFIG,
  )
}

export function getGlobalConfig(): GlobalConfig {
  if (process.env.NODE_ENV === 'test') {
    return TEST_GLOBAL_CONFIG_FOR_TESTING
  }
  return getConfig(GLOBAL_CLAUDE_FILE, DEFAULT_GLOBAL_CONFIG)
}

export function getAnthropicApiKey(): null | string {
  const config = getGlobalConfig()

  if (process.env.USER_TYPE === 'SWE_BENCH') {
    return process.env.ANTHROPIC_API_KEY_OVERRIDE ?? null
  }

  if (process.env.USER_TYPE === 'external') {
    return config.primaryApiKey ?? null
  }

  if (process.env.USER_TYPE === 'ant') {
    if (
      process.env.ANTHROPIC_API_KEY &&
      config.customApiKeyResponses?.approved?.includes(
        normalizeApiKeyForConfig(process.env.ANTHROPIC_API_KEY),
      )
    ) {
      return process.env.ANTHROPIC_API_KEY
    }
    return config.primaryApiKey ?? null
  }

  return null
}

export function normalizeApiKeyForConfig(apiKey: string): string {
  return apiKey.slice(-20)
}

export function isDefaultApiKey(): boolean {
  const config = getGlobalConfig()
  const apiKey = getAnthropicApiKey()
  return apiKey === config.primaryApiKey
}

export function getCustomApiKeyStatus(
  truncatedApiKey: string,
): 'approved' | 'rejected' | 'new' {
  const config = getGlobalConfig()
  if (config.customApiKeyResponses?.approved?.includes(truncatedApiKey)) {
    return 'approved'
  }
  if (config.customApiKeyResponses?.rejected?.includes(truncatedApiKey)) {
    return 'rejected'
  }
  return 'new'
}

function saveConfig<A extends object>(
  file: string,
  config: A,
  defaultConfig: A,
): void {
  // Filter out any values that match the defaults
  const filteredConfig = Object.fromEntries(
    Object.entries(config).filter(
      ([key, value]) =>
        JSON.stringify(value) !== JSON.stringify(defaultConfig[key as keyof A]),
    ),
  )
  writeFileSync(file, JSON.stringify(filteredConfig, null, 2), 'utf-8')
}

// Flag to track if config reading is allowed
let configReadingAllowed = false

export function enableConfigs(): void {
  // Any reads to configuration before this flag is set show an console warning
  // to prevent us from adding config reading during module initialization
  configReadingAllowed = true
  // We only check the global config because currently all the configs share a file
  getConfig(
    GLOBAL_CLAUDE_FILE,
    DEFAULT_GLOBAL_CONFIG,
    true /* throw on invalid */,
  )
}

function getConfig<A>(
  file: string,
  defaultConfig: A,
  throwOnInvalid?: boolean,
): A {
  // Log a warning if config is accessed before it's allowed
  if (!configReadingAllowed && process.env.NODE_ENV !== 'test') {
    throw new Error('Config accessed before allowed.')
  }

  if (!existsSync(file)) {
    return cloneDeep(defaultConfig)
  }
  try {
    const fileContent = readFileSync(file, 'utf-8')
    try {
      const parsedConfig = JSON.parse(fileContent)
      return {
        ...cloneDeep(defaultConfig),
        ...parsedConfig,
      }
    } catch (error) {
      // Throw a ConfigParseError with the file path and default config
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      throw new ConfigParseError(errorMessage, file, defaultConfig)
    }
  } catch (error: unknown) {
    // Re-throw ConfigParseError if throwOnInvalid is true
    if (error instanceof ConfigParseError && throwOnInvalid) {
      throw error
    }
    return cloneDeep(defaultConfig)
  }
}

export function getCurrentProjectConfig(): ProjectConfig {
  if (process.env.NODE_ENV === 'test') {
    return TEST_PROJECT_CONFIG_FOR_TESTING
  }

  const absolutePath = resolve(getCwd())
  const config = getConfig(GLOBAL_CLAUDE_FILE, DEFAULT_GLOBAL_CONFIG)

  if (!config.projects) {
    return defaultConfigForProject(absolutePath)
  }

  const projectConfig =
    config.projects[absolutePath] ?? defaultConfigForProject(absolutePath)
  // Not sure how this became a string
  // TODO: Fix upstream
  if (typeof projectConfig.allowedTools === 'string') {
    projectConfig.allowedTools =
      (safeParseJSON(projectConfig.allowedTools) as string[]) ?? []
  }
  return projectConfig
}

export function saveCurrentProjectConfig(projectConfig: ProjectConfig): void {
  if (process.env.NODE_ENV === 'test') {
    for (const key in projectConfig) {
      // @ts-expect-error: TODO
      TEST_PROJECT_CONFIG_FOR_TESTING[key] = projectConfig[key]
    }
    return
  }
  const config = getConfig(GLOBAL_CLAUDE_FILE, DEFAULT_GLOBAL_CONFIG)
  saveConfig(
    GLOBAL_CLAUDE_FILE,
    {
      ...config,
      projects: {
        ...config.projects,
        [resolve(getCwd())]: projectConfig,
      },
    },
    DEFAULT_GLOBAL_CONFIG,
  )
}

export async function isAutoUpdaterDisabled(): Promise<boolean> {
  const useExternalUpdater = await checkGate(GATE_USE_EXTERNAL_UPDATER)
  return (
    useExternalUpdater || getGlobalConfig().autoUpdaterStatus === 'disabled'
  )
}

export const TEST_MCPRC_CONFIG_FOR_TESTING: Record<string, McpServerConfig> = {}

export function clearMcprcConfigForTesting(): void {
  if (process.env.NODE_ENV === 'test') {
    Object.keys(TEST_MCPRC_CONFIG_FOR_TESTING).forEach(key => {
      delete TEST_MCPRC_CONFIG_FOR_TESTING[key]
    })
  }
}

export function addMcprcServerForTesting(
  name: string,
  server: McpServerConfig,
): void {
  if (process.env.NODE_ENV === 'test') {
    TEST_MCPRC_CONFIG_FOR_TESTING[name] = server
  }
}

export function removeMcprcServerForTesting(name: string): void {
  if (process.env.NODE_ENV === 'test') {
    if (!TEST_MCPRC_CONFIG_FOR_TESTING[name]) {
      throw new Error(`No MCP server found with name: ${name} in .mcprc`)
    }
    delete TEST_MCPRC_CONFIG_FOR_TESTING[name]
  }
}

export const getMcprcConfig = memoize(
  (): Record<string, McpServerConfig> => {
    if (process.env.NODE_ENV === 'test') {
      return TEST_MCPRC_CONFIG_FOR_TESTING
    }

    const mcprcPath = join(getCwd(), '.mcprc')
    if (!existsSync(mcprcPath)) {
      return {}
    }

    try {
      const mcprcContent = readFileSync(mcprcPath, 'utf-8')
      const config = safeParseJSON(mcprcContent)
      if (config && typeof config === 'object') {
        logEvent('tengu_mcprc_found', {
          numServers: Object.keys(config).length.toString(),
        })
        return config as Record<string, McpServerConfig>
      }
    } catch {
      // Ignore errors reading/parsing .mcprc (they're logged in safeParseJSON)
    }
    return {}
  },
  // This function returns the same value as long as the cwd and mcprc file content remain the same
  () => {
    const cwd = getCwd()
    const mcprcPath = join(cwd, '.mcprc')
    if (existsSync(mcprcPath)) {
      try {
        const stat = readFileSync(mcprcPath, 'utf-8')
        return `${cwd}:${stat}`
      } catch {
        return cwd
      }
    }
    return cwd
  },
)

export function getOrCreateUserID(): string {
  const config = getGlobalConfig()
  if (config.userID) {
    return config.userID
  }

  const userID = randomBytes(32).toString('hex')
  saveGlobalConfig({ ...config, userID })
  return userID
}

export function getConfigForCLI(key: string, global: boolean): unknown {
  logEvent('tengu_config_get', {
    key,
    global: global?.toString() ?? 'false',
  })
  if (global) {
    if (!isGlobalConfigKey(key)) {
      console.error(
        `Error: '${key}' is not a valid config key. Valid keys are: ${GLOBAL_CONFIG_KEYS.join(', ')}`,
      )
      process.exit(1)
    }
    return getGlobalConfig()[key]
  } else {
    if (!isProjectConfigKey(key)) {
      console.error(
        `Error: '${key}' is not a valid config key. Valid keys are: ${PROJECT_CONFIG_KEYS.join(', ')}`,
      )
      process.exit(1)
    }
    return getCurrentProjectConfig()[key]
  }
}

export function setConfigForCLI(
  key: string,
  value: unknown,
  global: boolean,
): void {
  logEvent('tengu_config_set', {
    key,
    global: global?.toString() ?? 'false',
  })
  if (global) {
    if (!isGlobalConfigKey(key)) {
      console.error(
        `Error: Cannot set '${key}'. Only these keys can be modified: ${GLOBAL_CONFIG_KEYS.join(', ')}`,
      )
      process.exit(1)
    }

    if (key === 'autoUpdaterStatus' && !isAutoUpdaterStatus(value as string)) {
      console.error(
        `Error: Invalid value for autoUpdaterStatus. Must be one of: disabled, enabled, no_permissions, not_configured`,
      )
      process.exit(1)
    }

    const currentConfig = getGlobalConfig()
    saveGlobalConfig({
      ...currentConfig,
      [key]: value,
    })
  } else {
    if (!isProjectConfigKey(key)) {
      console.error(
        `Error: Cannot set '${key}'. Only these keys can be modified: ${PROJECT_CONFIG_KEYS.join(', ')}. Did you mean --global?`,
      )
      process.exit(1)
    }
    const currentConfig = getCurrentProjectConfig()
    saveCurrentProjectConfig({
      ...currentConfig,
      [key]: value,
    })
  }
  // Wait for the output to be flushed, to avoid clearing the screen.
  setTimeout(() => {
    // Without this we hang indefinitely.
    process.exit(0)
  }, 100)
}

export function deleteConfigForCLI(key: string, global: boolean): void {
  logEvent('tengu_config_delete', {
    key,
    global: global?.toString() ?? 'false',
  })
  if (global) {
    if (!isGlobalConfigKey(key)) {
      console.error(
        `Error: Cannot delete '${key}'. Only these keys can be modified: ${GLOBAL_CONFIG_KEYS.join(', ')}`,
      )
      process.exit(1)
    }
    const currentConfig = getGlobalConfig()
    delete currentConfig[key]
    saveGlobalConfig(currentConfig)
  } else {
    if (!isProjectConfigKey(key)) {
      console.error(
        `Error: Cannot delete '${key}'. Only these keys can be modified: ${PROJECT_CONFIG_KEYS.join(', ')}. Did you mean --global?`,
      )
      process.exit(1)
    }
    const currentConfig = getCurrentProjectConfig()
    delete currentConfig[key]
    saveCurrentProjectConfig(currentConfig)
  }
}

export function listConfigForCLI(global: true): GlobalConfig
export function listConfigForCLI(global: false): ProjectConfig
export function listConfigForCLI(global: boolean): object {
  logEvent('tengu_config_list', {
    global: global?.toString() ?? 'false',
  })
  if (global) {
    const currentConfig = pick(getGlobalConfig(), GLOBAL_CONFIG_KEYS)
    return currentConfig
  } else {
    return pick(getCurrentProjectConfig(), PROJECT_CONFIG_KEYS)
  }
}
