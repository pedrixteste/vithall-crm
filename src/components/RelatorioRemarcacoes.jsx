import { REPESCAGEM_DESDE } from '../lib/remarcacaoMetrics'

// Bloco "Marcações · Remarcações · Repescagem" do relatório.
// Três coisas DIFERENTES lado a lado, que nunca se somam:
//   marcação   = cliente novo com visita marcada (vem do cadastro)
//   remarcação = uma visita que já existia mudou de data (vem do histórico)
//   repescagem = alguém marcou para ligar de novo mais pra frente (histórico)
// Componente separado da página para poder ser visto na bancada de teste
// (src/dev-relatorio.jsx) sem precisar de login nem de banco.

const fmtData = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR')

function Card({ label, value, sub, color }) {
  return (
    <div className="rounded-2xl" style={{ border: '1px solid #262626', background: '#141414', padding: '12px 10px', textAlign: 'center' }}>
      <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8B857D' }}>{label}</p>
      <p style={{ fontSize: '22px', fontWeight: 800, color, margin: '2px 0' }}>{value}</p>
      <p style={{ fontSize: '10px', color: '#6B6560', lineHeight: 1.3 }}>{sub}</p>
    </div>
  )
}

function Info({ onClick }) {
  return (
    <button onClick={onClick}
      style={{ width: '20px', height: '20px', flexShrink: 0, borderRadius: '50%', background: '#1F1F1F', border: '1px solid #303030', color: '#8B857D', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
      ?
    </button>
  )
}

export default function RelatorioRemarcacoes({
  totalMarcacoes, remarcacoes, ate, rep, baseConvVis, baseConvMat,
  remarcRanking = [], repRanking = [], nomeDe = () => '—', mostrarRanking = false,
  onInfo = () => {},
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#958E86' }}>
          Marcacoes · Remarcacoes · Repescagem
        </p>
        <p style={{ fontSize: '11px', color: '#8B857D' }}>periodo selecionado</p>
      </div>
      <p style={{ fontSize: '12px', color: '#8B857D', lineHeight: 1.5, marginBottom: '12px' }}>
        São três coisas diferentes e nunca se somam: <b style={{ color: '#B0A99F' }}>marcação</b> é
        cliente novo com visita marcada, <b style={{ color: '#B0A99F' }}>remarcação</b> é uma visita
        que mudou de data, <b style={{ color: '#B0A99F' }}>repescagem</b> é lembrar de ligar de novo.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
        <Card label="Marcações" value={totalMarcacoes} sub="clientes novos" color="#60A5FA" />
        <Card label="Remarcações" value={remarcacoes} color="#22D3EE"
          sub={ate.pctComRemarcacao !== null ? `${ate.pctComRemarcacao}% das marcações` : 'mudanças de data'} />
        <Card label="Repescagens" value={rep.clientes} sub="clientes marcados" color="#A3E635" />
      </div>

      {/* Quantas remarcações até a venda */}
      <div className="rounded-2xl" style={{ border: '1px solid #262626', background: '#141414', padding: '16px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#EFEFEF' }}>
            Quantas remarcações até a matrícula?
          </p>
          <Info onClick={() => onInfo({
            title: 'Remarcações até a matrícula',
            text: 'Pega as marcações do período e separa por quantas vezes a visita precisou ser remarcada. Em cada faixa, quantas viraram matrícula. Serve para responder se insistir compensa: se a conversão despenca da 1ª para a 2ª remarcação, remarcar duas vezes é jogar tempo fora; se ela se mantém, insistir vale a pena.',
          })} />
        </div>

        {ate.total === 0 ? (
          <p style={{ fontSize: '12px', color: '#8B857D', marginTop: '10px' }}>Sem marcações no período.</p>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              {ate.linhas.map(l => {
                const larg = ate.total > 0 ? Math.max((l.clientes / ate.total) * 100, l.clientes > 0 ? 4 : 0) : 0
                return (
                  <div key={l.faixa}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px', gap: '8px' }}>
                      <span style={{ color: '#B0A99F', fontWeight: 600 }}>{l.label}</span>
                      <span style={{ color: '#8B857D', textAlign: 'right' }}>
                        {l.clientes} {l.clientes === 1 ? 'cliente' : 'clientes'}
                        {l.clientes > 0 && (
                          <> · <span style={{ color: l.conversao >= 50 ? '#4ADE80' : l.conversao > 0 ? '#C9A84C' : '#6B6560', fontWeight: 700 }}>
                            {l.matriculas} matric. ({l.conversao}%)
                          </span></>
                        )}
                      </span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '99px', background: '#1C1C1C', overflow: 'hidden' }}>
                      <div style={{ width: `${larg}%`, height: '100%', background: '#22D3EE', borderRadius: '99px' }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {(ate.mediaMatriculados !== null || ate.mediaNaoMatriculados !== null) && (
              <p style={{ fontSize: '12px', color: '#A59F97', lineHeight: 1.55, marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #222' }}>
                Quem <b style={{ color: '#4ADE80' }}>matriculou</b> foi remarcado em média{' '}
                <b style={{ color: '#EFEFEF' }}>{ate.mediaMatriculados ?? '—'}</b> vez(es).
                Quem <b style={{ color: '#E8834A' }}>não matriculou</b>,{' '}
                <b style={{ color: '#EFEFEF' }}>{ate.mediaNaoMatriculados ?? '—'}</b>.
                {ate.mediaMatriculados !== null && ate.mediaNaoMatriculados !== null && (
                  ate.mediaNaoMatriculados > ate.mediaMatriculados
                    ? ' Ou seja: quanto mais remarca, menos fecha — vale rever a insistência.'
                    : ate.mediaNaoMatriculados < ate.mediaMatriculados
                      ? ' Ou seja: insistir está dando certo — quem fechou remarcou mais.'
                      : ' Empatado: remarcar não mudou o resultado.'
                )}
              </p>
            )}
          </>
        )}
      </div>

      {/* Repescagem dá resultado? */}
      <div className="rounded-2xl" style={{ border: '1px solid #262626', background: '#141414', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#EFEFEF' }}>
            A repescagem está dando resultado?
          </p>
          <Info onClick={() => onInfo({
            title: 'Conversão da repescagem',
            text: `Pega os clientes que alguém marcou para repescagem no período e vê quantos receberam visita e quantos matricularam — sempre comparado com a média de todo mundo no mesmo período. Se a repescagem converte mais que a média, ela está trazendo gente boa de volta; se converte menos, está gastando tempo com quem já disse não. Os dados começam em ${fmtData(REPESCAGEM_DESDE)} — antes disso a repescagem não deixava registro.`,
          })} />
        </div>

        {rep.clientes === 0 ? (
          <p style={{ fontSize: '12px', color: '#8B857D', lineHeight: 1.5, marginTop: '10px' }}>
            Nenhuma repescagem marcada no período. Os registros começam em {fmtData(REPESCAGEM_DESDE)}.
          </p>
        ) : (
          <div style={{ marginTop: '12px' }}>
            {[
              { label: 'Receberam visita depois', v: rep.receberam, p: rep.convVisita, base: baseConvVis, cor: '#A78BFA' },
              { label: 'Matricularam',            v: rep.matriculas, p: rep.convMat,   base: baseConvMat, cor: '#4ADE80' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1F1F1F', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#B0A99F' }}>{l.label}</span>
                <span style={{ fontSize: '12px', color: '#8B857D', textAlign: 'right' }}>
                  <b style={{ color: l.cor }}>{l.v} de {rep.clientes} ({l.p ?? 0}%)</b>
                  {l.base !== null && l.base !== undefined && (
                    <span style={{ display: 'block', fontSize: '11px' }}>
                      média geral: {l.base}%
                      {l.p !== null && l.p !== l.base && (
                        <b style={{ color: l.p > l.base ? '#4ADE80' : '#E8834A' }}>
                          {' '}({l.p > l.base ? '+' : ''}{l.p - l.base} pts)
                        </b>
                      )}
                    </span>
                  )}
                </span>
              </div>
            ))}
            <p style={{ fontSize: '11px', color: '#6B6560', marginTop: '10px', lineHeight: 1.5 }}>
              Registros de repescagem começam em {fmtData(REPESCAGEM_DESDE)}.
            </p>
          </div>
        )}
      </div>

      {/* Quem remarcou e quem repescou — só o gerente na visão da equipe */}
      {mostrarRanking && (remarcRanking.length > 0 || repRanking.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
          {[
            { titulo: 'Quem remarcou', dados: remarcRanking, cor: '#22D3EE' },
            { titulo: 'Quem repescou', dados: repRanking,    cor: '#A3E635' },
          ].map(bloco => (
            <div key={bloco.titulo} className="rounded-2xl" style={{ border: '1px solid #262626', background: '#141414', padding: '14px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: bloco.cor, marginBottom: '8px' }}>
                {bloco.titulo}
              </p>
              {bloco.dados.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#6B6560' }}>ninguém no período</p>
              ) : bloco.dados.slice(0, 5).map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '3px 0', gap: '8px' }}>
                  <span style={{ color: '#B0A99F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomeDe(r.id)}</span>
                  <b style={{ color: '#EFEFEF' }}>{r.total}</b>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
