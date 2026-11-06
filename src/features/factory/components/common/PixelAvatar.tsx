'use client'

import { useEffect, useRef } from 'react'

import { rankOf } from '../../domain/ranks'
import { clanOf } from '../../domain/stations'
import type { AgentSnapshot } from '../../domain/types'
import { clanColor, ninjaSprite } from '../../scene/render/sprites'

// Head-and-shoulders crop of the agent's floor ninja.
const CROP_TOP = 1
const CROP_H = 16

type Props = { agent: Pick<AgentSnapshot, 'id' | 'zones' | 'toolCount' | 'subagents'>; size?: number }

export default function PixelAvatar({ agent, size = 36 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const clan = clanOf(agent.zones)
  const rank = rankOf(agent)

  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, 16, CROP_H)
    ctx.drawImage(ninjaSprite(agent.id, clan, rank, 'stand', false), 0, CROP_TOP, 16, CROP_H, 0, 0, 16, CROP_H)
  }, [agent.id, clan, rank])

  return (
    <canvas
      ref={ref}
      width={16}
      height={CROP_H}
      aria-hidden
      className="shrink-0 border border-cyan-400/25 [image-rendering:pixelated]"
      style={{ width: size, height: size, background: `${clanColor(clan)}33` }}
    />
  )
}
