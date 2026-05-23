export type ChatSource = {
  text: string
  start: number
  score: number
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
  createdAt: number
}

const CHAT_KEY = 'yt-semantic-chat'

function loadAllChats(): Record<string, ChatMessage[]> {
  try {
    const raw = localStorage.getItem(CHAT_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, ChatMessage[]>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveAllChats(chats: Record<string, ChatMessage[]>) {
  localStorage.setItem(CHAT_KEY, JSON.stringify(chats))
}

export function loadChat(videoId: string): ChatMessage[] {
  return loadAllChats()[videoId] ?? []
}

export function saveChat(videoId: string, messages: ChatMessage[]) {
  const chats = loadAllChats()
  if (messages.length === 0) {
    delete chats[videoId]
  } else {
    chats[videoId] = messages
  }
  saveAllChats(chats)
}

export function clearChat(videoId: string) {
  saveChat(videoId, [])
}

export function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
