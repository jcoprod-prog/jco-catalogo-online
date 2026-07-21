import os
from flask import Blueprint, jsonify, render_template, request
from supabase import create_client, Client

catalogo_bp = Blueprint('catalogo', __name__)

@catalogo_bp.route('/')
def pagina_catalogo():
    return render_template('catalogo.html')

@catalogo_bp.route('/carrinho')
def carrinho():
    return render_template('carrinho.html')

def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if url and key:
        return create_client(url, key)
    return None

@catalogo_bp.route('/api/banners')
def api_banners():
    supabase = get_supabase()
    if not supabase:
        return jsonify([]) 
    resposta = supabase.table('banners_nuvem').select('*').execute()
    return jsonify(resposta.data)

@catalogo_bp.route('/api/product_categories')
def api_categories():
    supabase = get_supabase()
    if not supabase:
        return jsonify({"items": []})
        
    resposta = supabase.table('categorias_nuvem').select('*').execute()
    
    categorias = []
    for cat in resposta.data:
        categorias.append({
            "id": cat.get("id"),
            "name": cat.get("nome", cat.get("name", "Sem Nome")),
            "photo_path": cat.get("caminho_foto", cat.get("photo_path", ""))
        })
        
    return jsonify({"items": categorias})

@catalogo_bp.route('/api/products')
def api_products():
    supabase = get_supabase()
    if not supabase:
        return jsonify({"items": [], "total": 0})
        
    # Busca TUDO, sem filtro de categoria ou de ativo
    resposta = supabase.table('produtos_nuvem').select('*').execute()
    
    produtos = []
    for prod in resposta.data:
        produtos.append({
            "id": prod.get("id"),
            # Se não achar a coluna, coloca um nome de alerta
            "name": prod.get("nome") or prod.get("name") or "Produto Misterioso",
            "description": prod.get("descricao") or prod.get("description") or "Sem descrição",
            "price_catalog": prod.get("preco_catalogo") or prod.get("price_catalog") or 0.0,
            "stock_quantity": prod.get("estoque_atual") or prod.get("stock_quantity") or 10,
            "photo_path": prod.get("caminho_foto") or prod.get("photo_path") or ""
        })
        
    return jsonify({
        "items": produtos,
        "total": len(produtos)
    })
    
@catalogo_bp.route('/api/products/by-ids', methods=['POST'])
def api_products_by_ids():
    supabase = get_supabase()
    if not supabase:
        return jsonify([])

    dados = request.get_json() or {}
    
    # O JavaScript pode enviar uma lista direta [1, 2] ou um dicionário {"ids": [1, 2]}
    ids = dados.get('ids', []) if isinstance(dados, dict) else dados

    if not ids:
        return jsonify([])

    # Busca no banco de dados apenas os produtos que estão na lista de IDs
    resposta = supabase.table('produtos_nuvem').select('*').in_('id', ids).execute()

    # Aplica o nosso tradutor para o JavaScript entender
    produtos = []
    for prod in resposta.data:
        produtos.append({
            "id": prod.get("id"),
            "name": prod.get("nome") or prod.get("name") or "Produto Misterioso",
            "description": prod.get("descricao") or prod.get("description") or "",
            "price_catalog": prod.get("preco_catalogo") or prod.get("price_catalog") or 0.0,
            "stock_quantity": prod.get("estoque_atual") or prod.get("stock_quantity") or 0,
            "photo_path": prod.get("caminho_foto") or prod.get("photo_path") or ""
        })

    return jsonify(produtos)

@catalogo_bp.route('/api/orders', methods=['POST'])
def api_orders():
    supabase = get_supabase()
    if not supabase:
        return jsonify({"message": "Erro de conexão com o banco"}), 500

    dados = request.get_json() or {}
    client_info = dados.get('client_info', {})
    items = dados.get('items', {})
    
    if not client_info or not items:
        return jsonify({"message": "Dados incompletos"}), 400
        
    # 1. Calcula o total do pedido somando (quantidade * preço) de cada item
    total = 0.0
    for key, item in items.items():
        total += float(item.get('quantity', 0)) * float(item.get('price', 0.0))
        
    # 2. Prepara os dados para a tabela pedidos_nuvem
    pedido_data = {
        "cliente_nome": client_info.get('name', 'Sem nome'),
        "cliente_endereco": client_info.get('address', ''),
        "observacoes": client_info.get('notes', ''),
        "total": total,
        "status": "pendente"
    }
    
    # Grava o pedido principal
    resp_pedido = supabase.table('pedidos_nuvem').insert(pedido_data).execute()
    
    if not resp_pedido.data:
        return jsonify({"message": "Erro ao criar pedido"}), 500
        
    # Pega o ID (número) do pedido que acabou de ser gerado no banco
    pedido_id = resp_pedido.data[0]['id']
    
    # 3. Prepara os itens para a tabela itens_pedido_nuvem
    itens_data = []
    for key, item in items.items():
        itens_data.append({
            "pedido_id": pedido_id,
            "produto_id": item.get('product_id'),
            "quantidade": item.get('quantity'),
            "preco_unitario": item.get('price')
        })
        
    # Grava os itens vinculados ao ID do pedido
    if itens_data:
        supabase.table('itens_pedido_nuvem').insert(itens_data).execute()
        
    print(f"PEDIDO GRAVADO COM SUCESSO NO BANCO! ID: {pedido_id}")
    
    # Devolve a resposta de sucesso para o carrinho
    return jsonify({
        "order_id": pedido_id,
        "message": "Pedido recebido com sucesso!"
    }), 200

# Rota para evitar o erro 404 quando o JS redirecionar
@catalogo_bp.route('/meus-pedidos')
def meus_pedidos():
    # Como ainda não montamos a tela complexa de histórico, devolvemos uma tela de sucesso provisória
    return """
    <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h2 style="color: #28a745;">Pedido Finalizado com Sucesso!</h2>
        <p>O seu pedido foi enviado para o Mercadinho Oliveira.</p>
        <br>
        <a href="/" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Voltar ao Catálogo</a>
    </div>
    """