import * as React from 'react'
import type { Command } from '../commands.js'
import { ConsoleOAuthFlow } from '../components/ConsoleOAuthFlow.js'
import { clearTerminal } from '../utils/terminal.js'
import { isLoggedInToAnthropic } from '../utils/auth.js'
import { useExitOnCtrlCD } from '../hooks/useExitOnCtrlCD.js'
import { Box, Text } from 'ink'
import { clearConversation } from './clear.js'

export default () =>
  ({
    type: 'local-jsx',
    name: 'login',
    description: isLoggedInToAnthropic()
      ? 'Switch Anthropic accounts'
      : 'Sign in with your Anthropic account',
    isEnabled: true,
    isHidden: false,
    async call(onDone, context) {
      await clearTerminal()
      return (
        <Login
          onDone={async () => {
            clearConversation(context)
            onDone()
          }}
        />
      )
    },
    userFacingName() {
      return 'login'
    },
  }) satisfies Command

function Login(props: { onDone: () => void }) {
  const exitState = useExitOnCtrlCD(props.onDone)
  return (
    <Box flexDirection="column">
      <ConsoleOAuthFlow onDone={props.onDone} />
      <Box marginLeft={3}>
        <Text dimColor>
          {exitState.pending ? (
            <>Press {exitState.keyName} again to exit</>
          ) : (
            ''
          )}
        </Text>
      </Box>
    </Box>
  )
}
