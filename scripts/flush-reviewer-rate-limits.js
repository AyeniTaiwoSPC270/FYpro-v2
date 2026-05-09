// Flush all Upstash Redis rate limit keys for the project-reviewer endpoint.
// Use this to get a clean slate after changing the rate limit config.
//
// Run: node scripts/flush-reviewer-rate-limits.js

import './load-env.js';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function scanAll(pattern) {
  const keys = [];
  let cursor = 0;
  do {
    const [next, batch] = await redis.scan(cursor, { match: pattern, count: 100 });
    keys.push(...batch);
    cursor = Number(next);
  } while (cursor !== 0);
  return keys;
}

async function main() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN in .env.local');
    process.exit(1);
  }

  const [ipKeys, userKeys] = await Promise.all([
    scanAll('rl:ip:reviewer*'),
    scanAll('rl:user:reviewer*'),
  ]);

  const all = [...ipKeys, ...userKeys];

  if (all.length === 0) {
    console.log('No reviewer rate limit keys found — already clean.');
    return;
  }

  console.log(`Found ${all.length} key(s):`);
  ipKeys.forEach(k => console.log('  [ip]  ', k));
  userKeys.forEach(k => console.log('  [user]', k));

  await redis.del(...all);
  console.log(`\nDeleted ${all.length} key(s). Clean slate ready.`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
