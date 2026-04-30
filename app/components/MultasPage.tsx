'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../services/auth'
import { Search, Plus, ArrowLeft, Save, Trash2, ChevronRight, AlertTriangle } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!

interface Multa {
  id: string; motorista: string; placa: string; data: string; hora: string
  infracao: string; velocidade_permitida: number; velocidade_registrada: number
  numero_infracao: string; valor: number; status: string; orgao: string
  motorista_identificado: boolean; valor_nao_identificacao: number
  folha_pagamento: string; data_vencimento: string; data_pagamento: string
}
interface Motorista { id: string; nome: string }
interface Caminhao { id: string; placa: string; motorista_atual: string }

const InputClass = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-gray-50"
const LabelClass = "text-xs font-semibold text-gray-500 uppercase tracking-wide"

const INFRACOES = [
  'TRANSITAR EM LOCAL/HORARIO NAO PERMITIDO PELA REGULAMENTACAO - CAMINHAO',
  'ESTACIONAR EM LOCAL/HORARIO PROIBIDO ESPECIFICAMENTE PELA SINALIZACAO',
  'TRANSITAR EM VELOCIDADE SUPERIOR A MAXIMA PERMITIDA EM ATE 20',
  'TRANSITAR EM VELOCIDADE SUPERIOR A MAXIMA PERMITIDA ENTRE 20 E 50',
  'TRANSITAR EM VELOCIDADE SUPERIOR A MAXIMA PERMITIDA ACIMA DE 50',
  'DEIXAR DE CONSERVAR O VEICULO NA FAIXA A ELE DESTINADA PELA SINALIZACAO',
  'AVANÇAR O SINAL VERMELHO DO SEMAFORO',
  'CONDUZIR VEICULO UTILIZANDO TELEFONE CELULAR',
  'DEIXAR DE USAR CINTO DE SEGURANCA',
  'ULTRAPASSAGEM INDEVIDA',
  'TRANSPORTE IRREGULAR DE CARGA',
  'DOCUMENTACAO IRREGULAR',
  'OUTRA',
]

const ORGAOS = [
  'DER-SP', 'POLICIA RODOVIARIA FEDERAL', 'DNIT', 'DETRAN', 'CET', 'OUTRO',
]

const MESES = [
  { v: '01', l: 'Janeiro' }, { v: '02', l: 'Fevereiro' }, { v: '03', l: 'Março' },
  { v: '04', l: 'Abril' }, { v: '05', l: 'Maio' }, { v: '06', l: 'Junho' },
  { v: '07', l: 'Julho' }, { v: '08', l: 'Agosto' }, { v: '09', l: 'Setembro' },
  { v: '10', l: 'Outubro' }, { v: '11', l: 'Novembro' }, { v: '12', l: 'Dezembro' },
]

const isVelocidade = (inf: string) => inf.includes('VELOCIDADE SUPERIOR')

async function lancarContaPagar(multa: any) {
  await fetch(`${SUPABASE_URL}/rest/v1/contas_pagar`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal'
    },
    body: JSON.stringify({
      descricao: `Multa - ${multa.motorista} - ${multa.numero_infracao || multa.infracao}`,
      valor: multa.valor,
      data_vencimento: multa.data_vencimento || null,
      data_pagamento: multa.data_pagamento || null,
      status: 'PAGO',
      categoria: 'MULTA',
      referencia_id: multa.id,
      referencia_tipo: 'multa',
    })
  })
}

export default function MultasPage() {
  const { perm } = useAuth()
  const [multas, setMultas] = useState<Multa[]>([])
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([])
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState<Multa | null>(null)
  const [mostraCad, setMostraCad] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [confirmExcluir, setConfirmExcluir] = useState(false)

  const anoAtual = new Date().getFullYear()
  const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0')

  // Campos cadastro
  const [cadMotorista, setCadMotorista] = useState('')
  const [cadPlaca, setCadPlaca] = useState('')
  const [cadData, setCadData] = useState(new Date().toISOString().split('T')[0])
  const [cadHora, setCadHora] = useState('')
  const [cadInfracao, setCadInfracao] = useState('')
  const [cadVelPermitida, setCadVelPermitida] = useState('')
  const [cadVelRegistrada, setCadVelRegistrada] = useState('')
  const [cadNumero, setCadNumero] = useState('')
  const [cadValor, setCadValor] = useState('')
  const [cadStatus, setCadStatus] = useState('PENDENTE')
  const [cadOrgao, setCadOrgao] = useState('')
  const [cadIdentificado, setCadIdentificado] = useState(true)
  const [cadValorNaoId, setCadValorNaoId] = useState('')
  const [cadFolhaMes, setCadFolhaMes] = useState(mesAtual)
  const [cadFolhaAno, setCadFolhaAno] = useState(String(anoAtual))
  const [cadVencimento, setCadVencimento] = useState('')
  const [cadPagamento, setCadPagamento] = useState('')

  // Campos edição
  const [editMotorista, setEditMotorista] = useState('')
  const [editPlaca, setEditPlaca] = useState('')
  const [editData, setEditData] = useState('')
  const [editHora, setEditHora] = useState('')
  const [editInfracao, setEditInfracao] = useState('')
  const [editVelPermitida, setEditVelPermitida] = useState('')
  const [editVelRegistrada, setEditVelRegistrada] = useState('')
  const [editNumero, setEditNumero] = useState('')
  const [editValor, setEditValor] = useState('')
  const [editStatus, setEditStatus] = useState('PENDENTE')
  const [editOrgao, setEditOrgao] = useState('')
  const [editIdentificado, setEditIdentificado] = useState(true)
  const [editValorNaoId, setEditValorNaoId] = useState('')
  const [editFolhaMes, setEditFolhaMes] = useState(mesAtual)
  const [editFolhaAno, setEditFolhaAno] = useState(String(anoAtual))
  const [editVencimento, setEditVencimento] = useState('')
  const [editPagamento, setEditPagamento] = useState('')
  const [statusAnterior, setStatusAnterior] = useState('')

  useEffect(() => { fetch_(); fetchMotoristas(); fetchCaminhoes() }, [])

  async function fetch_() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/multas?order=data.desc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      const data = await res.json()
      setMultas(Array.isArray(data) ? data : [])
    } catch {}
  }

  async function fetchMotoristas() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/motoristas?order=nome.asc&ativo=eq.true`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      const data = await res.json()
      setMotoristas(Array.isArray(data) ? data : [])
    } catch {}
  }

  async function fetchCaminhoes() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/caminhoes?order=placa.asc`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
      const data = await res.json()
      setCaminhoes(Array.isArray(data) ? data : [])
    } catch {}
  }

  function resetCad() {
    setCadMotorista(''); setCadPlaca(''); setCadData(new Date().toISOString().split('T')[0])
    setCadHora(''); setCadInfracao(''); setCadVelPermitida(''); setCadVelRegistrada('')
    setCadNumero(''); setCadValor(''); setCadStatus('PENDENTE'); setCadOrgao('')
    setCadIdentificado(true); setCadValorNaoId(''); setCadFolhaMes(mesAtual)
    setCadFolhaAno(String(anoAtual)); setCadVencimento(''); setCadPagamento('')
  }

  function selecionar(m: Multa) {
    setSel(m)
    setEditMotorista(m.motorista || '')
    setEditPlaca(m.placa || '')
    setEditData(m.data || '')
    setEditHora(m.hora || '')
    setEditInfracao(m.infracao || '')
    setEditVelPermitida(String(m.velocidade_permitida || ''))
    setEditVelRegistrada(String(m.velocidade_registrada || ''))
    setEditNumero(m.numero_infracao || '')
    setEditValor(String(m.valor || ''))
    setEditStatus(m.status || 'PENDENTE')
    setEditOrgao(m.orgao || '')
    setEditIdentificado(m.motorista_identificado !== false)
    setEditValorNaoId(String(m.valor_nao_identificacao || ''))
    const folha = m.folha_pagamento || ''
    if (folha.includes('/')) {
      setEditFolhaMes(folha.split('/')[0])
      setEditFolhaAno(folha.split('/')[1])
    } else {
      setEditFolhaMes(mesAtual); setEditFolhaAno(String(anoAtual))
    }
    setEditVencimento(m.data_vencimento || '')
    setEditPagamento(m.data_pagamento || '')
    setStatusAnterior(m.status || 'PENDENTE')
    setConfirmExcluir(false)
  }

  function voltar() { setSel(null); setConfirmExcluir(false) }
  function showMsg(t: string) { setMsg(t); setTimeout(() => setMsg(''), 3000) }
  function fmtData(d: string) {
    if (!d) return ''
    const [y, m, dia] = d.split('-')
    return `${dia}/${m}/${y}`
  }

  function buildPayload(p: any) {
    return {
      motorista: p.motorista, placa: p.placa, data: p.data, hora: p.hora,
      infracao: p.infracao,
      velocidade_permitida: isVelocidade(p.infracao) ? parseInt(p.velPerm) || null : null,
      velocidade_registrada: isVelocidade(p.infracao) ? parseInt(p.velReg) || null : null,
      numero_infracao: p.numero, valor: parseFloat(p.valor) || 0,
      status: p.status, orgao: p.orgao,
      motorista_identificado: p.identificado,
      valor_nao_identificacao: !p.identificado ? parseFloat(p.valorNaoId) || null : null,
      folha_pagamento: `${p.folhaMes}/${p.folhaAno}`,
      data_vencimento: p.vencimento || null,
      data_pagamento: p.pagamento || null,
    }
  }

  async function cadastrar() {
    if (!cadMotorista) return
    setLoading(true)
    if (perm !== 'demo') {
      const payload = buildPayload({
        motorista: cadMotorista, placa: cadPlaca, data: cadData, hora: cadHora,
        infracao: cadInfracao, velPerm: cadVelPermitida, velReg: cadVelRegistrada,
        numero: cadNumero, valor: cadValor, status: cadStatus, orgao: cadOrgao,
        identificado: cadIdentificado, valorNaoId: cadValorNaoId,
        folhaMes: cadFolhaMes, folhaAno: cadFolhaAno,
        vencimento: cadVencimento, pagamento: cadPagamento,
      })
      const res = await fetch(`${SUPABASE_URL}/rest/v1/multas`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(payload)
      })
      if (cadStatus === 'PAGO') {
        const data = await res.json()
        if (Array.isArray(data) && data[0]) await lancarContaPagar({ ...data[0] })
      }
    }
    await fetch_(); setLoading(false)
    resetCad(); setMostraCad(false); showMsg('✅ Multa registrada!')
  }

  async function salvar() {
    if (!sel) return
    setLoading(true)
    if (perm !== 'demo') {
      const payload = buildPayload({
        motorista: editMotorista, placa: editPlaca, data: editData, hora: editHora,
        infracao: editInfracao, velPerm: editVelPermitida, velReg: editVelRegistrada,
        numero: editNumero, valor: editValor, status: editStatus, orgao: editOrgao,
        identificado: editIdentificado, valorNaoId: editValorNaoId,
        folhaMes: editFolhaMes, folhaAno: editFolhaAno,
        vencimento: editVencimento, pagamento: editPagamento,
      })
      await fetch(`${SUPABASE_URL}/rest/v1/multas?id=eq.${sel.id}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(payload)
      })
      // Se mudou para PAGO, lança no financeiro
      if (editStatus === 'PAGO' && statusAnterior !== 'PAGO') {
        await lancarContaPagar({
          ...sel, ...payload,
          id: sel.id,
          valor: parseFloat(editValor) || 0,
          data_vencimento: editVencimento,
          data_pagamento: editPagamento,
        })
      }
    }
    await fetch_(); setLoading(false); voltar(); showMsg('✅ Atualizado!')
  }

  async function excluir() {
    if (!sel) return
    setLoading(true)
    if (perm !== 'demo') {
      await fetch(`${SUPABASE_URL}/rest/v1/multas?id=eq.${sel.id}`, {
        method: 'DELETE',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
    }
    await fetch_(); setLoading(false); voltar(); showMsg('Multa excluída.')
  }

  const filtrados = busca.trim()
    ? multas.filter(m =>
        m.motorista?.toLowerCase().includes(busca.toLowerCase()) ||
        m.placa?.toLowerCase().includes(busca.toLowerCase()) ||
        m.numero_infracao?.includes(busca) ||
        m.infracao?.toLowerCase().includes(busca.toLowerCase())
      )
    : multas

  const anos = ['2024', '2025', '2026', '2027']

  const CamposComuns = (p: {
    motorista: string; setMotorista: any; placa: string; setPlaca: any
    data: string; setData: any; hora: string; setHora: any
    infracao: string; setInfracao: any; velPerm: string; setVelPerm: any
    velReg: string; setVelReg: any; numero: string; setNumero: any
    valor: string; setValor: any; status: string; setStatus: any
    orgao: string; setOrgao: any; identificado: boolean; setIdentificado: any
    valorNaoId: string; setValorNaoId: any; folhaMes: string; setFolhaMes: any
    folhaAno: string; setFolhaAno: any; vencimento: string; setVencimento: any
    pagamento: string; setPagamento: any
  }) => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LabelClass}>Motorista *</label>
          <select value={p.motorista} onChange={e => {
            const cam = caminhoes.find(c => c.motorista_atual === e.target.value)
            p.setMotorista(e.target.value)
            if (cam) p.setPlaca(cam.placa)
          }} className={InputClass}>
            <option value="">Selecione...</option>
            {motoristas.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
          </select>
        </div>
        <div>
          <label className={LabelClass}>Placa</label>
          <select value={p.placa} onChange={e => p.setPlaca(e.target.value)} className={InputClass}>
            <option value="">Selecione...</option>
            {caminhoes.map(c => <option key={c.id} value={c.placa}>{c.placa}</option>)}
          </select>
        </div>
      </div>

      {/* Motorista identificado */}
      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
        <div className="flex items-center justify-between">
          <label className={LabelClass}>Motorista identificado?</label>
          <div className="flex gap-2">
            <button onClick={() => p.setIdentificado(true)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${p.identificado ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
              SIM
            </button>
            <button onClick={() => p.setIdentificado(false)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${!p.identificado ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
              NÃO
            </button>
          </div>
        </div>
        {!p.identificado && (
          <div className="mt-3">
            <label className={LabelClass}>Valor de não identificação (R$)</label>
            <input type="number" step="0.01" value={p.valorNaoId}
              onChange={e => p.setValorNaoId(e.target.value)}
              placeholder="0,00" className={InputClass} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LabelClass}>Data da Infração</label>
          <input type="date" value={p.data} onChange={e => p.setData(e.target.value)} className={InputClass} />
        </div>
        <div>
          <label className={LabelClass}>Hora</label>
          <input type="time" value={p.hora} onChange={e => p.setHora(e.target.value)} className={InputClass} />
        </div>
      </div>

      <div>
        <label className={LabelClass}>Infração (Motivo)</label>
        <select value={p.infracao} onChange={e => p.setInfracao(e.target.value)} className={InputClass}>
          <option value="">Selecione...</option>
          {INFRACOES.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>

      {isVelocidade(p.infracao) && (
        <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-100 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LabelClass}>Velocidade Permitida (km/h)</label>
              <input type="number" value={p.velPerm} onChange={e => p.setVelPerm(e.target.value)} placeholder="Ex: 80" className={InputClass} />
            </div>
            <div>
              <label className={LabelClass}>Velocidade Registrada (km/h)</label>
              <input type="number" value={p.velReg} onChange={e => p.setVelReg(e.target.value)} placeholder="Ex: 110" className={InputClass} />
            </div>
          </div>
          {p.velPerm && p.velReg && (
            <p className="text-xs text-yellow-700 font-medium">
              Excesso: <span className="font-bold">{parseInt(p.velReg) - parseInt(p.velPerm)} km/h acima do limite</span>
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LabelClass}>Nº Auto de Infração</label>
          <input value={p.numero} onChange={e => p.setNumero(e.target.value)} placeholder="Ex: 1DJ4817991" className={InputClass} />
        </div>
        <div>
          <label className={LabelClass}>Valor da Multa (R$)</label>
          <input type="number" step="0.01" value={p.valor} onChange={e => p.setValor(e.target.value)} placeholder="0,00" className={InputClass} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LabelClass}>Órgão</label>
          <select value={p.orgao} onChange={e => p.setOrgao(e.target.value)} className={InputClass}>
            <option value="">Selecione...</option>
            {ORGAOS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className={LabelClass}>Status</label>
          <select value={p.status} onChange={e => p.setStatus(e.target.value)} className={InputClass}>
            <option value="PENDENTE">PENDENTE</option>
            <option value="PAGO">PAGO</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LabelClass}>Vencimento</label>
          <input type="date" value={p.vencimento} onChange={e => p.setVencimento(e.target.value)} className={InputClass} />
        </div>
        <div>
          <label className={LabelClass}>Data de Pagamento</label>
          <input type="date" value={p.pagamento} onChange={e => p.setPagamento(e.target.value)} className={InputClass} />
        </div>
      </div>

      <div>
        <label className={LabelClass}>Folha de Pagamento (desconto)</label>
        <div className="grid grid-cols-2 gap-3 mt-1">
          <select value={p.folhaMes} onChange={e => p.setFolhaMes(e.target.value)} className={InputClass.replace('mt-1 ', '')}>
            {MESES.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
          <select value={p.folhaAno} onChange={e => p.setFolhaAno(e.target.value)} className={InputClass.replace('mt-1 ', '')}>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
    </div>
  )

  if (mostraCad) return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => { setMostraCad(false); resetCad() }} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition">
        <ArrowLeft size={16}/> Voltar
      </button>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4 text-lg">Nova Multa</h3>
        <CamposComuns
          motorista={cadMotorista} setMotorista={setCadMotorista}
          placa={cadPlaca} setPlaca={setCadPlaca}
          data={cadData} setData={setCadData}
          hora={cadHora} setHora={setCadHora}
          infracao={cadInfracao} setInfracao={setCadInfracao}
          velPerm={cadVelPermitida} setVelPerm={setCadVelPermitida}
          velReg={cadVelRegistrada} setVelReg={setCadVelRegistrada}
          numero={cadNumero} setNumero={setCadNumero}
          valor={cadValor} setValor={setCadValor}
          status={cadStatus} setStatus={setCadStatus}
          orgao={cadOrgao} setOrgao={setCadOrgao}
          identificado={cadIdentificado} setIdentificado={setCadIdentificado}
          valorNaoId={cadValorNaoId} setValorNaoId={setCadValorNaoId}
          folhaMes={cadFolhaMes} setFolhaMes={setCadFolhaMes}
          folhaAno={cadFolhaAno} setFolhaAno={setCadFolhaAno}
          vencimento={cadVencimento} setVencimento={setCadVencimento}
          pagamento={cadPagamento} setPagamento={setCadPagamento}
        />
        <div className="flex gap-2 pt-4">
          <button onClick={cadastrar} disabled={loading || !cadMotorista}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium transition">
            Registrar multa
          </button>
          <button onClick={() => { setMostraCad(false); resetCad() }}
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">{msg}</div>}

      {sel ? (
        <div>
          <button onClick={voltar} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 text-sm transition">
            <ArrowLeft size={16}/> Voltar
          </button>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-red-600 to-red-700">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h2 className="text-white font-bold text-xl">{sel.motorista}</h2>
                  <p className="text-white/80 text-sm">
                    {fmtData(sel.data)}{sel.hora && ` · ${sel.hora}`} · {sel.placa} · {sel.status}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5">
              <CamposComuns
                motorista={editMotorista} setMotorista={setEditMotorista}
                placa={editPlaca} setPlaca={setEditPlaca}
                data={editData} setData={setEditData}
                hora={editHora} setHora={setEditHora}
                infracao={editInfracao} setInfracao={setEditInfracao}
                velPerm={editVelPermitida} setVelPerm={setEditVelPermitida}
                velReg={editVelRegistrada} setVelReg={setEditVelRegistrada}
                numero={editNumero} setNumero={setEditNumero}
                valor={editValor} setValor={setEditValor}
                status={editStatus} setStatus={setEditStatus}
                orgao={editOrgao} setOrgao={setEditOrgao}
                identificado={editIdentificado} setIdentificado={setEditIdentificado}
                valorNaoId={editValorNaoId} setValorNaoId={setEditValorNaoId}
                folhaMes={editFolhaMes} setFolhaMes={setEditFolhaMes}
                folhaAno={editFolhaAno} setFolhaAno={setEditFolhaAno}
                vencimento={editVencimento} setVencimento={setEditVencimento}
                pagamento={editPagamento} setPagamento={setEditPagamento}
              />
              <div className="flex gap-2 pt-4">
                <button onClick={salvar} disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-medium transition">
                  <Save size={15}/> Salvar alterações
                </button>
                <button onClick={() => setConfirmExcluir(true)}
                  className="flex items-center gap-2 border border-red-200 text-red-500 hover:bg-red-50 rounded-xl px-4 py-2.5 text-sm transition">
                  <Trash2 size={15}/>
                </button>
              </div>
              {confirmExcluir && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl mt-3">
                  <p className="text-sm text-red-700 font-medium mb-3">⚠️ Excluir esta multa?</p>
                  <div className="flex gap-2">
                    <button onClick={excluir} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium">Confirmar</button>
                    <button onClick={() => setConfirmExcluir(false)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm">Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-2xl font-bold text-gray-900">Multas</h1>
            {perm !== 'view' && (
              <button onClick={() => setMostraCad(true)}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition shadow-sm">
                <Plus size={16}/> Registrar
              </button>
            )}
          </div>
          <div className="relative mb-4">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por motorista, placa ou infração..."
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-sm" />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Registros</p>
              <p className="text-xs text-gray-400">{filtrados.length} registro(s)</p>
            </div>
            {filtrados.length === 0 ? (
              <div className="p-10 text-center">
                <AlertTriangle size={32} className="mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">Nenhuma multa registrada</p>
              </div>
            ) : filtrados.map(m => (
              <button key={m.id} onClick={() => selecionar(m)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition border-b border-gray-50 last:border-0 text-left">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-red-600">
                  <AlertTriangle size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-900">{m.motorista}</p>
                    {m.motorista_identificado === false && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Não identificado</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {m.infracao || 'Sem infração'}{m.placa && ` · ${m.placa}`}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {fmtData(m.data)}{m.hora && ` · ${m.hora}`}
                    {m.numero_infracao && ` · Nº ${m.numero_infracao}`}
                    {m.orgao && ` · ${m.orgao}`}
                    {m.data_vencimento && ` · Venc: ${fmtData(m.data_vencimento)}`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-800">{(m.valor||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'PAGO' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {m.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}