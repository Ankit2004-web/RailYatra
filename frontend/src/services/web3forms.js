const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';

/** Fallback when VITE_ env not baked at build time (matches render.yaml). */
const DEFAULT_ACCESS_KEY = 'f8d13fbf-80b4-4dbc-bab1-e6b5c38d84f8';

function getAccessKey() {
  return String(import.meta.env.VITE_WEB3FORMS_ACCESS_KEY || DEFAULT_ACCESS_KEY).trim();
}

export function isWeb3FormsConfigured() {
  return Boolean(getAccessKey());
}

export async function submitContactViaWeb3Forms({ name, email, subject, message }) {
  const accessKey = getAccessKey();

  const response = await fetch(WEB3FORMS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      access_key: accessKey,
      botcheck: false,
      from_name: import.meta.env.VITE_WEB3FORMS_FROM_NAME || 'RailYatra',
      name,
      email,
      replyto: email,
      subject: subject?.trim() || 'RailYatra support enquiry',
      message
    })
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok || !data.success) {
    throw new Error(data.message || `Could not send your message (${response.status})`);
  }

  return data;
}
