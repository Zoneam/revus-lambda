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
            const dataRec = {
              // prompt: `Given the following customer reviews for a product, summarize the reviews and identify recurring problems that are mentioned in 2 or more reviews. After each response add * symbol:\n\n${allReviews}\n\n`,
            //   prompt: `Summarize all of given customer reviews. Also tell me how many customers are mentioning same problem or positive feedback :\n\n${body.reviews}\n\n`,
              // prompt: `Summarize each customer review in maximum 6 word sentence. Also summarize all reviews in one sentence at the end :\n\n${body.reviews}\n\n`,
              prompt: `Your task is to generate summary of a product reviews from an e-commerce website.
              Summarize reviews below, delimited by triple ^.
              The summary is intended for customers to get general idea about overall quality of the product so should include all positive and negative comments.
              After writing summary identify a list of emotions that the writers of the following reviews are expressing. Format your answer as a list of lower-case words separated by commas in 2 bullet points grouped /nPositive and /nNegative.
              Each positive word in your response wrap in <span class="positive"> and similarly each negative word in your response wrap in <span class="negative">  

              Reviews: ^^^${body.reviews}^^^`,
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
