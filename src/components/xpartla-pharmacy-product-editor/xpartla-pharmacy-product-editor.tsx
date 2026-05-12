import { Component, Event, EventEmitter, Host, Prop, State, h } from '@stencil/core';
import {
  PharmacyProductsApi,
  PharmacyCategoriesApi,
  Product,
  Category,
  Configuration,
} from '../../api/pharmacy-product';

const LOW_STOCK_THRESHOLD = 10;

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
  @State() loading: boolean = true;
  @State() saving: boolean = false;

  private formElement: HTMLFormElement;

  async componentWillLoad() {
    await Promise.all([this.loadProduct(), this.loadCategories()]);
    this.loading = false;
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
      // Categories are optional; the form falls back to free-text display.
    }
  }

  render() {
    if (this.loading) {
      return (
        <Host>
          <div class="state state-loading">
            <md-circular-progress indeterminate></md-circular-progress>
            <p>Načítavam produkt…</p>
          </div>
        </Host>
      );
    }

    if (this.errorMessage && !this.entry) {
      return (
        <Host>
          <div class="state state-error">
            <md-icon>error</md-icon>
            <p>{this.errorMessage}</p>
            <md-outlined-button onclick={() => this.editorClosed.emit('cancel')}>
              <md-icon slot="icon">arrow_back</md-icon>
              Späť na zoznam
            </md-outlined-button>
          </div>
        </Host>
      );
    }

    const stockClass = this.stockTone();

    return (
      <Host>
        <header class="editor-header">
          <md-icon-button
            class="back"
            aria-label="Späť"
            onclick={() => this.editorClosed.emit('cancel')}
          >
            <md-icon>arrow_back</md-icon>
          </md-icon-button>
          <div class="header-text">
            <span class="eyebrow">{this.isNew ? 'Nový produkt' : 'Detail produktu'}</span>
            <h1>{this.entry?.name?.trim() || 'Nový produkt'}</h1>
          </div>
          {!this.isNew && this.renderStatusChip()}
        </header>

        {this.errorMessage && (
          <div class="banner banner-error">
            <md-icon>error</md-icon>
            <span>{this.errorMessage}</span>
          </div>
        )}

        <form ref={el => (this.formElement = el)}>
          <section class="card">
            <h2>
              <md-icon>info</md-icon>
              Základné údaje
            </h2>
            <div class="row">
              <md-outlined-text-field
                class="grow"
                label="Názov produktu"
                required
                pattern=".*\S.*"
                value={this.entry?.name}
                oninput={(ev: InputEvent) => {
                  if (this.entry) this.entry.name = this.handleInputEvent(ev);
                }}
              >
                <md-icon slot="leading-icon">medication</md-icon>
              </md-outlined-text-field>
            </div>
            <div class="row">{this.renderCategorySelect()}</div>
          </section>

          <section class="card">
            <h2>
              <md-icon>inventory_2</md-icon>
              Sklad
            </h2>
            <div class="stepper">
              <md-filled-tonal-icon-button
                aria-label="Znížiť"
                onclick={() => this.adjustStock(-1)}
              >
                <md-icon>remove</md-icon>
              </md-filled-tonal-icon-button>
              <md-outlined-text-field
                class="stock-input"
                label="Počet kusov"
                type="number"
                min="0"
                required
                value={String(this.entry?.stock ?? 0)}
                oninput={(ev: InputEvent) => {
                  if (this.entry)
                    this.entry.stock = Math.max(
                      0,
                      Number.parseInt(this.handleInputEvent(ev), 10) || 0
                    );
                }}
              ></md-outlined-text-field>
              <md-filled-tonal-icon-button
                aria-label="Zvýšiť"
                onclick={() => this.adjustStock(+1)}
              >
                <md-icon>add</md-icon>
              </md-filled-tonal-icon-button>
            </div>
            <div class={`stock-hint stock-hint-${stockClass}`}>
              <md-icon>{this.stockHintIcon(stockClass)}</md-icon>
              <span>{this.stockHintText(stockClass)}</span>
            </div>
          </section>

          {!this.isNew && (
            <section class="card">
              <h2>
                <md-icon>toggle_on</md-icon>
                Stav produktu
              </h2>
              <div class="toggle-row">
                <div>
                  <div class="toggle-label">Produkt je aktívny</div>
                  <div class="toggle-help">
                    Neaktívne produkty sa štandardne nezobrazujú v zozname zákazníkom.
                  </div>
                </div>
                <md-switch
                  selected={this.entry?.active}
                  onchange={(ev: Event) => {
                    if (this.entry) this.entry.active = (ev.target as any).selected;
                  }}
                ></md-switch>
              </div>
            </section>
          )}
        </form>

        <md-divider></md-divider>
        <div class="actions">
          {!this.isNew && this.entry?.active && (
            <md-filled-tonal-button class="danger" onClick={() => this.deactivateEntry()}>
              <md-icon slot="icon">delete</md-icon>
              Deaktivovať
            </md-filled-tonal-button>
          )}
          {!this.isNew && !this.entry?.active && (
            <md-filled-tonal-button onClick={() => this.reactivateEntry()}>
              <md-icon slot="icon">restore</md-icon>
              Obnoviť
            </md-filled-tonal-button>
          )}
          <span class="stretch-fill"></span>
          <md-outlined-button
            onClick={() => this.editorClosed.emit('cancel')}
            disabled={this.saving}
          >
            Zrušiť
          </md-outlined-button>
          <md-filled-button onClick={() => this.saveEntry()} disabled={this.saving}>
            <md-icon slot="icon">save</md-icon>
            {this.saving ? 'Ukladám…' : 'Uložiť'}
          </md-filled-button>
        </div>
      </Host>
    );
  }

  private renderStatusChip() {
    if (!this.entry?.active) {
      return (
        <md-suggestion-chip
          class="status-chip inactive"
          label="Neaktívny"
        ></md-suggestion-chip>
      );
    }
    return (
      <md-suggestion-chip class="status-chip active" label="Aktívny"></md-suggestion-chip>
    );
  }

  private renderCategorySelect() {
    let categories = this.categories || [];
    if (this.entry?.category && !categories.find(c => c.code === this.entry.category.code)) {
      categories = [this.entry.category, ...categories];
    }
    return (
      <md-outlined-select
        class="grow"
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
      </md-outlined-select>
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

  private adjustStock(delta: number) {
    if (!this.entry) return;
    this.entry = { ...this.entry, stock: Math.max(0, (this.entry.stock ?? 0) + delta) };
  }

  private stockTone(): 'ok' | 'low' | 'out' {
    const s = this.entry?.stock ?? 0;
    if (s <= 0) return 'out';
    if (s <= LOW_STOCK_THRESHOLD) return 'low';
    return 'ok';
  }

  private stockHintIcon(tone: 'ok' | 'low' | 'out'): string {
    switch (tone) {
      case 'ok':
        return 'check_circle';
      case 'low':
        return 'warning';
      case 'out':
        return 'block';
    }
  }

  private stockHintText(tone: 'ok' | 'low' | 'out'): string {
    switch (tone) {
      case 'ok':
        return 'Dostatočne na sklade.';
      case 'low':
        return `Nízky stav (≤ ${LOW_STOCK_THRESHOLD} ks) — zvážte doplnenie.`;
      case 'out':
        return 'Produkt je vypredaný.';
    }
  }

  private validateForm(mode: 'silent' | 'show-errors'): boolean {
    if (!this.formElement) return false;
    this.isValid = true;
    // Walk through all form fields recursively because the inputs now live inside <section> wrappers.
    const fields = this.formElement.querySelectorAll<HTMLElement>(
      'md-outlined-text-field, md-filled-text-field, md-outlined-select, md-filled-select'
    );
    fields.forEach(element => {
      const el = element as HTMLElement & {
        checkValidity?: () => boolean;
        reportValidity?: () => boolean;
      };
      let valid = true;
      if (mode === 'show-errors' && el.reportValidity) {
        valid = el.reportValidity();
      } else if (el.checkValidity) {
        valid = el.checkValidity();
      }
      this.isValid &&= valid;
    });
    return this.isValid;
  }

  private async saveEntry() {
    if (!this.validateForm('show-errors')) return;
    this.saving = true;
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
    } finally {
      this.saving = false;
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

  private async reactivateEntry() {
    if (!this.entry) return;
    this.entry = { ...this.entry, active: true };
    // Reactivation is just a PUT that flips active=true.
    await this.saveEntry();
  }
}
