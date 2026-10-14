/**
 * MD5 of a string (UTF-8), as 32 lowercase hex characters.
 *
 * Only used to check that a Campus Virtual sign-in redirect belongs to the attempt we started
 * (Moodle's `siteid` is md5(site URL + passport)). It is NOT used for anything secret: MD5 is
 * broken for security purposes; here it only has to match what Moodle computes.
 *
 * Known values: md5('') = d41d8cd98f00b204e9800998ecf8427e,
 * md5('abc') = 900150983cd24fb0d6963f7d28e17f72.
 */
const SHIFTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
  20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6,
  10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]

// K[i] = floor(|sin(i + 1)| * 2^32), as RFC 1321 defines it.
const K = Array.from(
  { length: 64 },
  (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0,
)

function utf8(input: string): number[] {
  const bytes: number[] = []
  for (const char of input) {
    let code = char.codePointAt(0) ?? 0
    if (code < 0x80) {
      bytes.push(code)
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      )
    }
  }
  return bytes
}

function hexLittleEndian(word: number): string {
  let out = ''
  for (let i = 0; i < 4; i++) out += ((word >>> (i * 8)) & 0xff).toString(16).padStart(2, '0')
  return out
}

export function md5(input: string): string {
  const bytes = utf8(input)
  const blocks = ((bytes.length + 8) >>> 6) + 1
  const words = new Uint32Array(blocks * 16)
  for (let i = 0; i < bytes.length; i++) words[i >> 2] |= bytes[i] << ((i % 4) * 8)
  words[bytes.length >> 2] |= 0x80 << ((bytes.length % 4) * 8)
  const bitLength = bytes.length * 8
  words[blocks * 16 - 2] = bitLength >>> 0
  words[blocks * 16 - 1] = Math.floor(bitLength / 2 ** 32)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476
  for (let block = 0; block < words.length; block += 16) {
    let a = a0
    let b = b0
    let c = c0
    let d = d0
    for (let i = 0; i < 64; i++) {
      let f: number
      let g: number
      if (i < 16) {
        f = (b & c) | (~b & d)
        g = i
      } else if (i < 32) {
        f = (d & b) | (~d & c)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        f = b ^ c ^ d
        g = (3 * i + 5) % 16
      } else {
        f = c ^ (b | ~d)
        g = (7 * i) % 16
      }
      const next = d
      d = c
      c = b
      const sum = (a + f + K[i] + words[block + g]) >>> 0
      b = (b + ((sum << SHIFTS[i]) | (sum >>> (32 - SHIFTS[i])))) >>> 0
      a = next
    }
    a0 = (a0 + a) >>> 0
    b0 = (b0 + b) >>> 0
    c0 = (c0 + c) >>> 0
    d0 = (d0 + d) >>> 0
  }
  return hexLittleEndian(a0) + hexLittleEndian(b0) + hexLittleEndian(c0) + hexLittleEndian(d0)
}
