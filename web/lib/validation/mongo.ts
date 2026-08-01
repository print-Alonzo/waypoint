import { MongoClient } from 'mongodb'
import type { Collection, Document } from 'mongodb'

// MongoDB Atlas connection for the validation funnel — the one place this app
// talks to a database. Server-only: MONGODB_URI/MONGODB_DB must never be
// NEXT_PUBLIC_ (see .env.example). The client promise is cached on `globalThis`
// so warm serverless invocations (and dev-mode HMR) reuse one connection instead
// of opening a new one per request — the standard Next.js + MongoDB pattern.

const SUBMISSIONS_COLLECTION = 'validation_submissions'
const EVENTS_COLLECTION = 'validation_events'

declare global {
  var _waypointMongoClientPromise: Promise<MongoClient> | undefined
}

function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not set.')
  if (!globalThis._waypointMongoClientPromise) {
    // serverSelectionTimeoutMS/connectTimeoutMS: fail fast — the driver's 30s
    // default outlives Vercel's function timeout. On a failed connect, clear
    // the cached promise so the next request retries instead of re-awaiting a
    // permanently-rejected promise until the process recycles.
    globalThis._waypointMongoClientPromise = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5_000,
      connectTimeoutMS: 5_000,
      maxPoolSize: 10,
      appName: 'waypoint-validation',
    })
      .connect()
      .catch((err) => {
        globalThis._waypointMongoClientPromise = undefined
        throw err
      })
  }
  return globalThis._waypointMongoClientPromise
}

export async function getCollection(): Promise<Collection<Document>> {
  const client = await getClientPromise()
  const dbName = process.env.MONGODB_DB ?? 'waypoint_validation'
  return client.db(dbName).collection(SUBMISSIONS_COLLECTION)
}

// Append-only event log: every milestone POST inserts here, never updated or
// upserted. Durable record of truth — even if a rollup row in
// validation_submissions is ever overwritten, no individual answer is lost.
export async function getEventsCollection(): Promise<Collection<Document>> {
  const client = await getClientPromise()
  const dbName = process.env.MONGODB_DB ?? 'waypoint_validation'
  return client.db(dbName).collection(EVENTS_COLLECTION)
}
