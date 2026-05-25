exports.handler = async function(event, context) {
    // Validar método POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { prompt } = JSON.parse(event.body);

        // Importación dinámica para evitar errores de módulos en Node.js de Netlify
        const { GoogleGenerativeAI } = await import('@google/generative-ai');

        // Validar que la API Key exista en el servidor
        if (!process.env.GEMINI_API_KEY) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Falta la variable de entorno GEMINI_API_KEY en Netlify' })
            };
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        const systemInstruction = `
            Actúa como "GymBro AI", un experto nutricionista y asistente de volumen muscular.
            CONTEXTO DEL USUARIO: 15 años, 1.81m, 54 kg (En volumen muscular masivo).
            
            TU MISIÓN:
            1. Calcular estimadamente calorías y macros del mensaje.
            2. Analizar el texto para deducir qué alimentos se consumieron y cantidad.
            3. RESPONDE EXCLUSIVAMENTE CON UN OBJETO JSON VÁLIDO. Cero texto adicional.
            
            ESTRUCTURA EXACTA REQUERIDA:
            {
              "mensaje_usuario": "Texto corto felicitando al usuario por la comida.",
              "macros_calculados": {
                "calorias": <number>,
                "proteina_g": <number>
              },
              "ingredientes_a_descontar": [
                {
                  "palabra_clave_busqueda": "huevo", 
                  "cantidad_a_restar": <number>,
                  "unidad_estimada": "unidades o g"
                }
              ]
            }
        `;

        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash-latest",
            systemInstruction: systemInstruction,
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*' // Evita bloqueos de CORS
            },
            body: responseText 
        };

    } catch (error) {
        console.error("Error detallado en el backend:", error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message || 'Fallo en el servidor' }) 
        };
    }
};