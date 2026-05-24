const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.handler = async function(event, context) {
    // Solo permitimos peticiones POST desde nuestro frontend
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // Extraemos el mensaje del usuario enviado desde app.js
        const { prompt } = JSON.parse(event.body);

        // Inicializamos el SDK con la Variable de Entorno segura de Netlify
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        // System Prompt Maestro (Instrucciones del sistema)
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

        // Configuramos el modelo Flash con modo JSON estricto
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: systemInstruction,
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        // Ejecutamos la petición a la IA
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Devolvemos el JSON de Gemini a nuestro frontend
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: responseText 
        };

    } catch (error) {
        console.error("Error en la función serverless:", error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: 'Fallo al conectar con el cerebro de GymBro AI' }) 
        };
    }
};