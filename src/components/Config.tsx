import { Box, Text, useInput } from 'ink'
import * as React from 'react'
import { useState } from 'react'
import figures from 'figures'
import { getTheme } from '../utils/theme.js'
import {
  GlobalConfig,
  saveGlobalConfig,
  normalizeApiKeyForConfig,
} from '../utils/config.js'
import { getGlobalConfig } from '../utils/config.js'
import chalk from 'chalk'
import { PRODUCT_NAME } from '../constants/product.js'
import { useExitOnCtrlCD } from '../hooks/useExitOnCtrlCD.js'

type Props = {
  onClose: () => void
}

type Setting =
  | {
      id: string
      label: string
      value: boolean
      onChange(value: boolean): void
      type: 'boolean'
    }
  | {
      id: string
      label: string
      value: string
      options: string[]
      onChange(value: string): void
      type: 'enum'
    }

export function Config({ onClose }: Props): React.ReactNode {
  const [globalConfig, setGlobalConfig] = useState(getGlobalConfig())
  const initialConfig = React.useRef(getGlobalConfig())
  const [selectedIndex, setSelectedIndex] = useState(0)
  const exitState = useExitOnCtrlCD(() => process.exit(0))

  // TODO: Add MCP servers
  const settings: Setting[] = [
    // Global settings
    ...(process.env.ANTHROPIC_API_KEY
      ? [
          {
            id: 'apiKey',
            label: `Use custom API key: ${chalk.bold(normalizeApiKeyForConfig(process.env.ANTHROPIC_API_KEY))}`,
            value: Boolean(
              process.env.ANTHROPIC_API_KEY &&
                globalConfig.customApiKeyResponses?.approved?.includes(
                  normalizeApiKeyForConfig(process.env.ANTHROPIC_API_KEY),
                ),
            ),
            type: 'boolean' as const,
            onChange(useCustomKey: boolean) {
              const config = { ...getGlobalConfig() }
              if (!config.customApiKeyResponses) {
                config.customApiKeyResponses = {
                  approved: [],
                  rejected: [],
                }
              }
              if (!config.customApiKeyResponses.approved) {
                config.customApiKeyResponses.approved = []
              }
              if (!config.customApiKeyResponses.rejected) {
                config.customApiKeyResponses.rejected = []
              }
              if (process.env.ANTHROPIC_API_KEY) {
                const truncatedKey = normalizeApiKeyForConfig(
                  process.env.ANTHROPIC_API_KEY,
                )
                if (useCustomKey) {
                  config.customApiKeyResponses.approved = [
                    ...config.customApiKeyResponses.approved.filter(
                      k => k !== truncatedKey,
                    ),
                    truncatedKey,
                  ]
                  config.customApiKeyResponses.rejected =
                    config.customApiKeyResponses.rejected.filter(
                      k => k !== truncatedKey,
                    )
                } else {
                  config.customApiKeyResponses.approved =
                    config.customApiKeyResponses.approved.filter(
                      k => k !== truncatedKey,
                    )
                  config.customApiKeyResponses.rejected = [
                    ...config.customApiKeyResponses.rejected.filter(
                      k => k !== truncatedKey,
                    ),
                    truncatedKey,
                  ]
                }
              }
              saveGlobalConfig(config)
              setGlobalConfig(config)
            },
          },
        ]
      : []),
    {
      id: 'verbose',
      label: 'Verbose output',
      value: globalConfig.verbose,
      type: 'boolean',
      onChange(verbose: boolean) {
        const config = { ...getGlobalConfig(), verbose }
        saveGlobalConfig(config)
        setGlobalConfig(config)
      },
    },
    {
      id: 'theme',
      label: 'Theme',
      value: globalConfig.theme,
      options: ['light', 'dark', 'light-daltonized', 'dark-daltonized'],
      type: 'enum',
      onChange(theme: GlobalConfig['theme']) {
        const config = { ...getGlobalConfig(), theme }
        saveGlobalConfig(config)
        setGlobalConfig(config)
      },
    },
    {
      id: 'notifChannel',
      label: 'Notifications',
      value: globalConfig.preferredNotifChannel,
      options: [
        'iterm2',
        'terminal_bell',
        'iterm2_with_bell',
        'notifications_disabled',
      ],
      type: 'enum',
      onChange(notifChannel: GlobalConfig['preferredNotifChannel']) {
        const config = {
          ...getGlobalConfig(),
          preferredNotifChannel: notifChannel,
        }
        saveGlobalConfig(config)
        setGlobalConfig(config)
      },
    },
  ]

  useInput((input, key) => {
    if (key.escape) {
      // Log any changes that were made
      // TODO: Make these proper messages
      const changes: string[] = []
      // Check for API key changes
      const initialUsingCustomKey = Boolean(
        process.env.ANTHROPIC_API_KEY &&
          initialConfig.current.customApiKeyResponses?.approved?.includes(
            normalizeApiKeyForConfig(process.env.ANTHROPIC_API_KEY),
          ),
      )
      const currentUsingCustomKey = Boolean(
        process.env.ANTHROPIC_API_KEY &&
          globalConfig.customApiKeyResponses?.approved?.includes(
            normalizeApiKeyForConfig(process.env.ANTHROPIC_API_KEY),
          ),
      )
      if (initialUsingCustomKey !== currentUsingCustomKey) {
        changes.push(
          `  ⎿  ${currentUsingCustomKey ? 'Enabled' : 'Disabled'} custom API key`,
        )
      }

      if (globalConfig.verbose !== initialConfig.current.verbose) {
        changes.push(`  ⎿  Set verbose to ${chalk.bold(globalConfig.verbose)}`)
      }
      if (globalConfig.theme !== initialConfig.current.theme) {
        changes.push(`  ⎿  Set theme to ${chalk.bold(globalConfig.theme)}`)
      }
      if (
        globalConfig.preferredNotifChannel !==
        initialConfig.current.preferredNotifChannel
      ) {
        changes.push(
          `  ⎿  Set notifications to ${chalk.bold(globalConfig.preferredNotifChannel)}`,
        )
      }
      if (changes.length > 0) {
        console.log(chalk.gray(changes.join('\n')))
      }
      onClose()
      return
    }

    function toggleSetting() {
      const setting = settings[selectedIndex]
      if (!setting || !setting.onChange) {
        return
      }

      if (setting.type === 'boolean') {
        setting.onChange(!setting.value)
        return
      }

      if (setting.type === 'enum') {
        const currentIndex = setting.options.indexOf(setting.value)
        const nextIndex = (currentIndex + 1) % setting.options.length
        setting.onChange(setting.options[nextIndex]!)
        return
      }
    }

    if (key.return || input === ' ') {
      toggleSetting()
      return
    }

    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1))
    }

    if (key.downArrow) {
      setSelectedIndex(prev => Math.min(settings.length - 1, prev + 1))
    }
  })

  return (
    <>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={getTheme().secondaryBorder}
        paddingX={1}
        marginTop={1}
      >
        <Box flexDirection="column" minHeight={2} marginBottom={1}>
          <Text bold>Settings</Text>
          <Text dimColor>Configure {PRODUCT_NAME} preferences</Text>
        </Box>

        {settings.map((setting, i) => {
          const isSelected = i === selectedIndex

          return (
            <Box key={setting.id} height={2} minHeight={2}>
              <Box width={44}>
                <Text color={isSelected ? 'blue' : undefined}>
                  {isSelected ? figures.pointer : ' '} {setting.label}
                </Text>
              </Box>
              <Box>
                {setting.type === 'boolean' ? (
                  <Text color={isSelected ? 'blue' : undefined}>
                    {setting.value.toString()}
                  </Text>
                ) : (
                  <Text color={isSelected ? 'blue' : undefined}>
                    {setting.value.toString()}
                  </Text>
                )}
              </Box>
            </Box>
          )
        })}
      </Box>
      <Box marginLeft={3}>
        <Text dimColor>
          {exitState.pending ? (
            <>Press {exitState.keyName} again to exit</>
          ) : (
            <>↑/↓ to select · Enter/Space to change · Esc to close</>
          )}
        </Text>
      </Box>
    </>
  )
}
