const { createClient } = require('@supabase/supabase-js');

let supabase;

function getClient() {
  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabase;
}

async function ensureDb() {
  // Tables are created via Supabase SQL editor — just verify connection
  const { error } = await getClient().from('submissions').select('id').limit(0);
  if (error) throw new Error(`Database connection failed: ${error.message}`);
}

const queries = {
  async insert(data) {
    const { data: result, error } = await getClient()
      .from('submissions')
      .insert({
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone,
        email: data.email || null,
        service: data.service || null,
        message: data.message || null,
        ip_address: data.ipAddress || null
      })
      .select('id')
      .single();
    if (error) throw error;
    return { lastInsertRowid: result.id };
  },

  async getAll(status) {
    const db = getClient();
    let query = db.from('submissions').select('*').order('created_at', { ascending: false });
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await getClient()
      .from('submissions')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code === 'PGRST116') return null; // not found
    if (error) throw error;
    return data;
  },

  async updateStatus(id, status, notes) {
    const { error } = await getClient()
      .from('submissions')
      .update({
        status,
        notes: notes !== undefined ? notes : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id) {
    const { error } = await getClient()
      .from('submissions')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getStats() {
    const db = getClient();
    const count = async (filter) => {
      let query = db.from('submissions').select('*', { count: 'exact', head: true });
      if (filter) query = filter(query);
      const { count: c, error } = await query;
      if (error) throw error;
      return c;
    };

    const today = new Date().toISOString().slice(0, 10);

    return {
      total:     await count(),
      new:       await count(q => q.eq('status', 'new')),
      contacted: await count(q => q.eq('status', 'contacted')),
      resolved:  await count(q => q.eq('status', 'resolved')),
      today:     await count(q => q.gte('created_at', today + 'T00:00:00').lt('created_at', today + 'T23:59:59.999')),
    };
  },

  async logAction(action, submissionId, adminUser, details) {
    const { error } = await getClient()
      .from('admin_log')
      .insert({
        action,
        submission_id: submissionId,
        admin_user: adminUser,
        details
      });
    if (error) throw error;
  },

  async getAllContent() {
    const { data, error } = await getClient()
      .from('site_content')
      .select('key, value, type');
    if (error) throw error;
    return data;
  },

  async setContent(key, value, type = 'text') {
    const { error } = await getClient()
      .from('site_content')
      .upsert({
        key,
        value,
        type,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
    if (error) throw error;
  },

  async deleteContent(key) {
    const { error } = await getClient()
      .from('site_content')
      .delete()
      .eq('key', key);
    if (error) throw error;
  }
};

module.exports = { ensureDb, getClient, queries };
