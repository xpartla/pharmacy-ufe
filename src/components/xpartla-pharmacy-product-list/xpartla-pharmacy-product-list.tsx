import { Component, Event, EventEmitter, Host, Prop, State, h } from '@stencil/core';
import {
  PharmacyProductsApi,
  PharmacyCategoriesApi,
  Product,
  Category,
  Configuration,
} from '../../api/pharmacy-product';

@Component({
  tag: 'xpartla-pharmacy-product-list',
  styleUrl: 'xpartla-pharmacy-product-list.css',
  shadow: true,
})
export class XpartlaPharmacyProductList {
  @Event({ eventName: 'entry-clicked' }) entryClicked: EventEmitter<string>;
  @Prop() apiBase: string;
  @Prop() pharmacyId: string;

  @State() errorMessage: string;
  @State() products: Product[] = [];
  @State() categories: Category[] = [];
  @State() searchTerm: string = '';
  @State() selectedCategoryCode: string = '';

  async componentWillLoad() {
    await Promise.all([this.loadProducts(), this.loadCategories()]);
  }

  private async loadProducts() {
    try {
      const api = new PharmacyProductsApi(new Configuration({ basePath: this.apiBase }));
      const response = await api.getProductsRaw({ pharmacyId: this.pharmacyId });
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
      // Categories are optional for listing; just leave the filter empty.
    }
  }

  private filtered(): Product[] {
    const q = this.searchTerm.trim().toLowerCase();
    return this.products.filter(
      p =>
        (!q || (p.name || '').toLowerCase().includes(q)) &&
        (!this.selectedCategoryCode || p.category?.code === this.selectedCategoryCode)
    );
  }

  render() {
    if (this.errorMessage) {
      return (
        <Host>
          <div class="error">{this.errorMessage}</div>
        </Host>
      );
    }

    const visible = this.filtered();

    return (
      <Host>
        <div class="filters">
          <md-filled-text-field
            label="Hľadať podľa názvu"
            value={this.searchTerm}
            oninput={(ev: InputEvent) => (this.searchTerm = (ev.target as HTMLInputElement).value)}
          >
            <md-icon slot="leading-icon">search</md-icon>
          </md-filled-text-field>

          <md-filled-select
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
          </md-filled-select>
        </div>

        {visible.length === 0 ? (
          <div class="empty">Žiadne produkty nezodpovedajú filtru.</div>
        ) : (
          <md-list>
            {visible.map(p => (
              <md-list-item onClick={() => this.entryClicked.emit(p.id)}>
                <div slot="headline">{p.name}</div>
                <div slot="supporting-text">
                  {(p.category?.value ?? '—') + ' · sklad: ' + (p.stock ?? 0)}
                </div>
                <md-icon slot="start">medication</md-icon>
              </md-list-item>
            ))}
          </md-list>
        )}

        <md-filled-icon-button class="add-button" onclick={() => this.entryClicked.emit('@new')}>
          <md-icon>add</md-icon>
        </md-filled-icon-button>
      </Host>
    );
  }
}
