import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { Item } from './entities/item.entity';

export interface LedgerRow {
  date: string;
  transactionType: string;
  transactionNo: string;
  dealer: string;
  inQty: number | null;
  outQty: number | null;
}

interface LedgerQueryRow extends LedgerRow {
  itemCode: string;
  itemDescription: string;
  effectQty: number;
}

export interface LedgerProductReport {
  item: { code: string; description: string };
  openingStock: number;
  entries: (LedgerRow & { balance: number })[];
  totalIn: number;
  totalOut: number;
  closingBalance: number;
}

export interface LedgerProductsResponse {
  products: LedgerProductReport[];
}

@Injectable()
export class ItemService {
  constructor(
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    private readonly dataSource: DataSource,
  ) {}

  create(createItemDto: CreateItemDto) {
    const item = this.itemRepository.create(createItemDto);
    return this.itemRepository.save(item);
  }

  findAll() {
    return this.itemRepository.find();
  }

  findOne(code: string) {
    return this.itemRepository.findOne({ where: { code } });
  }

  async ensureItemsExist(codes: string[]): Promise<void> {
    const uniqueCodes = Array.from(
      new Set(codes.map((code) => code.trim()).filter((code) => code !== '')),
    );

    if (uniqueCodes.length === 0) {
      return;
    }

    const existingItems = await this.itemRepository.find({
      where: { code: In(uniqueCodes) },
      select: ['code'],
    });
    const existingCodes = new Set(existingItems.map((item) => item.code));
    const missingCodes = uniqueCodes.filter((code) => !existingCodes.has(code));

    if (missingCodes.length > 0) {
      throw new BadRequestException(
        `Item codes not found: ${missingCodes.join(', ')}`,
      );
    }
  }

  update(code: string, updateItemDto: UpdateItemDto) {
    return this.itemRepository.update(code, updateItemDto);
  }

  remove(code: string) {
    return this.itemRepository.delete(code);
  }

  async getLedgerByDateRange(
    fromDate: string,
    toDate: string,
    productCode?: string,
  ): Promise<LedgerProductsResponse> {
    const normalizedProductCode = productCode?.trim() || null;

    const rows: LedgerQueryRow[] = await this.dataSource.query(
      `SELECT sub.item_code AS "itemCode",
              COALESCE(it.description, '') AS "itemDescription",
              sub.date,
              sub.transaction_type AS "transactionType",
              sub.transaction_no AS "transactionNo",
              sub.dealer_name AS "dealer",
              sub.in_qty AS "inQty",
              sub.out_qty AS "outQty",
              sub.effect_qty AS "effectQty"
       FROM (
         SELECT ii.item_code,
                i.date,
                'INV' AS transaction_type,
                i.invoice_number AS transaction_no,
                COALESCE(d.name, '') AS dealer_name,
                NULL::int AS in_qty,
                ii.quantity AS out_qty,
                (0 - ii.quantity) AS effect_qty
         FROM invoice_item ii
         JOIN invoice i ON ii.invoice_number = i.invoice_number
         LEFT JOIN dealer d ON i.dealer_id = d.id
         WHERE i.date >= $1::date
           AND i.date <= $2::date
           AND ($3::varchar IS NULL OR ii.item_code = $3)

         UNION ALL

         SELECT ri.item_code,
                r.date,
                CASE UPPER(COALESCE(r.type, ''))
                  WHEN 'GOOD' THEN 'RET'
                  WHEN 'DAMAGE' THEN 'DMG'
                  WHEN 'EXPIRED' THEN 'EXP'
                  WHEN 'BAD' THEN 'BAD'
                  ELSE 'BAD'
                END AS transaction_type,
                r.return_note_no AS transaction_no,
                COALESCE(d.name, '') AS dealer_name,
                CASE WHEN UPPER(COALESCE(r.type, '')) = 'GOOD' THEN ri.quantity ELSE NULL::int END AS in_qty,
                NULL::int AS out_qty,
                CASE WHEN UPPER(COALESCE(r.type, '')) = 'GOOD' THEN ri.quantity ELSE 0 END AS effect_qty
         FROM return_item ri
         JOIN "return" r ON ri.return_id = r.return_note_no
         LEFT JOIN dealer d ON r.dealer_id = d.id
         WHERE r.date >= $1::date
           AND r.date <= $2::date
           AND ($3::varchar IS NULL OR ri.item_code = $3)

         UNION ALL

         SELECT gi.item_code,
                g.date,
                'GDN' AS transaction_type,
                g.gdn_number AS transaction_no,
                '' AS dealer_name,
                gi.quantity AS in_qty,
                NULL::int AS out_qty,
                gi.quantity AS effect_qty
         FROM gdn_item gi
         JOIN gdn g ON gi.gdn_number = g.gdn_number
         WHERE g.date >= $1::date
           AND g.date <= $2::date
           AND ($3::varchar IS NULL OR gi.item_code = $3)
       ) sub
       JOIN item it ON it.code = sub.item_code
       ORDER BY sub.item_code ASC, sub.date ASC, sub.transaction_type ASC, sub.transaction_no ASC`,
      [fromDate, toDate, normalizedProductCode],
    );

    if (rows.length === 0) {
      return { products: [] };
    }

    const itemCodes = Array.from(new Set(rows.map((row) => row.itemCode))).sort(
      (a, b) => a.localeCompare(b),
    );

    const openingRows: Array<{ itemCode: string; openingStock: number }> =
      await this.dataSource.query(
        `SELECT it.code AS "itemCode",
                (COALESCE(it.quantity, 0) - COALESCE(movement.since_from, 0))::int AS "openingStock"
         FROM item it
         LEFT JOIN (
           SELECT tx.item_code, SUM(tx.delta_qty) AS since_from
           FROM (
             SELECT ii.item_code, (0 - ii.quantity) AS delta_qty
             FROM invoice_item ii
             JOIN invoice i ON ii.invoice_number = i.invoice_number
             WHERE i.date >= $1::date

             UNION ALL

             SELECT ri.item_code,
                    CASE WHEN UPPER(COALESCE(r.type, '')) = 'GOOD' THEN ri.quantity ELSE 0 END AS delta_qty
             FROM return_item ri
             JOIN "return" r ON ri.return_id = r.return_note_no
             WHERE r.date >= $1::date

             UNION ALL

             SELECT gi.item_code, gi.quantity AS delta_qty
             FROM gdn_item gi
             JOIN gdn g ON gi.gdn_number = g.gdn_number
             WHERE g.date >= $1::date
           ) tx
           GROUP BY tx.item_code
         ) movement ON movement.item_code = it.code
         WHERE it.code = ANY($2::varchar[])`,
        [fromDate, itemCodes],
      );

    const openingByCode = new Map<string, number>();
    for (const row of openingRows) {
      openingByCode.set(row.itemCode, Number(row.openingStock ?? 0));
    }

    const rowsByItem = new Map<string, LedgerQueryRow[]>();
    for (const row of rows) {
      const collection = rowsByItem.get(row.itemCode);
      if (collection) {
        collection.push(row);
      } else {
        rowsByItem.set(row.itemCode, [row]);
      }
    }

    const products: LedgerProductReport[] = itemCodes.map((code) => {
      const groupedRows = rowsByItem.get(code) ?? [];
      const openingStock = openingByCode.get(code) ?? 0;
      let runningBalance = openingStock;
      let totalIn = 0;
      let totalOut = 0;

      const entries = groupedRows.map((row) => {
        const inQty = row.inQty === null ? null : Number(row.inQty);
        const outQty = row.outQty === null ? null : Number(row.outQty);
        const effectQty = Number(row.effectQty ?? 0);

        totalIn += inQty ?? 0;
        totalOut += outQty ?? 0;
        runningBalance += effectQty;

        return {
          date: row.date,
          transactionType: row.transactionType,
          transactionNo: row.transactionNo,
          dealer: row.dealer,
          inQty,
          outQty,
          balance: runningBalance,
        };
      });

      return {
        item: {
          code,
          description: groupedRows[0]?.itemDescription ?? '',
        },
        openingStock,
        entries,
        totalIn,
        totalOut,
        closingBalance: runningBalance,
      };
    });

    return { products };
  }

  async getLedger(
    code: string,
    fromDate: string,
    toDate: string,
  ): Promise<{
    item: { code: string; description: string };
    entries: (LedgerRow & { balance: number })[];
  }> {
    const result = await this.getLedgerByDateRange(fromDate, toDate, code);
    if (result.products.length > 0) {
      const firstProduct = result.products[0];
      return {
        item: firstProduct.item,
        entries: firstProduct.entries,
      };
    }

    const item = await this.itemRepository.findOne({ where: { code } });

    return {
      item: { code, description: item?.description ?? '' },
      entries: [],
    };
  }
}
