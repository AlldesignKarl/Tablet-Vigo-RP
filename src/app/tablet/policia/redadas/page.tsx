import { createServerSupabaseClient } from '@/lib/supabase/server';
import RaidsListPanel from '@/components/police/RaidsListPanel';

export default async function RedadasPage() {
  const supabase = createServerSupabaseClient();
  const { data: raids } = await supabase.from('raids').select('*').order('created_at', { ascending: false });

  return <RaidsListPanel initialRaids={raids ?? []} />;
}
