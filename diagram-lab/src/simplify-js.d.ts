declare module 'simplify-js' {
  export interface SimplifyPoint {
    x: number
    y: number
  }

  export default function simplify<T extends SimplifyPoint>(points: T[], tolerance?: number, highQuality?: boolean): T[]
}
