import type { Metadata } from 'next'

import MonitoringPage from '@/features/factory/components/monitoring/MonitoringPage'

export const metadata: Metadata = { title: 'Giám sát' }

export default function Page() {
  return <MonitoringPage />
}
