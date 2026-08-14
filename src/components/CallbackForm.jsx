import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Sheet } from './ui/Sheet'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { PhoneCall, Mic, MicOff } from 'lucide-react'
import SpecificDates from './SpecificDates'
import { reminderDates } from '../lib/utils'
import PhoneList, { TipoToggle } from './PhoneList'

// "Cliente pediu para ligar depois" — lembrete leve de ligação, fora da lista
// de clientes. Só nome + telefone obrigatórios; empresa/cargo opcionais.
// "Quando foi marcada a ligação?" = daily | weekly | specific_date.

const REMINDER_TYPES = [
  { key: 'daily',         label: 'Todo dia' },
  { key: 'weekly',        label: 'Dias da semana' },
  { key: 'specific_date', label: 'Data específica' },
]
const WEEK_DAYS = [
  { key: 'seg', label: 'Seg' }, { key: 'ter', label: 'Ter' }, { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' }, { key: 'sex', label: 'Sex' }, { key: 'sab', label: 'Sáb' }, { key: 'dom', label: 'Dom' },
]

export default function CallbackForm({ onClose, onSaved, initialData }) {
  const { user } = useAuth()
  const rc = initialData?.reminder_config
  const [contactName, setContactName] = useState(initialData?.contact_name || '')
  const [phone, setPhone]             = useState(initialData?.phone || '')
  const [phoneType, setPhoneType]     = useState(initialData?.phone_type || 'pessoal')
  const [phones, setPhones]           = useState(Array.isArray(initialData?.phones) ? initialData.phones : [])
  const [companyName, setCompanyName] = useState(initialData?.company_name || '')
  const [contactRole, setContactRole] = useState(initialData?.contact_role || '')
  const [reminderType, setReminderType] = useState(rc?.type || '')
  const [reminderDays, setReminderDays] = useState(rc?.days || [])
  const [reminderDatesList, setReminderDatesList] = useState(rc?.type === 'specific_date' ? reminderDates(rc) : [])
  const [reminderTime, setReminderTime] = useState(rc?.time || '')
  const [notes, setNotes]   = useState(initialData?.notes || '')
  const [listLocation, setListLocation] = useState(initialData?.list_location || '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]   = useState('')

  const titleCase = str => str.replace(/(^|\s)\S/g, l => l.toUpperCase())
  const toggleDay = d => setReminderDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  // ── Voz → texto na descrição (mesmo esquema do ClienteForm) ──
  const [listening, setListening] = useState(false)
  const recognitionRef     = useRef(null)
  const notesBaseRef       = useRef('')
  const finalTranscriptRef = useRef('')
  const listeningRef       = useRef(false)

  function buildRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang = 'pt-BR'
    rec.continuous = false      // melhor compatibilidade mobile
    rec.interimResults = true   // mostra texto enquanto fala

    rec.onresult = e => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalTranscriptRef.current += e.results[i][0].transcript + ' '
        } else {
          interim += e.results[i][0].transcript
        }
      }
      const base = notesBaseRef.current
      const combined = (finalTranscriptRef.current + interim).trim()
      setNotes(base ? base.trimEnd() + ' ' + combined : combined)
    }

    rec.onerror = e => {
      if (e.error === 'not-allowed') {
        alert('Microfone bloqueado. Toque no cadeado da URL e permita o acesso ao microfone.')
        listeningRef.current = false
        setListening(false)
      }
      // outros erros (no-speech, aborted): ignora, onend vai reiniciar
    }

    rec.onend = () => {
      if (listeningRef.current) {
        // auto-restart para simular gravacao continua
        setTimeout(() => {
          if (listeningRef.current) {
            try {
              const next = buildRecognition()
              recognitionRef.current = next
              next.start()
            } catch (_) {}
          }
        }, 150)
      } else {
        setListening(false)
      }
    }

    return rec
  }

  function toggleListening() {
    if (listeningRef.current) {
      listeningRef.current = false
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      alert('Seu navegador nao suporta reconhecimento de voz. Use Chrome ou Safari.')
      return
    }
    notesBaseRef.current       = notes
    finalTranscriptRef.current = ''
    listeningRef.current       = true
    setListening(true)
    const rec = buildRecognition()
    recognitionRef.current = rec
    rec.start()
  }

  async function handleDelete() {
    if (!initialData?.id) return
    if (!confirm('Excluir este "ligar depois"?')) return
    setDeleting(true)
    await supabase.from('callbacks').delete().eq('id', initialData.id)
    setDeleting(false)
    onSaved()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!contactName.trim()) { setError('Nome e obrigatorio.'); return }
    if (!phone.trim())       { setError('Telefone e obrigatorio.'); return }
    if (!reminderType)       { setError('Escolha quando lembrar de ligar.'); return }
    if (reminderType === 'weekly' && reminderDays.length === 0) { setError('Escolha ao menos um dia da semana.'); return }
    if (reminderType === 'specific_date' && reminderDatesList.length === 0) { setError('Adicione ao menos uma data.'); return }

    let reminder_config = null
    if (reminderType === 'daily')              reminder_config = { type: 'daily' }
    else if (reminderType === 'weekly')        reminder_config = { type: 'weekly', days: reminderDays }
    else if (reminderType === 'specific_date') reminder_config = { type: 'specific_date', dates: reminderDatesList }
    if (reminder_config && reminderTime) reminder_config.time = reminderTime // hora de ligar (o lembrete fica o dia todo)

    setSaving(true); setError('')
    const payload = {
      contact_name:    contactName.trim(),
      phone:           phone.trim(),
      phone_type:      phoneType,
      phones:          phones.filter(x => x?.n?.trim()).map(x => ({ n: x.n.trim(), t: x.t || 'pessoal' })),
      company_name:    companyName.trim() || null,
      contact_role:    contactRole.trim() || null,
      notes:           notes.trim() || null,
      list_location:   listLocation.trim() || null,
      reminder_config,
    }
    const { error: err } = initialData?.id
      ? await supabase.from('callbacks').update(payload).eq('id', initialData.id)
      : await supabase.from('callbacks').insert({ ...payload, created_by: user.id })
    setSaving(false)
    if (err) { setError('Erro ao salvar. Tente novamente.'); return }
    onSaved()
  }

  return (
    <Sheet open onClose={onClose} title={initialData ? 'Editar "ligar depois"' : 'Cliente pediu p/ ligar depois'}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '4px' }}>

        <p className="text-xs" style={{ color: '#958E86', lineHeight: 1.5 }}>
          Lembrete de ligação — <b style={{ color: '#B0A99F' }}>não entra na lista de clientes</b>.
          Serve só para você lembrar de ligar nos dias marcados.
        </p>

        <Input label="Nome *" value={contactName}
          onChange={e => setContactName(titleCase(e.target.value))} placeholder="Nome do contato" required />

        <Input label="Telefone *" value={phone}
          onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" />

        {phone.trim() && (
          <>
            <div className="rounded-2xl" style={{ background: '#111', border: '1px solid #1C1C1C', padding: '14px 16px' }}>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#9D968E' }}>
                Esse número é...
              </p>
              <TipoToggle value={phoneType} onChange={setPhoneType} />
            </div>
            <PhoneList value={phones} onChange={setPhones} primaryFilled />
          </>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Input label="Empresa" value={companyName}
            onChange={e => setCompanyName(titleCase(e.target.value))} placeholder="Opcional" />
          <Input label="Cargo" value={contactRole}
            onChange={e => setContactRole(titleCase(e.target.value))} placeholder="Opcional" />
        </div>

        {/* Quando foi marcada a ligação? */}
        <div style={{ borderTop: '1px solid #1C1C1C', paddingTop: '18px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: '10px' }}>
            <PhoneCall size={14} style={{ color: '#E8834A' }} />
            <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: '#958E86' }}>
              Quando foi marcada a ligacao? *
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
            {REMINDER_TYPES.map(rt => (
              <button key={rt.key} type="button"
                onClick={() => setReminderType(prev => prev === rt.key ? '' : rt.key)}
                className="text-xs font-semibold rounded-xl transition-all"
                style={{
                  padding: '10px 6px',
                  background: reminderType === rt.key ? 'rgba(232,131,74,0.12)' : '#111',
                  border: `1px solid ${reminderType === rt.key ? 'rgba(232,131,74,0.4)' : '#252525'}`,
                  color: reminderType === rt.key ? '#E8834A' : '#958E86',
                }}>
                {rt.label}
              </button>
            ))}
          </div>

          {reminderType === 'weekly' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              {WEEK_DAYS.map(d => (
                <button key={d.key} type="button" onClick={() => toggleDay(d.key)}
                  className="text-xs font-semibold rounded-xl transition-all"
                  style={{
                    padding: '9px 4px',
                    background: reminderDays.includes(d.key) ? 'rgba(232,131,74,0.12)' : '#111',
                    border: `1px solid ${reminderDays.includes(d.key) ? 'rgba(232,131,74,0.4)' : '#252525'}`,
                    color: reminderDays.includes(d.key) ? '#E8834A' : '#958E86',
                  }}>
                  {d.label}
                </button>
              ))}
            </div>
          )}

          {reminderType === 'specific_date' && (
            <div>
              <SpecificDates dates={reminderDatesList} setDates={setReminderDatesList} color="#E8834A" />
              <p className="text-[12px] mt-1.5" style={{ color: '#A59F97' }}>
                Aparece no "Hoje" em cada data escolhida. Pode adicionar mais de uma.
              </p>
            </div>
          )}

          {/* Hora de ligar (opcional) — seletor próprio (Hora + Minuto) p/ não
              depender do relógio nativo, que corta o botão em alguns celulares */}
          {reminderType && (() => {
            const [h = '', m = ''] = reminderTime ? reminderTime.split(':') : []
            const setPart = (hh, mm) => setReminderTime((hh !== '' && mm !== '') ? `${hh}:${mm}` : '')
            const selStyle = { padding: '12px 10px', background: '#111', border: '1px solid #252525', color: '#EFEFEF', borderRadius: '12px', fontSize: '14px', outline: 'none', width: '100%' }
            return (
              <div style={{ marginTop: '14px' }}>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#9D968E' }}>
                  Hora de ligar (opcional)
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center' }}>
                  <select value={h} onChange={e => setPart(e.target.value, e.target.value ? (m || '00') : '')} style={selStyle}>
                    <option value="">Hora</option>
                    {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(hh => (
                      <option key={hh} value={hh} style={{ background: '#1A1A1A' }}>{hh}h</option>
                    ))}
                  </select>
                  <span style={{ color: '#958E86', fontWeight: 700 }}>:</span>
                  <select value={m} onChange={e => setPart(e.target.value ? (h || '00') : '', e.target.value)} style={selStyle}>
                    <option value="">Min</option>
                    {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')).map(mm => (
                      <option key={mm} value={mm} style={{ background: '#1A1A1A' }}>{mm}</option>
                    ))}
                  </select>
                </div>
                <p className="text-[12px] mt-1.5" style={{ color: '#A59F97' }}>
                  Só p/ lembrar o melhor horário — o card fica o dia todo até você concluir.
                </p>
              </div>
            )
          })()}
        </div>

        {/* Onde o contato foi achado na lista física — antes ia solto no
            meio da descrição ("Pág 55"). */}
        <Input label="Onde encontrou na lista" value={listLocation}
          onChange={e => setListLocation(e.target.value)} placeholder="Ex: Pág 55, linha 12" />

        {/* Descrição (opcional) — com voz → texto, igual ao ClienteForm */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest block mb-2" style={{ color: '#958E86' }}>
            Descricao (opcional)
          </label>
          <div className="relative">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Anote o contexto para lembrar quando for ligar (ex: o que ficou combinado, interesse, melhor abordagem...)"
              className="w-full text-sm outline-none resize-none rounded-xl transition-all"
              style={{
                padding: '12px 48px 12px 14px',
                background: '#111',
                border: `1px solid ${listening ? '#E85555' : '#252525'}`,
                color: '#EFEFEF',
                lineHeight: '1.5',
                boxShadow: listening ? '0 0 0 3px rgba(232,85,85,0.08)' : 'none',
              }} />
            <button
              type="button"
              onClick={toggleListening}
              title={listening ? 'Parar gravacao' : 'Gravar com voz'}
              className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center transition-all"
              style={{
                background: listening ? 'rgba(232,85,85,0.15)' : 'rgba(201,168,76,0.08)',
                border: `1px solid ${listening ? 'rgba(232,85,85,0.4)' : 'rgba(201,168,76,0.2)'}`,
                animation: listening ? 'pulse 1.5s infinite' : 'none',
              }}>
              {listening
                ? <MicOff size={14} style={{ color: '#E85555' }} />
                : <Mic size={14} style={{ color: '#C9A84C' }} />
              }
            </button>
          </div>
          {listening && (
            <p className="text-xs mt-1.5 flex items-center gap-1.5" style={{ color: '#E85555' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#E85555', display: 'inline-block', animation: 'pulse 1s infinite' }} />
              Ouvindo... toque em parar quando terminar
            </p>
          )}
        </div>

        {error && (
          <p className="text-xs px-3 py-2 rounded-xl"
            style={{ color: '#E85555', background: 'rgba(232,85,85,0.08)', border: '1px solid rgba(232,85,85,0.15)' }}>
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </div>

        {initialData?.id && (
          <button type="button" onClick={handleDelete} disabled={deleting}
            className="w-full text-xs font-semibold rounded-xl py-3 transition-all"
            style={{ background: 'rgba(232,85,85,0.08)', border: '1px solid rgba(232,85,85,0.2)', color: '#E85555' }}>
            {deleting ? 'Excluindo...' : 'Excluir este "ligar depois"'}
          </button>
        )}
      </form>
    </Sheet>
  )
}
