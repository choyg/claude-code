import * as React from 'react'
import { getTheme } from '../utils/theme.js'
import { Text } from 'ink'

export function PressEnterToContinue(): React.ReactNode {
  return (
    <Text color={getTheme().permission}>
      Press <Text bold>Enter</Text> to continue…
    </Text>
  )
}
