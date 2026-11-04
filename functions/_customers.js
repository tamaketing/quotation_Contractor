// Shared helpers for the customer registry (ทะเบียนลูกค้า)

export const CUSTOMER_FIELDS = [
  { col: 'name', key: 'name' },
  { col: 'address', key: 'address' },
  { col: 'tax_id', key: 'taxId' },
  { col: 'contact', key: 'contact' },
  { col: 'phone', key: 'phone' },
  { col: 'email', key: 'email' },
  { col: 'project', key: 'project' },
  { col: 'note', key: 'note' },
];

export function mapCustomer(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name || '',
    address: r.address || '',
    taxId: r.tax_id || '',
    contact: r.contact || '',
    phone: r.phone || '',
    email: r.email || '',
    project: r.project || '',
    note: r.note || '',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/* รวมเฉพาะฟิลด์ที่ส่งมา (undefined = ไม่แตะของเดิม) */
export function pickCustomer(body) {
  const out = {};
  for (const f of CUSTOMER_FIELDS) {
    if (body && body[f.key] !== undefined) out[f.col] = String(body[f.key] == null ? '' : body[f.key]);
  }
  return out;
}
