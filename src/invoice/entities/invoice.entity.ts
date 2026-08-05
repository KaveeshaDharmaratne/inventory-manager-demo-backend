import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Dealer } from '../../dealers/entities/dealer.entity';
import { InvoiceItem } from './invoice-item.entity';

@Entity('invoice')
export class Invoice {
  @PrimaryColumn({ name: 'invoice_number', type: 'varchar' })
  invoiceNumber: string;

  @Column({ type: 'date', nullable: true })
  date: string;

  @Column({ name: 'dealer_id', type: 'varchar', nullable: true })
  dealerId: string;

  @ManyToOne(() => Dealer, (dealer) => dealer.invoices, {
    nullable: true,
    eager: false,
  })
  @JoinColumn({ name: 'dealer_id' })
  dealer: Dealer;

  @OneToMany(() => InvoiceItem, (item) => item.invoice)
  items: InvoiceItem[];
}
