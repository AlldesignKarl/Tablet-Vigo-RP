import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import RaidDetailPanel from '@/components/police/RaidDetailPanel';

export default async function RaidDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const [{ data: raid }, { data: strokes }] = await Promise.all([
    supabase.from('raids').select('*').eq('id', params.id).maybeSingle(),
    supabase.from('raid_strokes').select('*').eq('raid_id', params.id).order('created_at', { ascending: true }),
  ]);

  if (!raid) notFound();

  return <RaidDetailPanel raid={raid} initialStrokes={strokes ?? []} />;
}
