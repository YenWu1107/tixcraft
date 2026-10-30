const getCookie = (name) =>
  document.cookie.split('; ').find((r) => r.startsWith(name + '='))?.split('=')[1]

export async function api(path, { method = 'GET', data } = {}) {
  const res = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') ?? '' },
    body: data ? JSON.stringify(data) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || '發生錯誤，請稍後再試')
  return json
}
