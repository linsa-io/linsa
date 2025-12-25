#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Load .env
const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=')
      if (key) {
        process.env[key.trim()] = valueParts.join('=').trim()
      }
    }
  })
}

console.log('=== Flow Test Dev Server ===')
console.log('')
console.log('Environment loaded:')

const envVars = Object.keys(process.env)
  .filter(k => !k.startsWith('_') && !k.startsWith('npm_') && !['PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'LANG', 'PWD', 'OLDPWD', 'SHLVL'].includes(k))
  .sort()

envVars.forEach(key => {
  const value = process.env[key]
  const display = value && value.length > 20 ? value.slice(0, 20) + '...' : value
  console.log(`  ${key}: ${display || '(empty)'}`)
})

console.log('')
console.log('Server running... (Ctrl+C to stop)')

// Keep alive
setInterval(() => {}, 1000)
