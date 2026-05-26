import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { initializeFirestore, doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ==========================================
// CONFIGURACIÓN DE CRIDENCIALES DE FIREBASE
// ==========================================
// ¡REEMPLAZA ESTOS VALORES CON TUS CREDENCIALES REALES DE FIREBASE CONSOLE!
const firebaseConfig = {
  apiKey: "AIzaSyB8bAKYE727s1Pz3xy4UT_g7mGWFLZ7tBI",
  authDomain: "gymbro-ai-52d2e.firebaseapp.com",
  databaseURL: "https://gymbro-ai-52d2e-default-rtdb.firebaseio.com",
  projectId: "gymbro-ai-52d2e",
  storageBucket: "gymbro-ai-52d2e.firebasestorage.app",
  messagingSenderId: "194968857917",
  appId: "1:194968857917:web:a9c9f4875b7aab22e86954"
};

// Inicializar Firebase y forzar Long Polling HTTP para evitar bloqueos de red
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
    experimentalForceLongPolling: true
});

const MY_USER_ID = "gymbro_admin_01"; 

// Metas del Perfil de Usuario
const GOALS = {
    active: { cal: 3100, prot: 120 },
    rest: { cal: 2600, prot: 110 }
};

let currentMode = 'active'; 
let consumed = { cal: 0, prot: 0 };
let charts = {};

// ==========================================
// INICIALIZACIÓN DE DATOS (CLOUD FIRESTORE)
// ==========================================
async function initData() {
    try {
        const userRef = doc(db, "users", MY_USER_ID);
        const docSnap = await getDoc(userRef);

        if (!docSnap.exists()) {
            // Inicializar la estructura JSON en Firestore por primera vez
            await setDoc(userRef, {
                fridgeInventory: [],
                dailyLog: { cal: 0, prot: 0 },
                mealsHistory: []
            });
        } else {
            const data = docSnap.data();
            consumed = data.dailyLog || { cal: 0, prot: 0 };
        }
        
        initCharts();
        renderInventory();
        renderMealsHistory();
    } catch (error) {
        console.error("Error en la inicialización de Firestore:", error);
    }
}

// ==========================================
// GRÁFICOS PREMIUM ESTILO FITIA (CHART.JS)
// ==========================================
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
                    backgroundColor: [color, '#e5e5ea'],
                    borderWidth: 0,
                    borderRadius: 20, 
                    cutout: '85%'     
                }]
            },
            options: {
                responsive: true,
                layout: { padding: 10 },
                plugins: {
                    legend: { display: false },
                    title: { 
                        display: true, 
                        text: label, 
                        position: 'bottom',
                        font: { size: 13, weight: '600' },
                        color: '#1c1c1e'
                    },
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

// ==========================================
// GESTIÓN DE LA NEVERA VIRTUAL
// ==========================================
async function renderInventory() {
    try {
        const userRef = doc(db, "users", MY_USER_ID);
        const docSnap = await getDoc(userRef);
        if (!docSnap.exists()) return;

        const inventory = docSnap.data().fridgeInventory || [];
        const list = document.getElementById('inventoryList');
        list.innerHTML = '';

        if (inventory.length === 0) {
            list.innerHTML = `<p class="item-meta" style="text-align:center; padding:10px;">Tu nevera está vacía bro. Añade alimentos para arrancar.</p>`;
            return;
        }

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
                    Quedan: ${item.cantidad_actual.toFixed(1)} ${item.unidad} | Vence en: ${item.dias_para_vencer} días
                </div>
                <div class="progress-bg">
                    <div class="progress-fill" style="width: ${item.porcentaje_restante}%; background: ${colorClass}"></div>
                </div>
            `;
            list.appendChild(el);
        });
    } catch (err) {
        console.error("Error al renderizar inventario:", err);
    }
}

document.getElementById('addFoodForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('foodName').value;
    const qty = parseFloat(document.getElementById('foodQuantity').value);
    const unit = document.getElementById('foodUnit').value;
    const category = document.getElementById('foodCategory').value;

    let daysExp = 30; 
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

    try {
        const userRef = doc(db, "users", MY_USER_ID);
        const docSnap = await getDoc(userRef);
        const currentInventory = docSnap.exists() ? (docSnap.data().fridgeInventory || []) : [];
        
        currentInventory.push(newItem);
        await updateDoc(userRef, { fridgeInventory: currentInventory });

        document.getElementById('addFoodForm').reset();
        renderInventory();
    } catch (error) {
        console.error("Error al añadir alimento:", error);
    }
});

// ==========================================
// INTERFAZ DE HISTORIAL Y COMIDAS CONSUMIDAS
// ==========================================
async function renderMealsHistory() {
    try {
        const userRef = doc(db, "users", MY_USER_ID);
        const docSnap = await getDoc(userRef);
        if (!docSnap.exists()) return;

        const history = docSnap.data().mealsHistory || [];
        const list = document.getElementById('dailyMealsList');
        list.innerHTML = '';

        if(history.length === 0) {
            list.innerHTML = `<p class="item-meta" style="text-align:center; padding:10px;">No has registrado comidas hoy bro.</p>`;
            return;
        }

        history.forEach((meal, index) => {
            const el = document.createElement('div');
            el.className = 'meal-card';
            el.innerHTML = `
                <div class="meal-header">
                    <span>${meal.descripcion}</span>
                    <div class="meal-header-actions">
                        <span>🔥 ${meal.calorias} kcal</span>
                        <button class="btn-edit-meal" data-index="${index}">Eliminar</button>
                    </div>
                </div>
                <div class="meal-meta">Proteína: ${meal.proteina}g | Registrado: ${new Date(meal.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            `;
            list.appendChild(el);
        });

        // Configurar botones para eliminar comidas y restar macros
        document.querySelectorAll('.btn-edit-meal').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const idx = e.target.getAttribute('data-index');
                await deleteMealRecord(idx);
            });
        });

    } catch (err) {
        console.error("Error al renderizar historial:", err);
    }
}

async function deleteMealRecord(index) {
    try {
        const userRef = doc(db, "users", MY_USER_ID);
        const docSnap = await getDoc(userRef);
        if (!docSnap.exists()) return;

        let history = docSnap.data().mealsHistory || [];
        const removedMeal = history[index];

        // Restar los macros eliminados
        consumed.cal = Math.max(0, consumed.cal - removedMeal.calorias);
        consumed.prot = Math.max(0, consumed.prot - removedMeal.proteina);

        history.splice(index, 1);

        await updateDoc(userRef, {
            mealsHistory: history,
            dailyLog: consumed
        });

        updateCharts();
        renderMealsHistory();
    } catch (error) {
        console.error("Error al borrar comida:", error);
    }
}

// ==========================================
// INTEGRACIÓN DEL CHATBOT REAL (GEMINI AI WEBHOOK)
// ==========================================
document.getElementById('sendBtn').addEventListener('click', async () => {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if(!msg) return;

    const chatLog = document.getElementById('chatLog');
    chatLog.insertAdjacentHTML('beforeend', `<div class="msg user">${msg}</div>`);
    input.value = '';

    const loadingId = 'loading_' + Date.now();
    chatLog.insertAdjacentHTML('beforeend', `<div id="${loadingId}" class="msg bot">Analizando macros e inventario... 🏋️‍♂️</div>`);
    chatLog.scrollTop = chatLog.scrollHeight;

    try {
        const response = await fetch('/.netlify/functions/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: msg })
        });

        if (!response.ok) throw new Error('Error de red en el Servidor');
        const data = await response.json(); 
        
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();

        try {
            const extractedMacros = data.macros_calculados || { calorias: 0, proteina_g: 0 };
            const itemsToDeduct = data.ingredientes_a_descontar || [];

            const userRef = doc(db, "users", MY_USER_ID);
            const docSnap = await getDoc(userRef);
            let inventory = docSnap.exists() ? (docSnap.data().fridgeInventory || []) : [];
            let mealsHistory = docSnap.exists() ? (docSnap.data().mealsHistory || []) : [];
            let usedItemsFeedback = [];

            // Descontar inventario de la nevera virtual
            inventory = inventory.map(item => {
                let nameLower = item.nombre.toLowerCase();
                const match = itemsToDeduct.find(i => nameLower.includes(i.palabra_clave_busqueda.toLowerCase()));

                if(match) {
                    const deductQty = match.cantidad_a_restar;
                    item.cantidad_actual = Math.max(0, item.cantidad_actual - deductQty);
                    item.porcentaje_restante = Math.round((item.cantidad_actual / item.cantidad_inicial) * 100);
                    usedItemsFeedback.push(`${deductQty} ${item.unidad} de ${item.nombre}`);
                }
                return item;
            });

            // Añadir al registro de comidas diarias
            mealsHistory.push({
                descripcion: msg.length > 35 ? msg.substring(0, 32) + "..." : msg,
                calorias: extractedMacros.calorias,
                proteina: extractedMacros.proteina_g,
                timestamp: Date.now()
            });

            consumed.cal += extractedMacros.calorias;
            consumed.prot += extractedMacros.proteina_g;

            // Actualización atómica en la nube de Firestore
            await updateDoc(userRef, { 
                fridgeInventory: inventory,
                dailyLog: consumed,
                mealsHistory: mealsHistory
            });
            
            updateCharts();
            renderInventory();
            renderMealsHistory();

            const deduccionesTexto = usedItemsFeedback.length > 0 
                ? `<br><small style="color:var(--success)">🧊 Restado de la nevera: ${usedItemsFeedback.join(', ')}</small>` 
                : `<br><small style="color:var(--text-muted)">🧊 No se descontaron ingredientes de tu inventario.</small>`;
            
            chatLog.insertAdjacentHTML('beforeend', `<div class="msg bot">${data.mensaje_usuario} ${deduccionesTexto}</div>`);

        } catch (dbError) {
            console.error("Error al escribir en Firestore Database:", dbError);
            chatLog.insertAdjacentHTML('beforeend', `<div class="msg bot">${data.mensaje_usuario} <br><small style="color:#ff3b30;">(Nota: No se guardó en la nube: Verifica Firestore)</small></div>`);
        }

        chatLog.scrollTop = chatLog.scrollHeight;

    } catch (error) {
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
        chatLog.insertAdjacentHTML('beforeend', `<div class="msg bot" style="background:var(--danger); color:white;">Fallo al conectar con GymBro AI.</div>`);
        console.error(error);
    }
});

// ==========================================
// CONTROLADORES DE INTERFAZ GENERAL (SWITCH & TABS)
// ==========================================
document.getElementById('restModeToggle').addEventListener('change', (e) => {
    currentMode = e.target.checked ? 'rest' : 'active';
    updateCharts();
});

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
        
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-tab');
        document.getElementById(targetId).classList.add('active');
        
        window.scrollTo(0, 0);
    });
});

// Carga Inicial del sistema al abrir la app
initData();