import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard'
  },
  {
    path: 'auth',
    pathMatch: 'full',
    loadComponent: () => import('./pages/auth/auth').then(m => m.AuthPage)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/main-layout').then(m => m.MainLayout),
    children: [
      {
        path: 'dashboard',
        pathMatch: 'full',
        loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard)
      },
      {
        path: 'customers',
        pathMatch: 'full',
        loadComponent: () => import('./pages/customers/customers').then(m => m.Customers)
      },
      {
        path: 'add-customer',
        pathMatch: 'full',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/add-customer/add-customer').then(m => m.AddCustomer)
      },
      {
        path: 'edit-customer/:id',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/edit-customer/edit-customer').then(m => m.EditCustomer)
      },
      {
        path: 'customer-details/:id',
        loadComponent: () => import('./pages/customer-details/customer-details').then(m => m.CustomerDetailsPage)
      },
      {
        path: 'profile',
        pathMatch: 'full',
        loadComponent: () => import('./pages/edit-profile/edit-profile').then(m => m.EditProfile)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
