'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/services/supabase';

type Motorista = { id: string; nome: string };
type Contrato = {
  id: string;
  numero_contrato: string;
  data: string;
  fat_bruto: number;
  cliente?: string;
};
type Abastecimento = {
  id: string;
  data: string;
  posto?: string;
  litros_combustivel?: number;
  valor_combustivel?: number;
  litros_arla?: number;
  valor_arla?: number;
};

export default function FechamentoViagemPage() {
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [motoristaId, setMotoristaId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([]);
  const [kmInicial, setKmInicial] = useState('');
  const [kmFinal, setKmFinal] = useState('');
  const [buscou, setBuscou] = useState(false);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    supabase
      .from('motoristas')
      .select('id, nome')
      .order('nome')
      .then(({ data }) => data && setMotoristas(data));
  }, []);

  async function buscar() {
    if (!motoristaId || !dataInicio || !dataFim) return;
    setLoading(true);
    setBuscou(false);
    setErro('');

    const [{ data: contr }, { data: abast }] = await Promise.all([
      supabase
        .from('contratos')
        .select('id, numero_contrato, data, fat_bruto, cliente')
        .eq('motorista_id', motoristaId)
        .gte('data', dataInicio)
        .lte('data', dataFim)
        .order('data'),

      supabase
        .from('abastecimentos')
        .select(
          'id, data, posto, litros_combustivel, valor_combustivel, litros_arla, valor_arla'
        )
        .eq('motorista_id', motoristaId)
        .gte('data', dataInicio)
        .lte('data', dataFim)
        .order('data'),
    ]);

    setContratos(contr || []);
    setSelecionados(new Set((contr || []).map((c) => c.id)));
    setAbastecimentos(abast || []);
    setBuscou(true);
    setLoading(false);
  }

  function toggle(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const resumo = useMemo(() => {
    const km =
      kmFinal && kmInicial ? Number(kmFinal) - Number(kmInicial) : 0;
    const litros = abastecimentos.reduce(
      (s, a) => s + (a.litros_combustivel || 0),
      0
    );
    const valor = abastecimentos.reduce(
      (s, a) => s + (a.valor_combustivel || 0) + (a.valor_arla || 0),
      0
    );
    const mediaKmL = litros > 0 && km > 0 ? km / litros : 0;
    return { km, litros, valor, mediaKmL };
  }, [abastecimentos, kmInicial, kmFinal]);

  async function salvar() {
    setErro('');
    if (!motoristaId || !dataInicio || !dataFim || !kmInicial || !kmFinal) {
      setErro('Preencha todos os campos obrigatórios.');
      return;
    }
    if (selecionados.size === 0) {
      setErro('Selecione ao menos um contrato.');
      return;
    }
    setSalvando(true);

    const { data: fech, error } = await supabase
      .from('fechamento_viagens')
      .insert({
        motorista_id: motoristaId,
        data_inicio: dataInicio,
        data_fim: dataFim,
        km_inicial: Number(kmInicial),
        km_final: Number(kmFinal),
      })
      .select()
      .single();

    if (error || !fech) {
      setErro('Erro ao salvar: ' + (error?.message || 'tente novamente.'));
      setSalvando(false);
      return;
    }

    await Promise.all([
      supabase.from('fechamento_contratos').insert(
        [...selecionados].map((cid) => ({
          fechamento_id: fech.id,
          contrato_id: cid,
        }))
      ),
      abastecimentos.length > 0 &&
        supabase.from('fechamento_abastecimentos').insert(
          abastecimentos.map((a) => ({
            fechamento_id: fech.id,
            abastecimento_id: a.id,
          }))
        ),
    ]);

    setSucesso(true);
    setSalvando(false);
    setTimeout(() => {
      setMotoristaId('');
      setDataInicio('');
      setDataFim('');
      setKmInicial('');
      setKmFinal('');
      setContratos([]);
      setAbastecimentos([]);
      setSelecionados(new Set());
      setBuscou(false);
      setSucesso(false);
    }, 2000);
  }

  const fmt = (n: number) =>
    n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const fmtData = (d: string) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

  const podeSalvar =
    !!motoristaId &&
    !!dataInicio &&
    !!dataFim &&
    !!kmInicial &&
    !!kmFinal &&
    selecionados.size > 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Fechamento de Viagem</h1>

      {/* ── Filtros ── */}
      <div className="bg-white rounded-xl shadow p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Motorista <span className="text-red-500">*</span>
          </label>
          <select
            value={motoristaId}
            onChange={(e) => {
              setMotoristaId(e.target.value);
              setBuscou(false);
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecione...</option>
            {motoristas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Data Início <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Data Fim <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="md:col-span-4 flex justify-end">
          <button
            onClick={buscar}
            disabled={!motoristaId || !dataInicio || !dataFim || loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </div>

      {buscou && (
        <>
          {/* ── KM ── */}
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Hodômetro
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  KM Inicial <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={kmInicial}
                  onChange={(e) => setKmInicial(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: 125000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  KM Final <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={kmFinal}
                  onChange={(e) => setKmFinal(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: 127500"
                />
              </div>
            </div>
            {kmInicial && kmFinal && Number(kmFinal) > Number(kmInicial) && (
              <p className="mt-3 text-sm text-gray-500">
                KM percorrido:{' '}
                <span className="font-semibold text-gray-800">
                  {(Number(kmFinal) - Number(kmInicial)).toLocaleString('pt-BR')} km
                </span>
              </p>
            )}
          </div>

          {/* ── Contratos ── */}
          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800">
                Contratos{' '}
                <span className="text-sm font-normal text-gray-400">
                  ({selecionados.size} de {contratos.length} selecionados)
                </span>
              </h2>
              <div className="flex gap-3 text-xs">
                <button
                  onClick={() =>
                    setSelecionados(new Set(contratos.map((c) => c.id)))
                  }
                  className="text-blue-600 hover:underline"
                >
                  Todos
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => setSelecionados(new Set())}
                  className="text-blue-600 hover:underline"
                >
                  Nenhum
                </button>
              </div>
            </div>

            {contratos.length === 0 ? (
              <p className="text-gray-400 text-sm">
                Nenhum contrato encontrado no período.
              </p>
            ) : (
              <div className="space-y-2">
                {contratos.map((c) => (
                  <label
                    key={c.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors select-none
                      ${
                        selecionados.has(c.id)
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={selecionados.has(c.id)}
                      onChange={() => toggle(c.id)}
                      className="w-4 h-4 accent-blue-600 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm text-gray-800">
                        {c.numero_contrato}
                      </span>
                      {c.cliente && (
                        <span className="text-gray-500 text-sm ml-2">
                          · {c.cliente}
                        </span>
                      )}
                    </div>
                    <span className="text-gray-400 text-xs shrink-0">
                      {fmtData(c.data)}
                    </span>
                    <span className="text-green-700 font-semibold text-sm shrink-0">
                      {c.fat_bruto ? `R$ ${fmt(Number(c.fat_bruto))}` : '—'}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* ── Abastecimentos ── */}
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Abastecimentos no período{' '}
              <span className="text-sm font-normal text-gray-400">
                ({abastecimentos.length} registros — vinculados automaticamente)
              </span>
            </h2>

            {abastecimentos.length === 0 ? (
              <p className="text-gray-400 text-sm">
                Nenhum abastecimento no período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b">
                      <th className="pb-2 pr-4">Data</th>
                      <th className="pb-2 pr-4">Posto</th>
                      <th className="pb-2 pr-4 text-right">Diesel (L)</th>
                      <th className="pb-2 pr-4 text-right">Arla (L)</th>
                      <th className="pb-2 text-right">Valor Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abastecimentos.map((a) => {
                      const valor =
                        (a.valor_combustivel || 0) + (a.valor_arla || 0);
                      return (
                        <tr key={a.id} className="border-b last:border-0">
                          <td className="py-2 pr-4 text-gray-600">
                            {fmtData(a.data)}
                          </td>
                          <td className="py-2 pr-4 text-gray-600">
                            {a.posto || '—'}
                          </td>
                          <td className="py-2 pr-4 text-right text-gray-700">
                            {a.litros_combustivel
                              ? `${Number(a.litros_combustivel).toFixed(0)} L`
                              : '—'}
                          </td>
                          <td className="py-2 pr-4 text-right text-gray-700">
                            {a.litros_arla
                              ? `${Number(a.litros_arla).toFixed(0)} L`
                              : '—'}
                          </td>
                          <td className="py-2 text-right font-medium text-red-600">
                            {valor > 0 ? `R$ ${fmt(valor)}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Resumo ── */}
          <div className="bg-gray-900 text-white rounded-xl p-5 grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              {
                label: 'KM Rodado',
                value:
                  resumo.km > 0
                    ? `${resumo.km.toLocaleString('pt-BR')} km`
                    : '—',
                color: 'text-white',
              },
              {
                label: 'Total Abastecido',
                value: resumo.valor > 0 ? `R$ ${fmt(resumo.valor)}` : '—',
                color: 'text-red-400',
              },
              {
                label: 'Total Litros',
                value:
                  resumo.litros > 0
                    ? `${resumo.litros.toFixed(0)} L`
                    : '—',
                color: 'text-blue-400',
              },
              {
                label: 'Média km/L',
                value:
                  resumo.mediaKmL > 0
                    ? `${resumo.mediaKmL.toFixed(2)} km/L`
                    : '—',
                color: 'text-green-400',
              },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">
                  {item.label}
                </p>
                <p className={`text-xl font-bold ${item.color}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {/* ── Erro / Sucesso ── */}
          {erro && (
            <div className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {erro}
            </div>
          )}
          {sucesso && (
            <div className="text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              ✓ Fechamento salvo com sucesso!
            </div>
          )}

          {/* ── Salvar ── */}
          <div className="flex justify-end pb-8">
            <button
              onClick={salvar}
              disabled={!podeSalvar || salvando}
              className="bg-green-600 text-white px-8 py-3 rounded-xl font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {salvando ? 'Salvando...' : 'Salvar Fechamento'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}