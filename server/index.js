import express from 'express'
import cors from 'cors'
import os from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

// Init DB (creates file + tables on first run)
import db from './db.js'
import { startBackupScheduler } from './backup.js'

import { requireAuth, requireRole } from './middleware/auth.js'
import authRoutes from './routes/auth.js'
import itemRoutes from './routes/items.js'
import movementRoutes from './routes/movements.js'
import locationRoutes from './routes/locations.js'
import destinationRoutes from './routes/destinations.js'
import peopleRoutes from './routes/people.js'
import supplierRoutes from './routes/suppliers.js'
import roleRoutes from './routes/roles.js'
import epiRoutes from './routes/epis.js'
import seedRoutes from './routes/seed.js'
import workOrderRoutes from './routes/workOrders.js'
import motorRoutes from './routes/motors.js'
import closingRoutes from './routes/closings.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// ===== API Routes =====

// Auth (no auth required for login)
app.use('/api/auth', authRoutes)

// Public read + protected write (auth enforced per-route inside each file)
app.use('/api/items', itemRoutes)
app.use('/api/movements', movementRoutes)
app.use('/api/locations', locationRoutes)
app.use('/api/destinations', destinationRoutes)
app.use('/api/people', peopleRoutes)
app.use('/api/suppliers', supplierRoutes)
app.use('/api/roles', roleRoutes)
app.use('/api/epis', epiRoutes)
app.use('/api/seed', seedRoutes)
app.use('/api/work-orders', workOrderRoutes)
app.use('/api/motors', motorRoutes)
app.use('/api/closings', closingRoutes)

// ===== Serve frontend in production =====
const distPath = join(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.get('/{*path}', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' })
  res.sendFile(join(distPath, 'index.html'))
})

// ===== Start =====
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
  startBackupScheduler(db)
  const ip = getLocalIp();
  console.log(`✔ Servidor rodando em http://localhost:${PORT}`)
  console.log(`  Acesso na rede: http://${ip}:${PORT}`)
  console.log(`  Banco de dados: server/estoque.db`)
  console.log(`  Login padrão: admin / admin123`)
})
