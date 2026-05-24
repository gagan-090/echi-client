import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import LoginPage from '../pages/LoginPage';
import AppShell from '../pages/AppShell';
import NotFound from '../pages/NotFound';
import { useAuthStore } from '../store/authStore';

export const AppRouter = () => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  return (
    <Routes>
      <Route path="/" element={<Navigate to={isAuthenticated ? "/chat" : "/login"} replace />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/chat" replace /> : <LoginPage />} />
      
      <Route element={<ProtectedRoute />}>
        <Route path="/chat" element={<AppShell />} />
        <Route path="/chat/:convId" element={<AppShell />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRouter;
