import bug from './commands/bug.js'
import clear from './commands/clear.js'
import compact from './commands/compact.js'
import config from './commands/config.js'
import cost from './commands/cost.js'
import ctx_viz from './commands/ctx_viz.js'
import doctor from './commands/doctor.js'
import help from './commands/help.js'
import init from './commands/init.js'
import listen from './commands/listen.js'
import login from './commands/login.js'
import logout from './commands/logout.js'
import onboarding from './commands/onboarding.js'
import pr_comments from './commands/pr_comments.js'
import releaseNotes from './commands/release-notes.js'
import review from './commands/review.js'
import terminalSetup from './commands/terminalSetup.js'
import { Tool, ToolUseContext } from './Tool.js'
import resume from './commands/resume.js'
import { getMCPCommands } from './services/mcpClient.js'
import type { MessageParam } from '@anthropic-ai/sdk/resources/index.mjs'
import { memoize } from 'lodash-es'
import type { Message } from './query.js'
import { isAnthropicAuthEnabled } from './utils/auth.js'

type PromptCommand = {
  type: 'prompt'
  progressMessage: string
  argNames?: string[]
  getPromptForCommand(args: string): Promise<MessageParam[]>
}

type LocalCommand = {
  type: 'local'
  call(
    args: string,
    context: {
      options: {
        commands: Command[]
        tools: Tool[]
        slowAndCapableModel: string
      }
      abortController: AbortController
      setForkConvoWithMessagesOnTheNextRender: (
        forkConvoWithMessages: Message[],
      ) => void
    },
  ): Promise<string>
}

type LocalJSXCommand = {
  type: 'local-jsx'
  call(
    onDone: (result?: string) => void,
    context: ToolUseContext & {
      setForkConvoWithMessagesOnTheNextRender: (
        forkConvoWithMessages: Message[],
      ) => void
    },
  ): Promise<React.ReactNode>
}

export type Command = {
  description: string
  isEnabled: boolean
  isHidden: boolean
  name: string
  aliases?: string[]
  userFacingName(): string
} & (PromptCommand | LocalCommand | LocalJSXCommand)

const INTERNAL_ONLY_COMMANDS = [ctx_viz, resume, listen]

// Declared as a function so that we don't run this until getCommands is called,
// since underlying functions read from config, which can't be read at module initialization time
const COMMANDS = memoize((): Command[] => [
  clear,
  compact,
  config,
  cost,
  doctor,
  help,
  init,
  onboarding,
  pr_comments,
  releaseNotes,
  bug,
  review,
  terminalSetup,
  ...(isAnthropicAuthEnabled() ? [logout, login()] : []),
  ...(process.env.USER_TYPE === 'ant' ? INTERNAL_ONLY_COMMANDS : []),
])

export const getCommands = memoize(async (): Promise<Command[]> => {
  return [...(await getMCPCommands()), ...COMMANDS()].filter(_ => _.isEnabled)
})

export function hasCommand(commandName: string, commands: Command[]): boolean {
  return commands.some(
    _ => _.userFacingName() === commandName || _.aliases?.includes(commandName),
  )
}

export function getCommand(commandName: string, commands: Command[]): Command {
  const command = commands.find(
    _ => _.userFacingName() === commandName || _.aliases?.includes(commandName),
  ) as Command | undefined
  if (!command) {
    throw ReferenceError(
      `Command ${commandName} not found. Available commands: ${commands
        .map(_ => {
          const name = _.userFacingName()
          return _.aliases ? `${name} (aliases: ${_.aliases.join(', ')})` : name
        })
        .join(', ')}`,
    )
  }

  return command
}
