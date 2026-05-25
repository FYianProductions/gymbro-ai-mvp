exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { prompt } = JSON.parse(event.body);
        const { GoogleGenerativeAI } = await import('@google/generative-ai');

        if (!process.env.GEMINI_API_KEY) {
            throw new Error('Falta la variable GEMINI_API_KEY en Netlify');
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        // Usamos el modelo 2.5 Flash que tienes disponible en tu consola
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash", 
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        // Unimos el System Prompt y el mensaje del usuario en un solo bloque sólido
        const fullPrompt = `
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
                "calorias": 0,
                "proteina_g": 0
              },
              "ingredientes_a_descontar": [
                {
                  "palabra_clave_busqueda": "huevo", 
                  "cantidad_a_restar": 2,
                  "unidad_estimada": "unidades o g"
                }
              ]
            }

            MENSAJE DEL USUARIO: "${prompt}"
        `;

        const result = await model.generateContent(fullPrompt);
        const responseText = result.response.text();

        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
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