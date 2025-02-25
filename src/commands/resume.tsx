import * as React from 'react'
import type { Command } from '../commands.js'
import { ResumeConversation } from '../screens/ResumeConversation.js'
import { render } from 'ink'
import { CACHE_PATHS, loadLogList } from '../utils/log.js'

export default {
  type: 'local-jsx',
  name: 'resume',
  description: '[ANT-ONLY] Resume a previous conversation',
  isEnabled: process.env.USER_TYPE === 'ant',
  isHidden: process.env.USER_TYPE !== 'ant',
  userFacingName() {
    return 'resume'
  },
  async call(onDone, { options: { commands, tools, verbose } }) {
    const logs = await loadLogList(CACHE_PATHS.messages())
    render(
      <ResumeConversation
        commands={commands}
        context={{ unmount: onDone }}
        logs={logs}
        tools={tools}
        verbose={verbose}
      />,
    )
    // This return is here for type only
    return null
  },
} satisfies Command
