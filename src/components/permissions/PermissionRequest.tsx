import { useInput } from 'ink'
import * as React from 'react'
import { Tool } from '../../Tool.js'
import { AssistantMessage } from '../../query.js'
import { FileEditTool } from '../../tools/FileEditTool/FileEditTool.js'
import { FileWriteTool } from '../../tools/FileWriteTool/FileWriteTool.js'
import { BashTool } from '../../tools/BashTool/BashTool.js'
import { FileEditPermissionRequest } from './FileEditPermissionRequest/FileEditPermissionRequest.js'
import { BashPermissionRequest } from './BashPermissionRequest/BashPermissionRequest.js'
import { FallbackPermissionRequest } from './FallbackPermissionRequest.js'
import { useNotifyAfterTimeout } from '../../hooks/useNotifyAfterTimeout.js'
import { FileWritePermissionRequest } from './FileWritePermissionRequest/FileWritePermissionRequest.js'
import { type CommandSubcommandPrefixResult } from '../../utils/commands.js'
import { FilesystemPermissionRequest } from './FilesystemPermissionRequest/FilesystemPermissionRequest.js'
import { NotebookEditTool } from '../../tools/NotebookEditTool/NotebookEditTool.js'
import { GlobTool } from '../../tools/GlobTool/GlobTool.js'
import { GrepTool } from '../../tools/GrepTool/GrepTool.js'
import { LSTool } from '../../tools/lsTool/lsTool.js'
import { FileReadTool } from '../../tools/FileReadTool/FileReadTool.js'
import { NotebookReadTool } from '../../tools/NotebookReadTool/NotebookReadTool.js'

function permissionComponentForTool(tool: Tool) {
  switch (tool) {
    case FileEditTool:
      return FileEditPermissionRequest
    case FileWriteTool:
      return FileWritePermissionRequest
    case BashTool:
      return BashPermissionRequest
    case GlobTool:
    case GrepTool:
    case LSTool:
    case FileReadTool:
    case NotebookReadTool:
    case NotebookEditTool:
      return FilesystemPermissionRequest
    default:
      return FallbackPermissionRequest
  }
}

export type PermissionRequestProps = {
  toolUseConfirm: ToolUseConfirm
  onDone(): void
  verbose: boolean
}

export function toolUseConfirmGetPrefix(
  toolUseConfirm: ToolUseConfirm,
): string | null {
  return (
    (toolUseConfirm.commandPrefix &&
      !toolUseConfirm.commandPrefix.commandInjectionDetected &&
      toolUseConfirm.commandPrefix.commandPrefix) ||
    null
  )
}

export type ToolUseConfirm = {
  assistantMessage: AssistantMessage
  tool: Tool
  description: string
  input: { [key: string]: unknown }
  commandPrefix: CommandSubcommandPrefixResult | null
  // TODO: remove riskScore from ToolUseConfirm
  riskScore: number | null
  onAbort(): void
  onAllow(type: 'permanent' | 'temporary'): void
  onReject(): void
}

// TODO: Move this to Tool.renderPermissionRequest
export function PermissionRequest({
  toolUseConfirm,
  onDone,
  verbose,
}: PermissionRequestProps): React.ReactNode {
  // Handle Ctrl+C
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      onDone()
      toolUseConfirm.onReject()
    }
  })

  const toolName = toolUseConfirm.tool.userFacingName(
    toolUseConfirm.input as never,
  )
  useNotifyAfterTimeout(`Claude needs your permission to use ${toolName}`)

  const PermissionComponent = permissionComponentForTool(toolUseConfirm.tool)

  return (
    <PermissionComponent
      toolUseConfirm={toolUseConfirm}
      onDone={onDone}
      verbose={verbose}
    />
  )
}
