import { Component, Event, EventEmitter, Host, Prop, State, h } from '@stencil/core';
import {
  PharmacyProductsApi,
  PharmacyCategoriesApi,
  Product,
  Category,
  Configuration,
} from '../../api/pharmacy-product';

@Component({
  tag: 'xpartla-pharmacy-product-editor',
  styleUrl: 'xpartla-pharmacy-product-editor.css',
  shadow: true,
})
export class XpartlaPharmacyProductEditor {
  @Prop() productId: string;
  @Prop() pharmacyId: string;
  @Prop() apiBase: string;

  @Event({ eventName: 'editor-closed' }) editorClosed: EventEmitter<string>;

  @State() entry: Product;
  @State() categories: Category[] = [];
  @State() errorMessage: string;
  @State() isValid: boolean = false;

  private formElement: HTMLFormElement;

  async componentWillLoad() {
    await Promise.all([this.loadProduct(), this.loadCategories()]);
  }

  private get isNew(): boolean {
    return !this.productId || this.productId === '@new';
  }

  private async loadProduct() {
    if (this.isNew) {
      this.entry = { id: '@new', name: '', stock: 0, active: true };
      this.isValid = false;
      return;
    }
    try {
      const api = new PharmacyProductsApi(new Configuration({ basePath: this.apiBase }));
      const response = await api.getProductRaw({
        pharmacyId: this.pharmacyId,
        productId: this.productId,
      });
      if (response.raw.status < 299) {
        this.entry = await response.value();
        this.isValid = true;
      } else {
        this.errorMessage = `Nepodarilo sa načítať produkt: ${response.raw.statusText}`;
      }
    } catch (err: any) {
      this.errorMessage = `Nepodarilo sa načítať produkt: ${err.message || 'neznáma chyba'}`;
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
      // Categories are optional — editor still works with a free-text fallback in display only.
    }
  }

  render() {
    if (this.errorMessage) {
      return (
        <Host>
          <div class="error">{this.errorMessage}</div>
        </Host>
      );
    }

    return (
      <Host>
        <form ref={el => (this.formElement = el)}>
          <md-filled-text-field
            label="Názov produktu"
            required
            pattern=".*\S.*"
            value={this.entry?.name}
            oninput={(ev: InputEvent) => {
              if (this.entry) this.entry.name = this.handleInputEvent(ev);
            }}
          >
            <md-icon slot="leading-icon">medication</md-icon>
          </md-filled-text-field>

          {this.renderCategorySelect()}

          <md-filled-text-field
            label="Stav skladu (ks)"
            type="number"
            min="0"
            required
            value={String(this.entry?.stock ?? 0)}
            oninput={(ev: InputEvent) => {
              if (this.entry) this.entry.stock = Number.parseInt(this.handleInputEvent(ev), 10) || 0;
            }}
          >
            <md-icon slot="leading-icon">inventory_2</md-icon>
          </md-filled-text-field>
        </form>

        <md-divider></md-divider>
        <div class="actions">
          <md-filled-tonal-button
            id="delete"
            disabled={!this.entry || this.isNew}
            onClick={() => this.deactivateEntry()}
          >
            <md-icon slot="icon">delete</md-icon>
            Deaktivovať
          </md-filled-tonal-button>
          <span class="stretch-fill"></span>
          <md-outlined-button id="cancel" onClick={() => this.editorClosed.emit('cancel')}>
            Zrušiť
          </md-outlined-button>
          <md-filled-button id="confirm" onClick={() => this.saveEntry()}>
            <md-icon slot="icon">save</md-icon>
            Uložiť
          </md-filled-button>
        </div>
      </Host>
    );
  }

  private renderCategorySelect() {
    let categories = this.categories || [];
    if (this.entry?.category && !categories.find(c => c.code === this.entry.category.code)) {
      categories = [this.entry.category, ...categories];
    }
    return (
      <md-filled-select
        label="Kategória"
        display-text={this.entry?.category?.value}
        oninput={(ev: InputEvent) => this.handleCategory(ev)}
      >
        <md-icon slot="leading-icon">category</md-icon>
        {categories.map(c => (
          <md-select-option value={c.code} selected={c.code === this.entry?.category?.code}>
            <div slot="headline">{c.value}</div>
          </md-select-option>
        ))}
      </md-filled-select>
    );
  }

  private handleCategory(ev: InputEvent) {
    if (!this.entry) return;
    const code = this.handleInputEvent(ev);
    const cat = this.categories.find(c => c.code === code);
    if (cat) this.entry.category = { ...cat };
  }

  private handleInputEvent(ev: InputEvent): string {
    const target = ev.target as HTMLInputElement;
    this.validateForm('silent');
    return target.value;
  }

  private validateForm(mode: 'silent' | 'show-errors'): boolean {
    this.isValid = true;
    for (let i = 0; i < this.formElement.children.length; i++) {
      const element = this.formElement.children[i] as HTMLElement & {
        checkValidity?: () => boolean;
        reportValidity?: () => boolean;
      };
      let valid = true;
      if (mode === 'show-errors' && element.reportValidity) {
        valid = element.reportValidity();
      } else if (element.checkValidity) {
        valid = element.checkValidity();
      }
      this.isValid &&= valid;
    }
    return this.isValid;
  }

  private async saveEntry() {
    if (!this.validateForm('show-errors')) return;
    try {
      const api = new PharmacyProductsApi(new Configuration({ basePath: this.apiBase }));
      const response = this.isNew
        ? await api.createProductRaw({ pharmacyId: this.pharmacyId, product: this.entry })
        : await api.updateProductRaw({
            pharmacyId: this.pharmacyId,
            productId: this.productId,
            product: this.entry,
          });
      if (response.raw.status < 299) {
        this.editorClosed.emit('store');
      } else {
        this.errorMessage = `Produkt sa nepodarilo uložiť: ${response.raw.statusText}`;
      }
    } catch (err: any) {
      this.errorMessage = `Produkt sa nepodarilo uložiť: ${err.message || 'neznáma chyba'}`;
    }
  }

  private async deactivateEntry() {
    try {
      const api = new PharmacyProductsApi(new Configuration({ basePath: this.apiBase }));
      const response = await api.deleteProductRaw({
        pharmacyId: this.pharmacyId,
        productId: this.productId,
      });
      if (response.raw.status < 299) {
        this.editorClosed.emit('delete');
      } else {
        this.errorMessage = `Produkt sa nepodarilo deaktivovať: ${response.raw.statusText}`;
      }
    } catch (err: any) {
      this.errorMessage = `Produkt sa nepodarilo deaktivovať: ${err.message || 'neznáma chyba'}`;
    }
  }
}
