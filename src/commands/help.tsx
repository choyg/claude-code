import { Command } from '../commands.js'
import { Help } from '../components/Help.js'
import * as React from 'react'

const help = {
  type: 'local-jsx',
  name: 'help',
  description: 'Show help and available commands',
  isEnabled: true,
  isHidden: false,
  async call(onDone, { options: { commands } }) {
    return <Help commands={commands} onClose={onDone} />
  },
  userFacingName() {
    return 'help'
  },
} satisfies Command

export default help
