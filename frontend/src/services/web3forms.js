const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';

export function isWeb3FormsConfigured() {
  const key = String(import.meta.env.VITE_WEB3FORMS_ACCESS_KEY || '').trim();
  return Boolean(key);
}

export async function submitContactViaWeb3Forms({ name, email, subject, message }) {
  const accessKey = String(import.meta.env.VITE_WEB3FORMS_ACCESS_KEY || '').trim();
  if (!accessKey) {
    throw new Error('Contact email is not configured');
  }

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
    throw new Error(data.message || 'Could not send your message');
  }

  return data;
}
