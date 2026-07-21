import os
from flask import Blueprint, jsonify, render_template
from supabase import create_client, Client

# Cria o Blueprint que o erro disse que estava faltando
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
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if url and key:
        return create_client(url, key)
    return None

# --- ROTAS DE API ---
@catalogo_bp.route('/api/banners')
def api_banners():
    supabase = get_supabase()
    if not supabase:
        return jsonify([]) 
    
    resposta = supabase.table('banners_nuvem').select('*').eq('ativo', True).execute()
    return jsonify(resposta.data)

@catalogo_bp.route('/api/product_categories')
def api_categories():
    supabase = get_supabase()
    if not supabase:
        return jsonify({"items": []})
        
    resposta = supabase.table('categorias_nuvem').select('*').execute()
    return jsonify({"items": resposta.data})

@catalogo_bp.route('/api/products')
def api_products():
    supabase = get_supabase()
    if not supabase:
        return jsonify({"items": [], "total": 0})
        
    resposta = supabase.table('produtos_nuvem').select('*').eq('ativo', True).execute()
    return jsonify({
        "items": resposta.data,
        "total": len(resposta.data)
    })