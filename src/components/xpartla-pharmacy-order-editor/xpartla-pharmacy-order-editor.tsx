import { Component, Event, EventEmitter, Host, Prop, State, h } from '@stencil/core';
import {
  createDepartmentOrder,
  deleteDepartmentOrder,
  DepartmentOrder,
  DepartmentOrderItem,
  DepartmentOrderStatus,
  fetchDepartmentOrder,
  updateDepartmentOrder,
} from '../../api/department-orders';

@Component({
  tag: 'xpartla-pharmacy-order-editor',
  styleUrl: 'xpartla-pharmacy-order-editor.css',
  shadow: true,
})
export class XpartlaPharmacyOrderEditor {
  @Prop() orderId: string;
  @Prop() pharmacyId: string;
  @Prop() apiBase: string;
  @Prop() userRole?: 'sestra' | 'lekaren';

  @Event({ eventName: 'order-editor-closed' }) orderEditorClosed: EventEmitter<string>;

  @State() entry: DepartmentOrder;
  @State() errorMessage: string;
  @State() loading: boolean = true;
  @State() saving: boolean = false;
  @State() departments: string[] = [];

  private get isNew(): boolean {
    return !this.orderId || this.orderId === '@new';
  }

  private createItemId(): string {
    return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private createEmptyItem(): DepartmentOrderItem {
    return {
      id: this.createItemId(),
      productName: '',
      requestedQty: 1,
      issuedQty: 0,
    };
  }

  private normalizeItems(items: DepartmentOrderItem[] | undefined): DepartmentOrderItem[] {
    const source = items && items.length > 0 ? items : [this.createEmptyItem()];
    return source.map(item => ({
      ...item,
      id: item.id || this.createItemId(),
    }));
  }

  async componentWillLoad() {
    await Promise.all([this.loadOrder(), this.loadDepartments()]);
    this.loading = false;
  }

  private loadDepartments() {
    // Hardcoded list of departments
    this.departments = [
      'Chirurgia',
      'Interna',
      'Pediatria',
      'Psychiatria',
      'Urgentný príjem',
      'Ortopédia',
      'Oftalmológia',
      'Neurológia',
      'Urológia',
      'ORL',
    ];
  }

  private async loadOrder() {
    if (this.isNew) {
      this.entry = {
        id: '@new',
        departmentName: '',
        note: '',
        status: 'created',
        items: [this.createEmptyItem()],
      };
      return;
    }

    try {
      this.entry = await fetchDepartmentOrder(this.apiBase, this.pharmacyId, this.orderId);
      this.entry = { ...this.entry, items: this.normalizeItems(this.entry.items) };
    } catch (err: any) {
      this.errorMessage = `Nepodarilo sa načítať objednávku: ${err.message || 'neznáma chyba'}`;
    }
  }

  private statusOptions(): DepartmentOrderStatus[] {
    return ['created', 'processing', 'fulfilled', 'canceled', 'archived'];
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

  private canMarkAsComplete(items: DepartmentOrderItem[] | undefined): boolean {
    if (!items || items.length === 0) return false;
    return items.every(item => {
      const requested = Math.max(0, Number(item.requestedQty || 0));
      const issued = Math.max(0, Number(item.issuedQty || 0));
      return requested > 0 && issued >= requested;
    });
  }

  private upsertItem(index: number, item: Partial<DepartmentOrderItem>) {
    const items = [...(this.entry?.items || [])];
    const previous = items[index] || this.createEmptyItem();
    items[index] = {
      ...previous,
      ...item,
      id: previous.id || this.createItemId(),
      requestedQty: Math.max(1, Number(item.requestedQty ?? previous.requestedQty ?? 1)),
      issuedQty: Math.max(0, Number(item.issuedQty ?? previous.issuedQty ?? 0)),
    };
    this.entry = { ...this.entry, items };
  }

  private removeItem(index: number) {
    const items = [...(this.entry?.items || [])];
    items.splice(index, 1);
    this.entry = {
      ...this.entry,
      items: items.length > 0 ? items : [this.createEmptyItem()],
    };
  }

  private addItem() {
    this.entry = {
      ...this.entry,
      items: [...(this.entry?.items || []), this.createEmptyItem()],
    };
  }

  private validate(): string | undefined {
    if (!this.entry?.departmentName?.trim()) {
      return 'Názov oddelenia je povinný.';
    }
    if (!this.entry.items || this.entry.items.length === 0) {
      return 'Objednávka musí obsahovať aspoň jednu položku.';
    }
    for (const item of this.entry.items) {
      if (!item.productName?.trim()) {
        return 'Každá položka musí mať názov produktu.';
      }
      if ((item.requestedQty || 0) <= 0) {
        return 'Požadované množstvo musí byť väčšie ako 0.';
      }
      if ((item.issuedQty || 0) < 0) {
        return 'Vydané množstvo nemôže byť záporné.';
      }
    }
    if (this.entry.status === 'fulfilled' && !this.canMarkAsComplete(this.entry.items)) {
      return 'Stav Dokončené je možné nastaviť až po vydaní všetkého požadovaného množstva.';
    }
    return undefined;
  }

  private async save() {
    const validationError = this.validate();
    if (validationError) {
      this.errorMessage = validationError;
      return;
    }

    this.saving = true;
    this.errorMessage = undefined;
    try {
      if (this.isNew) {
        await createDepartmentOrder(this.apiBase, this.pharmacyId, this.entry);
      } else {
        await updateDepartmentOrder(this.apiBase, this.pharmacyId, this.orderId, this.entry);
      }
      this.orderEditorClosed.emit('store');
    } catch (err: any) {
      this.errorMessage = `Objednávku sa nepodarilo uložiť: ${err.message || 'neznáma chyba'}`;
    } finally {
      this.saving = false;
    }
  }

  private async confirmDelete() {
    if (this.isNew) return;
    this.saving = true;
    this.errorMessage = undefined;
    try {
      await deleteDepartmentOrder(this.apiBase, this.pharmacyId, this.orderId);
      this.orderEditorClosed.emit('delete');
    } catch (err: any) {
      this.errorMessage = `Objednávku sa nepodarilo zrušiť/archivovať: ${err.message || 'neznáma chyba'}`;
    } finally {
      this.saving = false;
    }
  }

  private canCancelOrArchiveViaDelete(): boolean {
    if (this.isNew || !this.entry) return false;
    if (this.userRole === 'lekaren') return false;
    return this.entry.status === 'created';
  }

  private cancelOrArchiveLabel(): string {
    return this.userRole === 'lekaren' ? 'Archivovať objednávku' : 'Zrušiť objednávku';
  }

  private async setStatus(nextStatus: DepartmentOrderStatus) {
    if (this.isNew) return;
    if (nextStatus === 'fulfilled' && !this.canMarkAsComplete(this.entry?.items)) {
      this.errorMessage = 'Stav Dokončené je možné nastaviť až po vydaní všetkého požadovaného množstva.';
      return;
    }
    this.saving = true;
    this.errorMessage = undefined;
    try {
      const updated = await updateDepartmentOrder(this.apiBase, this.pharmacyId, this.orderId, {
        ...this.entry,
        status: nextStatus,
      });
      this.entry = updated;
    } catch (err: any) {
      this.errorMessage = `Stav objednávky sa nepodarilo zmeniť: ${err.message || 'neznáma chyba'}`;
    } finally {
      this.saving = false;
    }
  }

  private async closeOrder() {
    if (this.isNew) return;
    if (this.entry.status !== 'fulfilled') {
      this.errorMessage = 'Objednávku je možné zatvoriť až po vybavení.';
      return;
    }
    await this.setStatus('archived');
  }

  render() {
    if (this.loading) {
      return (
        <Host>
          <div class="state">
            <md-circular-progress indeterminate></md-circular-progress>
            <p>Načítavam objednávku…</p>
          </div>
        </Host>
      );
    }

    if (!this.entry) {
      return (
        <Host>
          <div class="state">
            <md-icon>error</md-icon>
            <p>{this.errorMessage || 'Objednávka sa nenašla.'}</p>
            <md-outlined-button onclick={() => this.orderEditorClosed.emit('cancel')}>
              Späť
            </md-outlined-button>
          </div>
        </Host>
      );
    }

    return (
      <Host>
        <header class="header">
          <md-icon-button aria-label="Späť" onclick={() => this.orderEditorClosed.emit('cancel')}>
            <md-icon>arrow_back</md-icon>
          </md-icon-button>
          <div>
            <span class="eyebrow">Objednávka oddelenia</span>
            <h2>{this.entry.departmentName || 'Nová objednávka'}</h2>
          </div>
          {!this.isNew && (
            <md-suggestion-chip label={this.statusLabel(this.entry.status)}></md-suggestion-chip>
          )}
        </header>

        {this.saving && <md-linear-progress indeterminate></md-linear-progress>}

        {this.errorMessage && (
          <div class="error-banner">
            <md-icon>error</md-icon>
            <span>{this.errorMessage}</span>
          </div>
        )}

        <section class="card">
          <md-outlined-select
            class="grow"
            label="Oddelenie"
            display-text={this.entry.departmentName}
            required
            disabled={this.userRole === 'lekaren'}
            oninput={(ev: InputEvent) =>
            (this.entry = {
              ...this.entry,
              departmentName: (ev.target as HTMLInputElement).value,
            })
            }
          >
            <md-icon slot="leading-icon">domain</md-icon>
            <md-select-option value="" selected={!this.entry.departmentName}>
              <div slot="headline">-- Vyber oddelenie --</div>
            </md-select-option>
            {this.departments.map(dept => (
              <md-select-option value={dept} selected={this.entry.departmentName === dept}>
                <div slot="headline">{dept}</div>
              </md-select-option>
            ))}
          </md-outlined-select>

          <md-outlined-text-field
            class="grow"
            label="Poznámka"
            value={this.entry.note || ''}
            oninput={(ev: InputEvent) =>
            (this.entry = {
              ...this.entry,
              note: (ev.target as HTMLInputElement).value,
            })
            }
          ></md-outlined-text-field>

          {!this.isNew && (
            <md-outlined-select
              label="Stav objednávky"
              display-text={this.statusLabel(this.entry.status)}
              disabled={this.userRole === 'sestra'}
              oninput={(ev: InputEvent) =>
              (this.entry = {
                ...this.entry,
                status: (ev.target as HTMLInputElement).value as DepartmentOrderStatus,
              })
              }
            >
              {this.statusOptions().map(status => (
                <md-select-option
                  value={status}
                  selected={this.entry.status === status}
                  disabled={status === 'fulfilled' && this.entry.status !== 'fulfilled' && !this.canMarkAsComplete(this.entry.items)}
                >
                  <div slot="headline">{this.statusLabel(status)}</div>
                </md-select-option>
              ))}
            </md-outlined-select>
          )}
        </section>

        <section class="card items">
          <div class="items-head">
            <h3>Položky</h3>
            <md-filled-tonal-button disabled={this.userRole === 'lekaren'} onclick={() => this.addItem()}>
              <md-icon slot="icon">add</md-icon>
              Pridať položku
            </md-filled-tonal-button>
          </div>

          <div class="items-grid">
            {this.entry.items.map((item, index) => (
              <div class="item-row">
                <md-outlined-text-field
                  class="grow"
                  label="Produkt"
                  value={item.productName}
                  disabled={this.userRole === 'lekaren'}
                  oninput={(ev: InputEvent) =>
                    this.upsertItem(index, { productName: (ev.target as HTMLInputElement).value })
                  }
                ></md-outlined-text-field>

                <md-outlined-text-field
                  type="number"
                  label="Požadované"
                  value={item.requestedQty ?? 1}
                  min="1"
                  oninput={(ev: InputEvent) =>
                    this.upsertItem(index, { requestedQty: Math.max(1, Number((ev.target as HTMLInputElement).value)) })
                  }
                ></md-outlined-text-field>

                <md-outlined-text-field
                  type="number"
                  label="Vydané"
                  value={item.issuedQty ?? 0}
                  min="0"
                  oninput={(ev: InputEvent) =>
                    this.upsertItem(index, { issuedQty: Math.max(0, Number((ev.target as HTMLInputElement).value)) })
                  }
                ></md-outlined-text-field>

                <md-icon-button aria-label="Odstrániť položku" disabled={this.userRole === 'lekaren'} onclick={() => this.removeItem(index)}>
                  <md-icon>delete</md-icon>
                </md-icon-button>
              </div>
            ))}
          </div>
        </section>

        <div class="actions">
          {!this.isNew && this.userRole === 'lekaren' && this.entry.status === 'created' && (
            <md-filled-tonal-button disabled={this.saving} onclick={() => this.setStatus('processing')}>
              <md-icon slot="icon">play_arrow</md-icon>
              Prevziať do spracovania
            </md-filled-tonal-button>
          )}
          {!this.isNew && this.userRole === 'lekaren' && this.entry.status === 'processing' && (
            <md-filled-tonal-button disabled={this.saving} onclick={() => this.setStatus('fulfilled')}>
              <md-icon slot="icon">inventory_2</md-icon>
              Označiť ako vybavenú
            </md-filled-tonal-button>
          )}
          {!this.isNew && this.canCancelOrArchiveViaDelete() && (
            <md-filled-tonal-button class="danger" disabled={this.saving} onclick={() => this.confirmDelete()}>
              <md-icon slot="icon">delete</md-icon>
              {this.cancelOrArchiveLabel()}
            </md-filled-tonal-button>
          )}
          {!this.isNew && this.userRole === 'lekaren' && this.entry.status === 'fulfilled' && (
            <md-filled-tonal-button disabled={this.saving} onclick={() => this.closeOrder()}>
              <md-icon slot="icon">task_alt</md-icon>
              Zatvoriť objednávku
            </md-filled-tonal-button>
          )}
          <span class="stretch"></span>
          <md-outlined-button disabled={this.saving} onclick={() => this.orderEditorClosed.emit('cancel')}>
            Zrušiť
          </md-outlined-button>
          <md-filled-button disabled={this.saving} onclick={() => this.save()}>
            <md-icon slot="icon">save</md-icon>
            {this.saving ? 'Ukladám…' : 'Uložiť'}
          </md-filled-button>
        </div>
      </Host>
    );
  }
}
