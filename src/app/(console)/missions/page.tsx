import type { Metadata } from 'next'

import MissionsPage from '@/features/factory/components/missions/MissionsPage'

export const metadata: Metadata = { title: 'Nhiệm vụ' }

export default function Page() {
  return <MissionsPage />
}
