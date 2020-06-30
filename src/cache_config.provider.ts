import * as redisStore from 'cache-manager-redis-store';
import { RetryStrategyOptions } from 'redis';
import {
  Inject,
  CacheModuleOptions,
  CacheOptionsFactory,
  Injectable,
  Logger,
  LoggerService,
} from '@nestjs/common';
import {
  RedisAttemptException,
  RedisConnectRefusedException,
  RedisRetryTimeUsedException,
} from './cache.exception';
import { CacheConfig } from './cache.interface';
import { CACHE_OPTION_PROVIDER } from './cache.constants';

@Injectable()
export class CacheConfigProvider implements CacheOptionsFactory {
  public logger: Logger | LoggerService;
  constructor(@Inject(CACHE_OPTION_PROVIDER) private options: CacheConfig) {
    this.logger = options.logger || new Logger(CacheConfigProvider.name);
    delete options.logger;
  }

  // 重试策略
  public retryStrategy(options: RetryStrategyOptions) {
    // @ts-ignore
    this.logger.error('Reids连接异常！', options.error);
    if (options.error.code === 'ECONNREFUSED') {
      return new RedisConnectRefusedException();
    }
    if (options.total_retry_time > 1000 * 60) {
      return new RedisRetryTimeUsedException();
    }
    if (options.attempt > 6) {
      return new RedisAttemptException();
    }
    return Math.min(options.attempt * 100, 3000);
  }

  // 缓存配置
  public createCacheOptions(): CacheModuleOptions {
    return {
      ...this.options,
      store: redisStore,
      is_cacheable_value: () => true,
      retry_strategy: this.retryStrategy.bind(this),
    };
  }
}
