import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DataProvider, useData } from './context/DataContext';
import { WorkoutProvider } from './context/WorkoutContext';
import Layout from './components/layout/Layout';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import Dashboard from './pages/dashboard/Dashboard';
import ActiveSession from './pages/training/ActiveSession';
import TemplateManager from './pages/training/TemplateManager';
import Profile from './pages/Profile';
import HealthCoach from './pages/health-coach/HealthCoach';
import WorkoutHistory from './pages/history/WorkoutHistory';

// Protected Route Wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useData();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center p-4">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="health-coach"
          element={
            <ProtectedRoute>
              <HealthCoach />
            </ProtectedRoute>
          }
        />
        <Route
          path="training"
          element={
            <ProtectedRoute>
              <ActiveSession />
            </ProtectedRoute>
          }
        />
        <Route
          path="templates"
          element={
            <ProtectedRoute>
              <TemplateManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="templates/:id"
          element={
            <ProtectedRoute>
              <TemplateManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="history"
          element={
            <ProtectedRoute>
              <WorkoutHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <DataProvider>
        <WorkoutProvider>
          <AppRoutes />
        </WorkoutProvider>
      </DataProvider>
    </BrowserRouter>
  );
}

export default App;
