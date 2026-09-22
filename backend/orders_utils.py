from models import Product, ProductVariation, Payment

# o Mercado Pago escreve "canceled" (com um L). Deixo "cancelled" também, por segurança.
STATUS_ENCERRADO_MP = ('canceled', 'cancelled', 'expired')

# para onde cada status pode ir
STATUS_TRANSITIONS = {
    'pendente': ('cancelado',),
    'pago': ('enviado', 'cancelado'),
    'enviado': ('entregue',),
    'entregue': (),
    'cancelado': ()
}

def devolver_estoque(order):
    """Devolve pro estoque as peças de um pedido."""
    for item in order.items:
        if item.variation_id:
            variacao = ProductVariation.query.get(item.variation_id)
            if variacao:
                variacao.stock += item.quantity
        elif item.product_id:
            produto = Product.query.get(item.product_id)
            if produto and produto.stock is not None:
                produto.stock += item.quantity


def cancelar_pedido(order):
    """Cancela um pedido pendente e devolve o estoque."""
    # só cancela o que está pendente: assim o estoque nunca volta duas vezes
    if order.status != 'pendente':
        return False

    devolver_estoque(order)
    order.status = 'cancelado'

    pagamento = Payment.query.filter_by(order_id=order.id).first()
    if pagamento:
        pagamento.status = 'cancelado'

    return True


def marcar_como_pago(order):
    """Marca um pedido como pago."""
    if order.status == 'pago':
        return

    if order.status == 'cancelado':
        # não deveria acontecer, mas se acontecer, você precisa saber
        print(f'ATENÇÃO: pagamento aprovado no pedido #{order.id}, '
              f'que já estava cancelado. Verificar reembolso.')
        return

    order.status = 'pago'

    pagamento = Payment.query.filter_by(order_id=order.id).first()
    if pagamento:
        pagamento.status = 'aprovado'