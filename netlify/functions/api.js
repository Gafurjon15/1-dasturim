const serverless = require('serverless-http');
const { app, initializeDatabase } = require('../../server');

const handleRequest = serverless(app);

exports.handler = async (event, context) => {
    try {
        await initializeDatabase();
        return await handleRequest(event, context);
    } catch (error) {
        console.error('Netlify API ishga tushmadi:', error);
        const statusCode = Number.isInteger(error.status) ? error.status : 500;
        return {
            statusCode,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: statusCode < 500 || statusCode === 503
                    ? error.message
                    : 'API yoki ma’lumotlar bazasi sozlanmagan. Netlify Function loglarini tekshiring.'
            })
        };
    }
};
