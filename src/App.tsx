import { Routes, Route, Navigate } from "react-router-dom";
import { assertAuthConfig } from "@/lib/auth-config";
import { ProtectedRoute, AdminRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { ErrorState } from "@/components/states";
import Login from "@/pages/Login";
import SiteSelector from "@/pages/SiteSelector";
import Editor from "@/pages/Editor";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import Clients from "@/pages/admin/Clients";
import ClientDetail from "@/pages/admin/ClientDetail";
import AdminSites from "@/pages/admin/AdminSites";
import AddSiteGuide from "@/pages/admin/AddSiteGuide";

export default function App() {
  const configError = assertAuthConfig();
  if (configError) {
    return (
      <div className="flex h-screen w-screen items-center justify-center p-6">
        <ErrorState
          message={`Configuration error: ${configError}. Set the VITE_AUTH0_* environment variables.`}
        />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SiteSelector />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* The editor is full-screen — no AppLayout chrome. */}
      <Route
        path="/sites/:id"
        element={
          <ProtectedRoute>
            <Editor />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AppLayout>
                <AdminDashboard />
              </AppLayout>
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/clients"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AppLayout>
                <Clients />
              </AppLayout>
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/clients/:id"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AppLayout>
                <ClientDetail />
              </AppLayout>
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/guide"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AppLayout>
                <AddSiteGuide />
              </AppLayout>
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/sites"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AppLayout>
                <AdminSites />
              </AppLayout>
            </AdminRoute>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
