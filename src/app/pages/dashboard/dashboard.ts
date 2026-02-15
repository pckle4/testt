import { ChangeDetectionStrategy, Component, computed, signal, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

import { CustomerService } from '../../core/services/customer/customer.service';
import { Customer } from '../../core/models/customer.model';

export interface RecentCustomer extends Customer {
  avatar: string;
}

export interface MonthlyData {
  month: string;
  customers: number;
  contacts: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard implements OnInit, OnDestroy {
  private readonly customerService = inject(CustomerService);
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  readonly currentTime = signal(new Date());
  private clockInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.clockInterval = setInterval(() => this.currentTime.set(new Date()), 1000);
    this.fetchDashboardData();
  }

  ngOnDestroy() {
    if (this.clockInterval) clearInterval(this.clockInterval);
  }

  readonly currentPage = signal(1);
  readonly pageSize = signal(10);

  readonly recentCustomers = computed(() => {
    return this.customerService.customersList().map(c => ({
      ...c,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=E0E7FF&color=5955D1`
    }));
  });

  readonly totalCustomers = this.customerService.totalCustomers;
  readonly totalContacts = signal(0);
  readonly totalNotes = signal(0);

  readonly newCustomersThisMonth = computed(() => {
    return this.recentCustomers().filter(c => c.status?.toLowerCase() === 'active').length;
  });

  private fetchDashboardData() {
    this.customerService.getCustomers(
      this.currentPage() - 1,
      this.pageSize(),
      '',
      'all',
      'id',
      'desc'
    );

  }


  readonly monthlyData = signal<MonthlyData[]>([
    { month: 'Sep', customers: 12, contacts: 45 },
    { month: 'Oct', customers: 19, contacts: 62 },
    { month: 'Nov', customers: 15, contacts: 51 },
    { month: 'Dec', customers: 22, contacts: 78 },
    { month: 'Jan', customers: 28, contacts: 95 },
    { month: 'Feb', customers: 18, contacts: 67 },
  ]);

  readonly maxBarValue = computed(() => {
    const data = this.monthlyData();
    return Math.max(...data.map(d => Math.max(d.customers, d.contacts)));
  });

  readonly statusBreakdown = computed(() => {
    const customers = this.recentCustomers();
    const active = customers.filter(c => c.status?.toLowerCase() === 'active').length;
    const pending = customers.filter(c => c.status?.toLowerCase() === 'pending').length;
    const inactive = customers.length - active - pending;
    return [
      { label: 'Active', count: active, color: '#179AD7' },
      { label: 'Pending', count: pending, color: '#FAA41C' },
      { label: 'Inactive', count: inactive, color: '#94A3B8' },
    ];
  });

  readonly donutSegments = computed(() => {
    const data = this.statusBreakdown();
    const total = data.reduce((s, d) => s + d.count, 0);
    const segments: { offset: number; dashArray: string; color: string; label: string; count: number; percent: number }[] = [];
    let cumulative = 0;
    const circumference = 2 * Math.PI * 54;

    for (const d of data) {
      const percent = (d.count / total) * 100;
      const length = (d.count / total) * circumference;
      segments.push({
        offset: cumulative,
        dashArray: `${length} ${circumference - length}`,
        color: d.color,
        label: d.label,
        count: d.count,
        percent: Math.round(percent),
      });
      cumulative += length;
    }
    return segments;
  });

  readonly totalPages = computed(() => Math.ceil(this.totalCustomers() / this.pageSize()));
  readonly paginatedCustomers = this.recentCustomers;

  readonly hasCustomers = computed(() => this.recentCustomers().length > 0);

  readonly activities = signal([
    { icon: 'customer', text: 'Aarav Sharma was added as a new customer', time: '2 hours ago' },
    { icon: 'contact', text: 'New contact added for Gujarat Sol', time: '5 hours ago' },
    { icon: 'note', text: 'Note added to Delhi Systems account', time: '1 day ago' },
    { icon: 'customer', text: 'Farhan Khan profile updated', time: '2 days ago' },
    { icon: 'contact', text: '3 new contacts imported for Mumbai Creative', time: '3 days ago' },
  ]);

  getBarHeight(value: number): number {
    const max = this.maxBarValue();
    return max > 0 ? (value / max) * 140 : 0;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'active': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'inactive': return 'bg-slate-50 text-slate-500 border-slate-200';
      default: return '';
    }
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
      this.fetchDashboardData();
    }
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
      this.fetchDashboardData();
    }
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.fetchDashboardData();
    }
  }
}
