// Constantes de Metas (Activo vs Descanso)
const GOALS = {
    active: { cal: 3100, prot: 120 },
    rest: { cal: 2600, prot: 110 }
};

// Estado Inicial
let currentMode = 'active'; 
let consumed = { cal: 0, prot: 0 };
let charts = {};

// Inicialización de LocalStorage
function initData() {
    if (!localStorage.getItem('fridgeInventory')) {
        localStorage.setItem('fridgeInventory', JSON.stringify([]));
    }
}

// Inicializar Gráficos (Estilo Fitia / iOS Premium)
function initCharts() {
    const ctxCal = document.getElementById('caloriesChart').getContext('2d');
    const ctxProt = document.getElementById('proteinChart').getContext('2d');

    const createDoughnut = (ctx, label, color) => {
        return new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Consumido', 'Restante'],
                datasets: [{
                    data: [0, 100],
                    backgroundColor: [color, '#f2f2f7'], // Fondo gris muy sutil
                    borderWidth: 0,
                    borderRadius: 20, // <-- ESTA ES LA MAGIA: Bordes redondeados Fitia
                    cutout: '85%'     // <-- Anillo más delgado y elegante
                }]
            },
            options: {
                responsive: true,
                layout: {
                    padding: 10
                },
                plugins: {
                    legend: { display: false },
                    title: { 
                        display: true, 
                        text: label, 
                        position: 'bottom',
                        font: {
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                            size: 14,
                            weight: '600'
                        },
                        color: '#1c1c1e'
                    },
                    tooltip: { enabled: false } // Desactiva el hover molesto en móviles
                }
            }
        });
    };

    // Colores más vibrantes
    charts.cal = createDoughnut(ctxCal, 'Calorías', '#ff453a');
    charts.prot = createDoughnut(ctxProt, 'Proteína (g)', '#0a84ff');
    updateCharts();
}

// Actualizar Gráficos dinámicamente
function updateCharts() {
    const target = GOALS[currentMode];
    
    // Calcular restantes, evitando números negativos visuales
    let remainingCal = target.cal - consumed.cal;
    let remainingProt = target.prot - consumed.prot;
    
    charts.cal.data.datasets[0].data = [consumed.cal, Math.max(0, remainingCal)];
    charts.cal.options.plugins.title.text = `${consumed.cal} / ${target.cal} kcal`;
    charts.cal.update();

    charts.prot.data.datasets[0].data = [consumed.prot, Math.max(0, remainingProt)];
    charts.prot.options.plugins.title.text = `${consumed.prot} / ${target.prot} g`;
    charts.prot.update();
}

// Lógica de "Agregar Alimento"
document.getElementById('addFoodForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const name = document.getElementById('foodName').value;
    const qty = parseFloat(document.getElementById('foodQuantity').value);
    const unit = document.getElementById('foodUnit').value;
    const category = document.getElementById('foodCategory').value;

    let daysExp = 30; // Default
    if(category === "Lácteos") daysExp = 7;
    if(category === "Proteína Animal") daysExp = 5;
    if(category === "Vegetales/Frutas") daysExp = 10;
    if(category === "Despensa/Grasas") daysExp = 90;

    const newItem = {
        id: 'item_' + Date.now(),
        nombre: name,
        cantidad_inicial: qty,
        cantidad_actual: qty,
        unidad: unit,
        porcentaje_restante: 100,
        categoria: category,
        fecha_ingreso: new Date().toISOString(),
        dias_para_vencer: daysExp
    };

    const inventory = JSON.parse(localStorage.getItem('fridgeInventory'));
    inventory.push(newItem);
    localStorage.setItem('fridgeInventory', JSON.stringify(inventory));

    document.getElementById('addFoodForm').reset();
    renderInventory();
});

// Renderizar la Nevera Virtual
function renderInventory() {
    const inventory = JSON.parse(localStorage.getItem('fridgeInventory'));
    const list = document.getElementById('inventoryList');
    list.innerHTML = '';

    inventory.forEach(item => {
        // Lógica de color de barra según porcentaje
        let colorClass = '#34c759'; // Verde
        if(item.porcentaje_restante <= 20) colorClass = '#ff3b30'; // Rojo
        else if(item.porcentaje_restante <= 50) colorClass = '#ffcc00'; // Amarillo

        const el = document.createElement('div');
        el.className = 'fridge-item';
        el.innerHTML = `
            <div class="item-header">
                <span>${item.nombre}</span>
                <span>${item.porcentaje_restante}%</span>
            </div>
            <div class="item-meta">
                Quedan: ${item.cantidad_actual.toFixed(1)}${item.unidad} | Vence en: ${item.dias_para_vencer} días
            </div>
            <div class="progress-bg">
                <div class="progress-fill" style="width: ${item.porcentaje_restante}%; background: ${colorClass}"></div>
            </div>
        `;
        list.appendChild(el);
    });
}

// Toggle Modo Descanso / Activo
document.getElementById('restModeToggle').addEventListener('change', (e) => {
    currentMode = e.target.checked ? 'rest' : 'active';
    updateCharts();
});

// CONEXIÓN REAL CON NETLIFY FUNCTIONS Y GEMINI AI
document.getElementById('sendBtn').addEventListener('click', async () => {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if(!msg) return;

    // 1. Renderizar mensaje del usuario
    const chatLog = document.getElementById('chatLog');
    chatLog.innerHTML += `<div class="msg user">${msg}</div>`;
    input.value = '';

    // 2. Mostrar indicador de carga
    const loadingId = 'loading_' + Date.now();
    chatLog.innerHTML += `<div id="${loadingId}" class="msg bot">Calculando macros e inventario... 🏋️‍♂️</div>`;
    chatLog.scrollTop = chatLog.scrollHeight;

    try {
        // 3. Petición al endpoint seguro de Netlify Function
        const response = await fetch('/.netlify/functions/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: msg })
        });

        if (!response.ok) throw new Error('Error en la comunicación con el servidor');

        // 4. Recibimos el JSON puro validado por Gemini
        const data = await response.json(); 
        
        // Eliminamos el mensaje de carga
        document.getElementById(loadingId).remove();

        // 5. Extraer datos del JSON
        const extractedMacros = data.macros_calculados;
        const itemsToDeduct = data.ingredientes_a_descontar || [];

        // 6. Lógica de deducción de la nevera
        let inventory = JSON.parse(localStorage.getItem('fridgeInventory'));
        let usedItemsFeedback = [];

        inventory = inventory.map(item => {
            let nameLower = item.nombre.toLowerCase();
            
            // Buscar si el item de la nevera coincide con las palabras clave de Gemini
            const match = itemsToDeduct.find(i => nameLower.includes(i.palabra_clave_busqueda.toLowerCase()));

            if(match) {
                const deductQty = match.cantidad_a_restar;
                item.cantidad_actual = Math.max(0, item.cantidad_actual - deductQty);
                item.porcentaje_restante = Math.round((item.cantidad_actual / item.cantidad_inicial) * 100);
                usedItemsFeedback.push(`${deductQty} de ${item.nombre}`);
            }
            return item;
        });

        // 7. Guardar y actualizar UI
        localStorage.setItem('fridgeInventory', JSON.stringify(inventory));
        consumed.cal += extractedMacros.calorias;
        consumed.prot += extractedMacros.proteina_g;
        
        updateCharts();
        renderInventory();

        // 8. Renderizar la respuesta humana del bot
        const deduccionesTexto = usedItemsFeedback.length > 0 
            ? `\nRestado de tu nevera: ${usedItemsFeedback.join(', ')}.` 
            : `\nNo encontré ingredientes exactos para restar en tu inventario.`;

        chatLog.innerHTML += `<div class="msg bot">${data.mensaje_usuario} ${deduccionesTexto}</div>`;
        chatLog.scrollTop = chatLog.scrollHeight;

    } catch (error) {
        document.getElementById(loadingId).remove();
        chatLog.innerHTML += `<div class="msg bot" style="background: #ff3b30; color: white;">Hubo un fallo de conexión. Vuelve a intentarlo bro.</div>`;
        console.error(error);
    }
});

// Ejecución Inicial
initData();
initCharts();
renderInventory();