import { createBrowserRouter, Outlet } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { WishlistProvider } from '@/context/WishlistContext';
import CustomerLayout from '@/components/layout/CustomerLayout';
import AdminLayout from '@/components/layout/AdminLayout';
import RequireAdmin from '@/components/layout/RequireAdmin';
import AdminLoginPage from '@/pages/auth/AdminLoginPage';
import DashboardPage from '@/pages/admin/DashboardPage';
import InventoryPage from '@/pages/admin/InventoryPage';
import HomePage from '@/pages/customer/HomePage';
import ProductListPage from '@/pages/customer/ProductListPage';
import ProductDetailsPage from '@/pages/customer/ProductDetailsPage';
import WishlistPage from '@/pages/customer/WishlistPage';
import AboutPage from '@/pages/customer/AboutPage';
import PolicyPage from '@/pages/customer/PolicyPage';
import Placeholder from '@/pages/Placeholder';
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
          { path: '/terms', element: <PolicyPage page="terms" /> },
          { path: '/privacy', element: <PolicyPage page="privacy" /> },

          { path: '/cart', element: <Placeholder title="Cart" phase={3} /> },
          { path: '/checkout', element: <Placeholder title="Checkout" phase={3} /> },
          { path: '/checkout/gcash/:orderId', element: <Placeholder title="GCash payment" phase={3} /> },
          { path: '/orders', element: <Placeholder title="My orders" phase={3} /> },
          { path: '/orders/:orderId', element: <Placeholder title="Order confirmation" phase={3} /> },

          { path: '/login', element: <Placeholder title="Log in" phase={4} /> },
          { path: '/register', element: <Placeholder title="Create account" phase={4} /> },
          { path: '/forgot-password', element: <Placeholder title="Forgot password" phase={4} /> },

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
          { path: 'orders', element: <Placeholder title="Orders" phase={5} /> },
          { path: 'reviews', element: <Placeholder title="Reviews" phase={5} /> },
        ],
      },
    ],
  },
]);
