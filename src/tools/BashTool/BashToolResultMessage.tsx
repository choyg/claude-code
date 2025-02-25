import { Box, Text } from 'ink'
import { OutputLine } from './OutputLine.js'
import React from 'react'
import { getTheme } from '../../utils/theme.js'
import { Out as BashOut } from './BashTool.js'

type Props = {
  content: Omit<BashOut, 'interrupted'>
  verbose: boolean
}

function BashToolResultMessage({ content, verbose }: Props): JSX.Element {
  const { stdout, stdoutLines, stderr, stderrLines } = content

  return (
    <Box flexDirection="column">
      {stdout !== '' ? (
        <OutputLine content={stdout} lines={stdoutLines} verbose={verbose} />
      ) : null}
      {stderr !== '' ? (
        <OutputLine
          content={stderr}
          lines={stderrLines}
          verbose={verbose}
          isError
        />
      ) : null}
      {stdout === '' && stderr === '' ? (
        <Box flexDirection="row">
          <Text>&nbsp;&nbsp;⎿ &nbsp;</Text>
          <Text color={getTheme().secondaryText}>(No content)</Text>
        </Box>
      ) : null}
    </Box>
  )
}

export default BashToolResultMessage
