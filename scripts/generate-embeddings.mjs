#!/usr/bin/env node
/**
 * Generate embeddings for AI Toolkit tools
 * 
 * This script:
 * 1. Reads tools.json from the database
 * 2. Generates embeddings for each tool via OpenAI
 * 3. Saves to tools-with-embeddings.json in the data directory
 * 
 * Run with: pnpm generate-embeddings
 * 
 * Requires OPENAI_API_KEY environment variable or in .env file
 */

import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

// Load .env file manually (no dotenv dependency)
async function loadEnv() {
  try {
    const envPath = join(projectRoot, '.env')
    const envContent = await readFile(envPath, 'utf-8')
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const [key, ...valueParts] = trimmed.split('=')
      const value = valueParts.join('=').replace(/^["']|["']$/g, '')
      if (key && value && !process.env[key]) {
        process.env[key] = value
      }
    }
  } catch {
    // .env file doesn't exist, that's fine
  }
}

// Configuration
const TOOLKIT_DB_PATH = join(
  homedir(),
  'Desktop/VVAxeOps/AxeVault/40_KNOWLEDGE/AIToolkit/database/tools.json'
)
const OUTPUT_PATH = join(projectRoot, 'data', 'tools-with-embeddings.json')
const EMBEDDING_MODEL = 'text-embedding-3-small'
const BATCH_SIZE = 20 // OpenAI allows up to 2048 inputs per request, but let's be conservative

async function generateEmbedding(texts) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required. Add it to .env or export it.')
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      encoding_format: 'float',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.data.map(item => item.embedding)
}

function buildToolText(tool) {
  // Create a rich text representation of the tool for embedding
  const parts = [
    tool.name,
    tool.category,
    tool.subcategory || '',
    tool.description || '',
    ...(tool.key_features || []),
    ...(tool.pros || []),
    ...(tool.skills || []),
    ...(tool.tags || []),
    tool.forklift_relevance?.notes || '',
    ...(tool.forklift_relevance?.use_cases || []),
  ]
  
  return parts.filter(Boolean).join(' ').slice(0, 8000) // OpenAI limit is ~8k tokens, stay safe
}

async function main() {
  // Load environment variables
  await loadEnv()
  
  console.log('🚀 Starting embedding generation...')
  console.log(`📖 Reading tools from: ${TOOLKIT_DB_PATH}`)

  // Load tools database
  const toolsContent = await readFile(TOOLKIT_DB_PATH, 'utf-8')
  const toolsDatabase = JSON.parse(toolsContent)
  const tools = toolsDatabase.tools

  console.log(`📦 Found ${tools.length} tools to process`)

  // Prepare texts for embedding
  const toolTexts = tools.map(buildToolText)
  
  // Process in batches
  const embeddings = []
  const totalBatches = Math.ceil(toolTexts.length / BATCH_SIZE)
  
  for (let i = 0; i < toolTexts.length; i += BATCH_SIZE) {
    const batch = toolTexts.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    
    console.log(`⚡ Processing batch ${batchNum}/${totalBatches} (${batch.length} tools)...`)
    
    const batchEmbeddings = await generateEmbedding(batch)
    embeddings.push(...batchEmbeddings)
    
    // Small delay between batches to be nice to the API
    if (i + BATCH_SIZE < toolTexts.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  // Build output: tools with their embeddings
  const toolsWithEmbeddings = {
    metadata: {
      ...toolsDatabase.metadata,
      embeddings_generated: new Date().toISOString(),
      embedding_model: EMBEDDING_MODEL,
      embedding_dimensions: embeddings[0]?.length || 1536,
    },
    tools: tools.map((tool, idx) => ({
      ...tool,
      embedding: embeddings[idx],
    })),
  }

  // Ensure data directory exists
  await mkdir(dirname(OUTPUT_PATH), { recursive: true })
  
  // Write output
  await writeFile(OUTPUT_PATH, JSON.stringify(toolsWithEmbeddings, null, 2))
  
  console.log(`\n✅ Done! Generated embeddings for ${tools.length} tools`)
  console.log(`📝 Output saved to: ${OUTPUT_PATH}`)
  console.log(`📊 Embedding dimensions: ${embeddings[0]?.length || 0}`)
  
  // Estimate file size
  const stats = JSON.stringify(toolsWithEmbeddings).length
  console.log(`📁 File size: ~${(stats / 1024 / 1024).toFixed(2)} MB`)
}

main().catch(error => {
  console.error('❌ Error:', error.message)
  process.exit(1)
})
