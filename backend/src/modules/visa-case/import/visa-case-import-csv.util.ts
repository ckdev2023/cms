/**
 * 解析历史签证导入用 CSV 文本，产出规范化表头与数据行，供预览服务做字段映射与校验。
 */

/**
 * 去掉 UTF-8 BOM 与首尾空白，统一换行符便于按行切分。
 *
 * @param text - 原始 CSV 字符串
 * @returns 规范化后的文本
 */
function normalizeNewlinesAndBom(text: string): string {
  let t = text.replace(/^\uFEFF/, '');
  t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return t;
}

/**
 * 在双引号字段内消费当前下标字符：追加正文、`""` 译为单个 `"`，或结束引号状态。
 *
 * @param line - 不含换行符的一行文本
 * @param i - 当前字符下标
 * @param current - 当前单元格已累积内容
 * @returns 更新后的单元格片段、下一下标（处理 `""` 时已多消费一位）、是否仍在引号字段内
 */
function consumeQuotedCellChar(
  line: string,
  i: number,
  current: string,
): { value: string; nextIndex: number; inQuotes: boolean } {
  const ch = line[i];
  if (ch !== '"') {
    return { value: current + ch, nextIndex: i, inQuotes: true };
  }
  if (line[i + 1] === '"') {
    return { value: current + '"', nextIndex: i + 1, inQuotes: true };
  }
  return { value: current, nextIndex: i, inQuotes: false };
}

/**
 * 解析单行 CSV，支持双引号包裹字段及字段内转义双引号（`""`）。
 *
 * @param line - 不含换行符的一行文本
 * @returns 该行的单元格字符串数组
 */
export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      const step = consumeQuotedCellChar(line, i, current);
      current = step.value;
      inQuotes = step.inQuotes;
      i = step.nextIndex;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

/**
 * 将表头单元格转为小写并去首尾空白，保证列名匹配不区分大小写。
 *
 * @param header - 原始表头单元格
 * @returns 规范化列名
 */
export function normalizeImportCsvHeader(header: string): string {
  return header.trim().toLowerCase();
}

/**
 * 将完整 CSV 文本解析为表头与带源文件行号的数据行，便于错误报告定位；跳过全空行。
 *
 * @param text - 完整 CSV 文本（建议 UTF-8）
 * @returns 规范化表头与数据行（含 `sourceLineNumber` 为 1-based 物理行号）
 */
export function parseImportCsvWithLineNumbers(text: string): {
  headers: string[];
  dataRows: Array<{ sourceLineNumber: number; cells: string[] }>;
} {
  const normalized = normalizeNewlinesAndBom(text).trimEnd();
  if (normalized.length === 0) {
    return { headers: [], dataRows: [] };
  }

  const lines = normalized.split('\n');
  let headerIdx = 0;
  while (headerIdx < lines.length && lines[headerIdx].trim() === '') {
    headerIdx += 1;
  }
  if (headerIdx >= lines.length) {
    return { headers: [], dataRows: [] };
  }

  const headers = parseCsvLine(lines[headerIdx]).map((h) =>
    normalizeImportCsvHeader(h),
  );
  const dataRows: Array<{ sourceLineNumber: number; cells: string[] }> = [];

  for (let i = headerIdx + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '') {
      continue;
    }
    dataRows.push({
      sourceLineNumber: i + 1,
      cells: parseCsvLine(lines[i]),
    });
  }

  return { headers, dataRows };
}
