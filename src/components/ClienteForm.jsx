import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { phoneDigits, reminderDates } from '../lib/utils'
import { Sheet } from './ui/Sheet'
import { Input, Select } from './ui/Input'
import { Button } from './ui/Button'
import { Clock, Plus, X, Mic, MicOff, Calendar } from 'lucide-react'
import { scheduleClientReminder } from '../lib/onesignal'
import { creditMatricula, removeMatriculaCredit } from '../lib/clientStage'
import { getValidToken, createCalendarEvent } from '../lib/googleCalendar'
import SpecificDates from './SpecificDates'

const TRAININGS_INTERESSE = ['Impacto', 'Perfil', 'Vendas', 'LORAP', 'Academia Vithall', 'Workshop', 'Palestra', 'Mentoria']

// Dias úteis em que o cliente está livre para receber visita (opcional)
const DIAS_LIVRES = [
  { key: 'seg', label: 'Seg' }, { key: 'ter', label: 'Ter' }, { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' }, { key: 'sex', label: 'Sex' },
]

const ORIGINS = ['frias contatinhos', 'frias listas', 'lead campanha', 'lead organico', 'feiras', 'indicacao']
const ORIGIN_LABELS = {
  'frias contatinhos': 'Frias contatinhos',
  'frias listas':      'Frias listas',
  'lead campanha':     'Lead campanha',
  'lead organico':     'Lead orgânico',
  'feiras':            'Eventos',
  'indicacao':         'Indicacao',
}

const MATRICULA_STAGES = [
  { key: 'nao_marcou',     label: 'Nao marcou ainda' },
  { key: 'pediu_ligar',    label: 'Pediu para ligar depois' },
  { key: 'nao_visitado',   label: 'Marcacao feita' },
  { key: 'nao_apareceu',   label: 'Nao apareceu na visita' },
  { key: 'recebeu_visita', label: 'Recebeu visita' },
  { key: 'matriculado',    label: 'Matriculado!!' },
]

const MATRICULA_STAGES_PRE_VENDAS = [
  { key: 'nao_marcou',   label: 'Nao marcado' },
  { key: 'pediu_ligar',  label: 'Pediu para ligar depois' },
  { key: 'nao_visitado', label: 'Marcacao feita' },
]

const REMINDER_TYPES = [
  { key: 'daily',         label: 'Todo dia' },
  { key: 'weekly',        label: 'Dias da semana' },
  { key: 'specific_date', label: 'Data específica' },
]

const WEEK_DAYS = [
  { key: 'dom', label: 'D' },
  { key: 'seg', label: 'S' },
  { key: 'ter', label: 'T' },
  { key: 'qua', label: 'Q' },
  { key: 'qui', label: 'Q' },
  { key: 'sex', label: 'S' },
  { key: 'sab', label: 'S' },
]

const PRESET_TIMES = ['07:00', '08:00', '09:00', '12:00', '14:00', '17:00', '18:00', '19:00']

// Converte timestamp UTC (como vem do Supabase) para o formato local do
// input datetime-local ("YYYY-MM-DDTHH:mm"), sem deslocar o horário.
function toLocalInputValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export default function ClienteForm({ onClose, onSaved, initialData }) {
  const { user, profile } = useAuth()
  const [form, setForm] = useState({
    contact_name:    initialData?.contact_name    || '',
    company_name:    initialData?.company_name    || '',
    contact_role:    initialData?.contact_role    || '',
    city:            initialData?.city            || '',
    address_street:  initialData?.address_street  || '',
    address_number:  initialData?.address_number  || '',
    address_neighborhood: initialData?.address_neighborhood || '',
    address_reference: initialData?.address_reference || '',
    instagram:       initialData?.instagram       || '',
    phone:           initialData?.phone           || '',
    phone_type:      initialData?.phone_type      || 'pessoal',
    phone2:          initialData?.phone2          || '',
    origin:          initialData?.origin          || '',
    indicado_por:    initialData?.indicado_por    || '',
    matricula_stage: initialData?.matricula_stage || 'nao_marcou',
    notes:           initialData?.notes           || '',
    assigned_to:     initialData?.assigned_to     || '',
  })

  const [vendedores, setVendedores] = useState([])

  useEffect(() => {
    async function fetchVendedores() {
      const { data } = await supabase
        .from('profiles')
        .select('id, name')
        .in('role', ['vendedor', 'gerente'])
      setVendedores(data || [])
    }
    fetchVendedores()
  }, [])

  const rc = initialData?.reminder_config
  const [reminderType, setReminderType]     = useState(rc?.type    || '')
  const [reminderDays, setReminderDays]     = useState(rc?.days    || [])
  const [reminderDatesList, setReminderDatesList] = useState(rc?.type === 'specific_date' ? reminderDates(rc) : [])
  const [reminderDateTime, setReminderDateTime]   = useState(rc?.type === 'specific_date' ? (rc?.time || '') : '')
  const [reminderTimes, setReminderTimes]   = useState(rc?.times   || [])
  const [customTime, setCustomTime]         = useState('')

  const [treinamentosInteresse, setTreinamentosInteresse] = useState(
    initialData?.treinamentos_interesse || []
  )
  const [diasLivres, setDiasLivres] = useState(initialData?.dias_livres || [])
  const toggleDiaLivre = (d) =>
    setDiasLivres(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  const [visitScheduledAt, setVisitScheduledAt] = useState(
    toLocalInputValue(initialData?.visit_scheduled_at)
  )

  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [listening, setListening] = useState(false)
  const navigate = useNavigate()
  // Autocomplete de telefone (estilo discador): 5+ dígitos → sugere contatos
  // já salvos cujo número COMEÇA igual; tocar puxa os dados p/ o form
  const [phoneSuggestions, setPhoneSuggestions] = useState([])
  const [suggestDismissed, setSuggestDismissed] = useState(false)
  const phoneListRef = useRef(null) // cache da lista (1 fetch por abertura do form)

  async function updatePhoneSuggestions(value) {
    if (initialData?.id) return // só no cadastro novo
    const digits = phoneDigits(value)
    if (digits.length < 5) { setPhoneSuggestions([]); return }
    if (!phoneListRef.current) {
      const { data } = await supabase.from('clients').select('id, contact_name, company_name, phone, phone2')
      phoneListRef.current = data || []
    }
    const matches = []
    for (const r of phoneListRef.current) {
      const cand = [r.phone, r.phone2].find(p => phoneDigits(p).length >= 8 && phoneDigits(p).startsWith(digits))
      if (cand) matches.push({ ...r, matchPhone: cand })
      if (matches.length >= 5) break
    }
    setPhoneSuggestions(matches)
  }

  // Puxa TODOS os dados do contato escolhido (menos estágio/vendedor/visita,
  // que pertencem ao ciclo novo) — a pessoa só ajusta o que mudou
  async function applySuggestion(s) {
    const { data: c } = await supabase.from('clients').select('*').eq('id', s.id).single()
    if (!c) return
    setForm(f => ({
      ...f,
      contact_name:         c.contact_name || '',
      company_name:         c.company_name || '',
      contact_role:         c.contact_role || '',
      city:                 c.city || '',
      address_street:       c.address_street || '',
      address_number:       c.address_number || '',
      address_neighborhood: c.address_neighborhood || '',
      address_reference:    c.address_reference || '',
      instagram:            c.instagram || '',
      phone:                c.phone || '',
      phone_type:           c.phone_type || 'pessoal',
      phone2:               c.phone2 || '',
      origin:               c.origin || '',
      indicado_por:         c.indicado_por || '',
      notes:                c.notes || '',
    }))
    setTreinamentosInteresse(c.treinamentos_interesse || [])
    setDiasLivres(c.dias_livres || [])
    setPhoneSuggestions([])
    setSuggestDismissed(true)
  }

  // Pop-up "adicionar no Google Agenda?" após salvar marcação feita
  const [calendarPrompt, setCalendarPrompt] = useState(null) // { clientId, name, phone, visitIso }
  const [calSaving, setCalSaving] = useState(false)
  const [calDone, setCalDone]     = useState(false)
  // Pop-up "número já registrado antes" — último da cadeia
  const [dupPrompt, setDupPrompt] = useState(null) // { clientId }
  const dupPendingRef = useRef(null) // segura o dup até o pop-up da agenda fechar

  // Fim do pop-up do Google Agenda → mostra o de número repetido (se houver)
  function finishAfterCalendar() {
    if (dupPendingRef.current) {
      setCalendarPrompt(null)
      setDupPrompt(dupPendingRef.current)
      dupPendingRef.current = null
    } else {
      onSaved()
    }
  }
  const recognitionRef    = useRef(null)
  const notesBaseRef      = useRef('')
  const finalTranscriptRef = useRef('')
  const listeningRef      = useRef(false)

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
      set('notes', base ? base.trimEnd() + ' ' + combined : combined)
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
    notesBaseRef.current      = form.notes
    finalTranscriptRef.current = ''
    listeningRef.current      = true
    setListening(true)
    const rec = buildRecognition()
    recognitionRef.current = rec
    rec.start()
  }

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  // Capitaliza a primeira letra de cada palavra automaticamente
  const titleCase = str => str.replace(/(^|\s)\S/g, l => l.toUpperCase())

  const toggleTreinamento = (t) =>
    setTreinamentosInteresse(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const toggleDay = (day) =>
    setReminderDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])

  const toggleTime = (t) =>
    setReminderTimes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t].sort())

  function addCustomTime() {
    const t = customTime.trim()
    if (t && !reminderTimes.includes(t)) {
      setReminderTimes(prev => [...prev, t].sort())
      setCustomTime('')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.contact_name.trim())            { setError('Nome e obrigatorio.'); return }
    if (!form.company_name.trim())            { setError('Empresa e obrigatoria.'); return }
    if (!form.contact_role.trim())            { setError('Cargo e obrigatorio.'); return }
    if (!form.phone.trim())                   { setError('Telefone e obrigatorio.'); return }
    if (!form.city.trim())                    { setError('Cidade e obrigatoria.'); return }
    if (!form.address_street.trim())          { setError('Rua e obrigatoria.'); return }
    if (!form.address_number.trim())          { setError('Numero e obrigatorio.'); return }
    if (!form.address_neighborhood.trim())    { setError('Bairro e obrigatorio.'); return }
    if (!form.address_reference.trim())       { setError('Ponto de referencia e obrigatorio.'); return }
    if (!form.origin)                         { setError('Como surgiu e obrigatorio.'); return }
    if (!form.notes.trim())                   { setError('Observacoes e obrigatorio.'); return }
    // Vendedor só é obrigatório com marcação feita — sem agendamento ainda,
    // não dá para saber a disponibilidade de quem vai visitar
    if (form.matricula_stage === 'nao_visitado') {
      if (!form.assigned_to)  { setError('Atribuir a um vendedor e obrigatorio na marcacao feita.'); return }
      if (!visitScheduledAt)  { setError('Informe a data e hora da visita.'); return }
    }
    setSaving(true)
    setError('')

    let reminder_config = null
    if (reminderType === 'specific_date' && reminderDatesList.length > 0) {
      reminder_config = { type: 'specific_date', dates: reminderDatesList }
      if (reminderDateTime) reminder_config.time = reminderDateTime
    } else if (reminderType && reminderType !== 'specific_date' && reminderTimes.length > 0) {
      reminder_config = {
        type: reminderType,
        ...(reminderType === 'weekly' && { days: reminderDays }),
        times: reminderTimes,
      }
    }

    const newVisitIso = visitScheduledAt ? new Date(visitScheduledAt).toISOString() : null
    const payload = {
      ...form,
      assigned_to: form.assigned_to || null,
      reminder_config,
      visit_scheduled_at: newVisitIso,
      treinamentos_interesse: treinamentosInteresse,
      dias_livres: diasLivres,
    }
    // Visita remarcada (data mudou) → confirmação antiga não vale mais e
    // quem mudou a data passa a ser o responsável por confirmar
    if (initialData?.id) {
      const oldVisitIso = initialData.visit_scheduled_at ? new Date(initialData.visit_scheduled_at).toISOString() : null
      if (newVisitIso !== oldVisitIso) {
        payload.visit_confirmation = null
        payload.visit_confirmation_note = null
        payload.visit_scheduled_by = newVisitIso ? user.id : null
      }
    } else {
      payload.visit_scheduled_by = newVisitIso ? user.id : null
    }
    // created_by só no cadastro — editar não pode trocar quem marcou
    const res = initialData?.id
      ? await supabase.from('clients').update(payload).eq('id', initialData.id)
      : await supabase.from('clients').insert({ ...payload, created_by: user.id }).select('id').single()

    if (res.error) {
      setError('Erro ao salvar. Tente novamente.')
    } else {
      // Crédito de matrícula p/ comissão quando a edição muda o estágio
      if (initialData?.id && form.matricula_stage !== initialData.matricula_stage) {
        if (form.matricula_stage === 'matriculado') {
          creditMatricula({ ...initialData, ...payload, id: initialData.id }, user.id)
        } else if (initialData.matricula_stage === 'matriculado') {
          removeMatriculaCredit(initialData.id)
        }
      }
      if (reminder_config) {
        const name = form.contact_name || form.company_name
        scheduleClientReminder({
          clientName: name,
          clientId: initialData?.id || null,
          reminderConfig: reminder_config,
        })
      }
      // Notifica o responsavel quando alguem cria uma marcacao feita (exceto a si mesmo)
      if (form.matricula_stage === 'nao_visitado' && form.assigned_to && form.assigned_to !== user.id && visitScheduledAt) {
        supabase.functions.invoke('notify-visit', {
          body: {
            assignedToId:  form.assigned_to,
            clientName:    form.contact_name,
            companyName:   form.company_name,
            visitDateTime: new Date(visitScheduledAt).toISOString(),
            city:          form.city,
            notes:         form.notes,
          },
        })
      }
      // Cadastro novo: o telefone já existe em outro registro? (por dígitos,
      // considerando principal e secundário dos dois lados)
      let dup = null
      if (!initialData?.id && res.data?.id) {
        const keys = [phoneDigits(form.phone), phoneDigits(form.phone2)].filter(k => k.length >= 8)
        if (keys.length) {
          const { data: phones } = await supabase.from('clients').select('id, phone, phone2')
          const repeated = (phones || []).some(r => {
            if (r.id === res.data.id) return false
            const rk = [phoneDigits(r.phone), phoneDigits(r.phone2)].filter(k => k.length >= 8)
            return rk.some(k => keys.includes(k))
          })
          if (repeated) dup = { clientId: res.data.id }
        }
      }

      // Cadastro novo com marcação feita + Google Agenda conectado →
      // oferece adicionar a visita no Google Agenda antes de fechar
      if (!initialData?.id && form.matricula_stage === 'nao_visitado' && newVisitIso && res.data?.id && profile?.google_connected) {
        dupPendingRef.current = dup // o pop-up do número repetido vem DEPOIS
        setCalendarPrompt({
          clientId: res.data.id,
          name:     form.contact_name || form.company_name || 'Cliente',
          phone:    form.phone,
          visitIso: newVisitIso,
        })
      } else if (dup) {
        setDupPrompt(dup)
      } else {
        onSaved()
      }
    }
    setSaving(false)
  }

  // Botão do pop-up — mesma engrenagem do "Adicionar ao Google Agenda" da ficha
  async function addToCalendar() {
    setCalSaving(true)
    try {
      const token = await getValidToken(user.id)
      if (!token) { alert('Conecte o Google Agenda no seu Perfil primeiro.'); return }
      const eventId = await createCalendarEvent(token, {
        clientName:    calendarPrompt.name,
        visitDateTime: calendarPrompt.visitIso,
      })
      await supabase.from('clients').update({ google_calendar_event_id: eventId }).eq('id', calendarPrompt.clientId)
      setCalDone(true)
      setTimeout(finishAfterCalendar, 1000)
    } catch (e) {
      alert(`Erro ao adicionar: ${e.message}`)
    } finally {
      setCalSaving(false)
    }
  }

  return (
    <>
    <Sheet open onClose={onClose} title={initialData ? 'Editar cliente' : 'Novo cliente'}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '4px' }}>

        <Input
          label="Nome *"
          value={form.contact_name}
          onChange={e => set('contact_name', titleCase(e.target.value))}
          placeholder="Nome do cliente"
          required
        />

        {/* Celular logo abaixo do nome, com autocomplete de contatos já salvos */}
        <div>
          <Input
            label="Celular *"
            value={form.phone}
            onChange={e => { set('phone', e.target.value); setSuggestDismissed(false); updatePhoneSuggestions(e.target.value) }}
            placeholder="(00) 00000-0000"
          />
          {phoneSuggestions.length > 0 && !suggestDismissed && (
            <div className="rounded-xl mt-2" style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.25)', overflow: 'hidden' }}>
              <div className="flex items-center justify-between" style={{ padding: '8px 12px 6px' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#60A5FA' }}>
                  📞 Número já registrado — toque para puxar os dados
                </p>
                <button type="button" onClick={() => setSuggestDismissed(true)}
                  className="text-[10px] font-bold" style={{ color: '#6B6560' }}>✕</button>
              </div>
              {phoneSuggestions.map(s => (
                <button key={s.id} type="button" onClick={() => applySuggestion(s)}
                  className="w-full text-left transition-all active:opacity-70"
                  style={{ padding: '10px 12px', borderTop: '1px solid rgba(96,165,250,0.12)' }}>
                  <p className="text-sm font-semibold" style={{ color: '#EFEFEF' }}>
                    {s.contact_name || s.company_name || 'Sem nome'}
                    {s.company_name && s.contact_name ? <span style={{ color: '#6B6560', fontWeight: 400 }}> · {s.company_name}</span> : null}
                  </p>
                  <p className="text-xs tabular-nums" style={{ color: '#60A5FA' }}>{s.matchPhone}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tipo do telefone + segundo número (do outro tipo) */}
        {form.phone.trim() && (
          <div className="rounded-2xl" style={{ background: '#111', border: '1px solid #1C1C1C', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#444040' }}>
                Esse número é...
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[['pessoal', '👤 Pessoal'], ['empresa', '🏢 Empresa']].map(([k, label]) => (
                  <button key={k} type="button" onClick={() => set('phone_type', k)}
                    className="text-xs font-bold rounded-xl py-2.5 transition-all active:scale-95"
                    style={{
                      background: form.phone_type === k ? 'rgba(201,168,76,0.12)' : '#161616',
                      border: `1px solid ${form.phone_type === k ? 'rgba(201,168,76,0.4)' : '#252525'}`,
                      color: form.phone_type === k ? '#C9A84C' : '#6B6560',
                    }}>
                    {form.phone_type === k ? '✓ ' : ''}{label}
                  </button>
                ))}
              </div>
            </div>
            <Input
              label={form.phone_type === 'empresa' ? 'Telefone pessoal (opcional)' : 'Telefone empresa (opcional)'}
              value={form.phone2}
              onChange={e => set('phone2', e.target.value)}
              placeholder="Se o cliente passar outro número na ligação"
            />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Input
            label="Empresa *"
            value={form.company_name}
            onChange={e => set('company_name', titleCase(e.target.value))}
            placeholder="Nome da empresa"
          />
          <Input
            label="Cargo *"
            value={form.contact_role}
            onChange={e => set('contact_role', titleCase(e.target.value))}
            placeholder="Ex: Dono, Gerente"
          />
        </div>

        <Input
          label="Cidade *"
          value={form.city}
          onChange={e => set('city', titleCase(e.target.value))}
          placeholder="Ex: Sao Paulo, SP"
        />

        {/* Endereço */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.2fr', gap: '10px' }}>
            <Input
              label="Rua *"
              value={form.address_street}
              onChange={e => set('address_street', titleCase(e.target.value))}
              placeholder="Ex: Av. Paulista"
            />
            <Input
              label="Numero *"
              value={form.address_number}
              onChange={e => set('address_number', e.target.value)}
              placeholder="123"
            />
          </div>
          <Input
            label="Bairro *"
            value={form.address_neighborhood}
            onChange={e => set('address_neighborhood', titleCase(e.target.value))}
            placeholder="Ex: Centro"
          />
          <Input
            label="Ponto de referencia *"
            value={form.address_reference}
            onChange={e => set('address_reference', e.target.value)}
            placeholder="Ex: Em frente a praca, ao lado do mercado X"
          />
        </div>

        <Input
          label="Instagram"
          value={form.instagram}
          onChange={e => set('instagram', e.target.value)}
          placeholder="@usuario"
        />

        <Select
          label="Como surgiu? *"
          value={form.origin}
          onChange={e => { set('origin', e.target.value); if (e.target.value !== 'indicacao') set('indicado_por', '') }}
        >
          <option value="" style={{ background: '#1A1A1A' }}>Selecionar...</option>
          {ORIGINS.map(o => (
            <option key={o} value={o} style={{ background: '#1A1A1A' }}>{ORIGIN_LABELS[o]}</option>
          ))}
        </Select>

        {form.origin === 'indicacao' && (
          <Input
            label="Quem indicou?"
            value={form.indicado_por}
            onChange={e => set('indicado_por', e.target.value)}
            placeholder="Nome de quem fez a indicacao"
          />
        )}

        {/* Treinamento de interesse */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest block mb-2" style={{ color: '#6B6560' }}>
            Treinamento de interesse
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {TRAININGS_INTERESSE.map(t => (
              <button key={t} type="button" onClick={() => toggleTreinamento(t)}
                className="text-xs font-semibold rounded-xl transition-all"
                style={{
                  padding: '10px 6px',
                  background: treinamentosInteresse.includes(t) ? 'rgba(201,168,76,0.12)' : '#111',
                  border: `1px solid ${treinamentosInteresse.includes(t) ? 'rgba(201,168,76,0.35)' : '#252525'}`,
                  color: treinamentosInteresse.includes(t) ? '#C9A84C' : '#6B6560',
                }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Dias livres do cliente (opcional) */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest block mb-2" style={{ color: '#6B6560' }}>
            Dias livres do cliente
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
            {DIAS_LIVRES.map(d => (
              <button key={d.key} type="button" onClick={() => toggleDiaLivre(d.key)}
                className="text-xs font-semibold rounded-xl transition-all"
                style={{
                  padding: '10px 4px',
                  background: diasLivres.includes(d.key) ? 'rgba(201,168,76,0.12)' : '#111',
                  border: `1px solid ${diasLivres.includes(d.key) ? 'rgba(201,168,76,0.35)' : '#252525'}`,
                  color: diasLivres.includes(d.key) ? '#C9A84C' : '#6B6560',
                }}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <Select
          label="Estagio da matricula *"
          value={form.matricula_stage}
          onChange={e => {
            set('matricula_stage', e.target.value)
            // Saiu de "marcação feita": limpa a data da visita, mas MANTÉM o
            // vendedor atribuído (editar cliente não pode desatribuir sozinho)
            if (e.target.value !== 'nao_visitado') setVisitScheduledAt('')
          }}
        >
          {(!initialData || profile?.role === 'pre_vendas' ? MATRICULA_STAGES_PRE_VENDAS : MATRICULA_STAGES).map(s => (
            <option key={s.key} value={s.key} style={{ background: '#1A1A1A' }}>{s.label}</option>
          ))}
        </Select>

        {/* pre_vendas: atribuir vendedor — só com marcação feita */}
        {profile?.role === 'pre_vendas' && form.matricula_stage === 'nao_visitado' && vendedores.length > 0 && (
          <Select
            label="Atribuir para vendedor *"
            value={form.assigned_to}
            onChange={e => set('assigned_to', e.target.value)}
          >
            <option value="" style={{ background: '#1A1A1A' }}>Selecionar vendedor...</option>
            {vendedores.map(v => (
              <option key={v.id} value={v.id} style={{ background: '#1A1A1A' }}>{v.name || v.id}</option>
            ))}
          </Select>
        )}

        {/* Marcacao feita — data/hora da visita (todos os perfis) */}
        {form.matricula_stage === 'nao_visitado' && (
          <div className="rounded-2xl" style={{ background: '#0F1A0F', border: '1px solid rgba(74,222,128,0.15)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#4ADE80' }}>Detalhes da marcacao</p>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest block mb-2" style={{ color: '#6B6560' }}>
                Data e hora da visita *
              </label>
              <input
                type="datetime-local"
                value={visitScheduledAt}
                onChange={e => setVisitScheduledAt(e.target.value)}
                className="w-full text-sm outline-none rounded-xl"
                style={{ padding: '12px 14px', background: '#111111', border: '1px solid #252525', color: '#EFEFEF' }}
                onFocus={e => e.target.style.borderColor = '#4ADE80'}
                onBlur={e => e.target.style.borderColor = '#252525'}
              />
            </div>
          </div>
        )}

        {/* ---- OBSERVACOES ---- */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest block mb-2" style={{ color: '#6B6560' }}>
            Observacoes *
          </label>
          <div className="relative">
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Anote informacoes sobre o cliente, visita, interesses..."
              rows={4}
              className="w-full text-sm outline-none resize-none rounded-xl transition-all"
              style={{
                padding: '12px 48px 12px 14px',
                background: '#111111',
                border: `1px solid ${listening ? '#E85555' : '#252525'}`,
                color: '#EFEFEF',
                lineHeight: '1.6',
                boxShadow: listening ? '0 0 0 3px rgba(232,85,85,0.08)' : 'none',
              }}
              onFocus={e => { if (!listening) e.target.style.borderColor = '#C9A84C' }}
              onBlur={e => { if (!listening) e.target.style.borderColor = '#252525' }}
            />
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

        {/* ---- ATRIBUICAO (vendedor/gerente only — obrigatória só na marcação feita) ---- */}
        {profile?.role !== 'pre_vendas' && vendedores.length > 0 && (
          <Select
            label={form.matricula_stage === 'nao_visitado' ? 'Atribuir para vendedor *' : 'Atribuir para vendedor'}
            value={form.assigned_to}
            onChange={e => set('assigned_to', e.target.value)}
          >
            <option value="" style={{ background: '#1A1A1A' }}>Nao atribuido ⚠️</option>
            {vendedores.map(v => (
              <option key={v.id} value={v.id} style={{ background: '#1A1A1A' }}>
                {v.name || v.id}
              </option>
            ))}
          </Select>
        )}

        {/* ---- LEMBRETES ---- */}
        <div style={{ borderTop: '1px solid #1C1C1C', paddingTop: '20px' }}>

          {/* Header */}
          <div className="flex items-center gap-2" style={{ marginBottom: '6px' }}>
            <Clock size={14} style={{ color: '#C9A84C' }} />
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#6B6560' }}>
              Quando quer ser lembrado desse cliente?
            </p>
          </div>
          <p className="text-xs" style={{ color: '#383030', marginBottom: '14px' }}>
            Opcional - escolha para receber notificacoes
          </p>

          {/* Tipo de lembrete */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
            {REMINDER_TYPES.map(rt => (
              <button key={rt.key} type="button"
                onClick={() => setReminderType(prev => prev === rt.key ? '' : rt.key)}
                className="text-xs font-semibold rounded-xl transition-all"
                style={{
                  padding: '10px 6px',
                  background: reminderType === rt.key ? 'rgba(201,168,76,0.12)' : '#111',
                  border: `1px solid ${reminderType === rt.key ? 'rgba(201,168,76,0.35)' : '#252525'}`,
                  color: reminderType === rt.key ? '#C9A84C' : '#6B6560',
                }}>
                {rt.label}
              </button>
            ))}
          </div>

          {/* Dias da semana */}
          {reminderType === 'weekly' && (
            <div style={{ marginBottom: '14px' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#444040', marginBottom: '8px' }}>Dias</p>
              <div style={{ display: 'flex', gap: '5px' }}>
                {WEEK_DAYS.map((d, i) => (
                  <button key={d.key} type="button"
                    onClick={() => toggleDay(d.key)}
                    style={{
                      flex: 1,
                      aspectRatio: '1',
                      borderRadius: '50%',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: reminderDays.includes(d.key) ? 'rgba(201,168,76,0.15)' : '#111',
                      border: `1px solid ${reminderDays.includes(d.key) ? 'rgba(201,168,76,0.4)' : '#252525'}`,
                      color: reminderDays.includes(d.key) ? '#C9A84C' : '#555050',
                      cursor: 'pointer',
                    }}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Data específica — uma ou várias datas + horário opcional */}
          {reminderType === 'specific_date' && (
            <div style={{ marginBottom: '14px' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#444040', marginBottom: '8px' }}>
                Datas do lembrete
              </p>
              <SpecificDates dates={reminderDatesList} setDates={setReminderDatesList} />
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#444040', margin: '12px 0 8px' }}>
                Horário (opcional)
              </p>
              <input type="time" value={reminderDateTime} onChange={e => setReminderDateTime(e.target.value)}
                className="w-full text-sm outline-none rounded-xl"
                style={{ padding: '12px 14px', background: '#111111', border: '1px solid #252525', color: '#EFEFEF' }} />
              <p className="text-[11px] mt-1.5" style={{ color: '#555050' }}>Você será lembrado em cada data escolhida. Pode adicionar mais de uma.</p>
            </div>
          )}

          {/* Horarios (só para lembretes recorrentes: todo dia / dias da semana) */}
          {reminderType && reminderType !== 'specific_date' && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#444040', marginBottom: '8px' }}>
                Horarios (pode escolher mais de um)
              </p>

              {/* Horarios predefinidos */}
              <div className="flex flex-wrap" style={{ gap: '6px', marginBottom: '10px' }}>
                {PRESET_TIMES.map(t => (
                  <button key={t} type="button" onClick={() => toggleTime(t)}
                    className="text-xs font-medium rounded-full border transition-all"
                    style={{
                      padding: '6px 12px',
                      background: reminderTimes.includes(t) ? 'rgba(201,168,76,0.12)' : 'transparent',
                      borderColor: reminderTimes.includes(t) ? 'rgba(201,168,76,0.4)' : '#252525',
                      color: reminderTimes.includes(t) ? '#C9A84C' : '#6B6560',
                    }}>
                    {t}
                  </button>
                ))}
              </div>

              {/* Input de horario personalizado */}
              <div className="flex gap-2" style={{ marginBottom: '10px' }}>
                <input
                  type="time"
                  value={customTime}
                  onChange={e => setCustomTime(e.target.value)}
                  className="flex-1 text-sm outline-none"
                  style={{ padding: '10px 14px', borderRadius: '12px', background: '#111111', border: '1px solid #252525', color: '#EFEFEF' }}
                  onFocus={e => e.target.style.borderColor = '#C9A84C'}
                  onBlur={e => e.target.style.borderColor = '#252525'}
                />
                <button type="button" onClick={addCustomTime}
                  className="flex items-center justify-center flex-shrink-0"
                  style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#1A1A1A', border: '1px solid #252525', color: '#C9A84C', cursor: 'pointer' }}>
                  <Plus size={16} />
                </button>
              </div>

              {/* Horarios selecionados */}
              {reminderTimes.length > 0 && (
                <div className="flex flex-wrap" style={{ gap: '6px', padding: '10px', borderRadius: '12px', background: '#111', border: '1px solid #1C1C1C' }}>
                  {reminderTimes.map(t => (
                    <button key={t} type="button" onClick={() => toggleTime(t)}
                      className="flex items-center gap-1 text-xs font-semibold rounded-full"
                      style={{ padding: '5px 10px', background: 'rgba(201,168,76,0.12)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.25)', cursor: 'pointer' }}>
                      {t} <X size={10} />
                    </button>
                  ))}
                </div>
              )}
            </div>
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
      </form>
    </Sheet>

    {/* Pop-up: adicionar a marcação no Google Agenda? */}
    {calendarPrompt && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center px-6"
        style={{ background: 'rgba(0,0,0,0.85)' }}>
        <div className="w-full max-w-sm rounded-2xl animate-in"
          style={{ background: '#1A1A1A', border: '1px solid #303030', padding: '24px', textAlign: 'center' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)' }}>
            <Calendar size={20} style={{ color: '#C9A84C' }} />
          </div>
          {calDone ? (
            <p className="text-sm font-semibold" style={{ color: '#4ADE80' }}>✓ Adicionado ao Google Agenda!</p>
          ) : (
            <>
              <h2 className="text-base font-bold mb-2" style={{ color: '#EFEFEF' }}>Adicionar no Google Agenda?</h2>
              <p className="text-sm mb-1" style={{ color: '#B0A99F', lineHeight: 1.5 }}>
                Quer adicionar <b style={{ color: '#EFEFEF' }}>"{calendarPrompt.name}"</b>
                {calendarPrompt.phone ? <> ({calendarPrompt.phone})</> : null} no Google Agenda?
              </p>
              <p className="text-xs mb-5" style={{ color: '#6B6560' }}>
                Visita: {new Date(calendarPrompt.visitIso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')}
                {' às '}
                {new Date(calendarPrompt.visitIso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <button type="button" onClick={addToCalendar} disabled={calSaving}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] mb-2"
                style={{ background: 'linear-gradient(135deg, #7B1C3A 0%, #C9A84C 100%)', color: '#F0EAD6', border: 'none', boxShadow: '0 2px 12px rgba(201,168,76,0.2)' }}>
                <span className="inline-flex items-center gap-2"><Calendar size={14} /> {calSaving ? 'Adicionando...' : 'Adicionar ao Google Agenda'}</span>
              </button>
              <button type="button" onClick={finishAfterCalendar} disabled={calSaving}
                className="w-full py-2.5 rounded-xl text-xs font-medium transition-all"
                style={{ background: 'transparent', color: '#6B6560' }}>
                Agora não
              </button>
            </>
          )}
        </div>
      </div>
    )}

    {/* Pop-up: esse número já foi registrado antes */}
    {dupPrompt && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center px-6"
        style={{ background: 'rgba(0,0,0,0.85)' }}>
        <div className="w-full max-w-sm rounded-2xl animate-in"
          style={{ background: '#1A1A1A', border: '1px solid #303030', padding: '24px', textAlign: 'center' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)' }}>
            <span style={{ fontSize: '20px' }}>📞</span>
          </div>
          <h2 className="text-base font-bold mb-2" style={{ color: '#EFEFEF' }}>Contato já conhecido</h2>
          <p className="text-sm mb-5" style={{ color: '#B0A99F', lineHeight: 1.5 }}>
            Esse número já foi registrado no nosso banco antes.
            Quer ver como foi das outras vezes?
          </p>
          <button type="button"
            onClick={() => { const id = dupPrompt.clientId; setDupPrompt(null); onSaved(); navigate(`/clientes?open=${id}`) }}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] mb-2"
            style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.4)', color: '#60A5FA' }}>
            Sim, ver histórico
          </button>
          <button type="button" onClick={() => { setDupPrompt(null); onSaved() }}
            className="w-full py-2.5 rounded-xl text-xs font-medium transition-all"
            style={{ background: 'transparent', color: '#6B6560' }}>
            Não, continuar
          </button>
        </div>
      </div>
    )}
    </>
  )
}
