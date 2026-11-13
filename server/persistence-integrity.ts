/**
 * Referential-integrity reconciliation for legacy ticket -> asset links.
 *
 * Older snapshots may contain asset identifiers that no longer exist in the
 * canonical asset collection. Keep the ticket and its descriptive asset
 * snapshot, but clear only the stale relational identifier before PostgreSQL
 * enforces tickets.related_asset_id -> assets.id.
 */
export interface TicketAssetLink {
  id: string;
  related_asset_id?: string | null;
  related_asset_name?: string;
  related_asset_number?: string;
}

export interface AssetIdentity {
  id: string;
}

export interface OrphanedTicketAssetLink {
  ticketId: string;
  assetId: string;
}

export function clearOrphanedTicketAssetLinks(
  tickets: TicketAssetLink[],
  assets: readonly AssetIdentity[],
): OrphanedTicketAssetLink[] {
  const validAssetIds = new Set(assets.map(asset => String(asset.id)));
  const detached: OrphanedTicketAssetLink[] = [];

  for (const ticket of tickets) {
    const assetId = ticket.related_asset_id;
    if (!assetId || validAssetIds.has(String(assetId))) continue;

    detached.push({ ticketId: ticket.id, assetId: String(assetId) });
    ticket.related_asset_id = undefined;
  }

  return detached;
}
