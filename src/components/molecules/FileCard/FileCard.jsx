import React from 'react';
import { FileText, Download } from 'lucide-react';
import { cn } from '../../../lib/utils';
import IconButton from '../../atoms/IconButton';

export const FileCard = ({ name, size, url, className }) => {
  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDownload = () => {
    window.open(url, '_blank');
  };

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 bg-surface-primary border border-border rounded-lg mt-1 min-w-[200px] max-w-xs",
      className
    )}>
      <div className="w-10 h-10 rounded-full bg-accent-light text-accent flex items-center justify-center flex-shrink-0">
        <FileText size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-body-md font-medium text-text-primary truncate">{name}</p>
        <p className="text-label-sm text-text-secondary mt-0.5">{formatSize(size)}</p>
      </div>
      <IconButton icon={Download} size={20} onClick={handleDownload} />
    </div>
  );
};

export default FileCard;
