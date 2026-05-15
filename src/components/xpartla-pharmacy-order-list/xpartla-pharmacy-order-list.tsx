import { Component, Event, EventEmitter, Host, Prop, State, h } from '@stencil/core';
import {
  DepartmentOrder,
  fetchDepartmentOrders,
  DepartmentOrderStatus,
  updateDepartmentOrder,
} from '../../api/department-orders';

type StatusFilter = DepartmentOrderStatus | 'all';
type SortMode = 'newest' | 'oldest' | 'department';

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
  @State() onlyOpen: boolean = false;
  @State() sortMode: SortMode = 'newest';
  @State() actionBusyId?: string;

  async componentWillLoad() {
    await this.load();
    this.loading = false;
  }

  private async load() {
    try {
      this.errorMessage = undefined;
      this.orders = await fetchDepartmentOrders(this.apiBase, this.pharmacyId);
    } catch (err: any) {
      this.errorMessage = `Nepodarilo sa načítať objednávky: ${err.message || 'neznáma chyba'}`;
    }
  }

  private itemProgress(order: DepartmentOrder): { issued: number; requested: number; percent: number } {
    const requested = (order.items || []).reduce((sum, item) => sum + Math.max(0, Number(item.requestedQty || 0)), 0);
    const issued = (order.items || []).reduce((sum, item) => sum + Math.max(0, Number(item.issuedQty || 0)), 0);
    if (requested <= 0) {
      return { issued, requested, percent: 0 };
    }
    const percent = Math.min(100, Math.round((issued / requested) * 100));
    return { issued, requested, percent };
  }

  private canMarkAsComplete(order: DepartmentOrder): boolean {
    const items = order.items || [];
    if (items.length === 0) return false;
    return items.every(item => {
      const requested = Math.max(0, Number(item.requestedQty || 0));
      const issued = Math.max(0, Number(item.issuedQty || 0));
      return requested > 0 && issued >= requested;
    });
  }

  private async quickSetStatus(order: DepartmentOrder, nextStatus: DepartmentOrderStatus) {
    if (!order.id) return;
    if (nextStatus === 'fulfilled' && !this.canMarkAsComplete(order)) {
      this.errorMessage = 'Stav Dokončené je možné nastaviť až po vydaní všetkého požadovaného množstva.';
      return;
    }
    this.actionBusyId = order.id;
    this.errorMessage = undefined;
    try {
      const updated = await updateDepartmentOrder(this.apiBase, this.pharmacyId, order.id, {
        ...order,
        status: nextStatus,
      });
      this.orders = this.orders.map(existing => (existing.id === updated.id ? updated : existing));
    } catch (err: any) {
      this.errorMessage = `Zmena stavu zlyhala: ${err.message || 'neznáma chyba'}`;
    } finally {
      this.actionBusyId = undefined;
    }
  }

  private workflowStatusLabel(status: DepartmentOrderStatus): string {
    switch (status) {
      case 'created':
        return 'Pripravené na spracovanie';
      case 'processing':
        return 'Spracováva sa';
      case 'fulfilled':
        return 'Dokončené';
      case 'canceled':
        return 'Zrušené';
      case 'archived':
        return 'Archivované';
      default:
        return status;
    }
  }

  private renderCardActions(order: DepartmentOrder) {
    const busy = this.actionBusyId === order.id;
    const canChangeStatus = this.userRole === 'lekaren' && !!order.id;
    return (
      <div class="card-actions" onClick={(ev: Event) => ev.stopPropagation()}>
        <md-outlined-button
          class="detail-action"
          onclick={(ev: Event) => {
            ev.stopPropagation();
            this.orderClicked.emit(order.id || '');
          }}
        >
          <md-icon slot="icon">open_in_new</md-icon>
          Detail
        </md-outlined-button>
        {canChangeStatus ? (
          <md-outlined-select
            class="primary-action"
            label="Zmeniť stav"
            display-text={busy ? 'Ukladám…' : this.workflowStatusLabel(order.status)}
            disabled={busy}
            oninput={(ev: InputEvent) => {
              const nextStatus = (ev.target as HTMLInputElement).value as DepartmentOrderStatus;
              if (nextStatus && nextStatus !== order.status) {
                this.quickSetStatus(order, nextStatus);
              }
            }}
          >
            <md-select-option value="created" selected={order.status === 'created'}>
              <div slot="headline">Pripravené na spracovanie</div>
            </md-select-option>
            <md-select-option value="processing" selected={order.status === 'processing'}>
              <div slot="headline">Spracováva sa</div>
            </md-select-option>
            <md-select-option
              value="fulfilled"
              selected={order.status === 'fulfilled'}
              disabled={order.status !== 'fulfilled' && !this.canMarkAsComplete(order)}
            >
              <div slot="headline">Dokončené</div>
            </md-select-option>
          </md-outlined-select>
        ) : (
          <div class="action-hint">Stav mení lekáreň</div>
        )}
      </div>
    );
  }

  private orderTimestamp(order: DepartmentOrder): number {
    const value = order.updatedAt || order.createdAt;
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private formatDate(value?: string): string {
    if (!value) return 'Bez dátumu';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Bez dátumu';
    return new Intl.DateTimeFormat('sk-SK', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private statusLabel(status: DepartmentOrderStatus): string {
    switch (status) {
      case 'created':
        return 'Pripravené na spracovanie';
      case 'processing':
        return 'Spracováva sa';
      case 'fulfilled':
        return 'Dokončené';
      case 'canceled':
        return 'Zrušené';
      case 'archived':
        return 'Archivované';
      default:
        return status;
    }
  }

  private bySearch(): DepartmentOrder[] {
    const query = this.searchText.trim().toLowerCase();
    return this.orders.filter(order => {
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

  private visibleOrders(): DepartmentOrder[] {
    const searched = this.bySearch();
    const filtered = searched.filter(order => {
      if (this.selectedStatus !== 'all' && order.status !== this.selectedStatus) return false;
      if (this.onlyOpen && ['fulfilled', 'canceled', 'archived'].includes(order.status)) return false;
      return true;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (this.sortMode === 'department') {
        return (a.departmentName || '').localeCompare(b.departmentName || '', 'sk');
      }
      if (this.sortMode === 'oldest') {
        return this.orderTimestamp(a) - this.orderTimestamp(b);
      }
      return this.orderTimestamp(b) - this.orderTimestamp(a);
    });
    return sorted;
  }

  private stats() {
    const visible = this.bySearch();
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

    const visible = this.visibleOrders();
    const stats = this.stats();

    return (
      <Host>
        <header class="hero">
          <div class="hero-copy">
            <span class="eyebrow">Objednávky oddelení</span>
            <h2>Prehľad objednávok</h2>
            {this.userRole && <span class="role-badge">{this.userRole === 'sestra' ? '👩‍⚕️ Sestra' : '👨‍⚕️ Pracovník lekárne'}</span>}
          </div>
          <div class="hero-actions">
            <md-outlined-button onclick={() => this.load()}>
              <md-icon slot="icon">refresh</md-icon>
              Obnoviť
            </md-outlined-button>
            {this.userRole !== 'lekaren' && (
              <md-fab variant="primary" label="Nová objednávka" onclick={() => this.orderClicked.emit('@new')}>
                <md-icon slot="icon">add</md-icon>
              </md-fab>
            )}
          </div>
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
            <section class="summary-grid">
              <md-filled-card class="summary-card" onclick={() => (this.selectedStatus = 'all')}>
                <div class="summary-content">
                  <span class="summary-label">Všetky</span>
                  <md-badge label={stats.all} style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                    <span class="summary-value">{stats.all}</span>
                  </md-badge>
                </div>
              </md-filled-card>

              <md-filled-card class="summary-card summary-open" onclick={() => (this.onlyOpen = !this.onlyOpen)}>
                <div class="summary-content">
                  <span class="summary-label">Otvorené</span>
                  <md-badge label={stats.created + stats.processing}>
                    <span class="summary-value">{stats.created + stats.processing}</span>
                  </md-badge>
                </div>
              </md-filled-card>

              <md-filled-card class="summary-card" onclick={() => (this.selectedStatus = 'fulfilled')}>
                <div class="summary-content">
                  <span class="summary-label">Vybavené</span>
                  <md-badge label={stats.fulfilled}>
                    <span class="summary-value">{stats.fulfilled}</span>
                  </md-badge>
                </div>
              </md-filled-card>

              <md-filled-card class="summary-card" onclick={() => (this.selectedStatus = 'archived')}>
                <div class="summary-content">
                  <span class="summary-label">Archivované</span>
                  <md-badge label={stats.archived}>
                    <span class="summary-value">{stats.archived}</span>
                  </md-badge>
                </div>
              </md-filled-card>
            </section>

            <div class="filters">
              <md-chip-set class="status-chips" aria-label="Filter podľa stavu">
                {this.renderStatusChip('created', 'Pripravené na spracovanie', stats.created)}
                {this.renderStatusChip('processing', 'Spracováva sa', stats.processing)}
                {this.renderStatusChip('fulfilled', 'Dokončené', stats.fulfilled)}
                {this.renderStatusChip('canceled', 'Zrušené', stats.canceled)}
                {this.renderStatusChip('archived', 'Archivované', stats.archived)}
                {this.renderStatusChip('all', 'Všetky', stats.all)}
                <md-filter-chip
                  label="Len otvorené"
                  selected={this.onlyOpen}
                  onclick={() => (this.onlyOpen = !this.onlyOpen)}
                ></md-filter-chip>
              </md-chip-set>
              <div class="search-row">
                <md-outlined-text-field
                  class="search"
                  label="Hľadať oddelenie / ID / poznámku"
                  value={this.searchText}
                  oninput={(ev: InputEvent) => (this.searchText = (ev.target as HTMLInputElement).value)}
                ></md-outlined-text-field>
                <md-outlined-select
                  class="sort-select"
                  label="Triedenie"
                  display-text={
                    this.sortMode === 'newest'
                      ? 'Najnovšie'
                      : this.sortMode === 'oldest'
                        ? 'Najstaršie'
                        : 'Oddelenie A-Z'
                  }
                  oninput={(ev: InputEvent) =>
                    (this.sortMode = (ev.target as HTMLInputElement).value as SortMode)
                  }
                >
                  <md-select-option value="newest" selected={this.sortMode === 'newest'}>
                    <div slot="headline">Najnovšie</div>
                  </md-select-option>
                  <md-select-option value="oldest" selected={this.sortMode === 'oldest'}>
                    <div slot="headline">Najstaršie</div>
                  </md-select-option>
                  <md-select-option value="department" selected={this.sortMode === 'department'}>
                    <div slot="headline">Oddelenie A-Z</div>
                  </md-select-option>
                </md-outlined-select>
              </div>
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
                    {(() => {
                      const progress = this.itemProgress(order);
                      return (
                        <div class="progress-block">
                          <div class="progress-labels">
                            <span>Vybavené položky</span>
                            <strong>{progress.issued}/{progress.requested} ({progress.percent}%)</strong>
                          </div>
                          <div class="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
                            <div class="progress-fill" style={{ width: `${progress.percent}%` }}></div>
                          </div>
                        </div>
                      );
                    })()}
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
                    <div class="meta-row">
                      <p class="meta">
                        Položiek:
                        <md-badge label={order.items?.length || 0}>
                          <span>{order.items?.length || 0}</span>
                        </md-badge>
                      </p>
                      <p class="meta">Aktualizácia: {this.formatDate(order.updatedAt || order.createdAt)}</p>
                    </div>

                    {/* Expansion Panel - Extra element */}
                    <md-expansion-panel>
                      <div slot="headline">Podrobnosti položiek</div>
                      <div slot="supporting-text" style={{ fontSize: '0.875rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                        {order.items && order.items.length > 0 ? (
                          <div class="expansion-items">
                            {order.items.map((item, idx) => (
                              <div key={idx} class="expansion-item">
                                <strong>{item.productName || '—'}</strong>
                                <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                  Požadované: {item.requestedQty ?? 0} | Vydané: {item.issuedQty ?? 0}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ margin: '0' }}>Bez položiek</p>
                        )}
                      </div>
                    </md-expansion-panel>

                    {this.renderCardActions(order)}
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
