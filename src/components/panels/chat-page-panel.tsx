'use client'

import { ChatWorkspace } from '@/components/chat/chat-workspace'
import { BoundaryBanner, Chip, HudPanel, Page } from '@/components/mc/hud'

export function ChatPagePanel() {
  return (
    <Page
      kicker="Blackwire Ops / Direct Comms"
      title="Direct Chat"
      subtitle="Agent and operator conversations inside the local Mission Control boundary. Session controls remain embedded in the chat workspace."
      badges={
        <>
          <Chip tone="teal" pulse>local session</Chip>
          <Chip tone="dim">embedded workspace</Chip>
          <Chip tone="amber">receipt-aware</Chip>
        </>
      }
    >
      <div className="space-y-4">
        <BoundaryBanner tone="amber" title="Local chat boundary">
          Direct chat is available for local coordination and session context. External channel sends remain blocked unless routed through an approved, audited surface.
        </BoundaryBanner>
        <HudPanel kicker="operator workspace" title="Conversation Console" className="h-[calc(100vh-18rem)] min-h-[560px]" padded={false} glow>
          <div className="h-full overflow-hidden">
            <ChatWorkspace mode="embedded" />
          </div>
        </HudPanel>
      </div>
    </Page>
  )
}
