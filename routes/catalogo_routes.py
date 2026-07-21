import os
from flask import Blueprint, jsonify, render_template, request
from supabase import create_client, Client

catalogo_bp = Blueprint('catalogo', __name__)

@catalogo_bp.route('/')
def index():
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
    
    # TRADUTOR: Converte 'nome' (banco) para 'name' (javascript)
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
        
    # Pega qual categoria o usuário clicou no menu
    category_id = request.args.get('category_id')
        
    # Busca todos os produtos na nuvem
    resposta = supabase.table('produtos_nuvem').select('*').execute()
    
    # TRADUTOR: Converte as colunas para o que o JS espera e aplica o filtro
    produtos = []
    for prod in resposta.data:
        # Se estiver inativo, pula ele
        is_ativo = prod.get("ativo", prod.get("active", True))
        if not is_ativo:
            continue 
            
        # Verifica se o produto pertence à categoria clicada
        id_da_categoria = str(prod.get("categoria_id", prod.get("category_id")))
        if category_id and id_da_categoria != str(category_id):
            continue
            
        produtos.append({
            "id": prod.get("id"),
            "name": prod.get("nome", prod.get("name", "Produto sem nome")),
            "description": prod.get("descricao", prod.get("description", "")),
            "price_catalog": prod.get("preco_catalogo", prod.get("price_catalog", 0)),
            "stock_quantity": prod.get("estoque_atual", prod.get("stock_quantity", 0)),
            "photo_path": prod.get("caminho_foto", prod.get("photo_path", ""))
        })
        
    return jsonify({
        "items": produtos,
        "total": len(produtos)
    })