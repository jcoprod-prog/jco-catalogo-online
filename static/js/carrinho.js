// C:\Users\Administrador\Desktop\backupPaiton\pdv-loja\app\static\js\carrinho.js
// VERSÃO AJUSTADA PARA USAR API, SEM DEPENDÊNCIA DE CACHE

// =================================================================================
// CHAVES DE ARMAZENAMENTO E CONSTANTES
// =================================================================================
const CART_STORAGE_KEY = 'jcoVendasCart';
const ORDERS_STORAGE_KEY = 'jcoVendasMyOrders'; // Chave para guardar os IDs dos pedidos do cliente
const MINIMUM_ORDER_VALUE = 0.10; // --- NOVO: Valor mínimo do pedido ---

// Variáveis Globais
let currentCartProducts = []; // Guarda os detalhes completos dos produtos que estão no carrinho
let currentTotalValue = 0; // --- NOVO: Guarda o valor total atual do carrinho ---

// =================================================================================
// INICIALIZAÇÃO
// =================================================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log("Página do carrinho carregada. Buscando detalhes dos produtos na API...");
    renderCart(); // A função agora é assíncrona

    const checkoutButton = document.getElementById('checkout-btn');
    if (checkoutButton) {
        checkoutButton.addEventListener('click', openCheckoutModal);
    }
});

// =================================================================================
// LÓGICA DE RENDERIZAÇÃO E MANIPULAÇÃO DO CARRINHO
// =================================================================================

/**
 * Função principal que lê o carrinho, busca os detalhes dos produtos na API e desenha a tela.
 * AGORA RETORNA o valor total calculado.
 */
async function renderCart() {
    const cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || {};
    const productIdsInCart = Object.keys(cart);

    const cartItemsContainer = document.getElementById('cart-items-container');
    const cartTotalSpan = document.getElementById('cart-total');
    const checkoutButton = document.getElementById('checkout-btn'); // Referência ao botão

    // Se o carrinho estiver vazio, exibe a mensagem e encerra.
    if (productIdsInCart.length === 0) {
        cartItemsContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Seu carrinho está vazio.</p>';
        cartTotalSpan.textContent = formatCurrency(0);
        checkoutButton.disabled = true;
        currentCartProducts = []; // Limpa a lista de produtos
        currentTotalValue = 0; // --- NOVO: Reseta o valor total ---
        return 0; // Retorna 0
    }

    checkoutButton.disabled = false; // Habilita por padrão se não estiver vazio
    cartItemsContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Carregando detalhes dos produtos...</p>';

    let grandTotal = 0; // Inicializa o total aqui

    try {
        const response = await fetch('/api/products/by-ids', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: productIdsInCart.map(id => parseInt(id)) })
        });

        if (!response.ok) {
            throw new Error("Não foi possível buscar os detalhes dos produtos.");
        }

        currentCartProducts = await response.json();

        cartItemsContainer.innerHTML = ''; // Limpa o "carregando"

        currentCartProducts.forEach(product => {
            const quantity = cart[product.id];

            if (!quantity) return;

            const subtotal = product.price_catalog * quantity;
            grandTotal += subtotal; // Acumula o total

            let imageUrl = 'https://via.placeholder.com/80';
            if (product.photo_path && typeof SUPABASE_URL !== 'undefined' && typeof BUCKET_NAME !== 'undefined') {
                 imageUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${product.photo_path}`;
            } else if (product.photo_path) {
                 console.warn("SUPABASE_URL or BUCKET_NAME not defined for image path:", product.photo_path);
                 // Poderia usar um placeholder local aqui se quisesse
            }


            const cartItemDiv = document.createElement('div');
            cartItemDiv.className = 'cart-item';
            cartItemDiv.innerHTML = `
                <img src="${imageUrl}" alt="${product.name}">
                <div class="cart-item-details">
                    <h4>${product.name}</h4>
                    <p class="item-price">${formatCurrency(product.price_catalog)} x ${quantity}</p>
                    <p class="item-subtotal">Subtotal: <strong>${formatCurrency(subtotal)}</strong></p>
                </div>
                <div class="quantity-selector">
                    <button class="quantity-btn" onclick="changeCartQuantity(${product.id}, -1)">-</button>
                    <span class="quantity-value">${quantity}</span>
                    <button class="quantity-btn" onclick="changeCartQuantity(${product.id}, 1)">+</button>
                </div>
            `;
            cartItemsContainer.appendChild(cartItemDiv);
        });

        cartTotalSpan.textContent = formatCurrency(grandTotal);
        currentTotalValue = grandTotal; // --- NOVO: Atualiza o valor total global ---

    } catch (error) {
        console.error("Erro ao renderizar carrinho:", error);
        cartItemsContainer.innerHTML = "<p>Erro ao carregar os detalhes dos produtos. Por favor, tente recarregar a página.</p>";
        checkoutButton.disabled = true; // Desabilita se deu erro
        currentTotalValue = 0; // --- NOVO: Reseta em caso de erro ---
    }
    return grandTotal; // Retorna o total calculado
}

/**
 * Altera a quantidade de um item no carrinho, com validação de estoque.
 */
function changeCartQuantity(productId, amount) {
    let cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || {};

    const product = currentCartProducts.find(p => p.id == productId);

    if (!product) {
        console.error("Produto não encontrado na lista atual do carrinho.");
        alert("Erro, por favor recarregue a página.");
        return;
    }

    const currentQuantity = cart[productId] || 0;
    const newQuantity = currentQuantity + amount;

    // Validação de estoque (APENAS se estiver aumentando a quantidade)
    if (amount > 0 && newQuantity > product.stock_quantity) {
        alert(`Desculpe, temos apenas ${product.stock_quantity} unidades de "${product.name}" em estoque.`);
        return;
    }

    if (newQuantity <= 0) {
        // Remove o item do carrinho
        delete cart[productId];
         // --- NOVO: Remove também da lista local para consistência ---
         currentCartProducts = currentCartProducts.filter(p => p.id != productId);
    } else {
        // Atualiza a quantidade
        cart[productId] = newQuantity;
    }

    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    renderCart(); // Re-renderiza o carrinho para refletir as mudanças e recalcular total
}

// =================================================================================
// LÓGICA DE FINALIZAÇÃO DO PEDIDO (CHECKOUT)
// =================================================================================

/**
 * Abre o modal de checkout APÓS verificar o valor mínimo do pedido.
 */
function openCheckoutModal() {
    const cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || {};
    if (Object.keys(cart).length === 0) {
        alert("Seu carrinho está vazio!");
        return;
    }

    // --- INÍCIO DA VALIDAÇÃO DO VALOR MÍNIMO (FRONTEND) ---
    if (currentTotalValue < MINIMUM_ORDER_VALUE) {
        alert(`Caro cliente, o valor total da sua compra ( ${formatCurrency(currentTotalValue)} ) é menor que o valor do pedido mínimo de ${formatCurrency(MINIMUM_ORDER_VALUE)}.`);
        return; // Impede a abertura do modal
    }
    // --- FIM DA VALIDAÇÃO DO VALOR MÍNIMO ---

    // Se chegou aqui, o valor é suficiente, abre o modal
    const modal = document.getElementById('checkout-modal');
    modal.style.display = 'flex';

    // Limpa o formulário ao abrir (caso tenha sido preenchido antes)
    document.getElementById('checkout-form').reset();

    document.getElementById('cancel-btn').onclick = function() {
        modal.style.display = 'none';
    };

    document.getElementById('checkout-form').onsubmit = function(event) {
        event.preventDefault();
        submitOrder();
    };
}

/**
 * Envia o pedido para a API.
 */
async function submitOrder() {
    const form = document.getElementById('checkout-form');
    const submitButton = document.getElementById('submit-order-btn');

    const clientName = form.querySelector('#client-name').value;
    const clientAddress = form.querySelector('#client-address').value;

    // Validação básica dos campos
    if (clientName.trim() === '' || clientAddress.trim() === '') {
        alert("Por favor, preencha seu nome completo e endereço.");
        return;
    }

    const clientData = {
        name: clientName,
        address: clientAddress,
        notes: form.querySelector('#client-notes').value
    };

    const cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || {};

    // Formata os itens para a API usando 'currentCartProducts'
    const itemsParaApi = {};
    let calculatedTotal = 0; // Recalcula o total aqui para segurança
    for (const productId in cart) {
        const product = currentCartProducts.find(p => p.id == productId);
        if (product) {
             const quantity = cart[productId];
            itemsParaApi[productId] = {
                product_id: parseInt(productId),
                quantity: quantity,
                price: product.price_catalog // Preço do catálogo
            };
            calculatedTotal += product.price_catalog * quantity;
        } else {
             // Caso raro: produto foi removido enquanto o modal estava aberto
            alert(`O produto com ID ${productId} não está mais disponível. Por favor, revise seu carrinho.`);
            return;
        }
    }

     // --- CHECK EXTRA (REDUNDANTE MAS SEGURO) DO VALOR MÍNIMO ANTES DO ENVIO ---
     if (calculatedTotal < MINIMUM_ORDER_VALUE) {
        alert(`Ocorreu um erro. O valor do pedido (${formatCurrency(calculatedTotal)}) está abaixo do mínimo de ${formatCurrency(MINIMUM_ORDER_VALUE)}. Por favor, atualize a página.`);
        return;
     }
     // --- FIM DO CHECK EXTRA ---

    const orderPayload = {
        client_info: clientData,
        items: itemsParaApi
    };

    submitButton.disabled = true;
    submitButton.textContent = 'Enviando...';

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload),
        });

        const result = await response.json(); // Tenta ler a resposta mesmo se não for ok

        if (!response.ok) {
            // Usa a mensagem de erro da API (que agora inclui o erro de valor mínimo)
            throw new Error(result.message || `Erro ${response.status}: Não foi possível criar o pedido.`);
        }

        // Sucesso!
        document.getElementById('checkout-modal').style.display = 'none';
        alert(`Pedido #${result.order_id} criado com sucesso!`);

        // Guarda o ID do pedido para a página "Meus Pedidos"
        const myOrderIds = JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY)) || [];
        if (!myOrderIds.includes(result.order_id)) { // Evita duplicados
             myOrderIds.push(result.order_id);
             localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(myOrderIds));
        }


        // Limpa o carrinho e redireciona
        localStorage.removeItem(CART_STORAGE_KEY);
        window.location.href = '/meus-pedidos'; // Redireciona para a página de confirmação/pedidos

    } catch (error) {
        console.error("Erro ao finalizar pedido:", error);
        alert(`Erro ao finalizar o pedido: ${error.message}`);
        submitButton.disabled = false;
        submitButton.textContent = 'Confirmar Pedido';
    }
}

// =================================================================================
// FUNÇÕES AUXILIARES
// =================================================================================

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}