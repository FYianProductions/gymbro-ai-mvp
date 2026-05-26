exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const { prompt, imageBase64, currentFridge, history } = JSON.parse(event.body);
        const { GoogleGenerativeAI } = await import('@google/generative-ai');

        if (!process.env.GEMINI_API_KEY) throw new Error('Falta GEMINI_API_KEY');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        const fullPrompt = `
            Actúa como "GymBro AI", nutricionista y chef.
            USUARIO: 15 años, 1.81m, Volumen muscular.
            INVENTARIO ACTUAL: ${currentFridge}
            
            HISTORIAL DE LA CONVERSACIÓN (Para que recuerdes el contexto):
            ${history}
            
            MISIÓN: Analiza el texto o la imagen y determina qué quiere hacer.
            RESPONDE EXCLUSIVAMENTE CON ESTE JSON VÁLIDO:
            {
              "mensaje_usuario": "Texto usando formato markdown con **negritas** para ser amigable",
              "accion": "registro_comida | agregar_nevera | dar_receta | charlar",
              "macros_calculados": { "calorias": 0, "proteina_g": 0 },
              "ingredientes_a_descontar": [ { "palabra_clave": "huevo", "cantidad": 2 } ],
              "ingredientes_a_agregar": [ { "nombre": "Leche", "cantidad": 1000, "unidad": "ml", "categoria": "Lácteos", "macros_por_100g": {"prot":3, "carb":4, "gras":1} } ]
            }

            NUEVO MENSAJE: "${prompt}"
        `;

        let result;
        if (imageBase64) {
            result = await model.generateContent([fullPrompt, { inlineData: { data: imageBase64, mimeType: "image/jpeg" } }]);
        } else {
            result = await model.generateContent(fullPrompt);
        }

        // Limpiamos la respuesta en caso de que la IA añada texto extra
        let cleanJson = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: cleanJson
        };

    } catch (error) {
        console.error(error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};