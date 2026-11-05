import { createBrowserRouter, Outlet } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { WishlistProvider } from '@/context/WishlistContext';
import CustomerLayout from '@/components/layout/CustomerLayout';
import AdminLayout from '@/components/layout/AdminLayout';
import RequireAdmin from '@/components/layout/RequireAdmin';
import RequireLogin from '@/components/layout/RequireLogin';
import AdminLoginPage from '@/pages/auth/AdminLoginPage';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import DashboardPage from '@/pages/admin/DashboardPage';
import InventoryPage from '@/pages/admin/InventoryPage';
import AdminOrdersPage from '@/pages/admin/OrdersPage';
import AdminReviewsPage from '@/pages/admin/ReviewsPage';
import AdminMessagesPage from '@/pages/admin/MessagesPage';
import SettingsPage from '@/pages/admin/SettingsPage';
import HomePage from '@/pages/customer/HomePage';
import ProductListPage from '@/pages/customer/ProductListPage';
import ProductDetailsPage from '@/pages/customer/ProductDetailsPage';
import WishlistPage from '@/pages/customer/WishlistPage';
import CartPage from '@/pages/customer/CartPage';
import CheckoutPage from '@/pages/customer/CheckoutPage';
import OrderConfirmationPage from '@/pages/customer/OrderConfirmationPage';
import GcashPaymentPage from '@/pages/customer/GcashPaymentPage';
import MyOrdersPage from '@/pages/customer/MyOrdersPage';
import ProfilePage from '@/pages/customer/account/ProfilePage';
import ShippingPage from '@/pages/customer/account/ShippingPage';
import AboutPage from '@/pages/customer/AboutPage';
import ContactPage from '@/pages/customer/ContactPage';
import PolicyPage from '@/pages/customer/PolicyPage';
import NotFound from '@/pages/NotFound';

// providers sit inside the router because the wishlist uses navigate()
function Root() {
  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <Outlet />
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      {
        element: <CustomerLayout />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/products', element: <ProductListPage /> },
          { path: '/products/:productId', element: <ProductDetailsPage /> },
          { path: '/wishlist', element: <WishlistPage /> },
          { path: '/about', element: <AboutPage /> },
          { path: '/contact', element: <ContactPage /> },
          { path: '/terms', element: <PolicyPage page="terms" /> },
          { path: '/privacy', element: <PolicyPage page="privacy" /> },

          { path: '/cart', element: <CartPage /> },
          { path: '/checkout', element: <RequireLogin><CheckoutPage /></RequireLogin> },
          { path: '/checkout/shipping', element: <RequireLogin><ShippingPage /></RequireLogin> },
          { path: '/profile', element: <RequireLogin><ProfilePage /></RequireLogin> },
          { path: '/checkout/gcash/:orderId', element: <RequireLogin><GcashPaymentPage /></RequireLogin> },
          { path: '/orders', element: <RequireLogin><MyOrdersPage /></RequireLogin> },
          { path: '/orders/:orderId', element: <RequireLogin><OrderConfirmationPage /></RequireLogin> },

          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },

          { path: '*', element: <NotFound /> },
        ],
      },
      { path: '/admin/login', element: <AdminLoginPage /> },
      {
        path: '/admin',
        element: (
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        ),
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'inventory', element: <InventoryPage /> },
          { path: 'orders', element: <AdminOrdersPage /> },
          { path: 'reviews', element: <AdminReviewsPage /> },
          { path: 'messages', element: <AdminMessagesPage /> },
          { path: 'settings', element: <RequireAdmin superOnly><SettingsPage /></RequireAdmin> },
        ],
      },
    ],
  },
]);
