import * as React from 'react'
import type { Command } from '../commands.js'
import { getGlobalConfig, saveGlobalConfig } from '../utils/config.js'
import { clearTerminal } from '../utils/terminal.js'
import { Text } from 'ink'

export default {
  type: 'local-jsx',
  name: 'logout',
  description: 'Sign out from your Anthropic account',
  isEnabled: true,
  isHidden: false,
  async call() {
    await clearTerminal()

    const config = getGlobalConfig()

    config.oauthAccount = undefined
    config.primaryApiKey = undefined
    config.hasCompletedOnboarding = false

    if (config.customApiKeyResponses?.approved) {
      config.customApiKeyResponses.approved = []
    }

    saveGlobalConfig(config)

    const message = (
      <Text>Successfully logged out from your Anthropic account.</Text>
    )

    setTimeout(() => {
      process.exit(0)
    }, 200)

    return message
  },
  userFacingName() {
    return 'logout'
  },
} satisfies Command
