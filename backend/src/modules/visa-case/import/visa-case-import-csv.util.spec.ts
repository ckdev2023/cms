import {
  normalizeImportCsvHeader,
  parseCsvLine,
  parseImportCsvWithLineNumbers,
} from './visa-case-import-csv.util';

describe('visa-case-import-csv.util', () => {
  it('parseCsvLine handles quoted commas', () => {
    expect(parseCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
  });

  it('parseCsvLine handles escaped quotes', () => {
    expect(parseCsvLine('"say ""hi""",x')).toEqual(['say "hi"', 'x']);
  });

  it('normalizeImportCsvHeader lowercases', () => {
    expect(normalizeImportCsvHeader(' Record_Type ')).toBe('record_type');
  });

  it('parseImportCsvWithLineNumbers preserves physical line numbers', () => {
    const text = '\nrecord_type,customer_id\n\nCASE,\n';
    const { headers, dataRows } = parseImportCsvWithLineNumbers(text);
    expect(headers).toEqual(['record_type', 'customer_id']);
    expect(dataRows).toHaveLength(1);
    // 规范化并 trimEnd 后：1 空行、2 表头、3 空行、4 数据行
    expect(dataRows[0].sourceLineNumber).toBe(4);
    expect(dataRows[0].cells).toEqual(['CASE', '']);
  });
});
