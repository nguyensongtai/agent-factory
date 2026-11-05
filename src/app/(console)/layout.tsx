import ConsoleShell from '@/features/factory/components/shell/ConsoleShell'

export default function ConsoleLayout({ children }: LayoutProps<'/'>) {
  return <ConsoleShell>{children}</ConsoleShell>
}
