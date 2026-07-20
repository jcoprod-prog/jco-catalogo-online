from flask import Flask

def create_app():
    app = Flask(__name__)

    # Importa e registra as rotas do catálogo
    from routes.catalogo_routes import catalogo_bp
    app.register_blueprint(catalogo_bp)

    return app

app = create_app()

if __name__ == '__main__':
    # Roda o servidor localmente na porta 5001 para não conflitar com seu PDV
    app.run(debug=True, port=5001)