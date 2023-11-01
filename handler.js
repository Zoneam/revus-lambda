const axios = require('axios');

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST', 
};

const OPENAI_API_URL = 'https://api.openai.com/v1/completions';
const HEADERS = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
};

const respond = (statusCode, body, headers = corsHeaders) => ({
    statusCode,
    headers,
    body: JSON.stringify(body),
});

const isPostMethod = (httpMethod) => httpMethod === 'POST';

module.exports.revus = async (event) => {
    if (!isPostMethod(event.httpMethod)) {
        return respond(400, { error: 'Invalid request method. Only POST requests are allowed.' });
    }

    try {
        const body = JSON.parse(event.body);

        if (!body.reviews) {
            return respond(400, { error: 'Missing required parameter: reviews' });
        } 
        
        if (typeof body.reviews !== 'string') {
            return respond(400, { error: 'Invalid parameter type: reviews. Expected string.' });
        } 

        const dataRec = {
            prompt: `Provide a balanced summary of the following reviews in up to four sentences. Make sure to highlight both positive and negative comments. After the summary, list emotions expressed in the reviews, categorized into 'Positive' and 'Negative'.

            Reviews: ^^^${body.reviews}^^^`,
            temperature: 0.7,
            model: "text-davinci-002",
            max_tokens: 150,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
        };

        const { data } = await axios.post(OPENAI_API_URL, dataRec, { headers: HEADERS });
        
        return respond(200, data.choices[0].text);
    } catch (error) {
        if (error instanceof SyntaxError) {
            return respond(400, { error: 'Invalid JSON data', event: event.body });
        }
        
        return respond(500, { error: error.message });
    }
};
