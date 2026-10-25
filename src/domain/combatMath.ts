const LEVEL_BASE = 794

export const DEFENSE_FORMULA = {
  levelBase: LEVEL_BASE,
  enemyDefenseDivisor: 50,
  bossBase1: 60,
  shieldDefenseMultiplier: 1.8,
  shieldDamageTakenDown: 0.25,
} as const

export interface DefenseInputs {
  penRate?: number
  penFlat?: number
  defDown?: number
  defIgnore?: number
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function unit(value: number | undefined): number {
  return clamp(value ?? 0, 0, 1)
}

export function enemyDefense(base1: number, levelBase = LEVEL_BASE): number {
  return (base1 / DEFENSE_FORMULA.enemyDefenseDivisor) * levelBase
}

export function defenseZone(enemyDef: number, inputs: DefenseInputs = {}): number {
  const shred = clamp(unit(inputs.defDown) + unit(inputs.defIgnore), 0, 1)
  const scaled = enemyDef * (1 - shred) * (1 - unit(inputs.penRate))
  const effective = Math.max(0, scaled - (inputs.penFlat ?? 0))
  return clamp(LEVEL_BASE / (effective + LEVEL_BASE), 0.0001, 1)
}

export function critZone(critDamage: number): number {
  return 1 + critDamage
}

export function critExpectation(critRate: number, critDamage: number): number {
  return 1 + unit(critRate) * critDamage
}

export function resistZone(resist: number): number {
  return clamp(1 - resist, 0, 2)
}

export function vulnerabilityZone(takenUp = 0, takenDown = 0): number {
  return clamp(1 + takenUp - takenDown, 0.2, 2)
}

export function stunVulnerabilityZone(stunned: boolean, rate: number): number {
  return stunned ? clamp(1 + rate, 0.2, 5) : clamp(1 + rate, 1, 3)
}

export function bonusZone(up = 0, down = 0): number {
  return clamp(1 + up - down, 0, 6)
}

export function pierceBonusZone(bonus = 0): number {
  return clamp(1 + bonus, 0.2, 9)
}

export function dazeBonusZone(up = 0, down = 0): number {
  return clamp(1 + up - down, 0, 4)
}

export function dazeResistZone(resist = 0): number {
  return clamp(1 - resist, 0, 2)
}

export function anomalyMasteryZone(mastery: number): number {
  return clamp(mastery / 100, 0, 10)
}

export function anomalyBonusZone(bonus = 0): number {
  return clamp(1 + bonus, 0, 3)
}

export function anomalyCritZone(critDamage = 0): number {
  return clamp(1 + critDamage, 1, 3)
}

export function disorderLevelZone(level: number): number {
  return 1 + 0.0075 * level
}

export function damageLevelZone(level: number): number {
  return Math.floor((1 + (level - 1) / 59) * 1e4) / 1e4
}

export type DisorderSource =
  | 'burn'
  | 'shock'
  | 'corrosion'
  | 'frostIce'
  | 'frostFlaming'
  | 'flinch'

const DISORDER_RULES: Record<DisorderSource, { base: number; step: number; per: number }> = {
  burn: { base: 450, step: 50, per: 0.5 },
  shock: { base: 450, step: 125, per: 1 },
  corrosion: { base: 450, step: 62.5, per: 0.5 },
  frostIce: { base: 450, step: 7.5, per: 1 },
  frostFlaming: { base: 600, step: 75, per: 1 },
  flinch: { base: 450, step: 7.5, per: 1 },
}

export function disorderRatio(source: DisorderSource, remainingSeconds: number): number {
  const rule = DISORDER_RULES[source]
  const ticks = Math.max(0, Math.floor(remainingSeconds / rule.per))
  return rule.base + ticks * rule.step
}

export function dazeRecoverySpeed(initialSpeed: number, adjustments: readonly number[] = []): number {
  return initialSpeed * (1 + adjustments.reduce((sum, x) => sum + x, 0))
}

export function dazeRecoverySeconds(initialSpeed: number, adjustments: readonly number[] = []): number {
  const speed = dazeRecoverySpeed(initialSpeed, adjustments)
  return speed > 0 ? 1 / speed : Number.POSITIVE_INFINITY
}

export function freezeSeconds(resist = 0): number {
  return 2 + 1.5 * (1 - clamp(resist, 0, 1))
}

export function shieldDefenseZone(enemyDef: number, shieldMultiplier = DEFENSE_FORMULA.shieldDefenseMultiplier): number {
  return defenseZone(enemyDef * shieldMultiplier)
}

export function withShieldDamageRatio(
  enemyDef: number,
  takenDown = DEFENSE_FORMULA.shieldDamageTakenDown,
): number {
  return (shieldDefenseZone(enemyDef) / defenseZone(enemyDef)) * (1 - takenDown)
}

export function chainProduct(factors: readonly number[]): number {
  return factors.reduce((product, x) => product * x, 1)
}

export function relativeGain(before: number, after: number): number {
  return before > 0 ? after / before - 1 : 0
}

export function groupDigits(value: number): string {
  const rounded = Math.round(value)
  const sign = rounded < 0 ? '-' : ''
  const digits = String(Math.abs(rounded))
  let out = ''
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ','
    out += digits[i]
  }
  return sign + out
}

export function formatInt(value: number): string {
  return Number.isFinite(value) ? groupDigits(value) : '—'
}

export function formatStat(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—'
  return Number.isInteger(value) ? groupDigits(value) : trimFixed(value, digits)
}

export function formatFactor(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—'
  return `×${trimFixed(value, digits)}`
}

export function formatPercent(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—'
  return `${trimFixed(value * 100, digits)}%`
}

export function formatSignedPercent(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—'
  const text = trimFixed(Math.abs(value) * 100, digits)
  return `${value < 0 ? '−' : '+'}${text}%`
}

export function formatSeconds(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—'
  return `${trimFixed(value, digits)} 秒`
}

function trimFixed(value: number, digits: number): string {
  return value
    .toFixed(digits)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '')
}

export function scaleOnAxis(
  value: number,
  axisMin: number,
  axisMax: number,
): number {
  if (axisMax <= axisMin) return 0
  return clamp((value - axisMin) / (axisMax - axisMin), 0, 1)
}
