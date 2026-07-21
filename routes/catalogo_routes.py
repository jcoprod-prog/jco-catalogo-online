@catalogo_bp.route('/api/product_categories')
def api_categories():
    supabase = get_supabase()
    if not supabase:
        return jsonify({"items": []})
        
    # Busca todas as categorias
    resposta = supabase.table('categorias_nuvem').select('*').execute()
    
    # Colocamos os dados dentro de "items" para o JS reconhecer
    return jsonify({"items": resposta.data})

@catalogo_bp.route('/api/products')
def api_products():
    supabase = get_supabase()
    if not supabase:
        return jsonify({"items": [], "total": 0})
        
    # Busca todos os produtos ativos
    resposta = supabase.table('produtos_nuvem').select('*').eq('ativo', True).execute()
    
    # Trocamos "data" por "items" para agradar o catalogo.js
    return jsonify({
        "items": resposta.data,
        "total": len(resposta.data)
    })