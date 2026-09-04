// Canal com o banco de PRODUÇÃO pelo CLI: `npx supabase db query --linked -f`.
// Sem Docker/psql na máquina é o único caminho. Cada chamada = um arquivo SQL
// temporário; devolve as linhas do ÚLTIMO select do arquivo.
import { execSync } from 'node:child_process'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

export const PROJETO = join(dirname(fileURLToPath(import.meta.url)), '..')

const TMP = join(tmpdir(), 'vithall-sql')
mkdirSync(TMP, { recursive: true })
let seq = 0

export function query(sql, { timeoutMs = 300_000 } = {}) {
  const f = join(TMP, `q${process.pid}_${++seq}.sql`)
  writeFileSync(f, sql, 'utf8')
  let out
  try {
    // Node 24 não abre npx.cmd sem shell (proteção de .cmd)
    out = execSync(`npx supabase db query --linked -f "${f}"`, {
      cwd: PROJETO, encoding: 'utf8', maxBuffer: 1024 * 1024 * 256, timeout: timeoutMs,
      stdio: ['ignore', 'pipe', 'pipe'], shell: true,
    })
  } catch (e) {
    const msg = (e.stdout || '') + (e.stderr || '')
    throw new Error(`db query falhou:\n${msg.slice(0, 1500)}`)
  } finally {
    try { rmSync(f) } catch {}
  }
  const i = out.indexOf('{')
  if (i < 0) throw new Error(`resposta sem JSON: ${out.slice(0, 500)}`)
  const parsed = JSON.parse(out.slice(i))
  if (parsed._tag === 'Error' || parsed.error) throw new Error(`erro do banco: ${JSON.stringify(parsed.error || parsed)}`)
  return parsed.rows || []
}
