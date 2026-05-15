import { AverageStrategy } from './AverageStrategy.js'
import { FloydSteinbergStrategy } from './FloydSteinbergStrategy.js'
import { WuAdaptiveStrategy } from './WuAdaptiveStrategy.js'

// Extend to accept optional params later (e.g., softChoiceThreshold, randomFactor)
export function createStrategy(name, palette, opts={}){
  switch(name){
    case 'floyd':
      return new FloydSteinbergStrategy(palette, {
        diffusionStrength: opts.diffusionStrength ?? 1.0,
        cleanup: opts.cleanup ?? true,
        cleanupPasses: opts.cleanupPasses ?? 1,
        majorityThreshold: opts.majorityThreshold ?? 0.75
      })
    case 'wu_adaptive':
      return new WuAdaptiveStrategy(palette, {
        wuColorCount: opts.wuColorCount,
        minStrength: opts.minStrength,
        maxStrength: opts.maxStrength,
        varianceWindow: opts.varianceWindow,
        varianceScale: opts.varianceScale,
        cleanup: opts.cleanup,
        cleanupPasses: opts.cleanupPasses,
        majorityThreshold: opts.majorityThreshold
      })
    case 'average':
    default:
      return new AverageStrategy(palette, {
        softChoiceThreshold: opts.softChoiceThreshold || 0.8, // ΔE00 diff threshold
        randomFactor: opts.randomFactor ?? 0
      })
  }
}
