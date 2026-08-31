'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../services/auth'
import { Search, Palmtree, History, User, Truck, Calendar, Plus, X, Save, RotateCcw } from 'lucide-react'

interface Motorista {
  id: string
  nome: string
  ativo: boolean
  de_ferias: boolean
  ferias_inicio: string | null
  ferias_fim: string | null
  substituto_id: string | null
  caminhao_id: string | null
  caminhao_temp_id: string | null
}

interface HistoricoFerias {
  id: string
  motorista_id: string
  motorista_nome: string
  substituto_id?: string | null
  substituto_nome: string | null
  caminhao_placa: string | null
  ferias_inicio: string | null
  ferias_fim: string | null
  created_at: string
}

interface Caminhao { id: string; placa: string; motorista_atual: string | null }

function hojeLocal() {
  const agora = new Date()
  const offset = agora.getTimezoneOffset() * 60000
  return new Date(agora.getTime() - offset).toISOString().split('T')[0]
}

function fmtData(d: string | null | undefined) {
  if (!d) return '—'
  const [y, m, dia] = d.split('T')[0].split('-')
  return `${dia}/${m}/${y}`
}

function diasFerias(inicio: string | null | undefined, fim: string | null | undefined) {
  if (!inicio || !fim) return null
  return Math.max(1, Math.ceil((new Date(`${fim}T00:00:00`).getTime() - new Date(`${inicio}T00:00:00`).getTime()) / 86400000))
}

export default function FeriasPage() {
  const { perm } = useAuth()
  const podeEditar = perm === 'total'
  const [abaAtiva, setAbaAtiva] = useState<'ferias' | 'historico'>('ferias')
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([])
  const [historicos, setHistoricos] = useState<HistoricoFerias[]>([])
  const [busca, setBusca] = useState('')
  const [buscaHist, setBuscaHist] = useState('')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')
  const [selecionado, setSelecionado] = useState<Motorista | null>(null)
  const [formInicio, setFormInicio] = useState('')
  const [formFim, setFormFim] = useState('')
  const [formSubstitutoId, setFormSubstitutoId] = useState('')

  useEffect(() => { fetchTudo() }, [])

  function mostrarMsg(texto: string) {
    setMsg(texto)
    window.setTimeout(() => setMsg(''), 4000)
  }

  async function fetchTudo() {
    setLoading(true)
    try {
      const [motoristasRes, caminhoesRes, historicosRes] = await Promise.all([
        supabase.from('motoristas').select('id,nome,ativo,de_ferias,ferias_inicio,ferias_fim,substituto_id,caminhao_id,caminhao_temp_id').order('nome'),
        supabase.from('caminhoes').select('id,placa,motorista_atual').order('placa'),
        supabase.from('historico_ferias').select('*').order('created_at', { ascending: false }),
      ])
      if (motoristasRes.error) throw motoristasRes.error
      if (caminhoesRes.error) throw caminhoesRes.error
      if (historicosRes.error) throw historicosRes.error
      setMotoristas((motoristasRes.data || []) as Motorista[])
      setCaminhoes((caminhoesRes.data || []) as Caminhao[])
      setHistoricos((historicosRes.data || []) as HistoricoFerias[])
    } catch (error: any) {
      mostrarMsg('❌ Erro ao carregar férias: ' + (error?.message || 'verifique a conexão'))
    } finally {
      setLoading(false)
    }
  }

  const getCaminhao = (id: string | null | undefined) => caminhoes.find(c => c.id === id)
  const getMotorista = (id: string | null | undefined) => motoristas.find(m => m.id === id)

  const filtrados = useMemo(() => {
    const texto = busca.trim().toLowerCase()
    if (!texto) return motoristas.filter(m => m.ativo !== false)
    return motoristas.filter(m => m.ativo !== false && m.nome.toLowerCase().includes(texto))
  }, [motoristas, busca])

  const emFerias = filtrados.filter(m => m.de_ferias)
  const disponiveis = filtrados.filter(m => !m.de_ferias)

  const historicoFiltrado = useMemo(() => {
    const texto = buscaHist.trim().toLowerCase()
    if (!texto) return historicos
    return historicos.filter(h =>
      h.motorista_nome?.toLowerCase().includes(texto) ||
      h.substituto_nome?.toLowerCase().includes(texto) ||
      h.caminhao_placa?.toLowerCase().includes(texto)
    )
  }, [historicos, buscaHist])

  function abrirFormulario(motorista: Motorista) {
    if (!podeEditar) return
    setSelecionado(motorista)
    setFormInicio(motorista.ferias_inicio || hojeLocal())
    setFormFim(motorista.ferias_fim || '')
    setFormSubstitutoId(motorista.substituto_id || '')
  }

  function fecharFormulario() {
    if (salvando) return
    setSelecionado(null)
    setFormInicio('')
    setFormFim('')
    setFormSubstitutoId('')
  }

  async function verificarErro<T>(operacao: PromiseLike<{ error: any }>, mensagem: string) {
    const resultado = await operacao
    if (resultado.error) throw new Error(`${mensagem}: ${resultado.error.message || 'erro desconhecido'}`)
  }

  async function registrarTrocaCaminhao(caminhaoId: string, placa: string, motoristaNovo: string, motoristaAntigo: string) {
    if (!caminhaoId || motoristaNovo === motoristaAntigo) return
    const hoje = hojeLocal()
    const ontemDate = new Date(`${hoje}T00:00:00`)
    ontemDate.setDate(ontemDate.getDate() - 1)
    const ontem = ontemDate.toISOString().split('T')[0]

    if (motoristaAntigo) {
      await verificarErro(
        supabase.from('historico_motorista_caminhao')
          .update({ data_fim: ontem })
          .eq('caminhao_id', caminhaoId)
          .eq('motorista_nome', motoristaAntigo)
          .is('data_fim', null),
        'não foi possível fechar o histórico do caminhão'
      )
    }

    if (motoristaNovo) {
      await verificarErro(
        supabase.from('historico_motorista_caminhao').insert({
          caminhao_id: caminhaoId,
          caminhao_placa: placa,
          motorista_nome: motoristaNovo,
          data_inicio: hoje,
          data_fim: null,
        }),
        'não foi possível registrar o novo motorista do caminhão'
      )
    }
  }

  async function salvarPeriodo() {
    if (!selecionado) return
    if (!formInicio || !formFim) {
      mostrarMsg('❌ Informe a data de início e a data de fim das férias.')
      return
    }
    if (formFim < formInicio) {
      mostrarMsg('❌ A data final não pode ser anterior à data inicial.')
      return
    }
    if (!podeEditar) {
      mostrarMsg('❌ Seu usuário não possui permissão para alterar férias.')
      return
    }

    setSalvando(true)
    try {
      const substituto = getMotorista(formSubstitutoId)
      if (formSubstitutoId === selecionado.id) throw new Error('o motorista não pode ser o próprio substituto')
      if (substituto?.de_ferias) throw new Error('o substituto escolhido já está de férias')

      if (selecionado.de_ferias) {
        // Alterar um período ativo atualiza o mesmo registro, sem criar duplicidade no histórico.
        const historicoAtual = historicos.find(h =>
          h.motorista_id === selecionado.id &&
          h.ferias_inicio === selecionado.ferias_inicio
        )
        await verificarErro(
          supabase.from('motoristas').update({ ferias_inicio: formInicio, ferias_fim: formFim }).eq('id', selecionado.id),
          'não foi possível atualizar as férias'
        )
        if (historicoAtual) {
          await verificarErro(
            supabase.from('historico_ferias').update({ ferias_inicio: formInicio, ferias_fim: formFim }).eq('id', historicoAtual.id),
            'não foi possível atualizar o histórico de férias'
          )
        }
        mostrarMsg('✅ Período de férias atualizado!')
      } else {
        const caminhao = getCaminhao(selecionado.caminhao_id)
        if (substituto && caminhao) {
          await verificarErro(
            supabase.from('motoristas').update({ caminhao_temp_id: caminhao.id }).eq('id', substituto.id),
            'não foi possível vincular o substituto'
          )
          await verificarErro(
            supabase.from('caminhoes').update({ motorista_atual: substituto.nome }).eq('id', caminhao.id),
            'não foi possível atualizar o motorista do caminhão'
          )
          await registrarTrocaCaminhao(caminhao.id, caminhao.placa, substituto.nome, selecionado.nome)
        }

        await verificarErro(
          supabase.from('historico_ferias').insert({
            motorista_id: selecionado.id,
            motorista_nome: selecionado.nome,
            substituto_id: substituto?.id || null,
            substituto_nome: substituto?.nome || null,
            caminhao_placa: caminhao?.placa || null,
            ferias_inicio: formInicio,
            ferias_fim: formFim,
          }),
          'não foi possível registrar o histórico de férias'
        )
        await verificarErro(
          supabase.from('motoristas').update({
            de_ferias: true,
            ferias_inicio: formInicio,
            ferias_fim: formFim,
            substituto_id: substituto?.id || null,
          }).eq('id', selecionado.id),
          'não foi possível colocar o motorista de férias'
        )
        mostrarMsg('✅ Motorista colocado de férias!')
      }

      fecharFormulario()
      await fetchTudo()
    } catch (error: any) {
      mostrarMsg('❌ ' + (error?.message || 'Erro ao salvar férias'))
    } finally {
      setSalvando(false)
    }
  }

  async function encerrarFerias(motorista: Motorista) {
    if (!podeEditar || salvando) return
    if (!window.confirm(`Encerrar as férias de ${motorista.nome}? O histórico será preservado.`)) return

    setSalvando(true)
    try {
      const substituto = getMotorista(motorista.substituto_id)
      const caminhao = getCaminhao(motorista.caminhao_id)

      if (substituto && caminhao) {
        await verificarErro(
          supabase.from('motoristas').update({ caminhao_temp_id: null }).eq('id', substituto.id),
          'não foi possível liberar o substituto'
        )
        await verificarErro(
          supabase.from('caminhoes').update({ motorista_atual: motorista.nome }).eq('id', caminhao.id),
          'não foi possível devolver o caminhão ao motorista'
        )
        await registrarTrocaCaminhao(caminhao.id, caminhao.placa, motorista.nome, substituto.nome)
      }

      await verificarErro(
        supabase.from('motoristas').update({
          de_ferias: false,
          ferias_inicio: null,
          ferias_fim: null,
          substituto_id: null,
        }).eq('id', motorista.id),
        'não foi possível encerrar as férias'
      )
      mostrarMsg('✅ Férias encerradas. O histórico foi preservado.')
      await fetchTudo()
    } catch (error: any) {
      mostrarMsg('❌ ' + (error?.message || 'Erro ao encerrar férias'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {msg && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-bold ${msg.startsWith('❌') ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
          {msg}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600"><Palmtree size={25}/></div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Férias</h1>
            <p className="text-sm text-gray-500">Controle de períodos, substitutos e histórico dos motoristas</p>
          </div>
        </div>
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200">
          <button onClick={() => setAbaAtiva('ferias')}
            className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition ${abaAtiva === 'ferias' ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
            Férias
          </button>
          <button onClick={() => setAbaAtiva('historico')}
            className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition ${abaAtiva === 'historico' ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
            Histórico
          </button>
        </div>
      </div>

      {!podeEditar && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl px-4 py-3 text-sm font-medium">
          Este usuário pode consultar as férias, mas somente o administrador pode registrar, alterar ou encerrar períodos.
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando férias...</div>
      ) : abaAtiva === 'ferias' ? (
        <>
          <div className="relative">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar motorista..."
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-sm"/>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4"><p className="text-xs font-black uppercase text-blue-500">Em férias</p><p className="text-2xl font-black text-blue-800 mt-1">{emFerias.length}</p></div>
            <div className="bg-green-50 border border-green-100 rounded-2xl p-4"><p className="text-xs font-black uppercase text-green-500">Disponíveis</p><p className="text-2xl font-black text-green-800 mt-1">{disponiveis.length}</p></div>
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4"><p className="text-xs font-black uppercase text-gray-500">Histórico registrado</p><p className="text-2xl font-black text-gray-800 mt-1">{historicos.length}</p></div>
          </div>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-2"><Palmtree size={15}/> Em férias ({emFerias.length})</h2>
            </div>
            {emFerias.length === 0 ? (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-8 text-center text-sm text-blue-400">Nenhum motorista de férias no momento.</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {emFerias.map(m => {
                  const substituto = getMotorista(m.substituto_id)
                  const caminhao = getCaminhao(m.caminhao_id)
                  return (
                    <div key={m.id} className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5">
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-black shrink-0">{m.nome.charAt(0)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap"><p className="font-black text-gray-900">{m.nome}</p><span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-black uppercase">De férias</span></div>
                          <p className="text-xs text-blue-600 mt-1 flex items-center gap-1"><Calendar size={13}/> {fmtData(m.ferias_inicio)} → {fmtData(m.ferias_fim)} {diasFerias(m.ferias_inicio, m.ferias_fim) && <span className="text-blue-400">({diasFerias(m.ferias_inicio, m.ferias_fim)} dias)</span>}</p>
                          {caminhao && <p className="text-xs text-gray-500 mt-2 flex items-center gap-1"><Truck size={13}/> Caminhão {caminhao.placa}</p>}
                        </div>
                      </div>
                      {substituto && <div className="mt-4 bg-blue-50 rounded-xl p-3 flex items-center gap-2"><User size={15} className="text-blue-500"/><div><p className="text-[10px] text-blue-500 uppercase font-black">Substituto</p><p className="text-xs font-bold text-blue-800">{substituto.nome}</p></div></div>}
                      {podeEditar && <div className="flex gap-2 mt-4"><button onClick={() => abrirFormulario(m)} disabled={salvando} className="flex-1 border border-blue-200 text-blue-700 py-2 rounded-xl text-xs font-black uppercase hover:bg-blue-50 disabled:opacity-50">Editar período</button><button onClick={() => encerrarFerias(m)} disabled={salvando} className="flex-1 bg-gray-900 text-white py-2 rounded-xl text-xs font-black uppercase hover:bg-black disabled:opacity-50">Encerrar férias</button></div>}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2"><User size={15}/> Disponíveis ({disponiveis.length})</h2>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {disponiveis.length === 0 ? <div className="p-8 text-center text-sm text-gray-400">Nenhum motorista disponível.</div> : disponiveis.map(m => (
                <div key={m.id} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 last:border-0">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-black shrink-0">{m.nome.charAt(0)}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-black text-gray-900">{m.nome}</p><p className="text-xs text-gray-400">Disponível para escala</p></div>
                  {podeEditar && <button onClick={() => abrirFormulario(m)} disabled={salvando} className="bg-red-600 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 hover:bg-red-700 disabled:opacity-50"><Plus size={14}/> Colocar de férias</button>}
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="relative"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/><input value={buscaHist} onChange={e => setBuscaHist(e.target.value)} placeholder="Buscar por motorista, substituto ou caminhão..." className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-sm"/></div>
          {historicoFiltrado.length === 0 ? <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center"><History size={32} className="mx-auto text-gray-200 mb-2"/><p className="text-sm text-gray-400">Nenhum histórico de férias registrado.</p></div> : <div className="space-y-3">{historicoFiltrado.map(h => <div key={h.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-black">{h.motorista_nome?.charAt(0) || '?'}</div><div><p className="font-black text-gray-900">{h.motorista_nome}</p><p className="text-xs text-blue-600 mt-1 flex items-center gap-1"><Calendar size={13}/> {fmtData(h.ferias_inicio)} → {fmtData(h.ferias_fim)} {diasFerias(h.ferias_inicio, h.ferias_fim) && <span className="text-blue-400">({diasFerias(h.ferias_inicio, h.ferias_fim)} dias)</span>}</p></div></div><p className="text-xs text-gray-400">Registrado em {fmtData(h.created_at)}</p></div><div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">{h.substituto_nome && <div className="bg-gray-50 rounded-xl p-3"><p className="text-[10px] text-gray-400 uppercase font-black">Substituto</p><p className="text-xs font-bold text-gray-700 mt-1">{h.substituto_nome}</p></div>}{h.caminhao_placa && <div className="bg-gray-50 rounded-xl p-3"><p className="text-[10px] text-gray-400 uppercase font-black">Caminhão</p><p className="text-xs font-bold text-gray-700 mt-1">🚛 {h.caminhao_placa}</p></div>}</div></div>)}</div>}
        </>
      )}

      {selecionado && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) fecharFormulario() }}>
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5"><div><h2 className="text-xl font-black text-gray-900">{selecionado.de_ferias ? 'Editar férias' : 'Colocar de férias'}</h2><p className="text-sm text-gray-500 mt-1">{selecionado.nome}</p></div><button onClick={fecharFormulario} disabled={salvando} className="text-gray-400 hover:text-gray-700"><X size={22}/></button></div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3"><div><label className="text-[10px] font-black text-gray-400 uppercase">Início das férias</label><input type="date" value={formInicio} onChange={e => setFormInicio(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500"/></div><div><label className="text-[10px] font-black text-gray-400 uppercase">Fim das férias</label><input type="date" value={formFim} onChange={e => setFormFim(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500"/></div></div>
              <div><label className="text-[10px] font-black text-gray-400 uppercase">Motorista substituto</label><select value={formSubstitutoId} onChange={e => setFormSubstitutoId(e.target.value)} disabled={selecionado.de_ferias} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold bg-gray-50 disabled:opacity-60"><option value="">Sem substituto</option>{motoristas.filter(m => m.ativo && m.id !== selecionado.id && !m.de_ferias).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>{selecionado.de_ferias && <p className="text-[11px] text-gray-400 mt-1">O substituto não é alterado durante a edição do período.</p>}</div>
              {selecionado.caminhao_id && <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 flex items-center gap-2"><Truck size={15}/> {getCaminhao(selecionado.caminhao_id)?.placa || 'Caminhão vinculado'}{formSubstitutoId && ' será usado pelo substituto durante as férias.'}</div>}
            </div>
            <div className="flex gap-3 mt-6"><button onClick={fecharFormulario} disabled={salvando} className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-bold text-gray-600">Cancelar</button><button onClick={salvarPeriodo} disabled={salvando} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-3 text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50">{salvando ? <RotateCcw size={16} className="animate-spin"/> : <Save size={16}/>} {salvando ? 'Salvando...' : selecionado.de_ferias ? 'Atualizar período' : 'Confirmar férias'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
