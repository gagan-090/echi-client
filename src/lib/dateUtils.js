import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';

export const formatTime = (dateString) => {
  if (!dateString) return '';
  return format(new Date(dateString), 'h:mm a');
};

export const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d, yyyy');
};

export const relativeTime = (dateString) => {
  if (!dateString) return '';
  return formatDistanceToNow(new Date(dateString), { addSuffix: true });
};

export const groupByDate = (messages) => {
  const groups = {};
  messages.forEach(msg => {
    const dateKey = format(new Date(msg.sent_at || msg.created_at || Date.now()), 'yyyy-MM-dd');
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(msg);
  });
  return groups;
};
