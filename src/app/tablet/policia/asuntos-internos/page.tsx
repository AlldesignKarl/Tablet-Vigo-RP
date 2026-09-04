import { createServerSupabaseClient } from '@/lib/supabase/server';
import InternalAffairsPanel from '@/components/police/InternalAffairsPanel';

export default async function AsuntosInternosPage() {
  const supabase = createServerSupabaseClient();
  const { data: posts } = await supabase
    .from('internal_affairs_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <InternalAffairsPanel initialPosts={posts ?? []} currentUserId={user?.id ?? null} />;
}
