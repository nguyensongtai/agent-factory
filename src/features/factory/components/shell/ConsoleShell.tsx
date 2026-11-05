'use client'

import { FactoryProvider } from '../../context/FactoryProvider'
import AgentDrawer from '../agents/AgentDrawer'
import RoomDrawer from '../map/RoomDrawer'
import ConsoleHeader from './ConsoleHeader'
import SetupNotice from './SetupNotice'

export default function ConsoleShell({ children }: { children: React.ReactNode }) {
  return (
    <FactoryProvider>
      <ConsoleHeader />
      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 px-3 py-4 md:px-6">
        <SetupNotice />
        {children}
      </main>
      <AgentDrawer />
      <RoomDrawer />
    </FactoryProvider>
  )
}
