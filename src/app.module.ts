import {
  Module,
  MiddlewareConsumer,
  RequestMethod,
  Logger,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Return } from './returns/entities/return.entity';
import { ReturnItem } from './returns/entities/return-item.entity';
import { DealerReturn } from './returns/entities/dealer-return.entity';
import { Dealer } from './dealers/entities/dealer.entity';
import { Item } from './item/entities/item.entity';
import { Invoice } from './invoice/entities/invoice.entity';
import { InvoiceItem } from './invoice/entities/invoice-item.entity';
import { UnusableItem } from './item/entities/unusable-item.entity';
import { ItemModule } from './item/item.module';
import { StockOverviewModule } from './stock-overview/stock-overview.module';
import { InvoiceModule } from './invoice/invoice.module';
import { DealerModule } from './dealers/dealer.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { ReturnsModule } from './returns/returns.module';
import { Gdn } from './gdn/entities/gdn.entity';
import { GdnItem } from './gdn/entities/gdn-item.entity';
import { GdnModule } from './gdn/gdn.module';
import { DataManagementModule } from './data-management/data-management.module';
import { DataSource, DataSourceOptions } from 'typeorm';
import { APP_GUARD } from '@nestjs/core';
import { FirebaseAuthGuard } from './auth/firebase-auth.guard';

type ConnectionCandidate = {
  label: string;
  options: DataSourceOptions;
};

const dbLogger = new Logger('DatabaseConfig');

const dbEntities = [
  Return,
  ReturnItem,
  DealerReturn,
  Dealer,
  Item,
  Invoice,
  InvoiceItem,
  UnusableItem,
  Gdn,
  GdnItem,
];

function readEnv(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

const isDemoEnvironment = readEnv(['APP_ENV']) === 'demo';

const defaultPoolMax = readEnv(['VERCEL']) ? 2 : 10;

const configuredPoolMax = Number.parseInt(
  readEnv(['DB_POOL_MAX']) ?? String(defaultPoolMax),
  10,
);

const dbExtra = {
  keepalives: 1,
  keepalives_idle: 30,
  max: Number.isNaN(configuredPoolMax) ? defaultPoolMax : configuredPoolMax,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
};

function getSslConfig(hostOrUrl: string | undefined): any {
  const dbSslEnv = readEnv(['DB_SSL'])?.trim().toLowerCase();
  if (dbSslEnv === 'true') {
    return { rejectUnauthorized: false };
  }
  if (dbSslEnv === 'false') {
    return false;
  }

  if (hostOrUrl) {
    const lower = hostOrUrl.toLowerCase();
    if (lower.includes('localhost') || lower.includes('127.0.0.1')) {
      return false;
    }
  }

  return { rejectUnauthorized: false };
}

function parsePort(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '5432', 10);
  return Number.isNaN(parsed) ? 5432 : parsed;
}

function getEnvTokens(): string[] {
  const nodeEnv = (readEnv(['NODE_ENV']) ?? 'development').toUpperCase();
  const aliases: Record<string, string[]> = {
    DEVELOPMENT: ['DEV'],
    PRODUCTION: ['PROD'],
    TEST: ['TST'],
  };

  return [nodeEnv, ...(aliases[nodeEnv] ?? [])];
}

function buildDbConnectionCandidates(
  baseOptions: DataSourceOptions,
): ConnectionCandidate[] {
  const envTokens = getEnvTokens();
  const candidates: ConnectionCandidate[] = [];
  const seen = new Set<string>();

  for (const token of envTokens) {
    for (const key of [`DATABASE_URL_${token}`]) {
      const url = readEnv([key]);
      if (!url || seen.has(`url:${url}`)) {
        continue;
      }

      seen.add(`url:${url}`);
      candidates.push({
        label: `${key}`,
        options: {
          ...(baseOptions as object),
          url,
          extra: {
            ...(baseOptions.extra as object),
            ssl: getSslConfig(url),
          },
        } as DataSourceOptions,
      });
    }
  }

  for (const key of ['DATABASE_URL']) {
    const url = readEnv([key]);
    if (!url || seen.has(`url:${url}`)) {
      continue;
    }

    seen.add(`url:${url}`);
    candidates.push({
      label: key,
      options: {
        ...(baseOptions as object),
        url,
        extra: {
          ...(baseOptions.extra as object),
          ssl: getSslConfig(url),
        },
      } as DataSourceOptions,
    });
  }

  for (const token of envTokens) {
    const host = readEnv([`DB_HOST_${token}`]);
    const username = readEnv([`DB_USERNAME_${token}`]);
    const password = readEnv([`DB_PASSWORD_${token}`]);
    const database = readEnv([`DB_DATABASE_${token}`]);
    const port = parsePort(readEnv([`DB_PORT_${token}`]));

    if (!host || !username || !database) {
      continue;
    }

    const signature = `conn:${host}:${port}:${username}:${database}:${password ?? ''}`;
    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    candidates.push({
      label: `DB_*_${token}`,
      options: {
        ...(baseOptions as object),
        host,
        port,
        username,
        password,
        database,
        extra: {
          ...(baseOptions.extra as object),
          ssl: getSslConfig(host),
        },
      } as DataSourceOptions,
    });
  }

  const host = readEnv(['DB_HOST']);
  const username = readEnv(['DB_USERNAME']);
  const password = readEnv(['DB_PASSWORD']);
  const database = readEnv(['DB_DATABASE']);
  const port = parsePort(readEnv(['DB_PORT']));

  if (host && username && database) {
    const signature = `conn:${host}:${port}:${username}:${database}:${password ?? ''}`;
    if (!seen.has(signature)) {
      candidates.push({
        label: 'DB_*',
        options: {
          ...(baseOptions as object),
          host,
          port,
          username,
          password,
          database,
          extra: {
            ...(baseOptions.extra as object),
            ssl: getSslConfig(host),
          },
        } as DataSourceOptions,
      });
    }
  }

  return candidates;
}

async function createDataSourceWithFallback(
  options: DataSourceOptions,
): Promise<DataSource> {
  const connectionCandidates = buildDbConnectionCandidates(options);
  if (connectionCandidates.length === 0) {
    throw new Error(
      'No database configuration found. Provide DATABASE_URL (optionally env-specific) or DB_HOST/DB_USERNAME/DB_DATABASE.',
    );
  }

  let lastError: unknown;

  for (const candidate of connectionCandidates) {
    try {
      const dataSource = new DataSource(candidate.options);
      await dataSource.initialize();
      dbLogger.log(`Connected to PostgreSQL using ${candidate.label}.`);
      return dataSource;
    } catch (error) {
      lastError = error;
      const message =
        error instanceof Error ? error.message : 'Unknown database error';
      dbLogger.warn(
        `Database connection failed for ${candidate.label}. Trying next fallback. ${message}`,
      );
    }
  }

  throw lastError;
}

const migrationPaths = [
  __dirname + '/migrations/schema/*{.ts,.js}',
  ...(isDemoEnvironment ? [__dirname + '/migrations/demo/*{.ts,.js}'] : []),
];

const isMigrationRunEnabled = readEnv(['RUN_MIGRATIONS']) === 'true';

function getTypeOrmBaseOptions(): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    autoLoadEntities: true,
    synchronize: false,
    extra: dbExtra,
    dropSchema: false,
    entities: dbEntities,
    migrations: migrationPaths,
    migrationsRun: isMigrationRunEnabled,
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => getTypeOrmBaseOptions(),
      dataSourceFactory: async (options) =>
        createDataSourceWithFallback(options as DataSourceOptions),
    }),
    InvoiceModule,
    DealerModule,
    ReturnsModule,
    GdnModule,
    ItemModule,
    StockOverviewModule,
    DataManagementModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: FirebaseAuthGuard,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
