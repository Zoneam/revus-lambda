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

const respond = (statusCode, body, headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': true,
    'Access-Control-Allow-Methods': 'POST',
}) => ({
    statusCode,
    headers,
    body: JSON.stringify(body),
});

// REGISTER FUNCTION
module.exports.register = async (event) => {
    let body;
    
    try {
      body = JSON.parse(event.body);
    } catch (error) {
      return respond(400, { error: 'Could not parse JSON body' });
    }
  
    const { email, password } = body;
    
    if (!email || !password) {
      return respond(400, { error: 'Email and password are required' });
    }
  
    let client;
    
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      client = await MongoClient.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
      const db = client.db('revus');
      const existingUser = await db.collection('users').findOne({ email });
      
      if (existingUser) {
        return respond(400, { error: 'Email already in use' });
      }
  
      await db.collection('users').insertOne({ email, password: hashedPassword });
      return respond(200, { message: 'Registration successful' });
    } catch (error) {
      return respond(500, { error: 'Internal server error' });
    } finally {
      if (client) {
        client.close();
      }
    }
  };

// LOGIN FUNCTION
module.exports.login = async (event) => {
    const { body: rawBody } = event;
    let body;

    if (!rawBody) {
        return respond(400, { error: 'No data submitted' });
    }

    try {
        body = JSON.parse(rawBody);
    } catch (error) {
        return respond(400, { error: 'Could not parse JSON body' });
    }

    const { email, password } = body;
    if (!email || !password) {
        return respond(400, { error: 'Email and password are required' });
    }

    let client;

    try {
        client = await MongoClient.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        const db = client.db('revus');
        const user = await db.collection('users').findOne({ email });

        if (!user) {
            return respond(400, { error: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return respond(400, { error: 'Invalid email or password' });
        }

        const { _id } = user;
        const token = jwt.sign({ userId: _id }, process.env.SECRET, { expiresIn: '1h' });

        return respond(200, { token });
    } catch (error) {
        return respond(500, { error: error.message });
    } finally {
        if (client) {
            client.close();
        }
    }
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