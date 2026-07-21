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