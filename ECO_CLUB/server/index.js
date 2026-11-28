import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAuthSecret } from './auth.js'
import { openDatabase } from './db.js'
import { createApiHandler } from './routes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

export function createEcoClubServer(options = {}) {
  const dbPath = options.dbPath || process.env.ECO_CLUB_DB_PATH || path.join(__dirname, 'data', 'eco-club.db')
  const uploadDir = options.uploadDir || process.env.ECO_CLUB_UPLOAD_DIR || path.join(__dirname, 'uploads')
  const distDir = options.distDir !== undefined ? options.distDir : path.join(rootDir, 'dist')

  const db = openDatabase(dbPath)
  const secret = createAuthSecret(db)
  const handler = createApiHandler({ db, secret, uploadDir, distDir })
  const server = http.createServer(handler)

  return {
    server,
    db,
    handler,
    close() {
      return new Promise((resolve) => {
        if (!server.listening) {
          db.close()
          resolve()
          return
        }
        server.close(() => {
          db.close()
          resolve()
        })
      })
    },
  }
}

const isEntry = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isEntry) {
  const port = Number(process.env.PORT || 3001)
  const host = process.env.HOST || '127.0.0.1'
  const app = createEcoClubServer()
  app.server.listen(port, host, () => {
    console.log(`Eco Club API & server listening at http://${host}:${port}`)
  })
}
