const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function req(path: string, method = 'GET', body?: any) {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const r = await fetch(`${API}${path}`, opts)
  if (!r.ok) throw new Error(await r.text())
  if (r.status === 204) return null
  return r.json()
}

export const motoristasAPI = {
  listar: (busca = '') => req(`/motoristas/${busca ? `?busca=${busca}` : ''}`),
  criar: (data: any) => req('/motoristas/', 'POST', data),
  atualizar: (id: string, data: any) => req(`/motoristas/${id}`, 'PUT', data),
  excluir: (id: string) => req(`/motoristas/${id}`, 'DELETE'),
}

export const contratosAPI = {
  listar: (params?: { motorista?: string; status?: string; mes?: number; ano?: number }) => {
    const q = new URLSearchParams()
    if (params?.motorista) q.set('motorista', params.motorista)
    if (params?.status) q.set('status', params.status)
    if (params?.mes) q.set('mes', String(params.mes))
    if (params?.ano) q.set('ano', String(params.ano))
    return req(`/contratos/?${q}`)
  },
  criar: (data: any) => req('/contratos/', 'POST', data),
  atualizar: (id: string, data: any) => req(`/contratos/${id}`, 'PUT', data),
  excluir: (id: string) => req(`/contratos/${id}`, 'DELETE'),
}

export const frotasAPI = {
  listar: () => req('/frotas/'),
  criar: (data: any) => req('/frotas/', 'POST', data),
  atualizar: (id: string, data: any) => req(`/frotas/${id}`, 'PUT', data),
  excluir: (id: string) => req(`/frotas/${id}`, 'DELETE'),
}

export const caminhoesAPI = {
  listar: (frotaId?: string) => req(`/caminhoes/${frotaId ? `?frota_id=${frotaId}` : ''}`),
  criar: (data: any) => req('/caminhoes/', 'POST', data),
  atualizar: (id: string, data: any) => req(`/caminhoes/${id}`, 'PUT', data),
  excluir: (id: string) => req(`/caminhoes/${id}`, 'DELETE'),
}

export const usuariosAPI = {
  buscarPorLogin: (login: string) => req(`/usuarios/?login=eq.${login}&limit=1`),
  alterarSenha: (id: string, senha: string) => req(`/usuarios/${id}`, 'PUT', { senha, primeiro_acesso: false }),
}

export const abastecimentosAPI = {
  listar: (caminhao_id?: string) => req(`/abastecimentos/${caminhao_id ? `?caminhao_id=${caminhao_id}` : ''}`),
  criar: (data: any) => req('/abastecimentos/', 'POST', data),
  atualizar: (id: string, data: any) => req(`/abastecimentos/${id}`, 'PUT', data),
  excluir: (id: string) => req(`/abastecimentos/${id}`, 'DELETE'),
}