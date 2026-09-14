const defaultBackendOrigin = 'https://content-studio-wbb3.onrender.com'

export function onRequest({ request, env }) {
  const backend = new URL(env.BACKEND_ORIGIN || defaultBackendOrigin)
  if (backend.protocol !== 'https:') {
    return new Response('BACKEND_ORIGIN must use HTTPS.', { status: 500 })
  }

  const target = new URL(request.url)
  target.protocol = backend.protocol
  target.host = backend.host
  return fetch(new Request(target, request))
}
