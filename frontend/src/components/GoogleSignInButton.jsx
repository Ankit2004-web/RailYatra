import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

const GSI_SRC = 'https://accounts.google.com/gsi/client';

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Could not load Google Sign-In')), { once: true });
      if (window.google?.accounts?.id) resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Google Sign-In'));
    document.head.appendChild(script);
  });
}

export default function GoogleSignInButton({ onCredential, onError, disabled = false }) {
  const hostRef = useRef(null);
  const callbacksRef = useRef({ onCredential, onError });
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  callbacksRef.current = { onCredential, onError };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
        const config = await api.get('/oauth/google/config').catch(() => ({ clientId: '', enabled: false }));
        const clientId = String(config.clientId || envClientId || '').trim();
        if (!clientId || cancelled) {
          setEnabled(false);
          return;
        }

        await loadGoogleIdentity();
        if (cancelled || !window.google?.accounts?.id) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            try {
              if (!response?.credential) {
                throw new Error('Google did not return a sign-in token');
              }
              await callbacksRef.current.onCredential(response.credential);
            } catch (err) {
              callbacksRef.current.onError?.(err);
            }
          },
          ux_mode: 'popup',
          use_fedcm_for_prompt: true,
          auto_select: false,
          cancel_on_tap_outside: true,
          itp_support: true
        });

        if (!cancelled) {
          setEnabled(true);
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setEnabled(false);
          callbacksRef.current.onError?.(err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !hostRef.current || !window.google?.accounts?.id) return;

    let lastWidth = 0;
    const render = () => {
      if (!hostRef.current) return;
      const width = Math.max(240, Math.min(400, Math.floor(hostRef.current.clientWidth || 320)));
      if (width === lastWidth && hostRef.current.childElementCount) return;
      lastWidth = width;
      hostRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(hostRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width
      });
    };

    render();
    const observer = new ResizeObserver(render);
    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, [ready]);

  if (!enabled) return null;

  return (
    <div className={`google-signin-block${disabled ? ' is-disabled' : ''}`}>
      <p className="auth-divider">or</p>
      <div className="google-signin-host" ref={hostRef} />
    </div>
  );
}
