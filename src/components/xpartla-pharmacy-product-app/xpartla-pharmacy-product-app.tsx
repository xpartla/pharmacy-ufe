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
    let element = 'list';
    let productId = '@new';

    if (this.relativePath.startsWith('product/')) {
      element = 'editor';
      productId = this.relativePath.split('/')[1];
    }

    const navigate = (path: string) => {
      const absolute = new URL(path, new URL(this.basePath, document.baseURI)).pathname;
      window.navigation.navigate(absolute);
    };

    return (
      <Host>
        {element === 'editor' ? (
          <xpartla-pharmacy-product-editor
            product-id={productId}
            pharmacy-id={this.pharmacyId}
            api-base={this.apiBase}
            oneditor-closed={() => navigate('./list')}
          ></xpartla-pharmacy-product-editor>
        ) : (
          <xpartla-pharmacy-product-list
            pharmacy-id={this.pharmacyId}
            api-base={this.apiBase}
            onentry-clicked={(ev: CustomEvent<string>) => navigate('./product/' + ev.detail)}
          ></xpartla-pharmacy-product-list>
        )}
      </Host>
    );
  }
}
