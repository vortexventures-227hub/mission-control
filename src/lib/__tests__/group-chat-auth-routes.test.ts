import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const requireRole = vi.fn()
const getGroupChatRoomBySlug = vi.fn()
const listGroupChatAgentProfiles = vi.fn()
const listGroupChatAssignments = vi.fn()
const listGroupChatDecisionReceipts = vi.fn()
const listGroupChatMessages = vi.fn()
const listGroupChatQueuedAlerts = vi.fn()
const listGroupChatRooms = vi.fn()
const createGroupChatMessage = vi.fn()
const updateGroupChatAssignmentStatus = vi.fn()

vi.mock('@/lib/auth', () => ({
  requireRole,
}))

vi.mock('@/lib/group-chat', () => ({
  getGroupChatRoomBySlug,
  listGroupChatAgentProfiles,
  listGroupChatAssignments,
  listGroupChatDecisionReceipts,
  listGroupChatMessages,
  listGroupChatQueuedAlerts,
  listGroupChatRooms,
  createGroupChatMessage,
  updateGroupChatAssignmentStatus,
}))

vi.mock('@/lib/rate-limit', () => ({
  mutationLimiter: vi.fn(() => null),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

const room = {
  id: 10,
  slug: 'blackwire-ops',
  name: 'Blackwire Ops',
  kind: 'project',
  project_key: 'blackwire',
  pinned_finish_line: null,
  pinned_owner: null,
  pinned_blocker: null,
  created_at: 1,
  updated_at: 1,
}

function makeRequest(path: string) {
  return new NextRequest(`http://localhost${path}`)
}

describe('group chat API auth proof routes', () => {
  beforeEach(() => {
    vi.resetModules()
    requireRole.mockReset()
    getGroupChatRoomBySlug.mockReset()
    listGroupChatAgentProfiles.mockReset()
    listGroupChatAssignments.mockReset()
    listGroupChatDecisionReceipts.mockReset()
    listGroupChatMessages.mockReset()
    listGroupChatQueuedAlerts.mockReset()
    listGroupChatRooms.mockReset()
    createGroupChatMessage.mockReset()
    updateGroupChatAssignmentStatus.mockReset()

    getGroupChatRoomBySlug.mockReturnValue(room)
    listGroupChatRooms.mockReturnValue([room])
    listGroupChatMessages.mockReturnValue([{ id: 77, body: 'proof', delivery: [] }])
    listGroupChatAssignments.mockReturnValue([{ id: 88, title: 'proof assignment', status: 'working' }])
    listGroupChatDecisionReceipts.mockReturnValue([])
    listGroupChatQueuedAlerts.mockReturnValue([])
    listGroupChatAgentProfiles.mockReturnValue([])
  })

  it.each([
    ['rooms', '@/app/api/group-chat/rooms/route'],
    ['messages', '@/app/api/group-chat/messages/route'],
    ['assignments', '@/app/api/group-chat/assignments/route'],
  ])('blocks unauthenticated GET /api/group-chat/%s with 401', async (_name, modulePath) => {
    requireRole.mockReturnValue({ error: 'Authentication required', status: 401 })
    const { GET } = await import(modulePath)

    const response = await GET(makeRequest(`/api/group-chat/${_name}`))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('Authentication required')
  })

  it('returns group-chat rooms, messages, and assignments for an authenticated viewer without mutating state', async () => {
    requireRole.mockReturnValue({ user: { id: 1, username: 'admin', role: 'admin', workspace_id: 1 } })

    const [{ GET: getRooms }, { GET: getMessages }, { GET: getAssignments }] = await Promise.all([
      import('@/app/api/group-chat/rooms/route'),
      import('@/app/api/group-chat/messages/route'),
      import('@/app/api/group-chat/assignments/route'),
    ])

    const roomsResponse = await getRooms(makeRequest('/api/group-chat/rooms?room=blackwire-ops'))
    const messagesResponse = await getMessages(makeRequest('/api/group-chat/messages?room=blackwire-ops'))
    const assignmentsResponse = await getAssignments(makeRequest('/api/group-chat/assignments?room=blackwire-ops'))

    expect(roomsResponse.status).toBe(200)
    expect(messagesResponse.status).toBe(200)
    expect(assignmentsResponse.status).toBe(200)

    await expect(roomsResponse.json()).resolves.toMatchObject({ selectedRoom: room })
    await expect(messagesResponse.json()).resolves.toMatchObject({ messages: [{ id: 77, body: 'proof', delivery: [] }] })
    await expect(assignmentsResponse.json()).resolves.toMatchObject({
      selectedRoom: room,
      assignments: [{ id: 88, title: 'proof assignment', status: 'working' }],
    })

    expect(createGroupChatMessage).not.toHaveBeenCalled()
    expect(updateGroupChatAssignmentStatus).not.toHaveBeenCalled()
  })
})
