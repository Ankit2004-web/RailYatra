import { api } from './client';

export async function loadCaptcha() {
  return api.get('/captcha');
}
