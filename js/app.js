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

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true });
const MY_USER_ID = "gymbro_admin_01"; 

const GOALS = { active: { cal: 3100, prot: 120 }, rest: { cal: 2600, prot: 110 } };
let currentMode = 'active'; 
let consumed = { cal: 0, prot: 0 };
let charts = {};

async function initData() {
    const userRef = doc(db, "users", MY_USER_ID);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
        await setDoc(userRef, { fridgeInventory: [], dailyLog: { cal: 0, prot: 0 }, mealsHistory: [] });
    } else {
        consumed = docSnap.data().dailyLog || { cal: 0, prot: 0 };
    }
    
    injectChartTextDivs();
    initCharts();
    renderInventory();
    renderMealsHistory();
}

// ==========================================
// GRÁFICOS DINÁMICOS CON DEGRADADOS (UI PREMIUM)
// ==========================================
function injectChartTextDivs() {
    const calContainer = document.getElementById('caloriesChart').parentElement;
    const protContainer = document.getElementById('proteinChart').parentElement;
    
    calContainer.innerHTML += `<div class="chart-center-text" id="calText"><div class="value">0</div><div class="label">kcal</div></div>`;
    protContainer.innerHTML += `<div class="chart-center-text" id="protText"><div class="value">0</div><div class="label">prot</div></div>`;
}

function initCharts() {
    const ctxCal = document.getElementById('caloriesChart').getContext('2d');
    const ctxProt = document.getElementById('proteinChart').getContext('2d');

    const createDoughnut = (ctx) => {
        return new Chart(ctx, {
            type: 'doughnut',
            data: { labels: ['Consumido', 'Restante'], datasets: [{ data: [0, 100], borderWidth: 0, borderRadius: 20, cutout: '82%' }] },
            options: { responsive: true, plugins: { legend: { display: false }, tooltip: { enabled: false } }, layout: { padding: 5 } }
        });
    };

    charts.cal = createDoughnut(ctxCal);
    charts.prot = createDoughnut(ctxProt);
    updateCharts();
}

function updateCharts() {
    const target = GOALS[currentMode];
    let remainingCal = target.cal - consumed.cal;
    let remainingProt = target.prot - consumed.prot;
    
    const ctxCal = document.getElementById('caloriesChart').getContext('2d');
    const ctxProt = document.getElementById('proteinChart').getContext('2d');
    
    // Lógica de desbordamiento (Si te pasas de calorías/proteínas)
    let calColor = getGradient(ctxCal, '#ff9a9e', '#fecfef'); // Degradado normal
    if (remainingCal < 0) calColor = getGradient(ctxCal, '#ff0844', '#ffb199'); // Rojo fuego si te pasas
    
    let protColor = getGradient(ctxProt, '#4facfe', '#00f2fe'); // Azul
    if (remainingProt < 0) protColor = getGradient(ctxProt, '#43e97b', '#38f9d7'); // Verde éxito si logras meta

    charts.cal.data.datasets[0].data = [consumed.cal, Math.max(0, remainingCal)];
    charts.cal.data.datasets[0].backgroundColor = [calColor, 'rgba(0,0,0,0.05)'];
    charts.cal.update();

    charts.prot.data.datasets[0].data = [consumed.prot, Math.max(0, remainingProt)];
    charts.prot.data.datasets[0].backgroundColor = [protColor, 'rgba(0,0,0,0.05)'];
    charts.prot.update();

    // Actualizar el texto en el centro
    document.querySelector('#calText .value').innerText = consumed.cal;
    document.querySelector('#calText .label').innerText = `/ ${target.cal} kcal`;
    document.querySelector('#protText .value').innerText = `${consumed.prot}g`;
    document.querySelector('#protText .label').innerText = `/ ${target.prot}g`;
}

function getGradient(ctx, color1, color2) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 150);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    return gradient;
}

// ==========================================
// MANEJO DE IMÁGENES Y CÁMARA
// ==========================================
let currentImageBase64 = null;
const fileInput = document.createElement('input');
fileInput.type = 'file'; fileInput.accept = 'image/*';

document.getElementById('photoBtn').addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (re) => {
        currentImageBase64 = re.target.result.split(',')[1];
        document.getElementById('chatInput').placeholder = "📷 Foto lista. Escribe qué hacer...";
        document.getElementById('photoBtn').style.background = "var(--success)";
        document.getElementById('photoBtn').style.color = "white";
    };
    reader.readAsDataURL(file);
});

// ==========================================
// CHATBOT MULTIMODAL AVANZADO
// ==========================================
document.getElementById('sendBtn').addEventListener('click', async () => {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim() || (currentImageBase64 ? "Analiza esta imagen" : "");
    if(!msg) return;

    const chatLog = document.getElementById('chatLog');
    chatLog.insertAdjacentHTML('beforeend', `<div class="msg user">${currentImageBase64 ? '📷 ' : ''}${msg}</div>`);
    input.value = '';
    
    // Limpiar imagen después de enviar
    const imageToSend = currentImageBase64;
    currentImageBase64 = null;
    document.getElementById('chatInput').placeholder = "Pídeme una receta o registra tu comida...";
    document.getElementById('photoBtn').style.background = "";

    const loadingId = 'loading_' + Date.now();
    chatLog.insertAdjacentHTML('beforeend', `<div id="${loadingId}" class="msg bot">GymBro está pensando... 🤔</div>`);
    chatLog.scrollTop = chatLog.scrollHeight;

    try {
        const userRef = doc(db, "users", MY_USER_ID);
        const docSnap = await getDoc(userRef);
        let inventory = docSnap.exists() ? (docSnap.data().fridgeInventory || []) : [];
        let mealsHistory = docSnap.exists() ? (docSnap.data().mealsHistory || []) : [];

        // Extraemos solo nombres del inventario para enviárselos a la IA
        const fridgeNames = inventory.map(i => i.nombre).join(", ");

        const response = await fetch('/.netlify/functions/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: msg, imageBase64: imageToSend, currentFridge: fridgeNames })
        });

        if (!response.ok) throw new Error('Fallo de red');
        const data = await response.json(); 
        document.getElementById(loadingId).remove();

        // LÓGICA DE DECISIÓN DE LA IA
        let accionTexto = "";

        // 1. Si la IA decide que esto es para AGREGAR A LA NEVERA
        if (data.accion === "agregar_nevera" && data.ingredientes_a_agregar) {
            data.ingredientes_a_agregar.forEach(item => {
                inventory.push({
                    id: 'item_' + Date.now() + Math.random(),
                    nombre: item.nombre, cantidad_inicial: item.cantidad, cantidad_actual: item.cantidad,
                    unidad: item.unidad, porcentaje_restante: 100, categoria: item.categoria || "Despensa/Grasas",
                    fecha_ingreso: new Date().toISOString(), dias_para_vencer: 30
                });
                accionTexto += `<br>🧊 Añadido a nevera: ${item.cantidad}${item.unidad} de ${item.nombre}`;
            });
        }

        // 2. Si la IA decide REGISTRAR COMIDA
        if (data.accion === "registro_comida") {
            const macros = data.macros_calculados;
            const deduct = data.ingredientes_a_descontar || [];
            
            inventory = inventory.map(item => {
                const match = deduct.find(i => item.nombre.toLowerCase().includes(i.palabra_clave.toLowerCase()));
                if(match) {
                    item.cantidad_actual = Math.max(0, item.cantidad_actual - match.cantidad);
                    item.porcentaje_restante = Math.round((item.cantidad_actual / item.cantidad_inicial) * 100);
                    accionTexto += `<br>🔥 Restado de nevera: ${match.cantidad} de ${item.nombre}`;
                }
                return item;
            });

            mealsHistory.push({
                descripcion: msg.length > 30 ? msg.substring(0, 30) + "..." : (msg || "Registro por foto"),
                calorias: macros.calorias, proteina: macros.proteina_g, timestamp: Date.now()
            });

            consumed.cal += macros.calorias;
            consumed.prot += macros.proteina_g;
        }

        // Guardamos todo en la nube
        await updateDoc(userRef, { fridgeInventory: inventory, dailyLog: consumed, mealsHistory: mealsHistory });
        
        updateCharts();
        renderInventory();
        renderMealsHistory();

        chatLog.insertAdjacentHTML('beforeend', `<div class="msg bot">${data.mensaje_usuario} <small style="color:var(--success); display:block; margin-top:5px;">${accionTexto}</small></div>`);
        chatLog.scrollTop = chatLog.scrollHeight;

    } catch (error) {
        document.getElementById(loadingId)?.remove();
        chatLog.insertAdjacentHTML('beforeend', `<div class="msg bot" style="background:var(--danger); color:white;">Fallo de conexión.</div>`);
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