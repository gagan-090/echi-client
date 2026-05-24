import React from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { MESSAGE_STATUS } from '../../../lib/constants';

export const ReadReceipt = ({ status, className }) => {
  if (!status) return null;

  return (
    <div className={cn("inline-flex items-center ml-1", className)}>
      {status === MESSAGE_STATUS.SENDING && (
        <span className="material-symbols-outlined text-[14px] text-text-muted">schedule</span>
      )}
      {status === MESSAGE_STATUS.SENT && (
        <Check size={14} className="text-text-muted" strokeWidth={2.5} />
      )}
      {status === MESSAGE_STATUS.DELIVERED && (
        <CheckCheck size={14} className="text-delivered" strokeWidth={2.5} />
      )}
      {status === MESSAGE_STATUS.READ && (
        <CheckCheck size={14} className="text-read" strokeWidth={2.5} />
      )}
      {status === MESSAGE_STATUS.FAILED && (
        <span className="w-1.5 h-1.5 rounded-full bg-danger ml-1" />
      )}
    </div>
  );
};

export default ReadReceipt;
