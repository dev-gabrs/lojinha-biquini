import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const STATUS = {
  pendente: { texto: 'Aguardando pagamento', cor: '#8A7A95' },
  pago: { texto: 'Pago', cor: '#2E9E5B' },
  enviado: { texto: 'Enviado', cor: '#6B3FA0' },
  entregue: { texto: 'Entregue', cor: '#4A4553' },
  cancelado: { texto: 'Cancelado', cor: '#B8341A' }
};

const PROXIMO = {
  pago: { status: 'enviado', rotulo: 'Marcar como enviado' },
  enviado: { status: 'entregue', rotulo: 'Marcar como entregue' }
};

function formatarData(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatarReais(valor) {
  return 'R$ ' + Number(valor).toFixed(2).replace('.', ',');
}

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mudando, setMudando] = useState(null);
  const navegar = useNavigate();

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      const caminho = filtro ? `/admin/orders?status=${filtro}` : '/admin/orders';
      const dados = await api.get(caminho);
      setPedidos(dados.pedidos);
    } catch (e) {
      if (e.status === 401) {
        navegar('/admin/login');
        return;
      }
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [filtro]);

  async function mudarStatus(pedido, novoStatus) {
    setMudando(pedido.id);
    setErro('');
    try {
      await api.patch(`/admin/orders/${pedido.id}/status`, { status: novoStatus });
      await carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setMudando(null);
    }
  }

  return (
    <div style={estilos.pagina}>
      <div style={estilos.conteudo}>
        <h2 style={estilos.titulo}>Pedidos</h2>

        <div style={estilos.filtros}>
          {[['', 'Todos'], ...Object.entries(STATUS).map(([k, v]) => [k, v.texto])].map(([valor, rotulo]) => (
            <button
              key={valor}
              onClick={() => setFiltro(valor)}
              style={{
                ...estilos.filtro,
                ...(filtro === valor ? estilos.filtroAtivo : {})
              }}
            >
              {rotulo}
            </button>
          ))}
        </div>

        {erro && <p style={estilos.erro}>{erro}</p>}
        {carregando && <p style={estilos.aviso}>Carregando...</p>}
        {!carregando && pedidos.length === 0 && <p style={estilos.aviso}>Nenhum pedido aqui.</p>}

        {pedidos.map((pedido) => {
          const info = STATUS[pedido.status] || { texto: pedido.status, cor: 'var(--cinza)' };
          const proximo = PROXIMO[pedido.status];

          return (
            <div key={pedido.id} style={estilos.cartao}>
              <div style={estilos.cabecalhoCartao}>
                <div>
                  <strong style={estilos.numero}>Pedido #{pedido.id}</strong>
                  <span style={estilos.data}>{formatarData(pedido.created_at)}</span>
                </div>
                <span style={{ ...estilos.selo, background: info.cor }}>{info.texto}</span>
              </div>

              <div style={estilos.cliente}>
                <strong>{pedido.cliente.nome}</strong> · {pedido.cliente.email}
                {pedido.telefone && <> · {pedido.telefone}</>}
              </div>

              <ul style={estilos.itens}>
                {pedido.items.map((item) => (
                  <li key={item.id}>
                    {item.quantity}x {item.product_name}
                    {(item.size || item.color) && ` (${[item.size, item.color].filter(Boolean).join(' / ')})`}
                    {' — '}{formatarReais(item.subtotal)}
                  </li>
                ))}
              </ul>

              <div style={estilos.entrega}>
                {pedido.tipo_entrega === 'entrega' && pedido.endereco_entrega ? (
                  <>
                    <strong>Entrega:</strong> {pedido.endereco_entrega.rua}, {pedido.endereco_entrega.numero}
                    {pedido.endereco_entrega.complemento && ` — ${pedido.endereco_entrega.complemento}`}
                    {' · '}{pedido.endereco_entrega.bairro}
                    {pedido.endereco_entrega.referencia && (
                      <div style={estilos.referencia}>Referência: {pedido.endereco_entrega.referencia}</div>
                    )}
                  </>
                ) : (
                  <><strong>Retirada</strong> — combinar com a cliente</>
                )}
              </div>

              <div style={estilos.rodapeCartao}>
                <strong style={estilos.total}>{formatarReais(pedido.total)}</strong>
                {proximo && (
                  <button
                    onClick={() => mudarStatus(pedido, proximo.status)}
                    disabled={mudando === pedido.id}
                    style={estilos.acao}
                  >
                    {mudando === pedido.id ? 'Salvando...' : proximo.rotulo}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const estilos = {
  conteudo: { maxWidth: 820, margin: '0 auto', padding: '28px 20px 60px' },
  titulo: { fontSize: 15, marginBottom: 18 },
  filtros: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 },
  filtro: {
    background: '#fff',
    border: '1px solid var(--borda)',
    borderRadius: 20,
    padding: '7px 14px',
    fontSize: 12,
    color: 'var(--cinza)'
  },
  filtroAtivo: { background: 'var(--lilas-escuro)', color: '#fff', borderColor: 'var(--lilas-escuro)' },
  cartao: {
    background: '#fff',
    border: '1px solid var(--borda)',
    borderRadius: 12,
    padding: 18,
    marginBottom: 14
  },
  cabecalhoCartao: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  numero: { fontSize: 15, display: 'block' },
  data: { fontSize: 12, color: 'var(--cinza)' },
  selo: {
    color: '#fff',
    fontSize: 11,
    padding: '5px 10px',
    borderRadius: 20,
    whiteSpace: 'nowrap'
  },
  cliente: { fontSize: 13, color: 'var(--cinza)', marginTop: 12 },
  itens: { fontSize: 13, paddingLeft: 18, margin: '12px 0', lineHeight: 1.7 },
  entrega: {
    fontSize: 13,
    background: 'var(--fundo)',
    borderRadius: 8,
    padding: '10px 12px',
    lineHeight: 1.6
  },
  referencia: { color: 'var(--cinza)', marginTop: 4 },
  rodapeCartao: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    gap: 12
  },
  total: { fontSize: 17 },
  acao: {
    background: 'var(--lilas-escuro)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 16px',
    fontSize: 12,
    letterSpacing: '0.1em',
    textTransform: 'uppercase'
  },
  erro: {
    background: '#FFF0EC',
    color: '#B8341A',
    fontSize: 13,
    padding: '10px 12px',
    borderRadius: 8
  },
  aviso: { color: 'var(--cinza)', fontSize: 14 }
};