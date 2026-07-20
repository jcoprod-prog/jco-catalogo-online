import os
from flask import Blueprint, jsonify, render_template
from supabase import create_client, Client

catalogo_bp = Blueprint('catalogo', __name__)

# --- ROTAS DAS PÁGINAS HTML ---
@catalogo_bp.route('/')
def index():
    return render_template('catalogo.html')

@catalogo_bp.route('/carrinho')
def carrinho():
    return render_template('carrinho.html')

# --- FUNÇÃO PARA CONECTAR AO SUPABASE ---
def get_supabase() -> Client:
    # O Render vai fornecer essas variáveis automaticamente
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if url and key:
        return create_client(url, key)
    return None

# --- ROTAS DE API (As portas que o catalogo.js está chamando) ---

@catalogo_bp.route('/api/banners')
def api_banners():
    supabase = get_supabase()
    if not supabase:
        return jsonify([]) # Retorna vazio se não houver conexão
    
    # Busca os banners ativos na tabela do Supabase
    resposta = supabase.table('banners_nuvem').select('*').eq('ativo', True).execute()
    return jsonify(resposta.data)

@catalogo_bp.route('/api/product_categories')
def api_categories():
    supabase = get_supabase()
    if not supabase:
        return jsonify([])
        
    # Busca todas as categorias
    resposta = supabase.table('categorias_nuvem').select('*').execute()
    return jsonify(resposta.data)

@catalogo_bp.route('/api/products')
def api_products():
    supabase = get_supabase()
    if not supabase:
        return jsonify({"data": [], "total": 0})
        
    # Busca todos os produtos ativos
    resposta = supabase.table('produtos_nuvem').select('*').eq('ativo', True).execute()
    
    # Retornamos dentro de "data" pois muitos scripts JS com paginação esperam esse formato
    return jsonify({
        "data": resposta.data,
        "total": len(resposta.data)
    })