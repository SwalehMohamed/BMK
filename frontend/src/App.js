import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Header from './components/Header';
import Footer from './components/Footer';
import Dashboard from './components/Dashboard';
import FeedManager from './components/FeedManager';
import ChickManager from './components/ChickManager';
import SlaughterManager from './components/SlaughterManager';
import ProductTypesManager from './components/ProductTypesManager';
import Products from './components/Products';
import Orders from './components/Orders';
import Deliveries from './components/Deliveries';
import Mortalities from './components/Mortalities';
import UserManager from './components/UserManager';
import Sales from './components/Sales';
import AdminLanding from './pages/AdminLanding';
import UserLanding from './pages/UserLanding';
import LoginPage from './pages/LoginPage';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ProfileSettings from './pages/ProfileSettings';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './utils/PrivateRoute';
import RoleBasedRoute from './utils/RoleBasedRoute';

function App() {
  return (
    <Router basename={process.env.PUBLIC_URL || '/'}>
      <AuthProvider>
        <Header />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<div className="container mt-5"><h2>404 - Page Not Found</h2></div>} />

          <Route element={<PrivateRoute />}>
            <Route element={<RoleBasedRoute allowedRoles={['admin']} />}>
              <Route path="/" element={<AdminLanding />} />
              <Route path="/users" element={<UserManager />} />
              <Route path="/product-types" element={<ProductTypesManager />} />
              <Route path="/sales" element={<Sales />} />
            </Route>
            
            <Route element={<RoleBasedRoute allowedRoles={['user', 'admin']} />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/feed" element={<FeedManager />} />
              <Route path="/chicks" element={<ChickManager />} />
              <Route path="/mortalities" element={<Mortalities />} />
              <Route path="/slaughter" element={<SlaughterManager />} />
              <Route path="/products" element={<Products />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/deliveries" element={<Deliveries />} />
              <Route path="/profile" element={<ProfileSettings />} />
            </Route>
            
            {/* Fallback for users */}
            <Route path="/user-home" element={<UserLanding />} />
          </Route>
        </Routes>
        <Footer />
      </AuthProvider>
    </Router>
  );
}

export default App;
