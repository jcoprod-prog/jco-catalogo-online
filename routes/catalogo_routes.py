from flask import Blueprint, render_template
import time

catalogo_bp = Blueprint('catalogo', __name__, template_folder='../templates')

@catalogo_bp.route('/catalogo')
@catalogo_bp.route('/') 
def pagina_catalogo():
    version_timestamp = int(time.time())
    supabase_url = "https://SUA_URL.supabase.co" 
    
    return render_template('catalogo.html', version_timestamp=version_timestamp, config={"SUPABASE_URL": supabase_url})

@catalogo_bp.route('/carrinho')
def pagina_carrinho():
    return render_template('carrinho.html')

@catalogo_bp.route('/meus-pedidos')
def meus_pedidos_page():
    return render_template('meus_pedidos.html')