'use client'

import { useEffect, useRef } from 'react'

import { personSprite, shirtColor } from '../../scene/render/sprites'

// Head-and-shoulders crop of the agent's floor sprite.
const CROP_TOP = 1
const CROP_H = 16

type Props = { sessionId: string; project: string; size?: number }

export default function PixelAvatar({ sessionId, project, size = 36 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, 16, CROP_H)
    ctx.drawImage(personSprite(sessionId, project, 'stand', false), 0, CROP_TOP, 16, CROP_H, 0, 0, 16, CROP_H)
  }, [sessionId, project])

  return (
    <canvas
      ref={ref}
      width={16}
      height={CROP_H}
      aria-hidden
      className="shrink-0 border border-cyan-400/25 [image-rendering:pixelated]"
      style={{ width: size, height: size, background: `${shirtColor(project)}33` }}
    />
  )
}
