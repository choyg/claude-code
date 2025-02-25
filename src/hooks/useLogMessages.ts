import { useEffect } from 'react'
import { type Message } from '../query.js'
import { overwriteLog, getMessagesPath } from '../utils/log.js'

export function useLogMessages(
  messages: Message[],
  messageLogName: string,
  forkNumber: number,
): void {
  useEffect(() => {
    overwriteLog(
      getMessagesPath(messageLogName, forkNumber, 0),
      messages.filter(_ => _.type !== 'progress'),
    )
  }, [messages, messageLogName, forkNumber])
}
