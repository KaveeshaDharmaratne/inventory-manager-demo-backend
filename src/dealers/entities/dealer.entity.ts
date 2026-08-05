import { Entity, Column, OneToMany, PrimaryColumn } from 'typeorm';
import { Invoice } from '../../invoice/entities/invoice.entity';
import { Return } from '../../returns/entities/return.entity';
import { DealerReturn } from '../../returns/entities/dealer-return.entity';

@Entity()
export class Dealer {
  @PrimaryColumn({ type: 'varchar' })
  id: string;

  @Column({ type: 'varchar', unique: true })
  name: string;
  
  @Column({ type: 'varchar', nullable: true })
  address: string;

  @Column({ name: 'contact_number', type: 'varchar', nullable: true })
  contactNumber: string;

  @OneToMany(() => Invoice, (invoice) => invoice.dealer)
  invoices: Invoice[];

  @OneToMany(() => Return, (ret) => ret.dealer)
  returns: Return[];

  @OneToMany(() => DealerReturn, (dr) => dr.dealer)
  dealerReturns: DealerReturn[];
}
