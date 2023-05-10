const axios = require('axios');

module.exports.revus = async (event) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*', // Required for CORS support to work
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST', 
      }
      const url = `https://api.openai.com/v1/completions`;
      const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        };
  // Check if the request is a POST request
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid request method. Only POST requests are allowed.' }),
    };
  }

  try {
    let body;
    try {
      body = JSON.parse(event.body);
        if (!body.reviews) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Missing required parameter: reviews' }),
          };
        } else if (typeof body.reviews !== 'string') {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Invalid parameter type: reviews. Expected string.' }),
          };
        } else {
            console.log('body------->>', body.reviews)
            const dataRec = {
              // prompt: `Given the following customer reviews for a product, summarize the reviews and identify recurring problems that are mentioned in 2 or more reviews. After each response add * symbol:\n\n${allReviews}\n\n`,
              prompt: `Summarize all of given customer reviews. Also tell me how many customers are mentioning same problem or positive feedback :\n\n${body.reviews}\n\n`,
              temperature: 0.7,
              model: "text-davinci-002",
              max_tokens: 150,
              top_p: 1,
              frequency_penalty: 0,
              presence_penalty: 0,
            };
            const { data } = await axios.post(url, dataRec, { headers });
            return {
              statusCode: 200,
              headers: corsHeaders,
              body: JSON.stringify(data.choices[0].text),
            };
        }
    } catch (error) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid JSON data', event: event.body}),
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
