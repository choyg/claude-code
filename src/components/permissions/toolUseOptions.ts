import { type Option } from '@inkjs/ui'
import chalk from 'chalk'
import {
  type ToolUseConfirm,
  toolUseConfirmGetPrefix,
} from './PermissionRequest.js'
import { isUnsafeCompoundCommand } from '../../utils/commands.js'
import { getCwd } from '../../utils/state.js'
import { getTheme } from '../../utils/theme.js'
import { type OptionSubtree } from '../CustomSelect/select.js'

/**
 * Generates options for the tool use confirmation dialog
 */
export function toolUseOptions({
  toolUseConfirm,
  command,
}: {
  toolUseConfirm: ToolUseConfirm
  command: string
}): (Option | OptionSubtree)[] {
  // Hide "don't ask again" options if the command is an unsafe compound command, or a potential command injection
  const showDontAskAgainOption =
    !isUnsafeCompoundCommand(command) &&
    toolUseConfirm.commandPrefix &&
    !toolUseConfirm.commandPrefix.commandInjectionDetected
  const prefix = toolUseConfirmGetPrefix(toolUseConfirm)
  const showDontAskAgainPrefixOption = showDontAskAgainOption && prefix !== null

  let dontShowAgainOptions: (Option | OptionSubtree)[] = []
  if (showDontAskAgainPrefixOption) {
    // Prefix option takes precedence over full command option
    dontShowAgainOptions = [
      {
        label: `Yes, and don't ask again for ${chalk.bold(prefix)} commands in ${chalk.bold(getCwd())}`,
        value: 'yes-dont-ask-again-prefix',
      },
    ]
  } else if (showDontAskAgainOption) {
    dontShowAgainOptions = [
      {
        label: `Yes, and don't ask again for ${chalk.bold(command)} commands in ${chalk.bold(getCwd())}`,
        value: 'yes-dont-ask-again-full',
      },
    ]
  }

  return [
    {
      label: 'Yes',
      value: 'yes',
    },
    ...dontShowAgainOptions,
    {
      label: `No, and tell Claude what to do differently (${chalk.bold.hex(getTheme().warning)('esc')})`,
      value: 'no',
    },
  ]
}
