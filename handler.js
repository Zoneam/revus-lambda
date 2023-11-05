const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); 
const MongoClient = require('mongodb').MongoClient;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    "Access-Control-Allow-Credentials" : true,
    'Access-Control-Allow-Methods': 'POST', 
};

const OPENAI_API_URL = 'https://api.openai.com/v1/completions';
const HEADERS = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
};

const MONGODB_URI = process.env.MONGODB_CONNECTION_STRING;

const respond = (statusCode, body, headers = corsHeaders) => ({
    statusCode,
    headers,
    body: JSON.stringify(body),
});

// REGISTER FUNCTION
module.exports.register = async (event) => {
    let body;
    
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        return respond(400, { error: 'Could not parse JSON body' });
    }

    if (!body || !body.password) {
        return respond(400, { error: 'No password provided' });
    }

    const hashedPassword = bcrypt.hashSync(body.password, 10);
    
    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db('revus');
    await db.collection('users').insertOne({ email: body.email, password: hashedPassword });

    client.close();

    return respond(200, { message: 'Registration successful' });
};

// LOGIN FUNCTION
module.exports.login = async (event) => {
    const body = JSON.parse(event.body);
    
    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db('revus');
    const user = await db.collection('users').findOne({ email: body.email });

    client.close();

    if (!user || !bcrypt.compareSync(body.password, user.password)) {
        return respond(400, { error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.SECRET, { expiresIn: '1h' });

    return respond(200, { token });
};


// REVUS FUNCTION
module.exports.revus = async (event) => {
    const token = event.headers.Authorization || event.headers.authorization;
    if (!token) {
        return respond(401, { error: 'Authorization header missing' });
    }

    try {
        jwt.verify(token, process.env.SECRET);
    } catch (error) {
        return respond(401, { error: 'Token verification failed' });
    }

    try {
        const body = JSON.parse(event.body);

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