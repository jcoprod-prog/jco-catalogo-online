// C:\Users\Administrador\Desktop\backupPaiton\pdv-loja\app\static\js\carrinho.js
// VERSÃO AJUSTADA PARA USAR API, SEM DEPENDÊNCIA DE CACHE

// AS VARIÁVEIS SUPABASE_URL E BUCKET_NAME AGORA VÊM DIRETAMENTE DO HTML!

// =================================================================================
// CHAVES DE ARMAZENAMENTO E CONSTANTES
// =================================================================================
const CART_STORAGE_KEY = 'jcoVendasCart';
const ORDERS_STORAGE_KEY = 'jcoMeusPedidos'; 
const MINIMUM_ORDER_VALUE = 0.10; 

// Variáveis Globais
let currentCartProducts = []; 
let currentTotalValue = 0; 

// =================================================================================
// INICIALIZAÇÃO
// =================================================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log("Página do carrinho carregada. Buscando detalhes dos produtos na API...");
    renderCart();

    const checkoutButton = document.getElementById('checkout-btn');
    if (checkoutButton) {
        checkoutButton.addEventListener('click', openCheckoutModal);
    }
});

// =================================================================================
// LÓGICA DE RENDERIZAÇÃO E MANIPULAÇÃO DO CARRINHO
// =================================================================================

async function renderCart() {
    const cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || {};
    const productIdsInCart = Object.keys(cart);

    const cartItemsContainer = document.getElementById('cart-items-container');
    const cartTotalSpan = document.getElementById('cart-total');
    const checkoutButton = document.getElementById('checkout-btn');

    if (productIdsInCart.length === 0) {
        cartItemsContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Seu carrinho está vazio.</p>';
        cartTotalSpan.textContent = formatCurrency(0);
        checkoutButton.disabled = true;
        currentCartProducts = []; 
        currentTotalValue = 0; 
        return 0; 
    }

    checkoutButton.disabled = false;
    cartItemsContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Carregando detalhes dos produtos...</p>';

    let grandTotal = 0;

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
        cartItemsContainer.innerHTML = ''; 

        currentCartProducts.forEach(product => {
            const quantity = cart[product.id];
            if (!quantity) return;

            const subtotal = product.price_catalog * quantity;
            grandTotal += subtotal; 

            let imageUrl = 'https://via.placeholder.com/80';
            // O JS vai achar a URL e o BUCKET que foram declarados no HTML!
            if (product.photo_path && typeof SUPABASE_URL !== 'undefined' && typeof BUCKET_NAME !== 'undefined') {
                 imageUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${product.photo_path}`;
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
        currentTotalValue = grandTotal; 

    } catch (error) {
        console.error("Erro ao renderizar carrinho:", error);
        cartItemsContainer.innerHTML = "<p>Erro ao carregar os detalhes dos produtos. Por favor, tente recarregar a página.</p>";
        checkoutButton.disabled = true; 
        currentTotalValue = 0; 
    }
    return grandTotal; 
}

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

    if (amount > 0 && newQuantity > product.stock_quantity) {
        alert(`Desculpe, temos apenas ${product.stock_quantity} unidades de "${product.name}" em estoque.`);
        return;
    }

    if (newQuantity <= 0) {
        delete cart[productId];
         currentCartProducts = currentCartProducts.filter(p => p.id != productId);
    } else {
        cart[productId] = newQuantity;
    }

    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    renderCart(); 
}

// =================================================================================
// LÓGICA DE FINALIZAÇÃO DO PEDIDO (CHECKOUT)
// =================================================================================

function openCheckoutModal() {
    const cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || {};
    if (Object.keys(cart).length === 0) {
        alert("Seu carrinho está vazio!");
        return;
    }

    if (currentTotalValue < MINIMUM_ORDER_VALUE) {
        alert(`Caro cliente, o valor total da sua compra (${formatCurrency(currentTotalValue)}) é menor que o valor mínimo de entrega de ${formatCurrency(MINIMUM_ORDER_VALUE)}.`);
        return; 
    }

    const modal = document.getElementById('checkout-modal');
    modal.style.display = 'flex';
    document.getElementById('checkout-form').reset();

    document.getElementById('cancel-btn').onclick = function() {
        modal.style.display = 'none';
    };

    document.getElementById('checkout-form').onsubmit = function(event) {
        event.preventDefault();
        submitOrder();
    };
}

async function submitOrder() {
    const form = document.getElementById('checkout-form');
    const submitButton = document.getElementById('submit-order-btn');

    const clientName = form.querySelector('#client-name').value;
    const clientAddress = form.querySelector('#client-address').value;

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
    const itemsParaApi = {};
    let calculatedTotal = 0; 
    
    for (const productId in cart) {
        const product = currentCartProducts.find(p => p.id == productId);
        if (product) {
             const quantity = cart[productId];
            itemsParaApi[productId] = {
                product_id: parseInt(productId),
                quantity: quantity,
                price: product.price_catalog
            };
            calculatedTotal += product.price_catalog * quantity;
        } else {
            alert(`O produto com ID ${productId} não está mais disponível. Por favor, revise seu carrinho.`);
            return;
        }
    }

     if (calculatedTotal < MINIMUM_ORDER_VALUE) {
        alert(`Ocorreu um erro. O valor do pedido (${formatCurrency(calculatedTotal)}) está abaixo do mínimo de ${formatCurrency(MINIMUM_ORDER_VALUE)}.`);
        return;
     }

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

        const result = await response.json(); 

        if (!response.ok) {
            throw new Error(result.message || `Erro ${response.status}: Não foi possível criar o pedido.`);
        }

        document.getElementById('checkout-modal').style.display = 'none';
        
        // GUARDA O NÚMERO DO PEDIDO NA MEMÓRIA COM A CHAVE CORRETA
        const myOrderIds = JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY)) || [];
        if (!myOrderIds.includes(result.order_id)) {
             myOrderIds.push(result.order_id);
             localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(myOrderIds));
        }

        // Limpa o carrinho e redireciona
        localStorage.removeItem(CART_STORAGE_KEY);
        window.location.href = '/meus-pedidos'; 

    } catch (error) {
        console.error("Erro ao finalizar pedido:", error);
        alert(`Erro ao finalizar o pedido: ${error.message}`);
        submitButton.disabled = false;
        submitButton.textContent = 'Confirmar Pedido';
    }
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}