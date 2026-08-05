import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Invoice } from './invoice.entity';
import { Item } from '../../item/entities/item.entity';

@Entity('invoice_item')
export class InvoiceItem {
  @PrimaryColumn({ name: 'invoice_number', type: 'varchar' })
  invoiceNumber: string;

  @PrimaryColumn({ name: 'item_code', type: 'varchar' })
  itemCode: string;

  @Column({ type: 'integer' })
  quantity: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'modified_at', type: 'timestamp' })
  modifiedAt: Date;

  @ManyToOne(() => Invoice, (invoice) => invoice.items)
  @JoinColumn({ name: 'invoice_number' })
  invoice: Invoice;

  @ManyToOne(() => Item, { eager: false })
  @JoinColumn({ name: 'item_code' })
  item: Item;
}
