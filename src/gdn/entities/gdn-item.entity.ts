import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Item } from '../../item/entities/item.entity';
import { Gdn } from './gdn.entity';

@Entity('gdn_item')
export class GdnItem {
  @PrimaryColumn({ name: 'gdn_number', type: 'varchar' })
  gdnNumber: string;

  @PrimaryColumn({ name: 'item_code', type: 'varchar' })
  itemCode: string;

  @Column({ type: 'integer' })
  quantity: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'modified_at', type: 'timestamp' })
  modifiedAt: Date;

  @ManyToOne(() => Gdn, (gdn) => gdn.items)
  @JoinColumn({ name: 'gdn_number' })
  gdn: Gdn;

  @ManyToOne(() => Item, { eager: false })
  @JoinColumn({ name: 'item_code' })
  item: Item;
}
