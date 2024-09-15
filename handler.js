const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');

// Environment and external service variables
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MONGODB_URI = process.env.MONGODB_CONNECTION_STRING;
const SECRET = process.env.SECRET || 'default_secret';
const HEADERS = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
};

// Helper function to connect to the database
const connectToDB = async () => {
    return MongoClient.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
};

// Centralized response function with default headers
const respond = (statusCode, body, headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST"
}) => ({
    statusCode,
    headers,
    body: JSON.stringify(body),
});

// Token verification helper
const verifyToken = (token) => {
    try {
        jwt.verify(token, SECRET);
        return true;
    } catch (error) {
        throw new Error('Token verification failed: ' + error.message);
    }
};

// REGISTER FUNCTION
module.exports.register = async (event) => {
    try {
        const body = JSON.parse(event.body);
        const { email, password } = body || {};

        if (!email || !password) {
            return respond(400, { error: 'Email and password are required' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        let client = await connectToDB();
        const db = client.db('revus');
        const existingUser = await db.collection('users').findOne({ email });

        if (existingUser) {
            return respond(400, { error: 'Email already in use' });
        }

        await db.collection('users').insertOne({ email, password: hashedPassword });
        return respond(200, { message: 'Registration successful' });
    } catch (error) {
        return respond(500, { error: 'Internal server error', details: error.message });
    }
};

// LOGIN FUNCTION
module.exports.login = async (event) => {
    try {
        const body = JSON.parse(event.body);
        const { email, password } = body || {};

        if (!email || !password) {
            return respond(400, { error: 'Email and password are required' });
        }

        let client = await connectToDB();
        const db = client.db('revus');
        const user = await db.collection('users').findOne({ email });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return respond(400, { error: 'Invalid email or password' });
        }

        const token = jwt.sign({ userId: user._id }, SECRET, { expiresIn: '1h' });
        return respond(200, { token });
    } catch (error) {
        return respond(500, { error: 'Internal server error', details: error.message });
    }
};

// REVUS FUNCTION
module.exports.revus = async (event) => {
    try {
        // Token validation
        let token = event.headers.Authorization || event.headers.authorization;
        if (!token) return respond(401, { error: 'Authorization header missing' });

        const bearerPrefix = 'Bearer ';
        if (token.startsWith(bearerPrefix)) {
            token = token.slice(bearerPrefix.length);
        } else {
            return respond(401, { error: 'Invalid Authorization header format' });
        }

        verifyToken(token);

        // Process reviews
        const body = JSON.parse(event.body);
        if (!body.reviews) return respond(400, { error: 'Invalid reviews data' });

        const dataRec = {
            messages: [
                {
                    role: "system",
                    content: `You will be provided with Amazon product reviews, and your task is to summarize the reviews in 3 sentences and put them in the following format, starting with new line and ending with new line:
                    
                    ⭐ Overall summary of all reviews
                    ⭐ Positive reviews summary
                    ⭐ Negative reviews summary`
                },
                {
                    role: "user",
                    content: body.reviews.join("\n\n")
                }
            ],
            temperature: 0.5,
            model: "gpt-3.5-turbo",
            max_tokens: 256,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
        };

        const { data } = await axios.post(OPENAI_API_URL, dataRec, { headers: HEADERS });
        return respond(200, { summary: data.choices[0].message.content });
    } catch (error) {
        console.error('Error:', error);
        if (error instanceof SyntaxError) {
            return respond(400, { error: 'Invalid JSON data', event: event.body });
        }
        return respond(500, { error: 'Internal server error', details: error.message });
    }
};