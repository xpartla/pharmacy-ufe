import { format } from './utils';

describe('format', () => {
  it('returns empty string for empty name', () => {
    expect(format('', '', '')).toEqual('');
  });

  it('formats a single name', () => {
    expect(format('Adam', '', 'Partl')).toEqual('Adam Partl');
  });

  it('formats first middle and last', () => {
    expect(format('Adam', 'Q.', 'Partl')).toEqual('Adam Q. Partl');
  });
});
