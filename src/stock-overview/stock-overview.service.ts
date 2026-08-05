import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { toLocalTimeString } from '../common/utils/date.util';

export interface TransactionItem {
  itemCode: string;
  quantity: number;
}

export interface Transaction {
  transactionId: string;
  date: string;
  type: 'Invoice' | 'Return' | 'GDN';
  subtype?: string | null;
  dealer: string;
  items: TransactionItem[];
}

export interface PaginatedTransactions {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TransactionDetailItem {
  itemCode: string;
  description?: string;
  quantity: number;
}

export interface TransactionDetail {
  transactionId: string;
  accountNo?: string;
  customer: {
    name?: string;
    address?: string;
    contactNumber?: string;
  };
  date?: string;
  time?: string;
  stateType?: string;
  items: TransactionDetailItem[];
}

export interface StockMetrics {
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface ProductItem {
  code: string;
  description: string;
  quantity: number;
}

@Injectable()
export class StockOverviewService {
  constructor(private readonly dataSource: DataSource) {}

  private columnMapPromise?: Promise<StockOverviewColumnMap>;

  async getMetrics(): Promise<StockMetrics> {
    const rows: Array<{
      total_products: string;
      low_stock: string;
      out_of_stock: string;
    }> = await this.dataSource.query(`
        SELECT
          COUNT(*)::int AS total_products,
          COUNT(*) FILTER (WHERE quantity > 0 AND quantity < 10)::int AS low_stock,
          COUNT(*) FILTER (WHERE quantity = 0)::int AS out_of_stock
        FROM item;
      `);

    const row = rows[0];
    return {
      totalProducts: Number(row?.total_products ?? 0),
      lowStockCount: Number(row?.low_stock ?? 0),
      outOfStockCount: Number(row?.out_of_stock ?? 0),
    };
  }

  async getProducts(
    filter: 'all' | 'low-stock' | 'out-of-stock',
  ): Promise<ProductItem[]> {
    let whereClause = '';
    if (filter === 'low-stock') {
      whereClause = 'WHERE quantity > 0 AND quantity < 10';
    } else if (filter === 'out-of-stock') {
      whereClause = 'WHERE quantity = 0';
    }

    const rows: Array<{ code: string; description: string; quantity: number }> =
      await this.dataSource.query(`
        SELECT code, COALESCE(description, '') AS description, quantity
        FROM item
        ${whereClause}
        ORDER BY code ASC;
      `);

    return rows.map((r) => ({
      code: r.code,
      description: r.description,
      quantity: Number(r.quantity ?? 0),
    }));
  }

  async listTransactions(
    query: ListTransactionsQueryDto,
  ): Promise<PaginatedTransactions> {
    const {
      page = 1,
      limit = 10,
      startDate,
      endDate,
      type,
      dealer,
      sortBy = 'date',
      sortOrder = 'desc',
    } = query;

    const sanitizedPage = Math.min(Math.max(Number(page) || 1, 1), 5);
    const sanitizedLimit = Math.min(Math.max(Number(limit) || 10, 1), 10);

    const columnMap = await this.getColumnMap();

    const { transactionUnionSql, params } = this.buildTransactionUnionSql(
      {
        startDate,
        endDate,
        type,
        dealer,
      },
      columnMap,
    );

    const orderColumn = this.getOrderColumn(sortBy);
    const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const totalResult = (await this.dataSource.query(
      `
      SELECT COUNT(*)::int AS total
      FROM (${transactionUnionSql}) AS tx;
      `,
      params,
    )) as unknown;

    const total = this.extractTotal(totalResult);
    const totalPages = Math.min(Math.ceil(total / sanitizedLimit), 5);
    const effectivePage =
      totalPages > 0 ? Math.min(sanitizedPage, totalPages) : sanitizedPage;
    const offset = (effectivePage - 1) * sanitizedLimit;

    const pageParams = [...params, sanitizedLimit, offset];
    const rows: TransactionRow[] = await this.dataSource.query(
      `
      SELECT tx.transaction_id, tx.date, tx.type, tx.dealer, tx.subtype, tx.created_at
      FROM (${transactionUnionSql}) AS tx
      ORDER BY COALESCE(tx.created_at, tx.date) ${orderDirection}, tx.transaction_id ASC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2};
      `,
      pageParams,
    );

    const itemsByTransaction = await this.fetchTransactionItems(
      rows,
      columnMap,
    );

    const data: Transaction[] = rows.map((row) => ({
      transactionId: row.transaction_id,
      date: row.date ?? '',
      type: row.type,
      subtype: row.subtype ?? null,
      dealer: row.dealer ?? '',
      items:
        itemsByTransaction.get(
          this.buildMapKey(row.type, row.transaction_id),
        ) ?? [],
    }));

    return {
      data,
      total,
      page: effectivePage,
      limit: sanitizedLimit,
      totalPages,
    };
  }

  async getTransaction(
    type: 'Invoice' | 'Return' | 'GDN',
    id: string,
  ): Promise<TransactionDetail | null> {
    const columnMap = await this.getColumnMap();

    if (type === 'Invoice') {
      const txCol = this.quoteIdentifier(columnMap.invoice.transactionId);
      const invoiceRows: Array<{ transaction_id: string; date: string; dealer_id: string; dealer_name: string; address: string | null; contact_number: string | null }> = await this.dataSource.query(
        `
        SELECT
          ${txCol} AS transaction_id,
          ${this.quoteIdentifier(columnMap.invoice.date)} AS date,
          ${this.quoteIdentifier(columnMap.invoice.dealerId)} AS dealer_id,
          COALESCE(d.name, '') AS dealer_name,
          d.address,
          d.contact_number
        FROM invoice inv
        LEFT JOIN dealer d ON d.id = ${this.quoteIdentifier(columnMap.invoice.dealerId)}
        WHERE ${txCol} = $1
        LIMIT 1;
      `,
        [id],
      );

      if (invoiceRows.length === 0) return null;
      const row = invoiceRows[0];

      const itemRows: Array<{ item_code: string; description: string | null; quantity: number; created_at?: string }> = await this.dataSource.query(
        `
        SELECT ii.${this.quoteIdentifier(columnMap.invoiceItem.itemCode)} AS item_code, COALESCE(it.description, '') AS description, ii.quantity, ii.created_at
        FROM invoice_item ii
        LEFT JOIN item it ON it.code = ii.${this.quoteIdentifier(columnMap.invoiceItem.itemCode)}
        WHERE ii.${this.quoteIdentifier(columnMap.invoiceItem.transactionId)} = $1
        ORDER BY ii.${this.quoteIdentifier(columnMap.invoiceItem.transactionId)} ASC;
      `,
        [id],
      );

      const items: TransactionDetailItem[] = itemRows.map((r) => ({
        itemCode: r.item_code,
        description: r.description ?? '',
        quantity: Number(r.quantity ?? 0),
      }));

      // use first item's created_at as a time hint if available
      const time = itemRows.length > 0 ? toLocalTimeString(itemRows[0].created_at) : undefined;

      return {
        transactionId: id,
        accountNo: row.dealer_id,
        customer: {
          name: row.dealer_name,
          address: row.address ?? undefined,
          contactNumber: row.contact_number ?? undefined,
        },
        date: row.date ?? undefined,
        time,
        stateType: 'good',
        items,
      };
    }

    if (type === 'Return') {
      const txCol = this.quoteIdentifier(columnMap.return.transactionId);
      const rows: Array<{ transaction_id: string; date: string; dealer_id: string; dealer_name: string; address: string | null; contact_number: string | null; type: string | null }> = await this.dataSource.query(
        `
        SELECT
          ${txCol} AS transaction_id,
          ${this.quoteIdentifier(columnMap.return.date)} AS date,
          ${this.quoteIdentifier(columnMap.return.dealerId)} AS dealer_id,
          COALESCE(d.name, '') AS dealer_name,
          d.address,
          d.contact_number,
          ret.type
        FROM "return" ret
        LEFT JOIN dealer d ON d.id = ${this.quoteIdentifier(columnMap.return.dealerId)}
        WHERE ${txCol} = $1
        LIMIT 1;
      `,
        [id],
      );

      if (rows.length === 0) return null;
      const row = rows[0];

      const itemRows: Array<{ item_code: string; description: string | null; quantity: number; created_at?: string }> = await this.dataSource.query(
        `
        SELECT ri.${this.quoteIdentifier(columnMap.returnItem.itemCode)} AS item_code, COALESCE(it.description, '') AS description, ri.quantity, ri.created_at
        FROM return_item ri
        LEFT JOIN item it ON it.code = ri.${this.quoteIdentifier(columnMap.returnItem.itemCode)}
        WHERE ri.${this.quoteIdentifier(columnMap.returnItem.transactionId)} = $1
        ORDER BY ri.${this.quoteIdentifier(columnMap.returnItem.transactionId)} ASC;
      `,
        [id],
      );

      const items: TransactionDetailItem[] = itemRows.map((r) => ({
        itemCode: r.item_code,
        description: r.description ?? '',
        quantity: Number(r.quantity ?? 0),
      }));

      const time = itemRows.length > 0 ? toLocalTimeString(itemRows[0].created_at) : undefined;

      return {
        transactionId: id,
        accountNo: row.dealer_id,
        customer: {
          name: row.dealer_name,
          address: row.address ?? undefined,
          contactNumber: row.contact_number ?? undefined,
        },
        date: row.date ?? undefined,
        time,
        stateType: row.type ?? undefined,
        items,
      };
    }

    // GDN or others
    if (type === 'GDN') {
      const txCol = this.quoteIdentifier(columnMap.gdn.transactionId);
      const rows: Array<{ transaction_id: string; date: string }> = await this.dataSource.query(
        `
        SELECT ${txCol} AS transaction_id, ${this.quoteIdentifier(columnMap.gdn.date)} AS date
        FROM gdn
        WHERE ${txCol} = $1
        LIMIT 1;
      `,
        [id],
      );

      if (rows.length === 0) return null;

      const itemRows: Array<{ item_code: string; description: string | null; quantity: number; created_at?: string }> = await this.dataSource.query(
        `
        SELECT gi.${this.quoteIdentifier(columnMap.gdnItem.itemCode)} AS item_code, COALESCE(it.description, '') AS description, gi.quantity, gi.created_at
        FROM gdn_item gi
        LEFT JOIN item it ON it.code = gi.${this.quoteIdentifier(columnMap.gdnItem.itemCode)}
        WHERE gi.${this.quoteIdentifier(columnMap.gdnItem.transactionId)} = $1
        ORDER BY gi.${this.quoteIdentifier(columnMap.gdnItem.transactionId)} ASC;
      `,
        [id],
      );

      const items: TransactionDetailItem[] = itemRows.map((r) => ({
        itemCode: r.item_code,
        description: r.description ?? '',
        quantity: Number(r.quantity ?? 0),
      }));

      // compute time from first item created_at (adjust to +5:30)
      const time =
        itemRows.length > 0 && itemRows[0].created_at
          ? (() => {
              const dt = new Date(itemRows[0].created_at);
              const adj = new Date(dt.getTime() + 5.5 * 60 * 60 * 1000);
              return adj.toISOString().split('T')[1].split('.')[0];
            })()
          : undefined;

      return {
        transactionId: id,
        customer: { name: '' },
        date: rows[0].date ?? undefined,
        time,
        items,
      };
    }

    return null;
  }

  private buildTransactionUnionSql(
    query: {
      startDate?: string;
      endDate?: string;
      dealer?: string;
      type?: 'Invoice' | 'Return' | 'GDN';
    },
    columnMap: StockOverviewColumnMap,
  ): { transactionUnionSql: string; params: string[] } {
    const params: string[] = [];

    const addParam = (value: string): string => {
      params.push(value);
      return `$${params.length}`;
    };

    const buildWhere = (dateAlias: string, dealerAlias: string): string[] => {
      const where: string[] = [];

      if (query.startDate) {
        where.push(`${dateAlias} >= ${addParam(query.startDate)}`);
      }

      if (query.endDate) {
        where.push(`${dateAlias} <= ${addParam(query.endDate)}`);
      }

      if (query.dealer) {
        const dealerPattern = `%${query.dealer.toLowerCase()}%`;
        where.push(
          `LOWER(COALESCE(${dealerAlias}.name, '')) LIKE ${addParam(dealerPattern)}`,
        );
      }

      return where;
    };

    const branches: string[] = [];

    if (!query.type || query.type === 'Invoice') {
      const invoiceDate = this.qualify('invoice', columnMap.invoice.date);
      const invoiceDealer = this.qualify('invoice', columnMap.invoice.dealerId);
      const invoiceId = this.qualify(
        'invoice',
        columnMap.invoice.transactionId,
      );
      const invoiceWhere = buildWhere(invoiceDate, 'd');
      branches.push(`
        SELECT
          ${invoiceId} AS transaction_id,
          ${invoiceDate} AS date,
          'Invoice'::text AS type,
          COALESCE(d.name, '') AS dealer,
          ''::text AS subtype,
          (
            SELECT MAX(ii.${this.quoteIdentifier('created_at')})
            FROM invoice_item ii
            WHERE ii.${this.quoteIdentifier(columnMap.invoiceItem.transactionId)} = invoice.${this.quoteIdentifier(columnMap.invoice.transactionId)}
          ) AS created_at
        FROM invoice
        LEFT JOIN dealer d ON d.id = ${invoiceDealer}
        ${invoiceWhere.length > 0 ? `WHERE ${invoiceWhere.join(' AND ')}` : ''}
      `);
    }

    if (!query.type || query.type === 'Return') {
      const returnDate = this.qualify('ret', columnMap.return.date);
      const returnDealer = this.qualify('ret', columnMap.return.dealerId);
      const returnId = this.qualify('ret', columnMap.return.transactionId);
      const returnWhere = buildWhere(returnDate, 'd');
      branches.push(`
        SELECT
          ${returnId} AS transaction_id,
          ${returnDate} AS date,
          'Return'::text AS type,
          COALESCE(d.name, '') AS dealer,
          ret.type AS subtype,
          (
            SELECT MAX(ri.${this.quoteIdentifier('created_at')})
            FROM return_item ri
            WHERE ri.${this.quoteIdentifier(columnMap.returnItem.transactionId)} = ret.${this.quoteIdentifier(columnMap.return.transactionId)}
          ) AS created_at
        FROM "return" ret
        LEFT JOIN dealer d ON d.id = ${returnDealer}
        ${returnWhere.length > 0 ? `WHERE ${returnWhere.join(' AND ')}` : ''}
      `);
    }

    if (!query.type || query.type === 'GDN') {
      const gdnDate = this.qualify('gdn', columnMap.gdn.date);
      const gdnId = this.qualify('gdn', columnMap.gdn.transactionId);
      const gdnWhere: string[] = [];

      if (query.startDate) {
        gdnWhere.push(`${gdnDate} >= ${addParam(query.startDate)}`);
      }

      if (query.endDate) {
        gdnWhere.push(`${gdnDate} <= ${addParam(query.endDate)}`);
      }

      if (query.dealer) {
        gdnWhere.push('1 = 0');
      }

      branches.push(`
        SELECT
          ${gdnId} AS transaction_id,
          ${gdnDate} AS date,
          'GDN'::text AS type,
          ''::text AS dealer,
          ''::text AS subtype,
          (
            SELECT MAX(gi.${this.quoteIdentifier('created_at')})
            FROM gdn_item gi
            WHERE gi.${this.quoteIdentifier(columnMap.gdnItem.transactionId)} = gdn.${this.quoteIdentifier(columnMap.gdn.transactionId)}
          ) AS created_at
        FROM gdn
        ${gdnWhere.length > 0 ? `WHERE ${gdnWhere.join(' AND ')}` : ''}
      `);
    }

    return {
      transactionUnionSql: branches.join(' UNION ALL '),
      params,
    };
  }

  private async fetchTransactionItems(
    rows: TransactionRow[],
    columnMap: StockOverviewColumnMap,
  ): Promise<Map<string, TransactionItem[]>> {
    const invoiceIds = rows
      .filter((row) => row.type === 'Invoice')
      .map((row) => row.transaction_id);
    const returnIds = rows
      .filter((row) => row.type === 'Return')
      .map((row) => row.transaction_id);
    const gdnIds = rows
      .filter((row) => row.type === 'GDN')
      .map((row) => row.transaction_id);

    const itemsMap = new Map<string, TransactionItem[]>();

    if (invoiceIds.length > 0) {
      const invoiceItemId = this.quoteIdentifier(
        columnMap.invoiceItem.transactionId,
      );
      const invoiceItemCode = this.quoteIdentifier(
        columnMap.invoiceItem.itemCode,
      );

      const invoiceItems: InvoiceItemRow[] = await this.dataSource.query(
        `
        SELECT
          ${invoiceItemId} AS transaction_id,
          ${invoiceItemCode} AS item_code,
          quantity
        FROM invoice_item
        WHERE ${invoiceItemId} = ANY($1::varchar[])
        ORDER BY ${invoiceItemId} ASC;
        `,
        [invoiceIds],
      );

      for (const item of invoiceItems) {
        const key = this.buildMapKey('Invoice', item.transaction_id);
        const existing = itemsMap.get(key) ?? [];
        existing.push({
          itemCode: item.item_code,
          quantity: Number(item.quantity ?? 0),
        });
        itemsMap.set(key, existing);
      }
    }

    if (returnIds.length > 0) {
      const returnItemId = this.quoteIdentifier(
        columnMap.returnItem.transactionId,
      );
      const returnItemCode = this.quoteIdentifier(
        columnMap.returnItem.itemCode,
      );

      const returnItems: ReturnItemRow[] = await this.dataSource.query(
        `
        SELECT
          ${returnItemId} AS transaction_id,
          ${returnItemCode} AS item_code,
          quantity
        FROM return_item
        WHERE ${returnItemId} = ANY($1::varchar[])
        ORDER BY ${returnItemId} ASC;
        `,
        [returnIds],
      );

      for (const item of returnItems) {
        const key = this.buildMapKey('Return', item.transaction_id);
        const existing = itemsMap.get(key) ?? [];
        existing.push({
          itemCode: item.item_code,
          quantity: Number(item.quantity ?? 0),
        });
        itemsMap.set(key, existing);
      }
    }

    if (gdnIds.length > 0) {
      const gdnItemId = this.quoteIdentifier(columnMap.gdnItem.transactionId);
      const gdnItemCode = this.quoteIdentifier(columnMap.gdnItem.itemCode);

      const gdnItems: GdnItemRow[] = await this.dataSource.query(
        `
        SELECT
          ${gdnItemId} AS transaction_id,
          ${gdnItemCode} AS item_code,
          quantity
        FROM gdn_item
        WHERE ${gdnItemId} = ANY($1::varchar[])
        ORDER BY ${gdnItemId} ASC;
        `,
        [gdnIds],
      );

      for (const item of gdnItems) {
        const key = this.buildMapKey('GDN', item.transaction_id);
        const existing = itemsMap.get(key) ?? [];
        existing.push({
          itemCode: item.item_code,
          quantity: Number(item.quantity ?? 0),
        });
        itemsMap.set(key, existing);
      }
    }

    return itemsMap;
  }

  private getOrderColumn(sortBy?: 'date' | 'type' | 'transactionId'): string {
    if (sortBy === 'transactionId') {
      return 'tx.transaction_id';
    }

    if (sortBy === 'type') {
      return 'tx.type';
    }

    return 'tx.date';
  }

  private buildMapKey(
    type: 'Invoice' | 'Return' | 'GDN',
    transactionId: string,
  ): string {
    return `${type}:${transactionId}`;
  }

  private extractTotal(rawResult: unknown): number {
    if (!Array.isArray(rawResult) || rawResult.length === 0) {
      return 0;
    }

    const resultArray = rawResult as unknown[];
    const first = resultArray[0];
    if (typeof first !== 'object' || first === null || !('total' in first)) {
      return 0;
    }

    const total = (first as { total: unknown }).total;
    const parsed = Number(total);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private async getColumnMap(): Promise<StockOverviewColumnMap> {
    this.columnMapPromise ??= this.resolveColumnMap();

    return this.columnMapPromise;
  }

  private async resolveColumnMap(): Promise<StockOverviewColumnMap> {
    const [
      invoiceCols,
      returnCols,
      invoiceItemCols,
      returnItemCols,
      gdnCols,
      gdnItemCols,
    ] = await Promise.all([
      this.getColumnsForTable('invoice'),
      this.getColumnsForTable('return'),
      this.getColumnsForTable('invoice_item'),
      this.getColumnsForTable('return_item'),
      this.getColumnsForTable('gdn'),
      this.getColumnsForTable('gdn_item'),
    ]);

    return {
      invoice: {
        transactionId: this.pickColumn(
          invoiceCols,
          [
            'invoice_number',
            'invoiceNumber',
            'invoice_id',
            'invoiceId',
            'invoice_no',
            'invoiceNo',
            'id',
          ],
          (column) =>
            this.normalizeIdentifier(column).includes('invoice') &&
            (this.normalizeIdentifier(column).includes('number') ||
              this.normalizeIdentifier(column).endsWith('id') ||
              this.normalizeIdentifier(column).includes('no')),
        ),
        date: this.pickColumn(invoiceCols, [
          'date',
          'invoice_date',
          'invoiceDate',
        ]),
        dealerId: this.pickColumn(invoiceCols, [
          'dealer_id',
          'dealerId',
          'dealer',
        ]),
      },
      return: {
        transactionId: this.pickColumn(
          returnCols,
          [
            'return_note_no',
            'returnNoteNo',
            'return_id',
            'returnId',
            'return_no',
            'returnNo',
            'id',
          ],
          (column) =>
            this.normalizeIdentifier(column).includes('return') &&
            (this.normalizeIdentifier(column).includes('note') ||
              this.normalizeIdentifier(column).includes('number') ||
              this.normalizeIdentifier(column).endsWith('id') ||
              this.normalizeIdentifier(column).includes('no')),
        ),
        date: this.pickColumn(returnCols, [
          'date',
          'return_date',
          'returnDate',
        ]),
        dealerId: this.pickColumn(returnCols, [
          'dealer_id',
          'dealerId',
          'dealer',
        ]),
      },
      invoiceItem: {
        transactionId: this.pickColumn(
          invoiceItemCols,
          [
            'invoice_number',
            'invoiceNumber',
            'invoice_id',
            'invoiceId',
            'invoice',
            'transaction_id',
            'transactionId',
          ],
          (column) => this.normalizeIdentifier(column).includes('invoice'),
        ),
        itemCode: this.pickColumn(invoiceItemCols, [
          'item_code',
          'itemCode',
          'code',
          'item',
        ]),
      },
      returnItem: {
        transactionId: this.pickColumn(
          returnItemCols,
          [
            'return_id',
            'returnId',
            'return_note_no',
            'returnNoteNo',
            'return',
            'transaction_id',
            'transactionId',
          ],
          (column) => this.normalizeIdentifier(column).includes('return'),
        ),
        itemCode: this.pickColumn(returnItemCols, [
          'item_code',
          'itemCode',
          'code',
          'item',
        ]),
      },
      gdn: {
        transactionId: this.pickColumn(
          gdnCols,
          ['gdn_number', 'gdnNumber', 'gdn_id', 'gdnId', 'id'],
          (column) => this.normalizeIdentifier(column).includes('gdn'),
        ),
        date: this.pickColumn(gdnCols, ['date', 'gdn_date', 'gdnDate']),
      },
      gdnItem: {
        transactionId: this.pickColumn(
          gdnItemCols,
          [
            'gdn_number',
            'gdnNumber',
            'gdn_id',
            'gdnId',
            'transaction_id',
            'transactionId',
          ],
          (column) => this.normalizeIdentifier(column).includes('gdn'),
        ),
        itemCode: this.pickColumn(gdnItemCols, [
          'item_code',
          'itemCode',
          'code',
          'item',
        ]),
      },
    };
  }

  private async getColumnsForTable(tableName: string): Promise<Set<string>> {
    const rows: Array<{ column_name: string }> = await this.dataSource.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = ANY(current_schemas(true))
        AND lower(table_name) = lower($1);
      `,
      [tableName],
    );

    return new Set(rows.map((row) => row.column_name));
  }

  private pickColumn(
    columns: Set<string>,
    candidates: string[],
    fallbackMatcher?: (column: string) => boolean,
  ): string {
    const normalizedToActual = new Map<string, string>();
    for (const column of columns) {
      normalizedToActual.set(this.normalizeIdentifier(column), column);
    }

    for (const candidate of candidates) {
      if (columns.has(candidate)) {
        return candidate;
      }

      const normalized = this.normalizeIdentifier(candidate);
      const matched = normalizedToActual.get(normalized);
      if (matched) {
        return matched;
      }
    }

    if (fallbackMatcher) {
      const fallback = [...columns].find((column) => fallbackMatcher(column));
      if (fallback) {
        return fallback;
      }
    }

    throw new Error(
      `Missing expected column. Tried: ${candidates.join(', ')}. Available: ${[...columns].join(', ')}`,
    );
  }

  private normalizeIdentifier(value: string): string {
    return value.replaceAll(/[^a-zA-Z0-9]/g, '').toLowerCase();
  }

  private qualify(alias: string, column: string): string {
    return `${alias}.${this.quoteIdentifier(column)}`;
  }

  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replaceAll('"', '""')}"`;
  }
}

interface TransactionRow {
  transaction_id: string;
  date: string;
  type: 'Invoice' | 'Return' | 'GDN';
  dealer: string;
  subtype?: string | null;
  created_at?: string | null;
}

interface InvoiceItemRow {
  transaction_id: string;
  item_code: string;
  quantity: number;
}

interface ReturnItemRow {
  transaction_id: string;
  item_code: string;
  quantity: number;
}

interface GdnItemRow {
  transaction_id: string;
  item_code: string;
  quantity: number;
}

interface StockOverviewColumnMap {
  invoice: {
    transactionId: string;
    date: string;
    dealerId: string;
  };
  return: {
    transactionId: string;
    date: string;
    dealerId: string;
  };
  invoiceItem: {
    transactionId: string;
    itemCode: string;
  };
  returnItem: {
    transactionId: string;
    itemCode: string;
  };
  gdn: {
    transactionId: string;
    date: string;
  };
  gdnItem: {
    transactionId: string;
    itemCode: string;
  };
}
