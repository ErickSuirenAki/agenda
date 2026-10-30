export function memoryStore() {
  const rows = new Map();
  return {
    async list(admin) {
      const result = [...rows.values()].filter(row => admin || row.status === 'approved');
      result.sort((a, b) => admin ? b.created_at.localeCompare(a.created_at) : a.name.localeCompare(b.name));
      return result.map(row => {
        if (admin) return { ...row };
        const { status, created_at, ...published } = row;
        return published;
      });
    },
    async find(id) { return rows.get(id); },
    async duplicate(phone, category, id) { return [...rows.values()].find(row => row.phone === phone && row.category === category && row.id !== id); },
    async insert(row) {
      if (await this.duplicate(row.phone, row.category)) throw Object.assign(Error('Duplicate'), { code: '23505' });
      rows.set(row.id, { status: 'pending', ...row });
    },
    async update(id, patch) {
      if (!rows.has(id)) return { changes: 0 };
      rows.set(id, { ...rows.get(id), ...patch });
      return { changes: 1 };
    },
    async remove(id) { return { changes: Number(rows.delete(id)) }; },
    async health() { return true; },
  };
}
