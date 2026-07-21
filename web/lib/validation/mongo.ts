import { MongoClient } from 'mongodb'
import type { Collection, Document } from 'mongodb'

// MongoDB Atlas connection for the validation funnel — the one place this app
// talks to a database. Server-only: MONGODB_URI/MONGODB_DB must never be
// NEXT_PUBLIC_ (see .env.example). The client promise is cached on `globalThis`
// so warm serverless invocations (and dev-mode HMR) reuse one connection instead
// of opening a new one per request — the standard Next.js + MongoDB pattern.

const COLLECTION = 'validation_submissions'

declare global {
  var _waypointMongoClientPromise: Promise<MongoClient> | undefined
}

function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not set.')
  if (!globalThis._waypointMongoClientPromise) {
    globalThis._waypointMongoClientPromise = new MongoClient(uri).connect()
  }
  return globalThis._waypointMongoClientPromise
}

export async function getCollection(): Promise<Collection<Document>> {
  const client = await getClientPromise()
  const dbName = process.env.MONGODB_DB ?? 'waypoint_validation'
  return client.db(dbName).collection(COLLECTION)
}
