import { Component, Event, EventEmitter, Host, Prop, State, h } from '@stencil/core';
import {
  DepartmentOrder,
  fetchDepartmentOrders,
  DepartmentOrderStatus,
} from '../../api/department-orders';

type StatusFilter = DepartmentOrderStatus | 'all';

@Component({
  tag: 'xpartla-pharmacy-order-list',
  styleUrl: 'xpartla-pharmacy-order-list.css',
  shadow: true,
})
export class XpartlaPharmacyOrderList {
  @Event({ eventName: 'order-clicked' }) orderClicked: EventEmitter<string>;
  @Prop() apiBase: string;
  @Prop() pharmacyId: string;
  @Prop() userRole?: 'sestra' | 'lekaren';

  @State() loading: boolean = true;
  @State() errorMessage: string;
  @State() orders: DepartmentOrder[] = [];
  @State() selectedStatus: StatusFilter = 'all';
  @State() searchText: string = '';

  async componentWillLoad() {
    await this.load();
    this.loading = false;
  }

  private async load() {
    try {
      this.orders = await fetchDepartmentOrders(this.apiBase, this.pharmacyId);
    } catch (err: any) {
      this.errorMessage = `Nepodarilo sa načítať objednávky: ${err.message || 'neznáma chyba'}`;
    }
  }

  private statusLabel(status: DepartmentOrderStatus): string {
    switch (status) {
      case 'created':
        return 'Vytvorená';
      case 'processing':
        return 'Spracováva sa';
      case 'fulfilled':
        return 'Vybavená';
      case 'canceled':
        return 'Zrušená';
      case 'archived':
        return 'Archivovaná';
      default:
        return status;
    }
  }

  private filtered(): DepartmentOrder[] {
    const query = this.searchText.trim().toLowerCase();
    return this.orders.filter(order => {
      // Status filtering
      if (this.selectedStatus !== 'all' && order.status !== this.selectedStatus) {
        return false;
      }
      // Free text search for department, id and note
      if (query) {
        const haystack = `${order.departmentName || ''} ${order.id || ''} ${order.note || ''}`.toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }

  private stats() {
    const visible = this.filtered();
    const statuses: Record<DepartmentOrderStatus | 'all', number> = {
      all: visible.length,
      created: visible.filter(o => o.status === 'created').length,
      processing: visible.filter(o => o.status === 'processing').length,
      fulfilled: visible.filter(o => o.status === 'fulfilled').length,
      canceled: visible.filter(o => o.status === 'canceled').length,
      archived: visible.filter(o => o.status === 'archived').length,
    };
    return statuses;
  }

  private renderStatusChip(status: StatusFilter, label: string, count: number) {
    const selected = this.selectedStatus === status;
    return (
      <md-filter-chip
        label={`${label} (${count})`}
        selected={selected}
        onclick={() => (this.selectedStatus = status)}
      ></md-filter-chip>
    );
  }

  render() {
    if (this.errorMessage) {
      return (
        <Host>
          <div class="error-card">
            <md-icon>error</md-icon>
            <p>{this.errorMessage}</p>
          </div>
        </Host>
      );
    }

    const visible = this.filtered();
    const stats = this.stats();

    return (
      <Host>
        <header class="hero">
          <div>
            <span class="eyebrow">Objednávky oddelení</span>
            <h2>Prehľad objednávok</h2>
            {this.userRole && <span class="role-badge">{this.userRole === 'sestra' ? '👩‍⚕️ Sestra' : '👨‍⚕️ Pracovník lekárne'}</span>}
          </div>
          {this.userRole !== 'lekaren' && (
            <md-fab variant="primary" label="Nová objednávka" onclick={() => this.orderClicked.emit('@new')}>
              <md-icon slot="icon">add</md-icon>
            </md-fab>
          )}
        </header>

        {this.loading && (
          <div class="empty">
            <md-circular-progress indeterminate></md-circular-progress>
            <p>Načítavam objednávky…</p>
          </div>
        )}

        {!this.loading && this.orders.length === 0 && (
          <div class="empty">
            <md-icon>assignment</md-icon>
            <p>Zatiaľ nie sú vytvorené žiadne objednávky.</p>
          </div>
        )}

        {!this.loading && this.orders.length > 0 && (
          <>
            <div class="filters">
              <md-chip-set class="status-chips" aria-label="Filter podľa stavu">
                {this.renderStatusChip('created', 'Vytvorená', stats.created)}
                {this.renderStatusChip('processing', 'Spracováva sa', stats.processing)}
                {this.renderStatusChip('fulfilled', 'Vybavená', stats.fulfilled)}
                {this.renderStatusChip('canceled', 'Zrušená', stats.canceled)}
                {this.renderStatusChip('archived', 'Archivovaná', stats.archived)}
                {this.renderStatusChip('all', 'Všetky', stats.all)}
              </md-chip-set>
              <md-outlined-text-field
                class="search"
                label="Hľadať oddelenie / ID / poznámku"
                value={this.searchText}
                oninput={(ev: InputEvent) => (this.searchText = (ev.target as HTMLInputElement).value)}
              ></md-outlined-text-field>
            </div>

            {visible.length === 0 ? (
              <div class="empty">
                <md-icon>filter_list</md-icon>
                <p>Žiadne objednávky nezodpovedajú filtru.</p>
              </div>
            ) : (
              <div class="grid">
                {visible.map(order => (
                  <md-elevated-card class="order-card" onclick={() => this.orderClicked.emit(order.id || '')}>
                    <div class="top-row">
                      <h3>{order.departmentName}</h3>
                      <md-suggestion-chip
                        class={`chip status-${order.status}`}
                        label={this.statusLabel(order.status)}
                        onclick={(ev: Event) => ev.stopPropagation()}
                      ></md-suggestion-chip>
                    </div>
                    <p class="id">ID: {order.id}</p>
                    <p class="note">{order.note || 'Bez poznámky.'}</p>
                    <p class="meta">Položiek: {order.items?.length || 0}</p>
                  </md-elevated-card>
                ))}
              </div>
            )}
          </>
        )}
      </Host>
    );
  }
}
