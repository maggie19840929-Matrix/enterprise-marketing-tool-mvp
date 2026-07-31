import {
  hasValidBackgroundGenerationAuth,
  markBackgroundGenerationFailure,
  runBackgroundGeneration,
} from './api.mjs';

export default async (request) => {
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  if (!hasValidBackgroundGenerationAuth(request)) return json({ ok: false, error: 'unauthorized' }, 401);
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  if (!String(body.client_id || '').trim() || !String(body.task_id || '').trim()) {
    return json({ ok: false, error: 'missing_client_id_or_task_id' }, 400);
  }
  try {
    const task = await runBackgroundGeneration({ client_id: body.client_id, task_id: body.task_id });
    return json({ ok: true, task_id: task.task_id, status: task.status });
  } catch (error) {
    console.error(JSON.stringify({ event: 'generate_background_failed', task_id: body?.task_id || '', reason: error?.message || 'unknown' }));
    await markBackgroundGenerationFailure({
      client_id: body?.client_id || '',
      task_id: body?.task_id || '',
      error: error?.message || 'background_generation_failed',
    }).catch(() => null);
    return json({ ok: false, task_id: body?.task_id || '', error: error?.message || 'background_generation_failed' }, 500);
  }
};
