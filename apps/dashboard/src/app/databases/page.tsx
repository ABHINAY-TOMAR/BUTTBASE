import NodeTable from '@/components/NodeTable';

export default async function DatabasesPage({
  searchParams,
}: {
  searchParams: Promise<{ provision?: string }>;
}) {
  const sp = await searchParams;
  return <NodeTable autoProvision={sp.provision === '1'} />;
}
