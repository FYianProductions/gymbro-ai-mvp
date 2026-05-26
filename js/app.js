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
let currentWeight = 54; 
let charts = {};

// Arreglo para que la IA recuerde la conversación (Memoria)
let chatHistory = []; 

// === UTILIDADES ===
// Convierte los **texto** en <strong>texto</strong> para que se vea bonito
function parseMarkdown(text) {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
}

async function initData() {
    try {
        const userRef = doc(db, "users", MY_USER_ID);
        const docSnap = await getDoc(userRef);

        if (!docSnap.exists()) {
            await setDoc(userRef, { fridgeInventory: [], dailyLog: { cal: 0, prot: 0 }, mealsHistory: [], profile: { weight: 54 } });
        } else {
            const data = docSnap.data();
            consumed = data.dailyLog || { cal: 0, prot: 0 };
            currentWeight = data.profile?.weight || 54;
        }
        
        document.getElementById('currentWeightDisplay').innerHTML = `${currentWeight} kg ✏️`;
        injectChartTextDivs();
        initCharts();
        renderInventory();
        renderMealsHistory();
    } catch (e) { console.error("Error inicio:", e); }
}

document.getElementById('currentWeightDisplay').addEventListener('click', async () => {
    const newW = prompt("¿Peso actual? (kg)", currentWeight);
    if(newW && !isNaN(newW)) {
        currentWeight = parseFloat(newW);
        document.getElementById('currentWeightDisplay').innerHTML = `${currentWeight} kg ✏️`;
        await updateDoc(doc(db, "users", MY_USER_ID), { profile: { weight: currentWeight } });
    }
});

// === GRÁFICOS ===
function injectChartTextDivs() {
    if(!document.getElementById('calText')){
        document.getElementById('caloriesChart').parentElement.innerHTML += `<div class="chart-center-text" id="calText"><div class="value">0</div><div class="label">kcal</div></div>`;
        document.getElementById('proteinChart').parentElement.innerHTML += `<div class="chart-center-text" id="protText"><div class="value">0</div><div class="label">prot</div></div>`;
    }
}

function initCharts() {
    const createDoughnut = (ctx) => new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['Consumido', 'Restante'], datasets: [{ data: [0, 100], borderWidth: 0, borderRadius: 20, cutout: '82%' }] },
        options: { responsive: true, plugins: { legend: { display: false }, tooltip: { enabled: false } }, layout: { padding: 5 } }
    });
    charts.cal = createDoughnut(document.getElementById('caloriesChart').getContext('2d'));
    charts.prot = createDoughnut(document.getElementById('proteinChart').getContext('2d'));
    updateCharts();
}

function updateCharts() {
    const t = GOALS[currentMode];
    let remCal = t.cal - consumed.cal, remProt = t.prot - consumed.prot;
    
    const ctxC = document.getElementById('caloriesChart').getContext('2d');
    const ctxP = document.getElementById('proteinChart').getContext('2d');
    
    let cColor = getGradient(ctxC, '#ff9a9e', '#fecfef');
    if (remCal < 0) cColor = getGradient(ctxC, '#ff0844', '#ffb199'); 
    
    let pColor = getGradient(ctxP, '#4facfe', '#00f2fe'); 
    if (remProt < 0) pColor = getGradient(ctxP, '#43e97b', '#38f9d7'); 

    charts.cal.data.datasets[0].data = [consumed.cal, Math.max(0, remCal)];
    charts.cal.data.datasets[0].backgroundColor = [cColor, 'rgba(0,0,0,0.05)'];
    charts.cal.update();

    charts.prot.data.datasets[0].data = [consumed.prot, Math.max(0, remProt)];
    charts.prot.data.datasets[0].backgroundColor = [pColor, 'rgba(0,0,0,0.05)'];
    charts.prot.update();

    document.querySelector('#calText .value').innerText = consumed.cal;
    document.querySelector('#calText .label').innerText = `/ ${t.cal} kcal`;
    document.querySelector('#protText .value').innerText = `${consumed.prot}g`;
    document.querySelector('#protText .label').innerText = `/ ${t.prot}g`;
}

function getGradient(ctx, c1, c2) {
    const g = ctx.createLinearGradient(0, 0, 0, 150);
    g.addColorStop(0, c1); g.addColorStop(1, c2); return g;
}

// === NEVERA E HISTORIAL ===
async function renderInventory() {
    const snap = await getDoc(doc(db, "users", MY_USER_ID));
    const inv = snap.exists() ? snap.data().fridgeInventory || [] : [];
    const list = document.getElementById('inventoryList');
    list.innerHTML = inv.length === 0 ? `<p class="item-meta" style="text-align:center;">Nevera vacía.</p>` : '';

    inv.forEach((item, idx) => {
        let cClass = item.porcentaje_restante <= 20 ? '#ff3b30' : (item.porcentaje_restante <= 50 ? '#ffcc00' : '#34c759'); 
        let macrosBadge = item.macros ? `<div class="macro-badges"><span class="macro-badge">P: ${item.macros.prot}g</span><span class="macro-badge">C: ${item.macros.carb}g</span><span class="macro-badge">G: ${item.macros.fat}g</span></div>` : '';

        list.insertAdjacentHTML('beforeend', `
            <div class="fridge-item">
                <div class="item-header">
                    <span>${item.nombre}</span>
                    <div class="item-actions">
                        <button class="btn-action btn-edit" data-idx="${idx}">Editar</button>
                        <button class="btn-action btn-delete" data-idx="${idx}">X</button>
                    </div>
                </div>
                <div class="item-meta">Quedan: ${item.cantidad_actual}${item.unidad} (${item.porcentaje_restante}%)</div>
                ${macrosBadge}
                <div class="progress-bg"><div class="progress-fill" style="width: ${item.porcentaje_restante}%; background: ${cClass}"></div></div>
            </div>
        `);
    });

    // Lógica de botones editar y borrar
    document.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', async (e) => {
        if(!confirm("¿Borrar este alimento?")) return;
        inv.splice(e.target.dataset.idx, 1);
        await updateDoc(doc(db, "users", MY_USER_ID), { fridgeInventory: inv });
        renderInventory();
    }));

    document.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', async (e) => {
        let i = e.target.dataset.idx;
        let nQty = prompt(`Nueva cantidad actual para ${inv[i].nombre} (${inv[i].unidad}):`, inv[i].cantidad_actual);
        if(nQty && !isNaN(nQty)){
            inv[i].cantidad_actual = parseFloat(nQty);
            inv[i].porcentaje_restante = Math.round((inv[i].cantidad_actual / inv[i].cantidad_inicial) * 100);
            await updateDoc(doc(db, "users", MY_USER_ID), { fridgeInventory: inv });
            renderInventory();
        }
    }));
}

document.getElementById('addFoodForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const inv = (await getDoc(doc(db, "users", MY_USER_ID))).data().fridgeInventory || [];
    inv.push({
        id: 'item_' + Date.now(), 
        nombre: document.getElementById('foodName').value, 
        cantidad_inicial: parseFloat(document.getElementById('foodQuantity').value), 
        cantidad_actual: parseFloat(document.getElementById('foodQuantity').value),
        unidad: document.getElementById('foodUnit').value, 
        porcentaje_restante: 100, 
        macros: {
            prot: parseFloat(document.getElementById('foodProt').value || 0),
            carb: parseFloat(document.getElementById('foodCarb').value || 0),
            fat: parseFloat(document.getElementById('foodFat').value || 0)
        },
        fecha_ingreso: new Date().toISOString(), dias_para_vencer: 30
    });
    await updateDoc(doc(db, "users", MY_USER_ID), { fridgeInventory: inv });
    document.getElementById('addFoodForm').reset();
    renderInventory();
});

// (Render historial se mantiene igual, abreviado por espacio, asegúrate de mantener tu renderMealsHistory aquí)
async function renderMealsHistory() {
    const hist = (await getDoc(doc(db, "users", MY_USER_ID))).data().mealsHistory || [];
    const list = document.getElementById('dailyMealsList');
    list.innerHTML = hist.length === 0 ? `<p class="item-meta" style="text-align:center;">Nada registrado hoy.</p>` : '';
    hist.forEach((m, i) => {
        list.insertAdjacentHTML('beforeend', `<div class="meal-card"><div class="meal-header"><span>${m.descripcion}</span><div class="meal-header-actions"><span>🔥 ${m.calorias} kcal</span><button class="btn-action btn-delete" data-idx="${i}">Eliminar</button></div></div><div class="meal-meta">Proteína: ${m.proteina}g</div></div>`);
    });
    document.querySelectorAll('#dailyMealsList .btn-delete').forEach(b => b.addEventListener('click', async (e) => {
        let idx = e.target.dataset.idx;
        consumed.cal = Math.max(0, consumed.cal - hist[idx].calorias);
        consumed.prot = Math.max(0, consumed.prot - hist[idx].proteina);
        hist.splice(idx, 1);
        await updateDoc(doc(db, "users", MY_USER_ID), { mealsHistory: hist, dailyLog: consumed });
        updateCharts(); renderMealsHistory();
    }));
}

// === CÁMARA ===
let currentImageBase64 = null;
const fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = 'image/*';
document.getElementById('photoBtn').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 800; canvas.height = img.height * (800 / img.width);
            const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            currentImageBase64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
            document.getElementById('chatInput').placeholder = "📷 Foto lista...";
            document.getElementById('photoBtn').style.background = "var(--success)";
        };
        img.src = event.target.result;
    }; reader.readAsDataURL(file);
});

// === CHATBOT MULTIMODAL CON MEMORIA ===
document.getElementById('sendBtn').addEventListener('click', async () => {
    const input = document.getElementById('chatInput');
    const msgText = input.value.trim();
    const msg = msgText || (currentImageBase64 ? "Analiza esta imagen" : "");
    if(!msg) return;

    const chatLog = document.getElementById('chatLog');
    chatLog.insertAdjacentHTML('beforeend', `<div class="msg user">${currentImageBase64 ? '📷 ' : ''}${msg}</div>`);
    input.value = '';
    
    // Guardar en la memoria local
    chatHistory.push(`Usuario: ${msg}`);
    // Mantener solo los últimos 6 mensajes para no saturar la IA
    if(chatHistory.length > 6) chatHistory.shift();
    const historyString = chatHistory.join("\n");

    const imageToSend = currentImageBase64;
    currentImageBase64 = null;
    document.getElementById('chatInput').placeholder = "Escribe...";
    document.getElementById('photoBtn').style.background = "rgba(0,0,0,0.05)";

    const loadId = 'load_' + Date.now();
    chatLog.insertAdjacentHTML('beforeend', `<div id="${loadId}" class="msg bot"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`);
    chatLog.scrollTop = chatLog.scrollHeight;

    try {
        const userRef = doc(db, "users", MY_USER_ID);
        const docSnap = await getDoc(userRef);
        let inv = docSnap.exists() ? (docSnap.data().fridgeInventory || []) : [];
        let hist = docSnap.exists() ? (docSnap.data().mealsHistory || []) : [];
        const fNames = inv.map(i => i.nombre).join(", ");

        const response = await fetch('/.netlify/functions/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: msg, imageBase64: imageToSend, currentFridge: fNames, history: historyString })
        });

        if (!response.ok) throw new Error('Fallo de red');
        const data = await response.json(); 
        document.getElementById(loadId).remove();

        let accText = "";
        
        if (data.accion === "agregar_nevera" && data.ingredientes_a_agregar) {
            data.ingredientes_a_agregar.forEach(i => {
                inv.push({
                    id: 'item_'+Date.now()+Math.random(), nombre: i.nombre, cantidad_inicial: i.cantidad, cantidad_actual: i.cantidad,
                    unidad: i.unidad, porcentaje_restante: 100, macros: i.macros_por_100g || {prot:0, carb:0, fat:0}, dias_para_vencer: 30
                });
                accText += `<br>🧊 Añadido: ${i.cantidad}${i.unidad} de ${i.nombre}`;
            });
        }

        if (data.accion === "registro_comida") {
            const m = data.macros_calculados;
            const deduct = data.ingredientes_a_descontar || [];
            
            inv = inv.map(item => {
                const match = deduct.find(d => item.nombre.toLowerCase().includes(d.palabra_clave.toLowerCase()));
                if(match) {
                    item.cantidad_actual = Math.max(0, item.cantidad_actual - match.cantidad);
                    item.porcentaje_restante = Math.round((item.cantidad_actual / item.cantidad_inicial) * 100);
                    accText += `<br>🔥 Restado: ${match.cantidad} de ${item.nombre}`;
                }
                return item;
            });

            hist.push({ descripcion: msg.substring(0, 30), calorias: m.calorias, proteina: m.proteina_g, timestamp: Date.now() });
            consumed.cal += m.calorias; consumed.prot += m.proteina_g;
        }

        await updateDoc(userRef, { fridgeInventory: inv, dailyLog: consumed, mealsHistory: hist });
        updateCharts(); renderInventory(); renderMealsHistory();

        // Parseamos el Markdown (Negritas)
        const formatMsg = parseMarkdown(data.mensaje_usuario);
        chatLog.insertAdjacentHTML('beforeend', `<div class="msg bot">${formatMsg} <small style="color:var(--success);display:block;">${accText}</small></div>`);
        
        // Guardar la respuesta de la IA en la memoria
        chatHistory.push(`IA: ${data.mensaje_usuario}`);

    } catch (e) {
        document.getElementById(loadId)?.remove();
        chatLog.insertAdjacentHTML('beforeend', `<div class="msg bot" style="background:var(--danger);color:white;">Fallo de conexión ⚠️</div>`);
    }
    chatLog.scrollTop = chatLog.scrollHeight;
});

// TABS
document.getElementById('restModeToggle').addEventListener('change', (e) => { currentMode = e.target.checked ? 'rest' : 'active'; updateCharts(); });
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn, .tab-view').forEach(e => e.classList.remove('active'));
        btn.classList.add('active'); document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

initData();