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
            # 👇 CORREÇÃO: Agora ele busca exatamente a coluna 'foto_path' que está no seu Supabase!
            "photo_path": cat.get("foto_path", "")
        })
        
    return jsonify({"items": categorias})

@catalogo_bp.route('/api/products')
def api_products():
    supabase = get_supabase()
    if not supabase:
        return jsonify({"items": [], "total": 0})
        
    # Pega qual categoria o usuário clicou no menu (se houver)
    category_id = request.args.get('category_id')
        
    # Traz do maior ID para o menor (ordem decrescente / novidades primeiro)
    resposta = supabase.table('produtos_nuvem').select('*').order('id', desc=True).execute()
    
    produtos = []
    for prod in resposta.data:
        # 1. Só exibe o produto se ele estiver marcado como ativo
        is_ativo = prod.get("ativo", prod.get("active", True))
        if not is_ativo:
            continue 
            
        # 2. VERIFICAÇÃO DE ESTOQUE: Se for nulo, zero ou negativo, esconde o produto
        estoque = prod.get("estoque_atual", prod.get("stock_quantity", 0))
        try:
            # Tenta converter para número. Se for menor ou igual a 0, pula e não mostra
            if estoque is None or float(estoque) <= 0:
                continue
        except (ValueError, TypeError):
            # Se vier algum texto ou dado corrompido que não é número, esconde por segurança
            continue
            
        # 3. Filtra pela categoria escolhida (se o usuário clicou em alguma)
        id_da_categoria = str(prod.get("categoria_id", prod.get("category_id")))
        if category_id and id_da_categoria != str(category_id):
            continue
            
        produtos.append({
            "id": prod.get("id"),
            "name": prod.get("nome", prod.get("name", "Produto sem nome")),
            "description": prod.get("descricao", prod.get("description", "")),
            "price_catalog": prod.get("preco_catalogo", prod.get("price_catalog", 0)),
            "stock_quantity": estoque,
            "photo_path": prod.get("foto_path", prod.get("caminho_foto", ""))
            
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
            "photo_path": prod.get("foto_path") or prod.get("caminho_foto") or ""
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
    return render_template('meus_pedidos.html')

@catalogo_bp.route('/api/meus_pedidos', methods=['POST'])
def api_meus_pedidos():
    supabase = get_supabase()
    if not supabase:
        return jsonify({"message": "Erro de conexão"}), 500

    dados = request.get_json() or {}
    order_ids = dados.get('order_ids', [])

    if not order_ids:
        return jsonify([])

    # 1. Busca os pedidos principais na nuvem
    resp_pedidos = supabase.table('pedidos_nuvem').select('*').in_('id', order_ids).execute()
    pedidos = resp_pedidos.data
    if not pedidos:
        return jsonify([])

    # 2. Busca os itens desses pedidos
    resp_itens = supabase.table('itens_pedido_nuvem').select('*').in_('pedido_id', order_ids).execute()
    itens = resp_itens.data

    # 3. Busca o nome dos produtos usando os IDs dos itens
    produto_ids = list(set([item['produto_id'] for item in itens]))
    produtos_dict = {}
    if produto_ids:
        # CORREÇÃO: Pedimos apenas as colunas 'id' e 'nome'
        resp_produtos = supabase.table('produtos_nuvem').select('id, nome').in_('id', produto_ids).execute()
        for p in resp_produtos.data:
            produtos_dict[str(p['id'])] = p.get('nome') or "Produto Misterioso"

    # 4. Junta tudo para o JavaScript exibir na tela bonitinho
    for pedido in pedidos:
        pedido['itens_detalhados'] = []
        for item in itens:
            if str(item['pedido_id']) == str(pedido['id']):
                pedido['itens_detalhados'].append({
                    "nome": produtos_dict.get(str(item['produto_id']), "Produto"),
                    "quantidade": item.get('quantidade', 1),
                    "preco_unitario": item.get('preco_unitario', 0.0)
                })

    # Ordena para o pedido mais novo aparecer no topo
    pedidos.sort(key=lambda x: x['id'], reverse=True)

    return jsonify(pedidos)

@catalogo_bp.route('/api/registrar_acesso', methods=['POST'])
def api_registrar_acesso():
    supabase = get_supabase()
    if not supabase:
        return jsonify({"status": "erro"}), 500

    dados = request.get_json() or {}
    nome = dados.get('nome', 'Desconhecido')
    whatsapp = dados.get('whatsapp', 'Não informado')
    
    navegador = request.user_agent.string if request.user_agent else ''
    if 'Android' in navegador:
        aparelho = 'Celular Android'
    elif 'iPhone' in navegador:
        aparelho = 'iPhone'
    elif 'Windows' in navegador:
        aparelho = 'Computador Windows'
    else:
        aparelho = 'Outro'

    registro = {
        "visitante": nome,
        "whatsapp": whatsapp,
        "aparelho": aparelho
    }
    
    try:
        # Salva o nome e whatsapp reais no banco de dados
        supabase.table('registro_acessos').insert(registro).execute()
    except Exception as e:
        print("Erro ao registrar acesso:", e)
        # Plano B caso a coluna whatsapp não tenha sido criada corretamente
        try:
            registro_b = {"visitante": f"{nome} - {whatsapp}", "aparelho": aparelho}
            supabase.table('registro_acessos').insert(registro_b).execute()
        except:
            pass
        
    return jsonify({"status": "ok"}), 200