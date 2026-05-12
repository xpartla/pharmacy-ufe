import { newSpecPage } from '@stencil/core/testing';
import fetchMock from 'jest-fetch-mock';
import { XpartlaPharmacyProductList } from '../xpartla-pharmacy-product-list';
import { Product, Category } from '../../../api/pharmacy-product';

describe('xpartla-pharmacy-product-list', () => {
  const sampleCategories: Category[] = [
    { code: 'analgesics', value: 'Analgetiká' },
    { code: 'vitamins', value: 'Vitamíny' },
  ];

  const sampleProducts: Product[] = [
    { id: 'p1', name: 'Paralen', stock: 42, active: true, category: sampleCategories[0] },
    { id: 'p2', name: 'Ibalgin', stock: 3, active: true, category: sampleCategories[0] },
    { id: 'p3', name: 'Vitamín C', stock: 0, active: true, category: sampleCategories[1] },
    { id: 'p4', name: 'Staré liečivo', stock: 0, active: false, category: sampleCategories[0] },
  ];

  // The list issues three parallel fetches in componentWillLoad: products (include=all),
  // categories, pharmacy detail. Resolve all three on every test so loading completes.
  function respondWithSeed() {
    fetchMock.mockResponse(req => {
      if (req.url.includes('/items')) return Promise.resolve(JSON.stringify(sampleProducts));
      if (req.url.includes('/categories')) return Promise.resolve(JSON.stringify(sampleCategories));
      if (req.url.endsWith('/pharmacy/lekaren-centrum'))
        return Promise.resolve(JSON.stringify({ id: 'lekaren-centrum', name: 'Lekáreň Centrum' }));
      return Promise.resolve(JSON.stringify({}));
    });
  }

  beforeAll(() => {
    fetchMock.enableMocks();
  });

  afterEach(() => {
    fetchMock.resetMocks();
  });

  it('renders one card per active product by default', async () => {
    respondWithSeed();
    const page = await newSpecPage({
      components: [XpartlaPharmacyProductList],
      html: `<xpartla-pharmacy-product-list pharmacy-id="lekaren-centrum" api-base="http://test/api"></xpartla-pharmacy-product-list>`,
    });
    await page.waitForChanges();

    const cards = page.root.shadowRoot.querySelectorAll('.product-card');
    expect(cards.length).toEqual(3); // 3 active products
  });

  it('computes stock-status stats correctly', async () => {
    respondWithSeed();
    const page = await newSpecPage({
      components: [XpartlaPharmacyProductList],
      html: `<xpartla-pharmacy-product-list pharmacy-id="lekaren-centrum" api-base="http://test/api"></xpartla-pharmacy-product-list>`,
    });
    await page.waitForChanges();

    const instance = page.rootInstance as XpartlaPharmacyProductList;
    const stats = (instance as any).stats();
    expect(stats.total).toEqual(3); // active
    expect(stats.low).toEqual(1); // Ibalgin stock=3, threshold 10
    expect(stats.out).toEqual(1); // Vitamín C stock=0
    expect(stats.inactive).toEqual(1); // p4
  });

  it('filters by search term', async () => {
    respondWithSeed();
    const page = await newSpecPage({
      components: [XpartlaPharmacyProductList],
      html: `<xpartla-pharmacy-product-list pharmacy-id="lekaren-centrum" api-base="http://test/api"></xpartla-pharmacy-product-list>`,
    });
    await page.waitForChanges();

    const instance = page.rootInstance as XpartlaPharmacyProductList;
    instance.searchTerm = 'paralen';
    await page.waitForChanges();

    const cards = page.root.shadowRoot.querySelectorAll('.product-card');
    expect(cards.length).toEqual(1);
  });

  it('switches to inactive view via the filter chips', async () => {
    respondWithSeed();
    const page = await newSpecPage({
      components: [XpartlaPharmacyProductList],
      html: `<xpartla-pharmacy-product-list pharmacy-id="lekaren-centrum" api-base="http://test/api"></xpartla-pharmacy-product-list>`,
    });
    await page.waitForChanges();

    const instance = page.rootInstance as XpartlaPharmacyProductList;
    instance.activeFilter = 'inactive';
    await page.waitForChanges();

    const cards = page.root.shadowRoot.querySelectorAll('.product-card');
    expect(cards.length).toEqual(1); // only Staré liečivo
  });

  it('renders an error banner when the products fetch fails', async () => {
    fetchMock.mockReject(new Error('boom'));
    const page = await newSpecPage({
      components: [XpartlaPharmacyProductList],
      html: `<xpartla-pharmacy-product-list pharmacy-id="lekaren-centrum" api-base="http://test/api"></xpartla-pharmacy-product-list>`,
    });
    await page.waitForChanges();

    const errorCard = page.root.shadowRoot.querySelector('.error-card');
    expect(errorCard).not.toBeNull();
  });
});
