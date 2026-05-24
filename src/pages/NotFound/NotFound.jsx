import React from 'react';

export const NotFound = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-bg-primary">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-primary mb-2">404</h1>
        <p className="text-text-secondary">Page not found</p>
      </div>
    </div>
  );
};

export default NotFound;
