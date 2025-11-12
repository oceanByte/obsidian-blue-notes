import { describe, it, expect, beforeAll } from 'vitest'
import { GroqProvider } from '../../src/chat/providers/groq-provider'
import { RequestyProvider } from '../../src/chat/providers/requesty-provider'
import { ProviderRegistry } from '../../src/chat/providers/provider-config'

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
const REQUESTAI_KEY = process.env.REQUESTAI_KEY || ''

const shouldRunGroqTests = GROQ_API_KEY.length > 0
const shouldRunRequestyTests = REQUESTAI_KEY.length > 0

describe.skipIf(!shouldRunGroqTests)('Groq Model Validation', () => {
  const groqConfig = ProviderRegistry.get('groq')

  if (!groqConfig) {
    throw new Error('Groq provider not registered')
  }

  groqConfig.availableModels.forEach(({ id, name }) => {
    it(`should validate model: ${name} (${id})`, async () => {
      const provider = new GroqProvider(GROQ_API_KEY, id)

      const isValid = await provider.validateApiKey()
      expect(isValid).toBe(true)
    }, { timeout: 10000 })

    it(`should send a test message with model: ${name} (${id})`, async () => {
      const provider = new GroqProvider(GROQ_API_KEY, id)

      try {
        const response = await provider.sendMessage({
          messages: [{ role: 'user', content: 'Say "Hello" in one word' }],
          temperature: 0.7,
          maxTokens: 50,
        })

        if (!response.content || response.content.trim() === '') {
          console.warn(`⚠️  Model ${id} returned empty content`)
        }

        expect(response.content).toBeTruthy()
        expect(response.content.length).toBeGreaterThan(0)
        expect(response.model).toBeTruthy()
      } catch (error) {
        console.error(`❌ Model ${id} failed:`, error)
        throw error
      }
    }, { timeout: 30000 })
  })
})

describe.skipIf(!shouldRunRequestyTests)('Requesty Model Validation', () => {
  const requestyConfig = ProviderRegistry.get('requesty')

  if (!requestyConfig) {
    throw new Error('Requesty provider not registered')
  }

  requestyConfig.availableModels.forEach(({ id, name }) => {
    it(`should validate model: ${name} (${id})`, async () => {
      const provider = new RequestyProvider(REQUESTAI_KEY, id)

      const isValid = await provider.validateApiKey()
      expect(isValid).toBe(true)
    }, { timeout: 10000 })

    it(`should send a test message with model: ${name} (${id})`, async () => {
      const provider = new RequestyProvider(REQUESTAI_KEY, id)

      try {
        const response = await provider.sendMessage({
          messages: [{ role: 'user', content: 'Say "Hello" in one word' }],
          temperature: 0.7,
          maxTokens: 50,
        })

        if (!response.content || response.content.trim() === '') {
          console.warn(`⚠️  Model ${id} returned empty content`)
        }

        expect(response.content).toBeTruthy()
        expect(response.content.length).toBeGreaterThan(0)
        expect(response.model).toBeTruthy()
      } catch (error) {
        console.error(`❌ Model ${id} failed:`, error)
        throw error
      }
    }, { timeout: 30000 })
  })
})

if (!shouldRunGroqTests && !shouldRunRequestyTests) {
  console.warn('⚠️  Model validation tests skipped. Set GROQ_API_KEY and/or REQUESTAI_KEY environment variables to run these tests.')
}
