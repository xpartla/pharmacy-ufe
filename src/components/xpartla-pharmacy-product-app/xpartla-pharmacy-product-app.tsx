import { Component, Host, Prop, State, h } from '@stencil/core';

declare global {
  interface Window {
    navigation: any;
  }
}

@Component({
  tag: 'xpartla-pharmacy-product-app',
  styleUrl: 'xpartla-pharmacy-product-app.css',
  shadow: true,
})
export class XpartlaPharmacyProductApp {
  @State() private relativePath = '';
  @State() userRole: 'sestra' | 'lekaren' = 'sestra';

  @Prop() basePath: string = '';
  @Prop() apiBase: string;
  @Prop() pharmacyId: string;

  componentWillLoad() {
    const baseUri = new URL(this.basePath, document.baseURI || '/').pathname;

    const toRelative = (path: string) => {
      if (path.startsWith(baseUri)) {
        this.relativePath = path.slice(baseUri.length);
      } else {
        this.relativePath = '';
      }
    };

    window.navigation?.addEventListener('navigate', (ev: Event) => {
      if ((ev as any).canIntercept) {
        (ev as any).intercept();
      }
      const path = new URL((ev as any).destination.url).pathname;
      toRelative(path);
    });

    toRelative(location.pathname);
  }

  render() {
    let section: 'products' | 'orders' = 'products';
    let element = 'list';
    let entityId = '@new';

    if (this.relativePath.startsWith('orders/')) {
      section = 'orders';
      if (this.relativePath.startsWith('orders/order/')) {
        element = 'editor';
        entityId = this.relativePath.split('/')[2];
      }
    } else if (this.relativePath.startsWith('product/')) {
      element = 'editor';
      entityId = this.relativePath.split('/')[1];
    }

    const navigate = (path: string) => {
      const absolute = new URL(path, new URL(this.basePath, document.baseURI)).pathname;
      window.navigation.navigate(absolute);
    };

    return (
      <Host>
        <nav class="scenario-nav">
          <div class="nav-buttons">
            <md-text-button
              class={{ active: section === 'products' }}
              onclick={() => navigate('./list')}
            >
              Produkty lekárne
            </md-text-button>
            <md-text-button
              class={{ active: section === 'orders' }}
              onclick={() => navigate('./orders/list')}
            >
              Objednávky oddelení
            </md-text-button>
          </div>
          {section === 'orders' && (
            <div class="role-selector">
              <label>Rola:</label>
              <md-outlined-select
                value={this.userRole}
                oninput={(ev: InputEvent) =>
                  (this.userRole = (ev.target as HTMLInputElement).value as 'sestra' | 'lekaren')
                }
              >
                <md-select-option value="sestra" selected={this.userRole === 'sestra'}>
                  <div slot="headline">👩‍⚕️ Sestra</div>
                </md-select-option>
                <md-select-option value="lekaren" selected={this.userRole === 'lekaren'}>
                  <div slot="headline">👨‍⚕️ Pracovník lekárne</div>
                </md-select-option>
              </md-outlined-select>
            </div>
          )}
        </nav>

        {section === 'products' && element === 'editor' ? (
          <xpartla-pharmacy-product-editor
            product-id={entityId}
            pharmacy-id={this.pharmacyId}
            api-base={this.apiBase}
            oneditor-closed={() => navigate('./list')}
          ></xpartla-pharmacy-product-editor>
        ) : section === 'products' ? (
          <xpartla-pharmacy-product-list
            pharmacy-id={this.pharmacyId}
            api-base={this.apiBase}
            onentry-clicked={(ev: CustomEvent<string>) => navigate('./product/' + ev.detail)}
          ></xpartla-pharmacy-product-list>
        ) : element === 'editor' ? (
          <xpartla-pharmacy-order-editor
            order-id={entityId}
            pharmacy-id={this.pharmacyId}
            api-base={this.apiBase}
            user-role={this.userRole}
            onorder-editor-closed={() => navigate('./orders/list')}
          ></xpartla-pharmacy-order-editor>
        ) : (
          <xpartla-pharmacy-order-list
            pharmacy-id={this.pharmacyId}
            api-base={this.apiBase}
            user-role={this.userRole}
            onorder-clicked={(ev: CustomEvent<string>) => navigate('./orders/order/' + ev.detail)}
          ></xpartla-pharmacy-order-list>
        )}
      </Host>
    );
  }
}
