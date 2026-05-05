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
const updateGroupChatDeliveryState = vi.fn()
const updateGroupChatAssignmentStatus = vi.fn()
const getCommandTruthRouteContract = vi.fn()

vi.mock('@/lib/auth', () => ({
  requireRole,
}))

vi.mock('@/lib/group-chat', () => ({
  GROUP_CHAT_LOCAL_DELIVERY_BOUNDARY: 'Mission Control local DB only; no Telegram, customer, email, or external agent transport was contacted.',
  normalizeGroupChatAgentId: (value: string) => value.trim().toLowerCase().replace(/^agent:/, ''),
  canWriteAsGroupChatAgent: (input: { senderId: string; authAgentName?: string | null; authUsername?: string | null }) => {
    const senderId = input.senderId.trim().toLowerCase().replace(/^agent:/, '')
    const agentName = (input.authAgentName || '').trim().toLowerCase().replace(/^agent:/, '')
    const username = (input.authUsername || '').trim().toLowerCase().replace(/^agent:/, '')
    return senderId.length > 0 && (senderId === agentName || senderId === username)
  },
  getGroupChatRoomBySlug,
  listGroupChatAgentProfiles,
  listGroupChatAssignments,
  listGroupChatDecisionReceipts,
  listGroupChatMessages,
  listGroupChatQueuedAlerts,
  listGroupChatRooms,
  createGroupChatMessage,
  updateGroupChatDeliveryState,
  updateGroupChatAssignmentStatus,
}))

vi.mock('@/lib/command-truth-route-contract', () => ({
  getCommandTruthRouteContract,
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
    updateGroupChatDeliveryState.mockReset()
    updateGroupChatAssignmentStatus.mockReset()
    getCommandTruthRouteContract.mockReset()

    getGroupChatRoomBySlug.mockReturnValue(room)
    listGroupChatRooms.mockReturnValue([room])
    listGroupChatMessages.mockReturnValue([{ id: 77, body: 'proof', delivery: [] }])
    listGroupChatAssignments.mockReturnValue([{ id: 88, title: 'proof assignment', status: 'working' }])
    listGroupChatDecisionReceipts.mockReturnValue([])
    listGroupChatQueuedAlerts.mockReturnValue([])
    listGroupChatAgentProfiles.mockReturnValue([])
    getCommandTruthRouteContract.mockReturnValue({
      localMvpBoundary: 'Commercial-demo candidate only; production actions remain approval/instrumentation-gated.',
      routes: [
        { path: '/command-truth?tab=routes', status: 'live' },
        { path: '/rooms/blackwire-ops', status: 'alias' },
        { path: '/tracker?agent=neon-forge', status: 'alias' },
        { path: '/api/command-truth/routes', status: 'live' },
      ],
    })
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

  it('allows an agent-scoped identity to create its own local room message without external delivery', async () => {
    requireRole.mockReturnValue({
      user: {
        id: -1,
        username: 'agent:koda',
        display_name: 'Koda',
        role: 'operator',
        workspace_id: 1,
        agent_name: 'koda',
      },
    })
    createGroupChatMessage.mockReturnValue({
      message: { id: 91, sender_type: 'agent', sender_id: 'koda', body: 'local proof', delivery: [] },
      assignments: [],
    })
    const { POST } = await import('@/app/api/group-chat/messages/route')

    const request = new NextRequest('http://localhost/api/group-chat/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-agent-name': 'koda' },
      body: JSON.stringify({
        roomSlug: 'blackwire-ops',
        senderType: 'agent',
        senderId: 'koda',
        body: 'local proof',
      }),
    })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.externalDelivery).toBe(false)
    expect(body.deliveryBoundary).toContain('local DB only')
    expect(createGroupChatMessage).toHaveBeenCalledWith(expect.objectContaining({
      senderType: 'agent',
      senderId: 'koda',
      body: 'local proof',
      workspaceId: 1,
    }))
  })

  it('rejects agent message spoofing before writing local chat state', async () => {
    requireRole.mockReturnValue({
      user: {
        id: -1,
        username: 'agent:koda',
        display_name: 'Koda',
        role: 'operator',
        workspace_id: 1,
        agent_name: 'koda',
      },
    })
    const { POST } = await import('@/app/api/group-chat/messages/route')

    const request = new NextRequest('http://localhost/api/group-chat/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-agent-name': 'koda' },
      body: JSON.stringify({
        roomSlug: 'blackwire-ops',
        senderType: 'agent',
        senderId: 'herm',
        body: 'spoofed local proof',
      }),
    })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toContain('agent-scoped identity')
    expect(createGroupChatMessage).not.toHaveBeenCalled()
  })

  it('rejects non-admin attempts to spoof system messages before writing local chat state', async () => {
    requireRole.mockReturnValue({
      user: {
        id: -1,
        username: 'agent:koda',
        display_name: 'Koda',
        role: 'operator',
        workspace_id: 1,
        agent_name: 'koda',
      },
    })
    const { POST } = await import('@/app/api/group-chat/messages/route')

    const request = new NextRequest('http://localhost/api/group-chat/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-agent-name': 'koda' },
      body: JSON.stringify({
        roomSlug: 'blackwire-ops',
        senderType: 'system',
        senderId: 'mission-control',
        body: 'fake system postback',
      }),
    })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toContain('System messages require admin')
    expect(createGroupChatMessage).not.toHaveBeenCalled()
  })

  it('blocks non-admin agents from marking another agent seen', async () => {
    requireRole.mockReturnValue({
      user: {
        id: -1,
        username: 'agent:koda',
        display_name: 'Koda',
        role: 'operator',
        workspace_id: 1,
        agent_name: 'koda',
      },
    })
    const { PATCH } = await import('@/app/api/group-chat/delivery/route')

    const request = new NextRequest('http://localhost/api/group-chat/delivery', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-agent-name': 'koda' },
      body: JSON.stringify({
        messageId: 91,
        recipientType: 'agent',
        recipientId: 'herm',
        state: 'seen',
      }),
    })
    const response = await PATCH(request)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toContain('same agent identity')
    expect(updateGroupChatDeliveryState).not.toHaveBeenCalled()
  })


  it('blocks unauthenticated GET /api/command-truth/routes with 401', async () => {
    requireRole.mockReturnValue({ error: 'Authentication required', status: 401 })
    const { GET } = await import('@/app/api/command-truth/routes/route')

    const response = await GET(makeRequest('/api/command-truth/routes'))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('Authentication required')
    expect(getCommandTruthRouteContract).not.toHaveBeenCalled()
  })

  it('returns the read-only Blackwire runbook route contract for an authenticated viewer without mutating group chat', async () => {
    requireRole.mockReturnValue({ user: { id: 1, username: 'viewer', role: 'viewer', workspace_id: 1 } })
    const { GET } = await import('@/app/api/command-truth/routes/route')

    const response = await GET(makeRequest('/api/command-truth/routes'))
    const body = await response.json()
    const paths = body.routes.map((route: { path: string }) => route.path)

    expect(response.status).toBe(200)
    expect(paths).toEqual(expect.arrayContaining([
      '/command-truth?tab=routes',
      '/rooms/blackwire-ops',
      '/tracker?agent=neon-forge',
      '/api/command-truth/routes',
    ]))
    expect(body.localMvpBoundary).toContain('Commercial-demo candidate only')
    expect(getCommandTruthRouteContract).toHaveBeenCalledWith(1)
    expect(createGroupChatMessage).not.toHaveBeenCalled()
    expect(updateGroupChatAssignmentStatus).not.toHaveBeenCalled()
  })

})
