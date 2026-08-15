import {
  generateDEK,
  deriveKEK,
  encrypt,
  decrypt,
  encryptDEK,
  decryptDEK,
  encryptData,
  decryptData,
} from '../src/shared/crypto/envelope.js'
import { randomBytes } from 'node:crypto'

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.error(`  ✗ ${label}`)
  }
}

function assertThrows(fn: () => void, label: string) {
  try {
    fn()
    failed++
    console.error(`  ✗ ${label} (expected throw)`)
  } catch {
    passed++
    console.log(`  ✓ ${label}`)
  }
}

const testKEKHex = randomBytes(32).toString('hex')
const kek = deriveKEK(testKEKHex)

console.log('=== deriveKEK ===')
assert(kek instanceof Buffer, 'returns Buffer')
assert(kek.length === 32, 'is 32 bytes')
assertThrows(() => deriveKEK('aabbcc'), 'rejects short key')
assertThrows(() => deriveKEK('00'.repeat(16)), 'rejects wrong length (16 bytes)')

console.log('\n=== generateDEK ===')
const dek1 = generateDEK()
const dek2 = generateDEK()
assert(dek1 instanceof Buffer, 'returns Buffer')
assert(dek1.length === 32, 'is 32 bytes')
assert(!dek1.equals(dek2), 'produces unique keys')

console.log('\n=== encrypt/decrypt roundtrip ===')
{
  const key = generateDEK()
  const plaintext = Buffer.from('hello world')
  const encrypted = encrypt(plaintext, key)
  const decrypted = decrypt(encrypted, key)
  assert(decrypted.equals(plaintext), 'roundtrips text')
}

{
  const key = generateDEK()
  const encrypted = encrypt(Buffer.alloc(0), key)
  const decrypted = decrypt(encrypted, key)
  assert(decrypted.length === 0, 'handles empty plaintext')
}

{
  const key = generateDEK()
  const large = randomBytes(100_000)
  const encrypted = encrypt(large, key)
  const decrypted = decrypt(encrypted, key)
  assert(decrypted.equals(large), 'handles large payloads (100KB)')
}

console.log('\n=== tamper detection ===')
{
  const key1 = generateDEK()
  const key2 = generateDEK()
  const encrypted = encrypt(Buffer.from('secret'), key1)
  assertThrows(() => decrypt(encrypted, key2), 'fails with wrong key')
}

{
  const key = generateDEK()
  const encrypted = encrypt(Buffer.from('secret'), key)
  const tampered = { ...encrypted, ciphertext: Buffer.from([...encrypted.ciphertext]) }
  tampered.ciphertext[0] ^= 0xff
  assertThrows(() => decrypt(tampered, key), 'fails with tampered ciphertext')
}

{
  const key = generateDEK()
  const encrypted = encrypt(Buffer.from('secret'), key)
  const tampered = { ...encrypted, authTag: Buffer.from([...encrypted.authTag]) }
  tampered.authTag[0] ^= 0xff
  assertThrows(() => decrypt(tampered, key), 'fails with tampered auth tag')
}

console.log('\n=== DEK envelope ===')
{
  const dek = generateDEK()
  const encrypted = encryptDEK(dek, kek)
  const recovered = decryptDEK(encrypted, kek)
  assert(recovered.equals(dek), 'encrypt/decrypt DEK with KEK roundtrips')
}

{
  const dek = generateDEK()
  const a = encryptDEK(dek, kek)
  const b = encryptDEK(dek, kek)
  assert(!a.iv.equals(b.iv), 'different IVs for same DEK')
  assert(!a.ciphertext.equals(b.ciphertext), 'different ciphertexts for same DEK')
}

console.log('\n=== data encryption helpers ===')
{
  const dek = generateDEK()
  const data = JSON.stringify({ preKey: [1, 2, 3], id: 'abc-123' })
  const encrypted = encryptData(data, dek)
  const decrypted = decryptData(encrypted, dek)
  assert(decrypted === data, 'roundtrips JSON string')
}

{
  const dek = generateDEK()
  const data = '🔐 chave protegida — proteção familiar'
  const encrypted = encryptData(data, dek)
  assert(decryptData(encrypted, dek) === data, 'roundtrips unicode')
}

{
  const dek = generateDEK()
  const creds = JSON.stringify({
    noiseKey: { private: Buffer.alloc(32).toString('base64'), public: Buffer.alloc(32).toString('base64') },
    signedIdentityKey: { private: Buffer.alloc(32).toString('base64'), public: Buffer.alloc(32).toString('base64') },
    signedPreKey: { keyPair: { private: Buffer.alloc(32).toString('base64'), public: Buffer.alloc(32).toString('base64') }, signature: Buffer.alloc(64).toString('base64'), keyId: 1 },
    registrationId: 12345,
    advSecretKey: Buffer.alloc(32).toString('base64'),
  })
  const encrypted = encryptData(creds, dek)
  const decrypted = decryptData(encrypted, dek)
  assert(decrypted === creds, 'roundtrips Baileys-like creds structure')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
if (failed > 0) process.exit(1)
