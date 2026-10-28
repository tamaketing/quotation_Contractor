import { json, err, requireUser, randomId } from './_utils.js';

export function makeHandlers(table, noField) {
  // table: 'invoices' etc; noField: 'invoice_no' etc
  return {
    async list({ request, env }) {
      const user = await requireUser(request, env);
      if (!user) return err('Unauthorized', 401);
      const { results } = await env.DB.prepare(
        `SELECT id, ${noField} as docNo, data, created_at, updated_at FROM ${table} WHERE company_id = ? ORDER BY updated_at DESC`
      ).bind(user.company_id).all();
      return json({ items: results.map(r => ({ id: r.id, docNo: r.docNo, ...safeParse(r.data), createdAt: r.created_at, updatedAt: r.updated_at })) });
    },
    async create({ request, env }) {
      const user = await requireUser(request, env);
      if (!user) return err('Unauthorized', 401);
      let body; try { body = await request.json(); } catch { return err('Invalid JSON'); }
      const id = body.id || randomId();
      const docNo = body.docNo || body[noField.replace('_no','No')] || '';
      await env.DB.prepare(`INSERT INTO ${table} (id, company_id, ${noField}, data) VALUES (?, ?, ?, ?)`)
        .bind(id, user.company_id, docNo, JSON.stringify(body.data || body)).run();
      return json({ id, docNo }, 201);
    },
    async get({ request, env, params }) {
      const user = await requireUser(request, env);
      if (!user) return err('Unauthorized', 401);
      const id = params.id;
      const row = await env.DB.prepare(`SELECT id, ${noField} as docNo, data, created_at, updated_at FROM ${table} WHERE id = ? AND company_id = ?`).bind(id, user.company_id).first();
      if (!row) return err('Not found', 404);
      return json({ id: row.id, docNo: row.docNo, ...safeParse(row.data), createdAt: row.created_at, updatedAt: row.updated_at });
    },
    async update({ request, env, params }) {
      const user = await requireUser(request, env);
      if (!user) return err('Unauthorized', 401);
      const id = params.id;
      let body; try { body = await request.json(); } catch { return err('Invalid JSON'); }
      const docNo = body.docNo || body[noField.replace('_no','No')] || '';
      await env.DB.prepare(`UPDATE ${table} SET ${noField} = ?, data = ?, updated_at = datetime('now') WHERE id = ? AND company_id = ?`)
        .bind(docNo, JSON.stringify(body.data || body), id, user.company_id).run();
      return json({ ok: true });
    },
    async remove({ request, env, params }) {
      const user = await requireUser(request, env);
      if (!user) return err('Unauthorized', 401);
      const id = params.id;
      await env.DB.prepare(`DELETE FROM ${table} WHERE id = ? AND company_id = ?`).bind(id, user.company_id).run();
      return json({ ok: true });
    },
  };
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}