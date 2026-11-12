import { compact, usd } from '../../domain/format'

const UNPRICED_HELP = 'Model này chưa có trong bảng giá: token vẫn được đếm nhưng chi phí không được cộng vào tổng.'

// Cost of one model row: a model missing from the price table says so instead of showing $0.
export function ModelCost({ cost, unpriced }: { cost: number; unpriced: boolean }) {
  if (!unpriced) return <>{usd(cost)}</>

  return (
    <span className="text-amber-300" title={UNPRICED_HELP}>
      chưa có giá
    </span>
  )
}

// "≈ $x theo giá API", plus a warning when the total leaves out tokens of unpriced models.
export function CostNote({ cost, unpricedTokens }: { cost: number; unpricedTokens: number }) {
  return (
    <>
      ≈ {usd(cost)} theo giá API
      {unpricedTokens > 0 && (
        <span className="block text-xs text-amber-300">
          chưa gồm {compact(unpricedTokens)} token của model chưa có giá
        </span>
      )}
    </>
  )
}

// A bare cost in a table cell, marked when it leaves out tokens of unpriced models.
export function CostValue({ cost, unpricedTokens }: { cost: number; unpricedTokens: number }) {
  if (unpricedTokens === 0) return <>{usd(cost)}</>
  const help = `Chưa gồm ${compact(unpricedTokens)} token của model chưa có giá`

  return (
    <span title={help}>
      {usd(cost)}
      <span className="text-amber-300" aria-label={help}>
        *
      </span>
    </span>
  )
}
