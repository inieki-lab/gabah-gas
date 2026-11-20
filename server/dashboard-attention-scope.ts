export interface DashboardAttentionItem {
  link_type: string;
  link_id: string;
}

interface ScopedLoan {
  id: string;
  borrower_id?: string;
  owner_division: string;
}

interface ScopedTicket {
  id: string;
  reporter_id?: string;
  assigned_agent_id?: string;
  category: string;
}

export interface DashboardAttentionScope {
  actorId: string;
  isGlobalReader: boolean;
  visibleAssetIds: ReadonlySet<string>;
  loans: readonly ScopedLoan[];
  tickets: readonly ScopedTicket[];
  canReadOwnerScope: (module: 'loans' | 'tickets', owner: string) => boolean;
}

/**
 * Attention-center cards are references to operational records. Filter the
 * cards against the same record-level visibility rules as their source lists.
 * Unknown/missing records and unsupported link types fail closed.
 */
export function filterDashboardAttentionItems<T extends DashboardAttentionItem>(
  items: readonly T[],
  scope: DashboardAttentionScope,
): T[] {
  if (scope.isGlobalReader) return [...items];

  const loansById = new Map(scope.loans.map(item => [item.id, item]));
  const ticketsById = new Map(scope.tickets.map(item => [item.id, item]));

  return items.filter(item => {
    switch (item.link_type) {
      case 'asset':
        return scope.visibleAssetIds.has(item.link_id);
      case 'loan': {
        const loan = loansById.get(item.link_id);
        return Boolean(loan && (
          loan.borrower_id === scope.actorId
          || scope.canReadOwnerScope('loans', loan.owner_division)
        ));
      }
      case 'ticket': {
        const ticket = ticketsById.get(item.link_id);
        return Boolean(ticket && (
          ticket.reporter_id === scope.actorId
          || ticket.assigned_agent_id === scope.actorId
          || scope.canReadOwnerScope('tickets', ticket.category)
        ));
      }
      default:
        return false;
    }
  });
}
