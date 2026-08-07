import { startBaileysConnection } from '../src/gateway/baileys/index.js'

const log: any = {
  info: (m: string, o: unknown) => console.log('INFO', m, JSON.stringify(o)),
  debug: () => {},
  warn: (m: string, o: unknown) => console.log('WARN', m, JSON.stringify(o)),
  error: (m: string, o: unknown) => console.log('ERR', m, JSON.stringify(o)),
}
log.child = () => log

async function main() {
  try {
    const h = await startBaileysConnection(log)
    console.log('handle returned; process stays up. Press Ctrl+C or send SIGTERM to stop.')
    // Não paramos sozinho — deixa vivo até o operador encerrar; o QR precisa
    // ser escaneado, e novo QR é regenerado automaticamente se expirar.
    const stop = async () => { await h.stop(); process.exit(0) }
    process.on('SIGINT', stop)
    process.on('SIGTERM', stop)
  } catch (e) {
    console.error('CAUGHT ERROR:')
    console.error(e)
    process.exit(1)
  }
}

main()
