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
let currentWeight = 54; // Peso inicial por defecto
let charts = {};

// ==========================================
// 2. INICIALIZACIÓN Y DESCARGA DE DATOS
// ==========================================
async function initData() {
    try {
        const userRef = doc(db, "users", MY_USER_ID);
        const docSnap = await getDoc(userRef);

        if (!docSnap.exists()) {
            await setDoc(userRef, { 
                fridgeInventory: [], 
                dailyLog: { cal: 0, prot: 0 }, 
                mealsHistory: [],
                profile: { weight: 54 }
            });
        } else {
            const data = docSnap.data();
            consumed = data.dailyLog || { cal: 0, prot: 0 };
            currentWeight = data.profile?.weight || 54;
        }
        
        // Actualizar UI del peso
        document.getElementById('currentWeightDisplay').innerHTML = `${currentWeight} kg ✏️`;

        injectChartTextDivs();
        initCharts();
        renderInventory();
        renderMealsHistory();
    } catch (error) {
        console.error("Error al inicializar datos:", error);
    }
}

// ==========================================
// 3. EDITAR PESO MANUALMENTE
// ==========================================
document.getElementById('currentWeightDisplay').addEventListener('click', async () => {
    const newWeight = prompt("¿Cuál es tu peso actual bro? (kg)", currentWeight);
    if(newWeight && !isNaN(newWeight)) {
        currentWeight = parseFloat(newWeight);
        document.getElementById('currentWeightDisplay').innerHTML = `${currentWeight} kg ✏️`;
        
        try {
            const userRef = doc(db, "users", MY_USER_ID);
            await updateDoc(userRef, { profile: { weight: currentWeight } });
        } catch(e) { console.error("Error guardando peso", e); }
    }
});

// ==========================================
// 4. GRÁFICOS Y DEGRADADOS (UI PREMIUM)
// ==========================================
function injectChartTextDivs() {
    const calContainer = document.getElementById('caloriesChart').parentElement;
    const protContainer = document.getElementById('proteinChart').parentElement;
    
    // Evita duplicados si se llama dos veces
    if(!document.getElementById('calText')){
        calContainer.innerHTML += `<div class="chart-center-text" id="calText"><div class="value">0</div><div class="label">kcal</div></div>`;
        protContainer.innerHTML += `<div class="chart-center-text" id="protText"><div class="value">0</div><div class="label">prot</div></div>`;
    }
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
    
    let calColor = getGradient(ctxCal, '#ff9a9e', '#fecfef');
    if (remainingCal < 0) calColor = getGradient(ctxCal, '#ff0844', '#ffb199'); 
    
    let protColor = getGradient(ctxProt, '#4facfe', '#00f2fe'); 
    if (remainingProt < 0) protColor = getGradient(ctxProt, '#43e97b', '#38f9d7'); 

    charts.cal.data.datasets[0].data = [consumed.cal, Math.max(0, remainingCal)];
    charts.cal.data.datasets[0].backgroundColor = [calColor, 'rgba(0,0,0,0.05)'];
    charts.cal.update();

    charts.prot.data.datasets[0].data = [consumed.prot, Math.max(0, remainingProt)];
    charts.prot.data.datasets[0].backgroundColor = [protColor, 'rgba(0,0,0,0.05)'];
    charts.prot.update();

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
// 5. RENDERS COMPLETOS (NEVERA E HISTORIAL)
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
            list.innerHTML = `<p class="item-meta" style="text-align:center; padding:10px;">Tu nevera está vacía bro.</p>`;
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
    } catch (err) { console.error("Error inventario:", err); }
}

async function renderMealsHistory() {
    try {
        const userRef = doc(db, "users", MY_USER_ID);
        const docSnap = await getDoc(userRef);
        if (!docSnap.exists()) return;

        const history = docSnap.data().mealsHistory || [];
        const list = document.getElementById('dailyMealsList');
        list.innerHTML = '';

        if(history.length === 0) {
            list.innerHTML = `<p class="item-meta" style="text-align:center; padding:10px;">No has registrado comidas hoy.</p>`;
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

        document.querySelectorAll('.btn-edit-meal').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const idx = e.target.getAttribute('data-index');
                await deleteMealRecord(idx);
            });
        });
    } catch (err) { console.error("Error historial:", err); }
}

async function deleteMealRecord(index) {
    try {
        const userRef = doc(db, "users", MY_USER_ID);
        const docSnap = await getDoc(userRef);
        let history = docSnap.data().mealsHistory || [];
        const removedMeal = history[index];

        consumed.cal = Math.max(0, consumed.cal - removedMeal.calorias);
        consumed.prot = Math.max(0, consumed.prot - removedMeal.proteina);
        history.splice(index, 1);

        await updateDoc(userRef, { mealsHistory: history, dailyLog: consumed });
        updateCharts();
        renderMealsHistory();
    } catch (error) { console.error("Error borrando comida:", error); }
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

    const newItem = {
        id: 'item_' + Date.now(), nombre: name, cantidad_inicial: qty, cantidad_actual: qty,
        unidad: unit, porcentaje_restante: 100, categoria: category,
        fecha_ingreso: new Date().toISOString(), dias_para_vencer: daysExp
    };

    try {
        const userRef = doc(db, "users", MY_USER_ID);
        const docSnap = await getDoc(userRef);
        const currentInventory = docSnap.exists() ? (docSnap.data().fridgeInventory || []) : [];
        currentInventory.push(newItem);
        await updateDoc(userRef, { fridgeInventory: currentInventory });
        document.getElementById('addFoodForm').reset();
        renderInventory();
    } catch (error) { console.error("Error alimento:", error); }
});

// ==========================================
// 6. CÁMARA (COMPRESIÓN INTELIGENTE)
// ==========================================
let currentImageBase64 = null;
const fileInput = document.createElement('input');
fileInput.type = 'file'; fileInput.accept = 'image/*';

document.getElementById('photoBtn').addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    
    // COMPRESIÓN DE IMAGEN PARA EVITAR ERROR 500 EN NETLIFY
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800; // Resolución segura para la IA y Netlify
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Exporta a JPEG calidad 70% (baja el peso de 5MB a ~100KB)
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            currentImageBase64 = compressedDataUrl.split(',')[1];
            
            document.getElementById('chatInput').placeholder = "📷 Foto subida. Escribe qué hacer...";
            document.getElementById('photoBtn').style.background = "var(--success)";
            document.getElementById('photoBtn').style.color = "white";
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// ==========================================
// 7. CHATBOT MULTIMODAL CON ANIMACIÓN
// ==========================================
document.getElementById('sendBtn').addEventListener('click', async () => {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim() || (currentImageBase64 ? "Analiza esta imagen" : "");
    if(!msg) return;

    const chatLog = document.getElementById('chatLog');
    chatLog.insertAdjacentHTML('beforeend', `<div class="msg user">${currentImageBase64 ? '📷 ' : ''}${msg}</div>`);
    input.value = '';
    
    const imageToSend = currentImageBase64;
    currentImageBase64 = null;
    document.getElementById('chatInput').placeholder = "Pídeme una receta o registra tu comida...";
    document.getElementById('photoBtn').style.background = "";
    document.getElementById('photoBtn').style.color = "var(--text-main)";

    // ANIMACIÓN DE ESCRITURA (LOS 3 PUNTOS)
    const loadingId = 'loading_' + Date.now();
    chatLog.insertAdjacentHTML('beforeend', `<div id="${loadingId}" class="msg bot"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`);
    chatLog.scrollTop = chatLog.scrollHeight;

    try {
        const userRef = doc(db, "users", MY_USER_ID);
        const docSnap = await getDoc(userRef);
        let inventory = docSnap.exists() ? (docSnap.data().fridgeInventory || []) : [];
        let mealsHistory = docSnap.exists() ? (docSnap.data().mealsHistory || []) : [];
        const fridgeNames = inventory.map(i => i.nombre).join(", ");

        const response = await fetch('/.netlify/functions/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: msg, imageBase64: imageToSend, currentFridge: fridgeNames })
        });

        if (!response.ok) throw new Error('Fallo de red al servidor');
        const data = await response.json(); 
        document.getElementById(loadingId).remove(); // Quita la animación de carga

        let accionTexto = "";
        
        // Agregar ingredientes por IA
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

        // Registrar comida por IA
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

        await updateDoc(userRef, { fridgeInventory: inventory, dailyLog: consumed, mealsHistory: mealsHistory });
        
        updateCharts();
        renderInventory();
        renderMealsHistory();

        chatLog.insertAdjacentHTML('beforeend', `<div class="msg bot">${data.mensaje_usuario} <small style="color:var(--success); display:block; margin-top:5px;">${accionTexto}</small></div>`);
        chatLog.scrollTop = chatLog.scrollHeight;

    } catch (error) {
        document.getElementById(loadingId)?.remove();
        chatLog.insertAdjacentHTML('beforeend', `<div class="msg bot" style="background:var(--danger); color:white;">Fallo de conexión.</div>`);
        console.error(error);
    }
});

// TABS & SWITCH LOGIC
document.getElementById('restModeToggle').addEventListener('change', (e) => { currentMode = e.target.checked ? 'rest' : 'active'; updateCharts(); });
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.getAttribute('data-tab')).classList.add('active');
    });
});

// ARRANCAR
initData();