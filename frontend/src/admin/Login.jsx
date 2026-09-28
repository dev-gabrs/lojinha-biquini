import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const navegar = useNavigate();

  async function entrar(evento) {
    evento.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      const dados = await api.post('/auth/login', { email, password: senha });
      setToken(dados.token);
      navegar('/admin/pedidos');
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={estilos.tela}>
      <form onSubmit={entrar} style={estilos.caixa}>
        <h1 style={estilos.marca}>Biquínis_PF</h1>
        <p style={estilos.sub}>Painel da loja</p>

        <label style={estilos.rotulo}>E-mail</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={estilos.campo}
          required
        />

        <label style={estilos.rotulo}>Senha</label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          style={estilos.campo}
          required
        />

        {erro && <p style={estilos.erro}>{erro}</p>}

        <button type="submit" disabled={carregando} style={estilos.botao}>
          {carregando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

const estilos = {
  tela: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  caixa: {
    background: '#fff',
    border: '1px solid var(--borda)',
    borderRadius: 14,
    padding: 32,
    width: '100%',
    maxWidth: 380,
    display: 'flex',
    flexDirection: 'column'
  },
  marca: {
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 4
  },
  sub: {
    textAlign: 'center',
    color: 'var(--cinza)',
    fontSize: 13,
    marginTop: 0,
    marginBottom: 28
  },
  rotulo: {
    fontSize: 13,
    color: 'var(--cinza)',
    marginBottom: 6
  },
  campo: {
    fontFamily: 'var(--corpo)',
    fontSize: 15,
    padding: '11px 13px',
    border: '1px solid var(--borda)',
    borderRadius: 9,
    marginBottom: 18,
    background: 'var(--fundo)'
  },
  erro: {
    background: '#FFF0EC',
    color: '#B8341A',
    fontSize: 13,
    padding: '10px 12px',
    borderRadius: 8,
    marginTop: 0,
    marginBottom: 16
  },
  botao: {
    background: 'var(--lilas-escuro)',
    color: '#fff',
    border: 'none',
    borderRadius: 9,
    padding: '13px',
    fontSize: 13,
    letterSpacing: '0.12em',
    textTransform: 'uppercase'
  }
};