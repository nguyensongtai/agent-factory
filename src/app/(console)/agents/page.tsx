import type { Metadata } from 'next'

import AgentsPage from '@/features/factory/components/agents/AgentsPage'

export const metadata: Metadata = { title: 'Agent' }

export default function Page() {
  return <AgentsPage />
}
