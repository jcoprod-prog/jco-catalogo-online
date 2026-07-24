// ============================================================================================
// ARQUIVO: static/js/catalogo.js
// DESCRIÇÃO: Lógica do frontend para o catálogo online de produtos.
// VERSÃO: CORRIGIDA (Botão Voltar do Celular fecha Zoom + Memória de Categoria)
// ============================================================================================

// AS VARIÁVEIS SUPABASE_URL E BUCKET_NAME AGORA VÊM DIRETAMENTE DO HTML!

const CART_STORAGE_KEY = 'jcoVendasCart';
let cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || {};
let allProducts = []; 
let debounceTimer;

// Variáveis de estado para paginação e memória
let currentPage = 1;
let hasMoreProducts = true;
let isLoading = false; 
let currentCategoryId = null; 

document.addEventListener('DOMContentLoaded', function() {
    
    /// =========================================================
    // === INÍCIO: SISTEMA DA TELA DE BOAS VINDAS E REGISTRO ===
    // =========================================================
    const modalBoasVindas = document.getElementById('modal-boas-vindas');
    const formBoasVindas = document.getElementById('form-boas-vindas');

    let clienteNome = localStorage.getItem('jcoClienteNome');
    let clienteZap = localStorage.getItem('jcoClienteZap');
    
    // NOVO: Verifica qual foi o dia da última visita
    let ultimaVisita = localStorage.getItem('jcoUltimaVisita');
    const dataHoje = new Date().toLocaleDateString(); // Ex: "21/07/2026"

    if (!clienteNome || !clienteZap) {
        if (modalBoasVindas) {
            modalBoasVindas.style.display = 'flex';
            document.body.style.overflow = 'hidden'; 
        }
    } else {
        // Só avisa o Supabase se a última visita NÃO foi hoje
        if (ultimaVisita !== dataHoje) {
            registrarAcesso(clienteNome, clienteZap);
            localStorage.setItem('jcoUltimaVisita', dataHoje); // Atualiza pro dia de hoje
        }
    }

    if (formBoasVindas) {
        formBoasVindas.addEventListener('submit', (e) => {
            e.preventDefault(); 
            const nomeInput = document.getElementById('bv-nome').value.trim();
            const zapInput = document.getElementById('bv-whatsapp').value.trim();

            if(nomeInput && zapInput) {
                localStorage.setItem('jcoClienteNome', nomeInput);
                localStorage.setItem('jcoClienteZap', zapInput);
                localStorage.setItem('jcoUltimaVisita', dataHoje); // Salva o dia de hoje
                
                modalBoasVindas.style.display = 'none';
                document.body.style.overflow = 'auto'; 
                
                registrarAcesso(nomeInput, zapInput);
            }
        });
    }

    function registrarAcesso(nome, zap) {
        fetch('/api/registrar_acesso', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: nome, whatsapp: zap })
        }).catch(e => console.log("Erro no registro silencioso", e));
    }
    // =========================================================
    // === FIM: SISTEMA DA TELA DE BOAS VINDAS E REGISTRO ======
    // =========================================================

    console.log("Catálogo iniciado. Carregando dados iniciais...");
    loadInitialData();
    
    const searchBar = document.getElementById('search-bar');
    
    // 1. Busca automática ao digitar (com atraso/debounce)
    searchBar.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            filterProducts(); 
        }, 300);
    });

    // 2. Fecha teclado no mobile ao dar "Ir/Enter"
    searchBar.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.keyCode === 13) {
            event.preventDefault(); 
            clearTimeout(debounceTimer);
            filterProducts();
            searchBar.blur(); // Fecha o teclado
            document.body.focus(); 
        }
    });

    const menuBtn = document.getElementById('menu-btn');
    const closeDrawerBtn = document.getElementById('close-drawer-btn');
    const navDrawer = document.getElementById('nav-drawer');
    const overlay = document.getElementById('overlay');

    const openMenu = () => {
        navDrawer.classList.add('is-open');
        overlay.classList.add('is-open');
    };
    const closeMenu = () => {
        navDrawer.classList.remove('is-open');
        overlay.classList.remove('is-open');
    };

    menuBtn.addEventListener('click', openMenu);
    closeDrawerBtn.addEventListener('click', closeMenu);
    overlay.addEventListener('click', closeMenu);
});

// --- LISTENER PARA O BOTÃO VOLTAR DO CELULAR (POPSTATE) ---
window.addEventListener('popstate', function(event) {
    const modal = document.getElementById("imageZoomModal");
    // Se o modal estiver visível, fecha ele visualmente
    if (modal && modal.style.display === "flex") {
        modal.style.display = "none";
    }
});
// ----------------------------------------------------------

async function filterProducts(categoryId = null, page = 1) {
    if (isLoading) return;
    isLoading = true;

    const searchTerm = document.getElementById('search-bar').value;
    const productListDiv = document.getElementById('product-list');

    // Se estamos carregando a página 1, limpa tudo e atualiza a memória da categoria
    if (page === 1) {
        productListDiv.innerHTML = '<p>Buscando produtos...</p>';
        allProducts = []; 
        currentPage = 1;
        currentCategoryId = categoryId; 
    }
    
    try {
        let apiUrl = `/api/products?source=catalog&page=${page}`;
        if (searchTerm.trim() !== '') {
            apiUrl += `&search=${encodeURIComponent(searchTerm)}`;
        }
        
        // Usa a categoria informada (ou a da memória se for paginação)
        if (categoryId) {
            apiUrl += `&category_id=${categoryId}`;
        }

        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('Falha na busca.');

        const responseData = await response.json();
        
        allProducts.push(...responseData.items); 
        
        currentPage = responseData.current_page;
        hasMoreProducts = currentPage < responseData.pages;

        renderProducts(responseData.items, page === 1); 
        updateLoadMoreButton();

    } catch (error) {
        console.error("Erro na busca:", error);
        productListDiv.innerHTML = '<p style="color: red;">Erro ao realizar a busca.</p>';
    } finally {
        isLoading = false;
    }
}

async function loadInitialData() {
    await fetchBanners();
    await filterProducts(); 
    await fetchCategories();
    updateCartCount();
}

async function fetchCategories() {
    const categoryListDiv = document.getElementById('category-list');
    try {
        const response = await fetch('/api/product_categories?per_page=100');
        if (!response.ok) throw new Error('Não foi possível buscar as categorias.');
        
        const responseData = await response.json();
        const categories = responseData.items; 
        
        categoryListDiv.innerHTML = ''; 

        const allItem = document.createElement('div');
        allItem.className = 'category-item active';
        allItem.innerHTML = `
            <div style="width: 80px; height: 80px; background-color: #f1f5f9; border-radius: 12px; display: flex; justify-content: center; align-items: center; margin: 0 auto 10px auto; border: 2px solid #e2e8f0;">
                <i class="fas fa-store" style="font-size: 2.2rem; color: #3b82f6;"></i>
            </div>
            <p style="margin: 0; font-weight: bold; text-align: center;">Todos</p>
        `;
        allItem.onclick = () => filterByCategory(null, allItem, 'Todos os Produtos');
        categoryListDiv.appendChild(allItem);

        if (categories.length === 0) return;

        categories.forEach(category => {
            const categoryItem = document.createElement('div');
            categoryItem.className = 'category-item';
            
            let imageUrl = 'https://via.placeholder.com/80';
            if (category.photo_path) {
                 imageUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${category.photo_path}`;
            }
            
            categoryItem.innerHTML = `<img src="${imageUrl}" alt="${category.name}"><p>${category.name}</p>`;
            categoryItem.onclick = () => filterByCategory(category.id, categoryItem, category.name);
            categoryListDiv.appendChild(categoryItem);
        });

    } catch (error) {
        console.error("Erro ao carregar categorias:", error);
        categoryListDiv.innerHTML = '<p style="color: red;">Erro ao carregar categorias.</p>';
    }
}

function filterByCategory(categoryId, clickedElement, categoryName) {
    document.querySelectorAll('.category-item').forEach(item => {
        item.classList.remove('active');
    });
    if (clickedElement) {
        clickedElement.classList.add('active');
    }

    const titleElement = document.getElementById('products-section-title');
    titleElement.textContent = categoryName;

    // Limpa a busca ao trocar de categoria
    document.getElementById('search-bar').value = '';

    filterProducts(categoryId, 1);
}

async function fetchBanners() {
    const bannerListDiv = document.getElementById('banner-list');
    if (!bannerListDiv) return;

    try {
        const response = await fetch('/api/banners');
        if (!response.ok) throw new Error('Não foi possível carregar os banners.');
        
        const banners = await response.json();
        bannerListDiv.innerHTML = '';

        if (banners.length === 0) {
            document.querySelector('.banner-section').style.display = 'none';
            return;
        }

        banners.forEach(banner => {
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';

            let imageUrl = 'https://via.placeholder.com/400x200';
            if (banner.image_path) { 
                 imageUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${banner.image_path}`;
            }
            
            const link_url = banner.link_url;

            if (link_url) {
                slide.innerHTML = `<a href="${link_url}"><img src="${imageUrl}" alt="Banner Promocional"></a>`;
            } else {
                slide.innerHTML = `<img src="${imageUrl}" alt="Banner Promocional">`;
            }
            bannerListDiv.appendChild(slide);
        });

        new Swiper('#banner-swiper', {
            loop: true,
            autoplay: {
                delay: 5000,
                disableOnInteraction: false,
            },
            pagination: {
                el: '.swiper-pagination',
                clickable: true,
            },
        });

    } catch (error) {
        console.error("Erro ao carregar banners:", error);
        document.querySelector('.banner-section').style.display = 'none';
    }
}

function renderProducts(productsToRender, clearList) {
    const productListDiv = document.getElementById('product-list');
    
    if (clearList) {
        productListDiv.innerHTML = '';
    }

    if (allProducts.length === 0) {
        productListDiv.innerHTML = '<p>Nenhum produto encontrado para esta seleção.</p>';
        return;
    }

    productsToRender.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.id = `product-card-${product.id}`;
        
        let imageUrl = 'https://via.placeholder.com/150';

        if (product.photo_path) {
            imageUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${product.photo_path}`;
        }
        
        const safeName = product.name.replace(/'/g, "\\'"); 
        const safeDesc = (product.description || "").replace(/'/g, "\\'");

        const quantityInCart = cart[product.id] || 0;
        const isInCart = quantityInCart > 0;

        productCard.innerHTML = `
            <img src="${imageUrl}" alt="${product.name}" 
                 onclick="openImageModal('${imageUrl}', '${safeName}', '${safeDesc}')" 
                 style="cursor: pointer;">
                 
            <h3>${product.name}</h3>
            <p class="unit">UNIDADE(S)</p>
            <p class="price">${formatCurrency(product.price_catalog)}</p>
            <div class="cart-controls">
                <button class="add-to-cart-btn" style="display: ${isInCart ? 'none' : 'block'}" onclick="addToCart(${product.id})">
                    <i class="fas fa-shopping-cart"></i>
                </button>
                <div class="quantity-selector" style="display: ${isInCart ? 'flex' : 'none'}">
                    <button class="quantity-btn" onclick="changeQuantity(${product.id}, -1)">-</button>
                    <input type="number" class="quantity-input" value="${quantityInCart}" min="0" onchange="setQuantity(${product.id}, this.value)">
                    <button class="quantity-btn" onclick="changeQuantity(${product.id}, 1)">+</button>
                </div>
            </div>
        `;
        productListDiv.appendChild(productCard);
    });
}

function updateLoadMoreButton() {
    let loadMoreContainer = document.getElementById('load-more-container');
    if (!loadMoreContainer) return; 

    if (hasMoreProducts) {
        loadMoreContainer.innerHTML = `<button id="load-more-btn" class="load-more-btn">Carregar Mais</button>`;
        document.getElementById('load-more-btn').addEventListener('click', () => {
            filterProducts(currentCategoryId, currentPage + 1);
        });
    } else {
        loadMoreContainer.innerHTML = ''; 
    }
}

function updateProductCardView(productId) {
    const productCard = document.getElementById(`product-card-${productId}`);
    if (!productCard) return;
    const addToCartButton = productCard.querySelector('.add-to-cart-btn');
    const quantitySelector = productCard.querySelector('.quantity-selector');
    const quantityInput = productCard.querySelector('.quantity-input');
    const quantity = cart[productId] || 0;

    if (quantity > 0) {
        addToCartButton.style.display = 'none';
        quantitySelector.style.display = 'flex';
        quantityInput.value = quantity;
    } else {
        addToCartButton.style.display = 'block';
        quantitySelector.style.display = 'none';
    }
}

function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) { alert("Erro: Produto não encontrado."); return; }
    if (product.stock_quantity <= 0) { alert("Desculpe, este produto está fora de estoque."); return; }
    cart[productId] = 1;
    saveCart();
    updateProductCardView(productId);
    updateCartCount();
}

function setQuantity(productId, value) {
    const newQuantity = parseFloat(value);
    if (isNaN(newQuantity) || newQuantity < 0) {
        updateProductCardView(productId);
        return;
    }

    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    if (newQuantity > product.stock_quantity) {
        alert(`Desculpe, temos apenas ${product.stock_quantity} unidades de "${product.name}" em estoque.`);
        const input = document.querySelector(`#product-card-${productId} .quantity-input`);
        input.value = product.stock_quantity;
        cart[productId] = product.stock_quantity;
    } else if (newQuantity === 0) {
        delete cart[productId];
    } else {
        cart[productId] = newQuantity;
    }

    saveCart();
    updateProductCardView(productId);
    updateCartCount();
}

function changeQuantity(productId, amount) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    
    const currentQuantity = parseFloat(cart[productId] || 0);
    let newQuantity = currentQuantity + amount;
    
    if (newQuantity > product.stock_quantity) {
        alert(`Desculpe, temos apenas ${product.stock_quantity} unidades de "${product.name}" em estoque.`);
        newQuantity = product.stock_quantity;
    }
    
    if (newQuantity <= 0) {
        delete cart[productId];
    } else {
        cart[productId] = newQuantity;
    }

    saveCart();
    updateProductCardView(productId);
    updateCartCount();
}

function saveCart() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

function updateCartCount() {
    const currentCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || {};
    const totalUniqueItems = Object.keys(currentCart).length;
    const cartCountSpan = document.getElementById('cart-count');
    if (cartCountSpan) {
        cartCountSpan.textContent = totalUniqueItems;
    }
}

function formatCurrency(value) {
    if (typeof value !== 'number') { value = 0; }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

async function finalizarPedido() {
    console.log("Iniciando finalização do pedido...");
    const currentCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || {};
    const productIdsInCart = Object.keys(currentCart);
    if (productIdsInCart.length === 0) {
        alert("Seu carrinho está vazio!");
        return;
    }

    const itemsParaApi = {};
    for (const productId of productIdsInCart) {
        const product = allProducts.find(p => p.id == productId);
        if (product) {
            itemsParaApi[product.id] = {
                product_id: product.id,
                quantity: currentCart[productId],
                price: product.price_catalog
            };
        }
    }

    const client_info = {
        name: prompt("Por favor, digite seu nome:", ""),
        address: prompt("Digite seu endereço para entrega:", ""),
        notes: prompt("Alguma observação para o pedido?", "")
    };

    if (!client_info.name || !client_info.address) {
        alert("Nome e endereço são obrigatórios para finalizar o pedido.");
        return;
    }

    const dadosDoPedido = {
        client_info: client_info,
        items: itemsParaApi
    };

    console.log("Enviando para a API:", JSON.stringify(dadosDoPedido, null, 2));

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosDoPedido)
        });
        const result = await response.json();
        if (response.ok) {
            alert(`Pedido #${result.order_id} realizado com sucesso!`);
            cart = {};
            saveCart();
            location.reload(); 
        } else {
            alert(`Erro ao realizar o pedido: ${result.message}`);
        }
    } catch (error) {
        console.error("Erro de comunicação ao finalizar pedido:", error);
        alert("Ocorreu um erro de comunicação. Tente novamente.");
    }
}

// ==================================================================
// FUNÇÕES DO MODAL DE ZOOM (LIGHTBOX)
// ==================================================================

function openImageModal(src, title, description) {
    const modal = document.getElementById("imageZoomModal");
    const modalImg = document.getElementById("img01");
    const captionText = document.getElementById("caption");
    
    // 1. Exibe o modal
    modal.style.display = "flex";
    modalImg.src = src;
    
    // 2. Adiciona o estado no histórico do navegador
    // O '#zoom' na URL faz o navegador achar que mudamos de página
    history.pushState({ zoomOpen: true }, null, "#zoom");
    
    const descHtml = description ? `<p>${description}</p>` : '';
    captionText.innerHTML = `<h3>${title}</h3>${descHtml}`;
}

function closeImageModal() {
    const modal = document.getElementById("imageZoomModal");
    
    // Se o modal estiver visível
    if (modal.style.display === "flex") {
        // Simula o clique no botão voltar do navegador
        // Isso vai acionar o 'popstate', que é quem realmente fecha a div
        history.back();
    }
}

// Fecha ao clicar no X
document.querySelector('.close-zoom').addEventListener('click', function(e) {
    e.stopPropagation(); 
    closeImageModal();
});