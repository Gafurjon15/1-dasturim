const serverless = require('serverless-http');
const { app, initializeDatabase } = require('../../server');

const handleRequest = serverless(app);

exports.handler = async (event, context) => {
    try {
        await initializeDatabase();
        return await handleRequest(event, context);
    } catch (error) {
        console.error('Netlify API ishga tushmadi:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Server yoki ma’lumotlar bazasi sozlanmagan.' })
        };
    }
};
