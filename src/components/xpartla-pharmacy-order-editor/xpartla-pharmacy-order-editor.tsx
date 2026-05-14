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

    private get isNew(): boolean {
        return !this.orderId || this.orderId === '@new';
    }

    async componentWillLoad() {
        await this.loadOrder();
        this.loading = false;
    }

    private async loadOrder() {
        if (this.isNew) {
            this.entry = {
                id: '@new',
                departmentName: '',
                note: '',
                status: 'created',
                items: [{ productName: '', requestedQty: 1, issuedQty: 0 }],
            };
            return;
        }

        try {
            this.entry = await fetchDepartmentOrder(this.apiBase, this.pharmacyId, this.orderId);
            if (!this.entry.items || this.entry.items.length === 0) {
                this.entry = { ...this.entry, items: [{ productName: '', requestedQty: 1, issuedQty: 0 }] };
            }
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

    private upsertItem(index: number, item: Partial<DepartmentOrderItem>) {
        const items = [...(this.entry?.items || [])];
        const previous = items[index] || { productName: '', requestedQty: 1, issuedQty: 0 };
        items[index] = {
            ...previous,
            ...item,
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
            items: items.length > 0 ? items : [{ productName: '', requestedQty: 1, issuedQty: 0 }],
        };
    }

    private addItem() {
        this.entry = {
            ...this.entry,
            items: [...(this.entry?.items || []), { productName: '', requestedQty: 1, issuedQty: 0 }],
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

    private async remove() {
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

                {this.errorMessage && (
                    <div class="error-banner">
                        <md-icon>error</md-icon>
                        <span>{this.errorMessage}</span>
                    </div>
                )}

                <section class="card">
                    <md-outlined-text-field
                        class="grow"
                        label="Oddelenie"
                        value={this.entry.departmentName}
                        oninput={(ev: InputEvent) =>
                        (this.entry = {
                            ...this.entry,
                            departmentName: (ev.target as HTMLInputElement).value,
                        })
                        }
                    ></md-outlined-text-field>

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
                                <md-select-option value={status} selected={this.entry.status === status}>
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
                                    label="Požadované"
                                    type="number"
                                    min="1"
                                    value={String(item.requestedQty ?? 1)}
                                    disabled={this.userRole === 'lekaren'}
                                    oninput={(ev: InputEvent) =>
                                        this.upsertItem(index, {
                                            requestedQty:
                                                Number.parseInt((ev.target as HTMLInputElement).value, 10) || 1,
                                        })
                                    }
                                ></md-outlined-text-field>
                                <md-outlined-text-field
                                    label="Vydané"
                                    type="number"
                                    min="0"
                                    value={String(item.issuedQty ?? 0)}
                                    disabled={this.userRole === 'sestra'}
                                    oninput={(ev: InputEvent) =>
                                        this.upsertItem(index, {
                                            issuedQty: Number.parseInt((ev.target as HTMLInputElement).value, 10) || 0,
                                        })
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
                    {!this.isNew && (
                        <md-filled-tonal-button class="danger" disabled={this.saving} onclick={() => this.remove()}>
                            <md-icon slot="icon">delete</md-icon>
                            Zrušiť / Archivovať
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
