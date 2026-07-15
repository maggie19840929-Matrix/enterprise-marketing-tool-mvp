import { pullFeishuBitableRecords } from './api.mjs';

export default async () => {
  try {
    const result = await pullFeishuBitableRecords({}, { trigger: 'scheduled' });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  } catch (error) {
    const result = {
      ok: false,
      skipped: true,
      mode: 'bitable_pull',
      trigger: 'scheduled',
      reason: 'scheduled_pull_failed',
    };
    console.error(JSON.stringify({ event: 'feishu_bitable_scheduled_failed', reason: error?.message || 'unknown' }));
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
};

export const config = {
  schedule: '*/15 * * * *',
};
