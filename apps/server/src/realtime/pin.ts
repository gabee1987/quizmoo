import { randomInt } from 'node:crypto'

/** 6-digit PIN, never starting with 0, not in use. Cryptographic randomness keeps PINs hard to guess. */
export function generatePin(isTaken: (pin: string) => boolean, random: () => number = () => randomInt(100000, 1000000)): string {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const pin = String(random())
    if (!isTaken(pin)) return pin
  }
  throw new Error('no free game PIN')
}
