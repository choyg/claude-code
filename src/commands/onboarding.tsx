import * as React from 'react'
import type { Command } from '../commands.js'
import { Onboarding } from '../components/Onboarding.js'
import { clearTerminal } from '../utils/terminal.js'
import { getGlobalConfig, saveGlobalConfig } from '../utils/config.js'
import { clearConversation } from './clear.js'

export default {
  type: 'local-jsx',
  name: 'onboarding',
  description: '[ANT-ONLY] Run through the onboarding flow',
  isEnabled: process.env.USER_TYPE === 'ant',
  isHidden: false,
  async call(onDone, context) {
    await clearTerminal()
    const config = getGlobalConfig()
    saveGlobalConfig({
      ...config,
      theme: 'dark',
    })

    return (
      <Onboarding
        onDone={async () => {
          clearConversation(context)
          onDone()
        }}
      />
    )
  },
  userFacingName() {
    return 'onboarding'
  },
} satisfies Command
