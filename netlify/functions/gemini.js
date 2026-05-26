exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const { prompt, imageBase64, currentFridge } = JSON.parse(event.body);
        const { GoogleGenerativeAI } = await import('@google/generative-ai');

        if (!process.env.GEMINI_API_KEY) throw new Error('Falta GEMINI_API_KEY');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const fullPrompt = `
            Actúa como "GymBro AI", nutricionista y chef experto.
            USUARIO: 15 años, 1.81m, 54kg (Volumen muscular).
            INVENTARIO ACTUAL: ${currentFridge}
            
            MISIÓN: Analiza el texto o la imagen del usuario y determina qué quiere hacer.
            
            RESPONDE EXCLUSIVAMENTE CON ESTE JSON VÁLIDO:
            {
              "mensaje_usuario": "Texto respondiendo, dando la receta o confirmando el registro",
              "accion": "registro_comida | agregar_nevera | dar_receta | charlar",
              "macros_calculados": { "calorias": 0, "proteina_g": 0 },
              "ingredientes_a_descontar": [ { "palabra_clave": "huevo", "cantidad": 2 } ],
              "ingredientes_a_agregar": [ { "nombre": "Leche Entera", "cantidad": 1000, "unidad": "ml", "categoria": "Lácteos" } ]
            }

            MENSAJE: "${prompt}"
        `;

        // Si hay imagen, la empaquetamos para Gemini Vision
        let result;
        if (imageBase64) {
            const imagePart = {
                inlineData: { data: imageBase64, mimeType: "image/jpeg" }
            };
            result = await model.generateContent([fullPrompt, imagePart]);
        } else {
            result = await model.generateContent(fullPrompt);
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: result.response.text()
        };

    } catch (error) {
        console.error(error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};