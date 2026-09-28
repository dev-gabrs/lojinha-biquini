const BASE = 'http://127.0.0.1:5000/api';

export function getToken() {
  return localStorage.getItem('token');
}

export function setToken(token) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
}

async function request(caminho, opcoes = {}) {
  const headers = { 'Content-Type': 'application/json', ...opcoes.headers };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const resposta = await fetch(`${BASE}${caminho}`, { ...opcoes, headers });

  // token expirado ou inválido: limpa e avisa
  if (resposta.status === 401 && token) {
    clearToken();
  }

  let dados = null;
  try {
    dados = await resposta.json();
  } catch {
    dados = null;
  }

  if (!resposta.ok) {
    const mensagem = (dados && (dados.error || dados.msg)) || 'Algo deu errado';
    const erro = new Error(mensagem);
    erro.status = resposta.status;
    throw erro;
  }

  return dados;
}

export const api = {
  get: (caminho) => request(caminho),
  post: (caminho, corpo) => request(caminho, { method: 'POST', body: JSON.stringify(corpo || {}) }),
  put: (caminho, corpo) => request(caminho, { method: 'PUT', body: JSON.stringify(corpo || {}) }),
  patch: (caminho, corpo) => request(caminho, { method: 'PATCH', body: JSON.stringify(corpo || {}) }),
  del: (caminho) => request(caminho, { method: 'DELETE' })
};