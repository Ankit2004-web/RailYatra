const logger = require('../utils/logger');

const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';

const getAccessKey = () => String(process.env.WEB3FORMS_ACCESS_KEY || '').trim();

const isWeb3FormsConfigured = () => Boolean(getAccessKey());

const submitToWeb3Forms = async (fields) => {
    const accessKey = getAccessKey();
    if (!accessKey) {
        throw new Error('Web3Forms is not configured');
    }

    const response = await fetch(WEB3FORMS_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
        },
        body: JSON.stringify({
            access_key: accessKey,
            botcheck: false,
            from_name: process.env.WEB3FORMS_FROM_NAME || 'RailYatra',
            ...fields
        })
    });

    let data = {};
    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok || !data.success) {
        const message = data.message || `Web3Forms request failed (${response.status})`;
        logger.error('Web3Forms submit failed', { status: response.status, message });
        throw new Error(message);
    }

    return data;
};

module.exports = {
    isWeb3FormsConfigured,
    submitToWeb3Forms
};
