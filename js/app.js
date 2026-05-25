// 1. IMPORTACIONES DE FIREBASE (Desde el CDN oficial de Google)
import { getFirestore, doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// ... tu config ...

// 2. PEGA AQUÍ TU CONFIGURACIÓN (La que copiaste en el Paso 2)
const firebaseConfig = {
  apiKey: "AIzaSyB8bAKYE727s1Pz3xy4UT_g7mGWFLZ7tBI",
  authDomain: "gymbro-ai-52d2e.firebaseapp.com",
  databaseURL: "https://gymbro-ai-52d2e-default-rtdb.firebaseio.com",
  projectId: "gymbro-ai-52d2e",
  storageBucket: "gymbro-ai-52d2e.firebasestorage.app",
  messagingSenderId: "194968857917",
  appId: "1:194968857917:web:a9c9f4875b7aab22e86954"
};

// 3. INICIALIZAR LA NUBE
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ID estático para conectar tus dispositivos sin Login
const MY_USER_ID = "gymbro_admin_01"; 

// Constantes de Metas
const GOALS = {
    active: { cal: 3100, prot: 120 },
    rest: { cal: 2600, prot: 110 }
};

let currentMode = 'active'; 
let consumed = { cal: 0, prot: 0 };
let charts = {};

// 4. INICIALIZAR DATOS EN LA NUBE
async function initData() {
    const userRef = doc(db, "users", MY_USER_ID);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
        // Si es la primera vez, crea la estructura en la nube
        await setDoc(userRef, {
            fridgeInventory: [],
            dailyLog: { cal: 0, prot: 0 },
            history: {} // Aquí guardaremos los días anteriores después
        });
    } else {
        // Si ya existe, descargamos tus macros consumidos
        const data = docSnap.data();
        consumed = data.dailyLog || { cal: 0, prot: 0 };
    }
    
    initCharts();
    renderInventory();
}

// Inicializar Gráficos (El código estilo Fitia que ya hicimos)
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
                    backgroundColor: [color, '#f2f2f7'],
                    borderWidth: 0, borderRadius: 20, cutout: '85%'
                }]
            },
            options: {
                responsive: true, layout: { padding: 10 },
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: label, position: 'bottom', font: { size: 14, weight: '600' }, color: '#1c1c1e' },
                    tooltip: { enabled: false }
                }
            }
        });
    };

    charts.cal = createDoughnut(ctxCal, 'Calorías', '#ff453a');
    charts.prot = createDoughnut(ctxProt, 'Proteína (g)', '#0a84ff');
    updateCharts();
}

function updateCharts() {
    const target = GOALS[currentMode];
    let remainingCal = target.cal - consumed.cal;
    let remainingProt = target.prot - consumed.prot;
    
    charts.cal.data.datasets[0].data = [consumed.cal, Math.max(0, remainingCal)];
    charts.cal.options.plugins.title.text = `${consumed.cal} / ${target.cal} kcal`;
    charts.cal.update();

    charts.prot.data.datasets[0].data = [consumed.prot, Math.max(0, remainingProt)];
    charts.prot.options.plugins.title.text = `${consumed.prot} / ${target.prot} g`;
    charts.prot.update();
}

// 5. RENDERIZAR INVENTARIO DESDE LA NUBE
async function renderInventory() {
    const userRef = doc(db, "users", MY_USER_ID);
    const docSnap = await getDoc(userRef);
    if (!docSnap.exists()) return;

    const inventory = docSnap.data().fridgeInventory || [];
    const list = document.getElementById('inventoryList');
    list.innerHTML = '';

    inventory.forEach(item => {
        let colorClass = '#34c759'; 
        if(item.porcentaje_restante <= 20) colorClass = '#ff3b30'; 
        else if(item.porcentaje_restante <= 50) colorClass = '#ffcc00'; 

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

// SIMULACIÓN E INTEGRACIÓN CON IA Y FIREBASE
document.getElementById('sendBtn').addEventListener('click', async () => {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if(!msg) return;

    const chatLog = document.getElementById('chatLog');
    
    // 1. Mostrar mensaje del usuario sin romper el DOM
    chatLog.insertAdjacentHTML('beforeend', `<div class="msg user">${msg}</div>`);
    input.value = '';

    // 2. Mostrar indicador de carga
    const loadingId = 'loading_' + Date.now();
    chatLog.insertAdjacentHTML('beforeend', `<div id="${loadingId}" class="msg bot">Analizando macros e inventario... 🏋️‍♂️</div>`);
    chatLog.scrollTop = chatLog.scrollHeight;

    try {
        // 3. Petición a la IA (Netlify + Gemini)
        const response = await fetch('/.netlify/functions/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: msg })
        });

        if (!response.ok) throw new Error('Error al conectar con la IA');
        const data = await response.json(); 
        
        // Eliminar mensaje de carga de forma segura (Evita el error 'null')
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();

        // 4. Actualizar Firebase de forma aislada
        try {
            const extractedMacros = data.macros_calculados || { calorias: 0, proteina_g: 0 };
            const itemsToDeduct = data.ingredientes_a_descontar || [];

            const userRef = doc(db, "users", MY_USER_ID);
            const docSnap = await getDoc(userRef);
            let inventory = docSnap.exists() ? (docSnap.data().fridgeInventory || []) : [];
            let usedItemsFeedback = [];

            inventory = inventory.map(item => {
                let nameLower = item.nombre.toLowerCase();
                const match = itemsToDeduct.find(i => nameLower.includes(i.palabra_clave_busqueda.toLowerCase()));

                if(match) {
                    const deductQty = match.cantidad_a_restar;
                    item.cantidad_actual = Math.max(0, item.cantidad_actual - deductQty);
                    item.porcentaje_restante = Math.round((item.cantidad_actual / item.cantidad_inicial) * 100);
                    usedItemsFeedback.push(`${deductQty} de ${item.nombre}`);
                }
                return item;
            });

            // Guardar en FIREBASE y actualizar UI
            consumed.cal += extractedMacros.calorias;
            consumed.prot += extractedMacros.proteina_g;

            await updateDoc(userRef, { 
                fridgeInventory: inventory,
                dailyLog: consumed
            });
            
            updateCharts();
            renderInventory();

            // Mensaje de éxito de la IA
            const deduccionesTexto = usedItemsFeedback.length > 0 
                ? `<br><small>Restado: ${usedItemsFeedback.join(', ')}</small>` 
                : ``;
            
            chatLog.insertAdjacentHTML('beforeend', `<div class="msg bot">${data.mensaje_usuario} ${deduccionesTexto}</div>`);

        } catch (firebaseErr) {
            console.error("Error al guardar en Firebase:", firebaseErr);
            // Si Firebase falla, la IA de todos modos te responde
            chatLog.insertAdjacentHTML('beforeend', `<div class="msg bot">${data.mensaje_usuario} <br><small style="color: #ff3b30;">(Nota: No se pudo guardar en tu base de datos por un bloqueo de red)</small></div>`);
        }

        chatLog.scrollTop = chatLog.scrollHeight;

    } catch (error) {
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
        chatLog.insertAdjacentHTML('beforeend', `<div class="msg bot" style="background: #ff3b30; color: white;">Fallo de conexión con GymBro AI.</div>`);
        console.error("Error de la IA:", error);
    }
});

// Inicializamos la app conectándose a Firebase
initData();

// Toggle Modo Descanso / Activo
document.getElementById('restModeToggle').addEventListener('change', (e) => {
    currentMode = e.target.checked ? 'rest' : 'active';
    updateCharts();
});

    // ==========================================
// LÓGICA DE NAVEGACIÓN (TABS)
// ==========================================
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // 1. Quitar la clase 'active' de todos los botones y vistas
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
        
        // 2. Añadir 'active' al botón clickeado
        btn.classList.add('active');
        
        // 3. Mostrar la vista correspondiente
        const targetId = btn.getAttribute('data-tab');
        document.getElementById(targetId).classList.add('active');
        
        // Scroll al inicio de la página para evitar cortes visuales
        window.scrollTo(0, 0);
    });
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

        // 6. Lógica de deducción EN LA NUBE
        const userRef = doc(db, "users", MY_USER_ID);
        const docSnap = await getDoc(userRef);
        let inventory = docSnap.exists() ? (docSnap.data().fridgeInventory || []) : [];
        let usedItemsFeedback = [];

        inventory = inventory.map(item => {
            let nameLower = item.nombre.toLowerCase();
            const match = itemsToDeduct.find(i => nameLower.includes(i.palabra_clave_busqueda.toLowerCase()));

            if(match) {
                const deductQty = match.cantidad_a_restar;
                item.cantidad_actual = Math.max(0, item.cantidad_actual - deductQty);
                item.porcentaje_restante = Math.round((item.cantidad_actual / item.cantidad_inicial) * 100);
                usedItemsFeedback.push(`${deductQty} de ${item.nombre}`);
            }
            return item;
        });

        // 7. Guardar en FIREBASE y actualizar UI
        consumed.cal += extractedMacros.calorias;
        consumed.prot += extractedMacros.proteina_g;

        await updateDoc(userRef, { 
            fridgeInventory: inventory,
            dailyLog: consumed
        });
        
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