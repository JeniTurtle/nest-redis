import {
  CacheModule,
  Global,
  Module,
  Provider,
  DynamicModule,
} from '@nestjs/common';
import { CacheConfigProvider } from './cache_config.provider';
import { CacheProvider } from './cache.provider';
import { CacheAsyncConfig } from './cache.interface';
import { CACHE_OPTION_PROVIDER } from './cache.constants';

function createCacheAsyncOptionsProvider(options: CacheAsyncConfig): Provider {
  return {
    provide: CACHE_OPTION_PROVIDER,
    useFactory: options.useFactory,
    inject: options.inject || [],
  };
}

class CacheConfigModule {
  static forRootAsync(options: CacheAsyncConfig): DynamicModule {
    const cacheOptionProvider = createCacheAsyncOptionsProvider(options);
    return {
      module: CacheConfigModule,
      providers: [cacheOptionProvider, CacheConfigProvider],
      exports: [cacheOptionProvider, CacheConfigProvider],
    };
  }
}

@Global()
@Module({})
export class RedisCacheModule {
  static forRootAsync(options: CacheAsyncConfig): DynamicModule {
    return {
      module: RedisCacheModule,
      imports: [
        CacheModule.registerAsync({
          imports: [CacheConfigModule.forRootAsync(options)],
          useClass: CacheConfigProvider,
          inject: [CACHE_OPTION_PROVIDER],
        }),
      ],
      providers: [CacheProvider],
      exports: [CacheProvider],
    };
  }
}
