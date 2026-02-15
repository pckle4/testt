export interface CustomerDetails {
  name: string;
  email: string;
  phone: string;
  address?: string;
  company: string;
  status: string;
}

export interface Customer extends CustomerDetails {
  id: number;
}

export interface CustomerContact {
  id: number;
  customerId: number;
  name: string;
  position: string;
  email: string;
  phone: string;
}

export interface CustomerNote {
  id: number;
  customerId: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CustomerView extends Customer {
  contacts: CustomerContact[];
  notes: CustomerNote[];
}

export interface CustomerResponse {
  data: Customer[];
  total: number;
  page: number;
  size: number;
}
