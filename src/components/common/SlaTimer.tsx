import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Ticket } from '../../types';

interface SlaTimerProps {
  ticket: Ticket;
  className?: string;
}

function parseSlaDeadline(ticket: Ticket): number | null {
  if (ticket.sla_resolution_deadline) {
    const t = new Date(ticket.sla_resolution_deadline).getTime();
    if (!isNaN(t)) return t;
  }
  const hours = ticket.sla_hours || (ticket.priority === 'urgent' ? 4 : ticket.priority === 'high' ? 8 : ticket.priority === 'medium' ? 24 : 48);
  const created = new Date(ticket.created_at || Date.now()).getTime();
  if (isNaN(created)) return null;
  return created + hours * 3600 * 1000;
}

/**
 * Freshservice-style live SLA countdown.
 * Re-renders every 30s; turns amber < 25% of SLA window remaining, rose on breach.
 */
export const SlaTimer: React.FC<SlaTimerProps> = ({ ticket, className = '' }) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (ticket.status === 'resolved' || ticket.status === 'closed') return;
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, [ticket.status]);

  if (ticket.status === 'resolved' || ticket.status === 'closed') {
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 border bg-emerald-50 text-emerald-800 border-emerald-200 ${className}`}>
        <CheckCircle2 className="w-3.5 h-3.5" />
        SLA Terpenuhi
      </span>
    );
  }

  const deadline = parseSlaDeadline(ticket);
  if (deadline === null) return null;

  const slaWindowMs = (ticket.sla_hours || 8) * 3600 * 1000;
  const remaining = deadline - Date.now();

  if (remaining <= 0) {
    const overMs = -remaining;
    const hoursOver = Math.floor(overMs / 3600000);
    const minsOver = Math.floor((overMs % 3600000) / 60000);
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 border bg-rose-100 text-rose-800 border-rose-300 animate-pulse ${className}`}>
        <AlertTriangle className="w-3.5 h-3.5" />
        SLA Lewat +{hoursOver > 0 ? `${hoursOver}j ` : ''}{minsOver}m
      </span>
    );
  }

  const hoursLeft = Math.floor(remaining / 3600000);
  const minsLeft = Math.floor((remaining % 3600000) / 60000);
  const isCritical = remaining < slaWindowMs * 0.25;

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 border ${
      isCritical
        ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
        : 'bg-blue-50 text-blue-700 border-blue-200'
    } ${className}`}>
      <Clock className="w-3.5 h-3.5" />
      Sisa SLA: {hoursLeft > 0 ? `${hoursLeft}j ` : ''}{minsLeft}m
    </span>
  );
};
