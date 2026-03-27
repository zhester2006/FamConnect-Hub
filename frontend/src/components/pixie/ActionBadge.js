import React from 'react';
import { Check, ShoppingCart, Calendar, MessageCircle, Bell } from 'lucide-react';

const actionIcons = {
  add_shopping_item: ShoppingCart,
  add_calendar_event: Calendar,
  send_message: MessageCircle,
  post_to_wall: MessageCircle,
  send_reminder: Bell,
  complete_chore: Check,
  approve_chore: Check,
  approve_shopping: Check,
  add_pantry_item: ShoppingCart
};

export function ActionBadge({ action }) {
  const Icon = actionIcons[action.type] || Check;
  const label = action.type.replace(/_/g, ' ');
  const cls = action.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${cls}`}>
      <Icon className="w-2.5 h-2.5" /> {label}
    </span>
  );
}

export function ActionBadgeList({ actions }) {
  if (!actions || actions.length === 0) return null;
  const items = [];
  for (let i = 0; i < actions.length; i++) {
    items.push(<ActionBadge key={i} action={actions[i]} />);
  }
  return (
    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-700/50">
      {items}
    </div>
  );
}
