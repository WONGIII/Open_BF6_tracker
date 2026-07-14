import PlayerClient from "@/components/PlayerClient";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  return <PlayerClient playerId={decodeURIComponent(playerId)} />;
}
