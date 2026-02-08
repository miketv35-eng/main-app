import 'dotenv/config';

if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY not found in environment');
    process.exit(1);
}

console.log('Testing Anthropic API connection...');

try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Ping' }]
        })
    });

    const data = await response.json();

    if (!response.ok) {
        console.error('API Error:', response.status, JSON.stringify(data, null, 2));
        process.exit(1);
    }

    console.log('Success! Response:', data.content[0].text);
} catch (error) {
    console.error('Connection Error:', error);
    process.exit(1);
}
