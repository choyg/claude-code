import * as React from 'react'
import BashToolResultMessage from '../../tools/BashTool/BashToolResultMessage.js'
import { extractTag } from '../../utils/messages.js'

export function AssistantBashOutputMessage({
  content,
  verbose,
}: {
  content: string
  verbose?: boolean
}): React.ReactNode {
  const stdout = extractTag(content, 'bash-stdout') ?? ''
  const stderr = extractTag(content, 'bash-stderr') ?? ''
  const stdoutLines = stdout.split('\n').length
  const stderrLines = stderr.split('\n').length
  return (
    <BashToolResultMessage
      content={{ stdout, stdoutLines, stderr, stderrLines }}
      verbose={!!verbose}
    />
  )
}
