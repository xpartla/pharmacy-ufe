import { newSpecPage } from '@stencil/core/testing';
import fetchMock from 'jest-fetch-mock';
import { XpartlaPharmacyProductEditor } from '../xpartla-pharmacy-product-editor';
import { Product, Category } from '../../../api/pharmacy-product';

describe('xpartla-pharmacy-product-editor', () => {
  const sampleCategories: Category[] = [
    { code: 'analgesics', value: 'Analgetiká' },
    { code: 'vitamins', value: 'Vitamíny' },
  ];

  const existing: Product = {
    id: 'p1',
    name: 'Paralen',
    stock: 8,
    active: true,
    category: sampleCategories[0],
  };

  function mockExisting() {
    fetchMock.mockResponse(req => {
      if (req.url.endsWith('/items/p1')) return Promise.resolve(JSON.stringify(existing));
      if (req.url.includes('/categories')) return Promise.resolve(JSON.stringify(sampleCategories));
      return Promise.resolve(JSON.stringify({}));
    });
  }

  beforeAll(() => {
    fetchMock.enableMocks();
  });

  afterEach(() => {
    fetchMock.resetMocks();
  });

  it('initializes an empty entry in @new mode', async () => {
    fetchMock.mockResponse(req => {
      if (req.url.includes('/categories')) return Promise.resolve(JSON.stringify(sampleCategories));
      return Promise.resolve(JSON.stringify({}));
    });

    const page = await newSpecPage({
      components: [XpartlaPharmacyProductEditor],
      html: `<xpartla-pharmacy-product-editor product-id="@new" pharmacy-id="lekaren-centrum" api-base="http://test/api"></xpartla-pharmacy-product-editor>`,
    });
    await page.waitForChanges();

    const instance = page.rootInstance as XpartlaPharmacyProductEditor;
    expect(instance.entry.id).toEqual('@new');
    expect(instance.entry.name).toEqual('');
    expect(instance.entry.stock).toEqual(0);
    expect(instance.entry.active).toEqual(true);
  });

  it('loads the existing product when editing', async () => {
    mockExisting();
    const page = await newSpecPage({
      components: [XpartlaPharmacyProductEditor],
      html: `<xpartla-pharmacy-product-editor product-id="p1" pharmacy-id="lekaren-centrum" api-base="http://test/api"></xpartla-pharmacy-product-editor>`,
    });
    await page.waitForChanges();

    const instance = page.rootInstance as XpartlaPharmacyProductEditor;
    expect(instance.entry.name).toEqual('Paralen');
    expect(instance.entry.stock).toEqual(8);
  });

  it('stepper buttons bump and clamp stock at 0', async () => {
    mockExisting();
    const page = await newSpecPage({
      components: [XpartlaPharmacyProductEditor],
      html: `<xpartla-pharmacy-product-editor product-id="p1" pharmacy-id="lekaren-centrum" api-base="http://test/api"></xpartla-pharmacy-product-editor>`,
    });
    await page.waitForChanges();

    const instance = page.rootInstance as XpartlaPharmacyProductEditor;
    (instance as any).adjustStock(+1);
    expect(instance.entry.stock).toEqual(9);

    instance.entry = { ...instance.entry, stock: 0 };
    (instance as any).adjustStock(-1);
    expect(instance.entry.stock).toEqual(0); // clamped, no negative
  });

  it('stockTone reflects the current stock value', async () => {
    mockExisting();
    const page = await newSpecPage({
      components: [XpartlaPharmacyProductEditor],
      html: `<xpartla-pharmacy-product-editor product-id="p1" pharmacy-id="lekaren-centrum" api-base="http://test/api"></xpartla-pharmacy-product-editor>`,
    });
    await page.waitForChanges();

    const instance = page.rootInstance as XpartlaPharmacyProductEditor;
    instance.entry = { ...instance.entry, stock: 50 };
    expect((instance as any).stockTone()).toEqual('ok');

    instance.entry = { ...instance.entry, stock: 5 };
    expect((instance as any).stockTone()).toEqual('low');

    instance.entry = { ...instance.entry, stock: 0 };
    expect((instance as any).stockTone()).toEqual('out');
  });
});
