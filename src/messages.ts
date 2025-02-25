import type { Message } from './query.js'

let getMessages: () => Message[] = () => []
let setMessages: React.Dispatch<React.SetStateAction<Message[]>> = () => {}

export function setMessagesGetter(getter: () => Message[]) {
  getMessages = getter
}

export function getMessagesGetter(): () => Message[] {
  return getMessages
}

export function setMessagesSetter(
  setter: React.Dispatch<React.SetStateAction<Message[]>>,
) {
  setMessages = setter
}

export function getMessagesSetter(): React.Dispatch<
  React.SetStateAction<Message[]>
> {
  return setMessages
}
