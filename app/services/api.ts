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
  listar: (busca = '') => req(`/api/motoristas/${busca ? `?busca=${busca}` : ''}`),
  criar: (data: any) => req('/api/motoristas/', 'POST', data),
  atualizar: (id: string, data: any) => req(`/api/motoristas/${id}`, 'PUT', data),
  excluir: (id: string) => req(`/api/motoristas/${id}`, 'DELETE'),
}

export const contratosAPI = {
  listar: (params?: { motorista?: string; status?: string; mes?: number; ano?: number }) => {
    const q = new URLSearchParams()
    if (params?.motorista) q.set('motorista', params.motorista)
    if (params?.status) q.set('status', params.status)
    if (params?.mes) q.set('mes', String(params.mes))
    if (params?.ano) q.set('ano', String(params.ano))
    return req(`/api/contratos/?${q}`)
  },
  criar: (data: any) => req('/api/contratos/', 'POST', data),
  atualizar: (id: string, data: any) => req(`/api/contratos/${id}`, 'PUT', data),
  excluir: (id: string) => req(`/api/contratos/${id}`, 'DELETE'),
}

export const frotasAPI = {
  listar: () => req('/api/frotas/'),
  criar: (data: any) => req('/api/frotas/', 'POST', data),
  atualizar: (id: string, data: any) => req(`/api/frotas/${id}`, 'PUT', data),
  excluir: (id: string) => req(`/api/frotas/${id}`, 'DELETE'),
}

export const caminhoesAPI = {
  listar: (frotaId?: string) => req(`/api/caminhoes/${frotaId ? `?frota_id=${frotaId}` : ''}`),
  criar: (data: any) => req('/api/caminhoes/', 'POST', data),
  atualizar: (id: string, data: any) => req(`/api/caminhoes/${id}`, 'PUT', data),
  excluir: (id: string) => req(`/api/caminhoes/${id}`, 'DELETE'),
}