import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
env.split('\n').forEach(line => {
  const [key, val] = line.split('=')
  if (key && val) process.env[key.trim()] = val.trim()
})