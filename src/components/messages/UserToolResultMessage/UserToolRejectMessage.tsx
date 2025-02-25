import * as React from 'react'
import { Tool } from '../../../Tool.js'
import { Message } from '../../../query.js'
import { FallbackToolUseRejectedMessage } from '../../FallbackToolUseRejectedMessage.js'
import { useGetToolFromMessages } from './utils.js'
import { useTerminalSize } from '../../../hooks/useTerminalSize.js'

type Props = {
  toolUseID: string
  messages: Message[]
  tools: Tool[]
  verbose: boolean
}

export function UserToolRejectMessage({
  toolUseID,
  tools,
  messages,
  verbose,
}: Props): React.ReactNode {
  const { columns } = useTerminalSize()
  const { tool, toolUse } = useGetToolFromMessages(toolUseID, tools, messages)
  const input = tool.inputSchema.safeParse(toolUse.input)
  if (input.success) {
    return tool.renderToolUseRejectedMessage(input.data, {
      columns,
      verbose,
    })
  }
  return <FallbackToolUseRejectedMessage />
}
