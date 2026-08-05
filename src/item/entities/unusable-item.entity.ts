import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Item } from '../../item/entities/item.entity';

@Entity('unusable_item')
export class UnusableItem {
  @PrimaryColumn({ name: 'item_code', type: 'varchar' })
  itemCode: string;

  @PrimaryColumn({ type: 'varchar' })
  type: string; // 'Damage' | 'Expired'

  @Column({ type: 'integer', default: 0 })
  quantity: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'modified_at', type: 'timestamp' })
  modifiedAt: Date;

  @ManyToOne(() => Item)
  @JoinColumn({ name: 'item_code' })
  item: Item;
}
