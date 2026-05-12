import { Component, Event, EventEmitter, Host, Prop, State, h } from '@stencil/core';
import {
  PharmacyProductsApi,
  PharmacyCategoriesApi,
  PharmaciesApi,
  Product,
  Category,
  Pharmacy,
  Configuration,
  GetProductsIncludeEnum,
} from '../../api/pharmacy-product';

type SortKey = 'name' | 'stock-asc' | 'stock-desc' | 'category';
type ActiveFilter = 'active' | 'inactive' | 'all';

const LOW_STOCK_THRESHOLD = 10;

@Component({
  tag: 'xpartla-pharmacy-product-list',
  styleUrl: 'xpartla-pharmacy-product-list.css',
  shadow: true,
})
export class XpartlaPharmacyProductList {
  @Event({ eventName: 'entry-clicked' }) entryClicked: EventEmitter<string>;
  @Prop() apiBase: string;
  @Prop() pharmacyId: string;

  @State() loading: boolean = true;
  @State() errorMessage: string;
  @State() products: Product[] = [];
  @State() categories: Category[] = [];
  @State() pharmacy?: Pharmacy;
  @State() searchTerm: string = '';
  @State() selectedCategoryCode: string = '';
  @State() sortKey: SortKey = 'name';
  @State() activeFilter: ActiveFilter = 'active';

  async componentWillLoad() {
    await Promise.all([this.loadProducts(), this.loadCategories(), this.loadPharmacy()]);
    this.loading = false;
  }

  private async loadProducts() {
    try {
      const api = new PharmacyProductsApi(new Configuration({ basePath: this.apiBase }));
      // Fetch *all* products so stats and the inactive filter can be computed locally.
      const response = await api.getProductsRaw({
        pharmacyId: this.pharmacyId,
        include: GetProductsIncludeEnum.All,
      });
      if (response.raw.status < 299) {
        this.products = await response.value();
      } else {
        this.errorMessage = `Nepodarilo sa načítať zoznam produktov: ${response.raw.statusText}`;
      }
    } catch (err: any) {
      this.errorMessage = `Nepodarilo sa načítať zoznam produktov: ${err.message || 'neznáma chyba'}`;
    }
  }

  private async loadCategories() {
    try {
      const api = new PharmacyCategoriesApi(new Configuration({ basePath: this.apiBase }));
      const response = await api.getCategoriesRaw({ pharmacyId: this.pharmacyId });
      if (response.raw.status < 299) {
        this.categories = await response.value();
      }
    } catch (_err: any) {
      // Categories are optional for listing; the filter dropdown simply won't list them.
    }
  }

  private async loadPharmacy() {
    try {
      const api = new PharmaciesApi(new Configuration({ basePath: this.apiBase }));
      const response = await (api as any).getPharmacyRaw?.({ pharmacyId: this.pharmacyId });
      if (response && response.raw && response.raw.status < 299) {
        this.pharmacy = await response.value();
      }
    } catch (_err: any) {
      // The generated client may not expose a getPharmacy method (the OpenAPI contract has
      // create/delete but no GET). Fall back to a static label derived from the pharmacy id.
    }
  }

  private stockStatus(p: Product): 'ok' | 'low' | 'out' {
    const s = p.stock ?? 0;
    if (s <= 0) return 'out';
    if (s <= LOW_STOCK_THRESHOLD) return 'low';
    return 'ok';
  }

  private filtered(): Product[] {
    const q = this.searchTerm.trim().toLowerCase();
    return this.products
      .filter(p => {
        if (this.activeFilter === 'active' && !p.active) return false;
        if (this.activeFilter === 'inactive' && p.active) return false;
        if (q && !(p.name || '').toLowerCase().includes(q)) return false;
        if (this.selectedCategoryCode && p.category?.code !== this.selectedCategoryCode) return false;
        return true;
      })
      .sort((a, b) => {
        switch (this.sortKey) {
          case 'stock-asc':
            return (a.stock ?? 0) - (b.stock ?? 0);
          case 'stock-desc':
            return (b.stock ?? 0) - (a.stock ?? 0);
          case 'category':
            return (a.category?.value ?? '').localeCompare(b.category?.value ?? '', 'sk');
          case 'name':
          default:
            return (a.name ?? '').localeCompare(b.name ?? '', 'sk');
        }
      });
  }

  private stats() {
    const total = this.products.length;
    const active = this.products.filter(p => p.active);
    const low = active.filter(p => this.stockStatus(p) === 'low').length;
    const out = active.filter(p => this.stockStatus(p) === 'out').length;
    const inactive = total - active.length;
    return { total: active.length, low, out, inactive };
  }

  private pharmacyDisplayName(): string {
    return this.pharmacy?.name?.trim() || 'Lekáreň ' + (this.pharmacyId ?? '');
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
          <div class="hero-text">
            <span class="eyebrow">Sklad lekárne</span>
            <h1>{this.pharmacyDisplayName()}</h1>
          </div>
          <md-fab
            variant="primary"
            label="Pridať produkt"
            onclick={() => this.entryClicked.emit('@new')}
          >
            <md-icon slot="icon">add</md-icon>
          </md-fab>
        </header>

        <section class="stats" aria-label="Prehľad zásob">
          {this.renderStat('inventory_2', 'Aktívne produkty', stats.total, 'ok')}
          {this.renderStat('warning', 'Málo na sklade', stats.low, 'low')}
          {this.renderStat('block', 'Vypredané', stats.out, 'out')}
          {this.renderStat('archive', 'Neaktívne', stats.inactive, 'inactive')}
        </section>

        <section class="controls">
          <md-filled-text-field
            class="search"
            label="Hľadať podľa názvu"
            value={this.searchTerm}
            oninput={(ev: InputEvent) =>
              (this.searchTerm = (ev.target as HTMLInputElement).value)
            }
          >
            <md-icon slot="leading-icon">search</md-icon>
          </md-filled-text-field>

          <md-outlined-select
            label="Kategória"
            display-text={
              this.categories.find(c => c.code === this.selectedCategoryCode)?.value ||
              'Všetky kategórie'
            }
            oninput={(ev: InputEvent) =>
              (this.selectedCategoryCode = (ev.target as HTMLInputElement).value)
            }
          >
            <md-icon slot="leading-icon">category</md-icon>
            <md-select-option value="" selected={this.selectedCategoryCode === ''}>
              <div slot="headline">Všetky kategórie</div>
            </md-select-option>
            {this.categories.map(c => (
              <md-select-option value={c.code} selected={c.code === this.selectedCategoryCode}>
                <div slot="headline">{c.value}</div>
              </md-select-option>
            ))}
          </md-outlined-select>

          <md-outlined-select
            label="Zoradiť"
            display-text={this.sortLabel(this.sortKey)}
            oninput={(ev: InputEvent) =>
              (this.sortKey = (ev.target as HTMLInputElement).value as SortKey)
            }
          >
            <md-icon slot="leading-icon">sort</md-icon>
            <md-select-option value="name" selected={this.sortKey === 'name'}>
              <div slot="headline">Názov (A-Z)</div>
            </md-select-option>
            <md-select-option value="stock-desc" selected={this.sortKey === 'stock-desc'}>
              <div slot="headline">Sklad (najviac)</div>
            </md-select-option>
            <md-select-option value="stock-asc" selected={this.sortKey === 'stock-asc'}>
              <div slot="headline">Sklad (najmenej)</div>
            </md-select-option>
            <md-select-option value="category" selected={this.sortKey === 'category'}>
              <div slot="headline">Kategória</div>
            </md-select-option>
          </md-outlined-select>
        </section>

        <md-chip-set class="status-chips" aria-label="Filter podľa stavu">
          {this.renderActiveChip('active', 'Aktívne', stats.total)}
          {this.renderActiveChip('inactive', 'Neaktívne', stats.inactive)}
          {this.renderActiveChip('all', 'Všetky', this.products.length)}
        </md-chip-set>

        {this.renderBody(visible)}
      </Host>
    );
  }

  private renderBody(visible: Product[]) {
    if (this.loading) {
      return (
        <div class="empty">
          <md-circular-progress indeterminate></md-circular-progress>
          <p>Načítavam produkty…</p>
        </div>
      );
    }
    if (visible.length === 0) {
      return (
        <div class="empty">
          <md-icon>inventory_2</md-icon>
          <p>Žiadne produkty nezodpovedajú filtru.</p>
          <md-text-button onclick={() => this.resetFilters()}>Vymazať filter</md-text-button>
        </div>
      );
    }
    return <div class="grid">{visible.map(p => this.renderCard(p))}</div>;
  }

  private renderStat(icon: string, label: string, value: number, tone: string) {
    return (
      <div class={`stat stat-${tone}`}>
        <div class="stat-icon">
          <md-icon>{icon}</md-icon>
        </div>
        <div>
          <div class="stat-value">{value}</div>
          <div class="stat-label">{label}</div>
        </div>
      </div>
    );
  }

  private renderActiveChip(value: ActiveFilter, label: string, count: number) {
    const selected = this.activeFilter === value;
    return (
      <md-filter-chip
        label={`${label} (${count})`}
        selected={selected}
        onclick={() => (this.activeFilter = value)}
      ></md-filter-chip>
    );
  }

  private renderCard(p: Product) {
    const status = this.stockStatus(p);
    const inactive = !p.active;
    return (
      <md-elevated-card
        class={{
          'product-card': true,
          'is-inactive': inactive,
        }}
        onclick={() => this.entryClicked.emit(p.id)}
      >
        <div class="card-head">
          <div class="card-avatar">
            <md-icon>medication</md-icon>
          </div>
          <div class={`stock-badge stock-${inactive ? 'inactive' : status}`}>
            <md-icon>{this.statusIcon(inactive ? 'inactive' : status)}</md-icon>
            <span>{p.stock ?? 0} ks</span>
          </div>
        </div>
        <h3 class="card-title">{p.name || '—'}</h3>
        <div class="card-meta">
          {p.category?.value ? (
            <md-suggestion-chip
              label={p.category.value}
              onclick={(ev: Event) => ev.stopPropagation()}
            ></md-suggestion-chip>
          ) : (
            <span class="muted">Bez kategórie</span>
          )}
          {inactive && (
            <md-suggestion-chip
              label="Neaktívne"
              class="inactive-chip"
              onclick={(ev: Event) => ev.stopPropagation()}
            ></md-suggestion-chip>
          )}
        </div>
      </md-elevated-card>
    );
  }

  private statusIcon(s: 'ok' | 'low' | 'out' | 'inactive'): string {
    switch (s) {
      case 'ok':
        return 'check_circle';
      case 'low':
        return 'warning';
      case 'out':
        return 'block';
      case 'inactive':
        return 'archive';
    }
  }

  private sortLabel(key: SortKey): string {
    switch (key) {
      case 'stock-asc':
        return 'Sklad (najmenej)';
      case 'stock-desc':
        return 'Sklad (najviac)';
      case 'category':
        return 'Kategória';
      case 'name':
      default:
        return 'Názov (A-Z)';
    }
  }

  private resetFilters() {
    this.searchTerm = '';
    this.selectedCategoryCode = '';
    this.activeFilter = 'active';
  }
}
